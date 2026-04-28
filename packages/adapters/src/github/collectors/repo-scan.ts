import type { Octokit } from "@octokit/rest";
import type { SignalResult, Evidence } from "@ai-scorecard/core";

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

/**
 * Safely fetch the tree of a repo at HEAD and return a flat list of file paths.
 */
async function fetchRepoFilePaths(
  octokit: Octokit,
  owner: string,
  repo: string,
  defaultBranch: string
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
    // Swallow expected HTTP errors (repo not accessible), re-throw unexpected errors
    const status =
      err !== null && typeof err === "object" && "status" in err
        ? (err as { status: number }).status
        : undefined;
    if (status === 404 || status === 403) {
      return [];
    }
    throw err;
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
): Promise<SignalResult> {
  const matchedRepos: string[] = [];

  for (const repo of repos) {
    const paths = await fetchRepoFilePaths(
      octokit,
      repo.fullName.split("/")[0] ?? "",
      repo.name,
      repo.defaultBranch
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
  if (matchedRepos.length === 1)
    score = 2; // Single dedicated repo = centralized
  else if (matchedRepos.length >= 2) score = 1; // Multiple repos = distributed, partial credit

  return {
    signalId: "github:repo-scan:q1-gateway",
    questionId: "D1-Q1",
    score,
    evidence,
    confidence: 0.7,
  };
}

/**
 * Q5 — Prompt/template management system
 * Score 0: no prompt dirs found
 * Score 1: prompt dirs exist in some repos
 * Score 2: prompt dirs in multiple repos (suggests org-wide practice)
 */
export async function collectPromptManagementSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<SignalResult> {
  const matchedRepos: string[] = [];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch);
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
    signalId: "github:repo-scan:q5-prompt-management",
    questionId: "D1-Q5",
    score,
    evidence,
    confidence: 0.5,
  };
}

/**
 * Q7 — AI steering files
 * Score 0: no steering files found
 * Score 1: some repos have steering files
 * Score 2: majority of repos have steering files
 */
export async function collectSteeringFilesSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<SignalResult> {
  const matchedRepos: string[] = [];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch);
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
    signalId: "github:repo-scan:q7-steering-files",
    questionId: "D2-Q7",
    score,
    evidence,
    confidence: 0.9,
  };
}

/**
 * Q8 — AI rules for linting/testing/debugging
 * Score 0: no steering files with content depth
 * Score 1: steering files exist but shallow
 * Score 2: steering files with comprehensive rules
 */
export async function collectAIRulesSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<SignalResult> {
  const comprehensiveRepos: string[] = [];
  const basicRepos: string[] = [];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch);

    // Only attempt getContent for files that actually exist in the repo tree
    const steeringCandidates = ["CLAUDE.md", ".cursorrules", "agents.md"].filter((sf) =>
      paths.some((p) => p === sf)
    );

    for (const steeringFile of steeringCandidates) {
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo: repo.name,
          path: steeringFile,
        });
        if (!Array.isArray(data) && "content" in data && data.content) {
          const content = Buffer.from(data.content, "base64").toString("utf-8");
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
      } catch {
        // ignore
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
    signalId: "github:repo-scan:q8-ai-rules",
    questionId: "D2-Q8",
    score,
    evidence,
    confidence: 0.5,
  };
}

/**
 * Q21 — Prompt security (prompts not in client code)
 * Score 0: prompts found in frontend/client directories
 * Score 1: no client-side prompt exposure detected, but no confirmed server-side management
 * Score 2: prompt directories found in server-side paths with no client exposure
 */
export async function collectPromptSecuritySignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<SignalResult> {
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
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch);

    const promptInClientCode = paths.some(
      (p) =>
        clientDirPatterns.some((dir) => p.startsWith(`${dir}/`)) &&
        /prompt|system[_-]?message/i.test(p)
    );

    if (promptInClientCode) {
      exposedRepos.push(repo.fullName);
      continue;
    }

    // Check for server-side prompt directories (confirms intentional server-side management)
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
    score = 2; // Confirmed server-side prompt management, no client exposure
  } else if (repos.length > 0) {
    score = 1; // No client exposure, but no confirmed server-side prompt dirs either
  }

  return {
    signalId: "github:repo-scan:q21-prompt-security",
    questionId: "D4-Q21",
    score,
    evidence,
    confidence: 0.4,
  };
}

/**
 * Q25 — Tracing (OpenTelemetry, Langfuse, etc.)
 */
export async function collectTracingSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<SignalResult> {
  const matchedRepos: string[] = [];
  const matchedFiles: string[] = [];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch);
    const tracingFiles = OBSERVABILITY_FILES.filter((of) =>
      paths.some((p) => p === of || p.endsWith(`/${of}`))
    );
    if (tracingFiles.length > 0) {
      matchedRepos.push(repo.fullName);
      matchedFiles.push(...tracingFiles.map((f) => `${repo.fullName}:${f}`));
    }

    // Also check package.json for observability deps
    const hasObsDep = paths.some((p) => p === "package.json");
    if (hasObsDep) {
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo: repo.name,
          path: "package.json",
        });
        if (!Array.isArray(data) && "content" in data && data.content) {
          const content = Buffer.from(data.content, "base64").toString("utf-8");
          if (
            /@opentelemetry|langfuse|langsmith|@datadog|newrelic/i.test(content) &&
            !matchedRepos.includes(repo.fullName)
          ) {
            matchedRepos.push(repo.fullName);
          }
        }
      } catch {
        // ignore
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
    signalId: "github:repo-scan:q25-tracing",
    questionId: "D5-Q25",
    score,
    evidence,
    confidence: 0.7,
  };
}

/**
 * Q31 — AI-friendly documentation (OpenAPI, JSDoc, TypeScript types)
 */
export async function collectDocumentationSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<SignalResult> {
  const openapiRepos: string[] = [];
  const typescriptRepos: string[] = [];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch);

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
    signalId: "github:repo-scan:q31-ai-friendly-docs",
    questionId: "D6-Q31",
    score,
    evidence,
    confidence: 0.6,
  };
}

/**
 * Q32 — Spec accuracy (OpenAPI validated in CI)
 */
export async function collectSpecAccuracySignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<SignalResult> {
  const specsFound: string[] = [];
  const specsValidatedInCI: string[] = [];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch);

    const hasSpec = OPENAPI_FILES.some((of) => paths.some((p) => p === of || p.endsWith(`/${of}`)));
    if (!hasSpec) continue;
    specsFound.push(repo.fullName);

    // Check if any GitHub Actions workflow references the spec
    const workflowPaths = paths.filter((p) => p.startsWith(".github/workflows/"));
    for (const wfPath of workflowPaths) {
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo: repo.name,
          path: wfPath,
        });
        if (!Array.isArray(data) && "content" in data && data.content) {
          const content = Buffer.from(data.content, "base64").toString("utf-8");
          if (/openapi|swagger|spectral|redoc|prism/i.test(content)) {
            specsValidatedInCI.push(repo.fullName);
            break;
          }
        }
      } catch {
        // ignore
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
    signalId: "github:repo-scan:q32-spec-accuracy",
    questionId: "D6-Q32",
    score,
    evidence,
    confidence: 0.7,
  };
}
