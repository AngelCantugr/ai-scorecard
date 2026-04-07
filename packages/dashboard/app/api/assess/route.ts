import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { computeScorecard } from "@ai-scorecard/core";
import { GitHubAdapter, AIInferenceEngine } from "@ai-scorecard/adapters";
import type { GitHubAdapterConfig } from "@ai-scorecard/adapters";
import type { AIInferenceConfig, ContentBundle } from "@ai-scorecard/adapters";
import type { SignalResult } from "@ai-scorecard/core";

/** Maximum time (ms) for an assessment before we give up. */
const ASSESSMENT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/** Key AI-related file paths to fetch for AI inference content bundles */
const AI_CONTENT_FILES = [
  "CLAUDE.md",
  "agents.md",
  "AGENTS.md",
  ".cursorrules",
  ".clinerules",
  "aider.conf.yml",
  ".github/copilot-instructions.md",
  "litellm.yaml",
  "litellm.yml",
  "opentelemetry.yaml",
  "openapi.yaml",
  "openapi.yml",
  "openapi.json",
  "README.md",
];

interface AssessRequestBody {
  org: string;
  token: string;
  repos?: string[];
  enableAI?: boolean;
  anthropicKey?: string;
  maxRepos?: number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: AssessRequestBody;
  try {
    body = (await req.json()) as AssessRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  const { org, token, repos, enableAI, anthropicKey, maxRepos } = body;

  if (!org || typeof org !== "string" || org.trim() === "") {
    return NextResponse.json(
      { error: "Missing required field: org" },
      { status: 400 }
    );
  }

  if (!token || typeof token !== "string" || token.trim() === "") {
    return NextResponse.json(
      { error: "Missing required field: token" },
      { status: 400 }
    );
  }

  if (repos !== undefined && !Array.isArray(repos)) {
    return NextResponse.json(
      { error: "Field 'repos' must be an array of strings." },
      { status: 400 }
    );
  }

  if (
    repos !== undefined &&
    !repos.every((r) => typeof r === "string" && r.trim() !== "")
  ) {
    return NextResponse.json(
      { error: "Each entry in 'repos' must be a non-empty string." },
      { status: 400 }
    );
  }

  if (enableAI && (!anthropicKey || anthropicKey.trim() === "")) {
    return NextResponse.json(
      { error: "anthropicKey is required when enableAI is true." },
      { status: 400 }
    );
  }

  const rawMaxRepos = Number(maxRepos ?? 50);
  if (!Number.isFinite(rawMaxRepos) || !Number.isInteger(rawMaxRepos)) {
    return NextResponse.json(
      { error: "Field 'maxRepos' must be an integer." },
      { status: 400 }
    );
  }
  const clampedMaxRepos = Math.max(1, Math.min(500, rawMaxRepos));

  // AbortController so we can cancel in-flight fetch calls when the timeout fires
  const controller = new AbortController();

  const assessmentPromise = runAssessment({
    org: org.trim(),
    token: token.trim(),
    repos: repos ?? [],
    enableAI: enableAI ?? false,
    anthropicKey: anthropicKey?.trim() ?? "",
    maxRepos: clampedMaxRepos,
    signal: controller.signal,
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => {
      controller.abort();
      reject(new Error("Assessment timed out after 5 minutes."));
    }, ASSESSMENT_TIMEOUT_MS)
  );

  try {
    const result = await Promise.race([assessmentPromise, timeoutPromise]);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Assessment failed.";
    const isTimeout = message.includes("timed out");
    return NextResponse.json(
      { error: message },
      { status: isTimeout ? 504 : 500 }
    );
  }
}

interface RunOptions {
  org: string;
  token: string;
  repos: string[];
  enableAI: boolean;
  anthropicKey: string;
  maxRepos: number;
  signal: AbortSignal;
}

async function runAssessment(opts: RunOptions) {
  const { org, token, repos, enableAI, anthropicKey, maxRepos, signal } = opts;

  // 1. Set up GitHub adapter and collect signals
  const githubConfig: GitHubAdapterConfig = {
    token,
    org,
    maxRepos,
    ...(repos.length > 0 ? { repos } : {}),
  };

  const githubAdapter = new GitHubAdapter();
  await githubAdapter.connect(githubConfig);
  const githubSignals = await githubAdapter.collect();

  // 2. Optionally run AI inference
  let aiSignals: SignalResult[] = [];
  let aiSucceeded = false;
  if (enableAI && anthropicKey) {
    try {
      const bundle = await buildContentBundle(
        token,
        org,
        repos.length > 0 ? repos : undefined,
        maxRepos,
        signal
      );
      const aiConfig: AIInferenceConfig = {
        provider: "anthropic",
        apiKey: anthropicKey,
      };
      const aiEngine = new AIInferenceEngine(aiConfig);
      aiSignals = await aiEngine.analyze(bundle);
      aiSucceeded = true;
    } catch (err) {
      // AI inference failure is non-fatal; continue without AI signals
      console.warn("AI inference failed, continuing without AI signals:", err);
    }
  }

  // 3. Compute scorecard from all collected signals
  const allSignals = [...githubSignals, ...aiSignals];
  const result = computeScorecard(allSignals, {
    adapterName: aiSucceeded ? "github+ai" : "github",
    target: org,
  });

  return result;
}

interface GitHubRepo {
  name: string;
}

interface GitHubFileContent {
  type: string;
  content?: string;
  encoding?: string;
}

/** Maximum repos sampled for AI content bundles — keeps prompt size bounded. */
const AI_BUNDLE_REPO_CAP = 5;

/**
 * Build a content bundle by fetching key AI-related files from the org's repos
 * using the GitHub REST API directly via fetch.
 * Samples up to AI_BUNDLE_REPO_CAP repos to keep the bundle size bounded.
 * When the caller supplied more repos than the cap, the excess are noted in
 * the bundle metadata so consumers can surface a warning.
 */
async function buildContentBundle(
  token: string,
  org: string,
  allowedRepos: string[] | undefined,
  maxRepos: number,
  signal: AbortSignal
): Promise<ContentBundle> {
  const files: Array<{ path: string; content: string }> = [];
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // Determine which repos to fetch content from
  let repoNames: string[] = [];
  let truncatedRepos: string[] = [];
  if (allowedRepos && allowedRepos.length > 0) {
    repoNames = allowedRepos.slice(0, AI_BUNDLE_REPO_CAP);
    truncatedRepos = allowedRepos.slice(AI_BUNDLE_REPO_CAP);
  } else {
    try {
      const limit = Math.min(AI_BUNDLE_REPO_CAP, maxRepos);
      const res = await fetch(
        `https://api.github.com/orgs/${encodeURIComponent(org)}/repos?sort=pushed&direction=desc&per_page=${limit}&type=all`,
        { headers, signal }
      );
      if (res.ok) {
        const data = (await res.json()) as GitHubRepo[];
        repoNames = data.map((r) => r.name);
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") throw err;
      // Other errors during repo discovery are non-fatal
    }
  }

  // Fetch key files from each repo
  for (const repoName of repoNames) {
    for (const filePath of AI_CONTENT_FILES) {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(org)}/${encodeURIComponent(repoName)}/contents/${filePath}`,
          { headers, signal }
        );
        if (res.ok) {
          const data = (await res.json()) as GitHubFileContent;
          if (
            data.type === "file" &&
            data.content &&
            data.encoding === "base64"
          ) {
            const content = Buffer.from(
              data.content.replace(/\n/g, ""),
              "base64"
            ).toString("utf-8");
            files.push({ path: `${repoName}/${filePath}`, content });
          }
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") throw err;
        // File doesn't exist in this repo — skip
      }
    }
  }

  return {
    source: `github:${org}`,
    files,
    metadata: {
      org,
      repoNames,
      ...(truncatedRepos.length > 0 ? { truncatedRepos } : {}),
    },
  };
}
