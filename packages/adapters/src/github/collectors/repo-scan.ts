import type { Octokit } from "@octokit/rest";
import type { SignalResult, Evidence } from "@ai-scorecard/core";
import {
  createCollectorContext,
  type CollectorContext,
  type CollectorOutcome,
} from "../collector-error.js";

/** Files that indicate an AI gateway is configured */
const GATEWAY_CONFIG_FILES = [
  "litellm.yaml",
  "litellm.yml",
  "litellm_config.yaml",
  "portkey.yaml",
  ".portkey",
  "helicone.yaml",
  "openrouter.yaml",
  "ai-gateway.yaml",
  "ai-gateway.yml",
];

/** Directories that suggest prompt/template management */
const PROMPT_DIRS = ["prompts", "templates", "prompt-templates", "llm-prompts"];

/** AI steering file names */
const STEERING_FILES = [
  "CLAUDE.md",
  "agents.md",
  "AGENTS.md",
  ".github/copilot-instructions.md",
  ".cursorrules",
  ".clinerules",
  "aider.conf.yml",
];

/** Observability config files */
const OBSERVABILITY_FILES = [
  "opentelemetry.yaml",
  "otel-config.yaml",
  "langfuse.yaml",
  "langsmith.yaml",
  ".langfuse",
  "datadog.yaml",
  "newrelic.yaml",
];

/** OpenAPI / spec file patterns */
const OPENAPI_FILES = [
  "openapi.yaml",
  "openapi.yml",
  "openapi.json",
  "swagger.yaml",
  "swagger.yml",
  "swagger.json",
  "api.yaml",
  "api.yml",
];

export interface RepoInfo {
  name: string;
  fullName: string;
  defaultBranch: string;
}

/** Pull a numeric `status` from a thrown value if present. */
function statusOf(err: unknown): number | undefined {
  if (err === null || typeof err !== "object") return undefined;
  const s = (err as { status?: unknown }).status;
  return typeof s === "number" ? s : undefined;
}

/**
 * Safely fetch the tree of a repo at HEAD and return a flat list of file paths.
 *
 * 404 is treated as an expected per-repo "no readable tree" outcome and is not
 * reported (a healthy run scanning private/empty repos sees many of these).
 * Auth (401/403), rate-limit (429), and unexpected errors are recorded on
 * `ctx` so the orchestrator can surface them.
 */
async function fetchRepoFilePaths(
  octokit: Octokit,
  owner: string,
  repo: string,
  defaultBranch: string,
  ctx: CollectorContext
): Promise<string[]> {
  try {
    const { data } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: defaultBranch,
      recursive: "1",
    });
    return data.tree
      .filter((item) => item.type === "blob")
      .map((item) => item.path ?? "")
      .filter(Boolean);
  } catch (err) {
    if (statusOf(err) === 404) return [];
    ctx.report(err);
    return [];
  }
}

/** Read a file's content; null on 404, reports other errors. */
async function safeReadFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ctx: CollectorContext
): Promise<string | null> {
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    if (!Array.isArray(data) && "content" in data && data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return null;
  } catch (err) {
    if (statusOf(err) === 404) return null;
    ctx.report(err);
    return null;
  }
}

/**
 * Q1 — Centralized AI gateway/proxy
 * Score 0: no gateway config found
 * Score 1: gateway config found in 2+ repos (distributed — each team has its own)
 * Score 2: gateway config found in exactly one dedicated repo (centralized)
 */
export async function collectGatewaySignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:repo-scan:q1-gateway");
  const matchedRepos: string[] = [];

  for (const repo of repos) {
    const paths = await fetchRepoFilePaths(
      octokit,
      repo.fullName.split("/")[0] ?? "",
      repo.name,
      repo.defaultBranch,
      ctx
    );
    const hasGateway = GATEWAY_CONFIG_FILES.some((gf) =>
      paths.some((p) => p === gf || p.endsWith(`/${gf}`))
    );
    if (hasGateway) {
      matchedRepos.push(repo.fullName);
    }
  }

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: { matchedRepos, totalRepos: repos.length },
      summary:
        matchedRepos.length === 0
          ? "No AI gateway config files found in any repo."
          : `Gateway config found in: ${matchedRepos.join(", ")}`,
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (matchedRepos.length === 1) score = 2;
  else if (matchedRepos.length >= 2) score = 1;

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D1-Q1",
      score,
      evidence,
      confidence: 0.7,
    },
    errors: ctx.errors(),
  };
}

/** Q5 — Prompt/template management system */
export async function collectPromptManagementSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:repo-scan:q5-prompt-management");
  const matchedRepos: string[] = [];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch, ctx);
    const hasPromptDir = PROMPT_DIRS.some((dir) =>
      paths.some((p) => p === dir || p.startsWith(`${dir}/`) || p.includes(`/${dir}/`))
    );
    if (hasPromptDir) {
      matchedRepos.push(repo.fullName);
    }
  }

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: { matchedRepos, totalRepos: repos.length },
      summary:
        matchedRepos.length === 0
          ? "No prompt template directories found."
          : `Prompt directories found in: ${matchedRepos.join(", ")}`,
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (matchedRepos.length >= 3) score = 2;
  else if (matchedRepos.length >= 1) score = 1;

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D1-Q5",
      score,
      evidence,
      confidence: 0.5,
    },
    errors: ctx.errors(),
  };
}

/** Q7 — AI steering files */
export async function collectSteeringFilesSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:repo-scan:q7-steering-files");
  const matchedRepos: string[] = [];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch, ctx);
    const hasSteeringFile = STEERING_FILES.some((sf) => paths.some((p) => p === sf));
    if (hasSteeringFile) {
      matchedRepos.push(repo.fullName);
    }
  }

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: {
        matchedRepos,
        totalRepos: repos.length,
        coveragePercent:
          repos.length > 0 ? Math.round((matchedRepos.length / repos.length) * 100) : 0,
      },
      summary:
        matchedRepos.length === 0
          ? "No AI steering files found (CLAUDE.md, agents.md, .cursorrules, etc.)."
          : `Steering files found in ${matchedRepos.length}/${repos.length} repos: ${matchedRepos.join(", ")}`,
    },
  ];

  const coverage = repos.length > 0 ? matchedRepos.length / repos.length : 0;
  let score: 0 | 1 | 2 = 0;
  if (coverage >= 0.5) score = 2;
  else if (coverage > 0) score = 1;

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D2-Q7",
      score,
      evidence,
      confidence: 0.9,
    },
    errors: ctx.errors(),
  };
}

/** Q8 — AI rules for linting/testing/debugging */
export async function collectAIRulesSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:repo-scan:q8-ai-rules");
  const comprehensiveRepos: string[] = [];
  const basicRepos: string[] = [];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch, ctx);

    const steeringCandidates = ["CLAUDE.md", ".cursorrules", "agents.md"].filter((sf) =>
      paths.some((p) => p === sf)
    );

    for (const steeringFile of steeringCandidates) {
      const content = await safeReadFile(octokit, owner, repo.name, steeringFile, ctx);
      if (content !== null) {
        const hasLintRules = /lint|eslint|prettier|format/i.test(content);
        const hasTestRules = /test|jest|vitest|spec|coverage/i.test(content);
        const hasDebugRules = /debug|breakpoint|log|trace/i.test(content);
        const ruleCount = [hasLintRules, hasTestRules, hasDebugRules].filter(Boolean).length;
        if (ruleCount >= 2) {
          comprehensiveRepos.push(repo.fullName);
        } else if (content.length > 200) {
          basicRepos.push(repo.fullName);
        }
        break;
      }
    }
  }

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: { comprehensiveRepos, basicRepos, totalRepos: repos.length },
      summary:
        comprehensiveRepos.length === 0 && basicRepos.length === 0
          ? "No AI rule files found with substantive content."
          : `Comprehensive rules in: ${comprehensiveRepos.join(", ")}. Basic rules in: ${basicRepos.join(", ")}`,
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (comprehensiveRepos.length >= 1) score = 2;
  else if (basicRepos.length >= 1) score = 1;

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D2-Q8",
      score,
      evidence,
      confidence: 0.5,
    },
    errors: ctx.errors(),
  };
}

/** Q21 — Prompt security (prompts not in client code) */
export async function collectPromptSecuritySignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:repo-scan:q21-prompt-security");
  const exposedRepos: string[] = [];
  const serverSidePromptRepos: string[] = [];
  const clientDirPatterns = [
    "src/client",
    "src/frontend",
    "src/app",
    "public",
    "static",
    "frontend",
  ];
  const serverPromptDirs = ["prompts", "templates", "prompt-templates", "llm-prompts"];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch, ctx);

    const promptInClientCode = paths.some(
      (p) =>
        clientDirPatterns.some((dir) => p.startsWith(`${dir}/`)) &&
        /prompt|system[_-]?message/i.test(p)
    );

    if (promptInClientCode) {
      exposedRepos.push(repo.fullName);
      continue;
    }

    const hasServerPromptDir = serverPromptDirs.some((dir) =>
      paths.some((p) => p === dir || p.startsWith(`${dir}/`))
    );
    if (hasServerPromptDir) {
      serverSidePromptRepos.push(repo.fullName);
    }
  }

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: { exposedRepos, serverSidePromptRepos, totalRepos: repos.length },
      summary:
        exposedRepos.length > 0
          ? `Potential prompt exposure in client code: ${exposedRepos.join(", ")}`
          : serverSidePromptRepos.length > 0
            ? `Server-side prompt dirs found in: ${serverSidePromptRepos.join(", ")}. No client exposure detected.`
            : "No prompt files detected in client-side code directories.",
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (exposedRepos.length > 0) {
    score = 0;
  } else if (serverSidePromptRepos.length > 0) {
    score = 2;
  } else if (repos.length > 0) {
    score = 1;
  }

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D4-Q21",
      score,
      evidence,
      confidence: 0.4,
    },
    errors: ctx.errors(),
  };
}

/** Q25 — Tracing (OpenTelemetry, Langfuse, etc.) */
export async function collectTracingSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:repo-scan:q25-tracing");
  const matchedRepos: string[] = [];
  const matchedFiles: string[] = [];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch, ctx);
    const tracingFiles = OBSERVABILITY_FILES.filter((of) =>
      paths.some((p) => p === of || p.endsWith(`/${of}`))
    );
    if (tracingFiles.length > 0) {
      matchedRepos.push(repo.fullName);
      matchedFiles.push(...tracingFiles.map((f) => `${repo.fullName}:${f}`));
    }

    const hasObsDep = paths.some((p) => p === "package.json");
    if (hasObsDep) {
      const content = await safeReadFile(octokit, owner, repo.name, "package.json", ctx);
      if (
        content !== null &&
        /@opentelemetry|langfuse|langsmith|@datadog|newrelic/i.test(content) &&
        !matchedRepos.includes(repo.fullName)
      ) {
        matchedRepos.push(repo.fullName);
      }
    }
  }

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: { matchedRepos, matchedFiles, totalRepos: repos.length },
      summary:
        matchedRepos.length === 0
          ? "No observability/tracing configs found."
          : `Tracing configs found in: ${matchedRepos.join(", ")}`,
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (matchedRepos.length >= 2) score = 2;
  else if (matchedRepos.length === 1) score = 1;

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D5-Q25",
      score,
      evidence,
      confidence: 0.7,
    },
    errors: ctx.errors(),
  };
}

/** Q31 — AI-friendly documentation (OpenAPI, JSDoc, TypeScript types) */
export async function collectDocumentationSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:repo-scan:q31-ai-friendly-docs");
  const openapiRepos: string[] = [];
  const typescriptRepos: string[] = [];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch, ctx);

    const hasOpenAPI = OPENAPI_FILES.some((of) =>
      paths.some((p) => p === of || p.endsWith(`/${of}`))
    );
    if (hasOpenAPI) openapiRepos.push(repo.fullName);

    const hasTypeScript = paths.some((p) => p.endsWith(".ts") || p.endsWith(".d.ts"));
    if (hasTypeScript) typescriptRepos.push(repo.fullName);
  }

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: {
        openapiRepos,
        typescriptRepos,
        totalRepos: repos.length,
      },
      summary: `OpenAPI specs in ${openapiRepos.length} repos, TypeScript in ${typescriptRepos.length} repos.`,
    },
  ];

  let score: 0 | 1 | 2 = 0;
  const hasStructuredDocs = openapiRepos.length > 0 || typescriptRepos.length >= 2;
  const hasComprehensiveDocs = openapiRepos.length >= 1 && typescriptRepos.length >= 1;
  if (hasComprehensiveDocs) score = 2;
  else if (hasStructuredDocs) score = 1;

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D6-Q31",
      score,
      evidence,
      confidence: 0.6,
    },
    errors: ctx.errors(),
  };
}

/** Q32 — Spec accuracy (OpenAPI validated in CI) */
export async function collectSpecAccuracySignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:repo-scan:q32-spec-accuracy");
  const specsFound: string[] = [];
  const specsValidatedInCI: string[] = [];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch, ctx);

    const hasSpec = OPENAPI_FILES.some((of) => paths.some((p) => p === of || p.endsWith(`/${of}`)));
    if (!hasSpec) continue;
    specsFound.push(repo.fullName);

    const workflowPaths = paths.filter((p) => p.startsWith(".github/workflows/"));
    for (const wfPath of workflowPaths) {
      const content = await safeReadFile(octokit, owner, repo.name, wfPath, ctx);
      if (content !== null && /openapi|swagger|spectral|redoc|prism/i.test(content)) {
        specsValidatedInCI.push(repo.fullName);
        break;
      }
    }
  }

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: { specsFound, specsValidatedInCI, totalRepos: repos.length },
      summary:
        specsFound.length === 0
          ? "No OpenAPI/Swagger specs found."
          : `Specs in ${specsFound.length} repos, CI-validated in ${specsValidatedInCI.length} repos.`,
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (specsValidatedInCI.length >= 1) score = 2;
  else if (specsFound.length >= 1) score = 1;

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D6-Q32",
      score,
      evidence,
      confidence: 0.7,
    },
    errors: ctx.errors(),
  };
}
