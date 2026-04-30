import type { Octokit } from "@octokit/rest";
import type { SignalResult, Evidence } from "@ai-scorecard/core";
import type { RepoInfo } from "./repo-scan.js";
import {
  createCollectorContext,
  type CollectorContext,
  type CollectorOutcome,
} from "../collector-error.js";

/** Agent configuration directory names to scan */
const AGENT_DIRS = [".github/agents", ".claude/agents", "agents"];

/** MCP server config file names */
const MCP_CONFIG_FILES = [
  ".mcp.json",
  "mcp.json",
  "mcp-config.json",
  ".claude.json",
  "claude_desktop_config.json",
];

/** Agent registry/catalog file names */
const AGENT_REGISTRY_FILES = ["agents.yaml", "agents.yml"];

/** Hook configuration directory names */
const HOOK_DIRS = [".github/hooks", ".claude/hooks"];

function statusOf(err: unknown): number | undefined {
  if (err === null || typeof err !== "object") return undefined;
  const s = (err as { status?: unknown }).status;
  return typeof s === "number" ? s : undefined;
}

/** Fetch repo file paths; 404 silent, other errors reported. */
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

/** Read file content; null on 404, reports other errors. */
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

/** Q36 — Agent scope/permissions */
export async function collectAgentScopeSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:repo-scan:q36-agent-scope");
  const reposWithAgentDirs: string[] = [];
  const reposWithScopeDefinitions: string[] = [];

  const scopeKeywords = /allowedTools|tools|permissions|scope|sandboxed/i;

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch, ctx);

    const agentFiles = paths.filter(
      (p) =>
        AGENT_DIRS.some((dir) => p === dir || p.startsWith(`${dir}/`)) ||
        p === ".devcontainer/devcontainer.json" ||
        p === "devcontainer.json" ||
        p.startsWith(".devcontainer/")
    );

    if (agentFiles.length === 0) continue;
    reposWithAgentDirs.push(repo.fullName);

    let foundScope = false;
    for (const filePath of agentFiles) {
      const content = await safeReadFile(octokit, owner, repo.name, filePath, ctx);
      if (content && scopeKeywords.test(content)) {
        foundScope = true;
        break;
      }
    }

    if (foundScope) {
      reposWithScopeDefinitions.push(repo.fullName);
    }
  }

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: { reposWithAgentDirs, reposWithScopeDefinitions, totalRepos: repos.length },
      summary:
        reposWithAgentDirs.length === 0
          ? "No agent directories found in any repo."
          : reposWithScopeDefinitions.length > 0
            ? `Agent scope definitions found in: ${reposWithScopeDefinitions.join(", ")}`
            : `Agent dirs found in ${reposWithAgentDirs.join(", ")} but no explicit scope definitions.`,
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (reposWithScopeDefinitions.length >= 1) score = 2;
  else if (reposWithAgentDirs.length >= 1) score = 1;

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D7-Q36",
      score,
      evidence,
      confidence: 0.7,
    },
    errors: ctx.errors(),
  };
}

/** Q37 — Structured outputs */
export async function collectStructuredOutputsSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:repo-scan:q37-structured-outputs");
  const reposWithSchemas: string[] = [];

  const schemaKeywords = /outputSchema|output_schema|response_format|\.schema\.json/i;
  const validatorImports = /zod|z\.object|z\.string|JSONSchema|ajv|yup/i;

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch, ctx);

    const agentFiles = paths.filter(
      (p) =>
        AGENT_DIRS.some((dir) => p === dir || p.startsWith(`${dir}/`)) || p.endsWith(".schema.json")
    );

    let foundSchema = false;

    for (const filePath of agentFiles) {
      const content = await safeReadFile(octokit, owner, repo.name, filePath, ctx);
      if (content && (schemaKeywords.test(content) || validatorImports.test(content))) {
        foundSchema = true;
        break;
      }
    }

    if (!foundSchema) {
      const agentAdjacentFiles = paths.filter(
        (p) =>
          AGENT_DIRS.some((dir) => p.startsWith(`${dir}/`)) &&
          (p.endsWith(".ts") || p.endsWith(".js"))
      );
      for (const filePath of agentAdjacentFiles.slice(0, 5)) {
        const content = await safeReadFile(octokit, owner, repo.name, filePath, ctx);
        if (content && validatorImports.test(content)) {
          foundSchema = true;
          break;
        }
      }
    }

    if (foundSchema) {
      reposWithSchemas.push(repo.fullName);
    }
  }

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: { reposWithSchemas, totalRepos: repos.length },
      summary:
        reposWithSchemas.length === 0
          ? "No output schema definitions found in agent files."
          : `Output schema definitions found in: ${reposWithSchemas.join(", ")}`,
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (reposWithSchemas.length >= 2) score = 2;
  else if (reposWithSchemas.length === 1) score = 1;

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D7-Q37",
      score,
      evidence,
      confidence: 0.5,
    },
    errors: ctx.errors(),
  };
}

/** Q38 — Composable workflows */
export async function collectComposableWorkflowsSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:repo-scan:q38-composable-workflows");
  const reposWithComposition: string[] = [];
  const signalsByRepo: Record<string, string[]> = {};

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch, ctx);
    const signals: string[] = [];

    if (paths.some((p) => p === ".github/workflows/copilot-setup-steps.yml")) {
      signals.push("copilot-setup-steps");
    }

    if (
      AGENT_REGISTRY_FILES.some((f) => paths.some((p) => p === f || p.endsWith(`/${f}`))) ||
      paths.some((p) => p === ".github/agents" || p.startsWith(".github/agents/"))
    ) {
      signals.push("agent-registry");
    }

    if (MCP_CONFIG_FILES.some((f) => paths.some((p) => p === f || p.endsWith(`/${f}`)))) {
      signals.push("mcp-config");
    }

    if (signals.length > 0) {
      reposWithComposition.push(repo.fullName);
      signalsByRepo[repo.fullName] = signals;
    }
  }

  const totalSignals = Object.values(signalsByRepo).reduce((acc, s) => acc + s.length, 0);

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: { reposWithComposition, signalsByRepo, totalRepos: repos.length },
      summary:
        reposWithComposition.length === 0
          ? "No workflow composition evidence found."
          : `Composable workflow signals found in: ${reposWithComposition.join(", ")}`,
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (reposWithComposition.length >= 2 || totalSignals >= 2) score = 2;
  else if (reposWithComposition.length === 1) score = 1;

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D7-Q38",
      score,
      evidence,
      confidence: 0.6,
    },
    errors: ctx.errors(),
  };
}

/** Q39 — Session logging / reproducible traces */
export async function collectSessionLoggingSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:repo-scan:q39-session-logging");
  const reposWithHooks: string[] = [];
  const reposWithFullHooks: string[] = [];

  const hookKeywords = /hooks|logging|sessionLog/i;

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch, ctx);

    const hookConfigFiles = paths.filter((p) =>
      HOOK_DIRS.some((dir) => p.startsWith(`${dir}/`) && p.endsWith(".json"))
    );

    const agentFiles = paths.filter((p) =>
      AGENT_DIRS.some((dir) => p === dir || p.startsWith(`${dir}/`))
    );

    let foundHooks = hookConfigFiles.length > 0;
    let foundFullHooks = false;

    for (const filePath of hookConfigFiles) {
      const content = await safeReadFile(octokit, owner, repo.name, filePath, ctx);
      if (content) {
        const hasPreToolUse = /preToolUse/i.test(content);
        const hasPostToolUse = /postToolUse/i.test(content);
        if (hasPreToolUse && hasPostToolUse) {
          foundFullHooks = true;
          break;
        }
      }
    }

    if (!foundHooks) {
      for (const filePath of agentFiles) {
        const content = await safeReadFile(octokit, owner, repo.name, filePath, ctx);
        if (content && hookKeywords.test(content)) {
          foundHooks = true;
          break;
        }
      }
    }

    if (foundFullHooks) {
      reposWithFullHooks.push(repo.fullName);
      reposWithHooks.push(repo.fullName);
    } else if (foundHooks) {
      reposWithHooks.push(repo.fullName);
    }
  }

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: { reposWithHooks, reposWithFullHooks, totalRepos: repos.length },
      summary:
        reposWithHooks.length === 0
          ? "No hook/logging configs found."
          : reposWithFullHooks.length > 0
            ? `Full hook configs (preToolUse+postToolUse) found in: ${reposWithFullHooks.join(", ")}`
            : `Hook config files found in: ${reposWithHooks.join(", ")} but no preToolUse/postToolUse entries.`,
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (reposWithFullHooks.length >= 1) score = 2;
  else if (reposWithHooks.length >= 1) score = 1;

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D7-Q39",
      score,
      evidence,
      confidence: 0.65,
    },
    errors: ctx.errors(),
  };
}

/** Q40 — Human-in-the-loop approval */
export async function collectHumanOversightSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:repo-scan:q40-human-oversight");
  const reposWithApproval: string[] = [];
  const reposWithFormalApproval: string[] = [];

  const approvalKeywords = /stop|confirm|approve|human|review/i;
  const environmentGatePattern = /environment\s*:/i;

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch, ctx);

    const hookConfigFiles = paths.filter((p) =>
      HOOK_DIRS.some((dir) => p.startsWith(`${dir}/`) && p.endsWith(".json"))
    );

    let foundApproval = false;
    let foundFormalApproval = false;

    for (const filePath of hookConfigFiles) {
      const content = await safeReadFile(octokit, owner, repo.name, filePath, ctx);
      if (content) {
        const hasPreToolUse = /preToolUse/i.test(content);
        if (hasPreToolUse && approvalKeywords.test(content)) {
          foundFormalApproval = true;
          foundApproval = true;
          break;
        }
        if (/postToolUse/i.test(content)) {
          foundApproval = true;
        }
      }
    }

    if (!foundFormalApproval) {
      const workflowPaths = paths.filter(
        (p) => p.startsWith(".github/workflows/") && (p.endsWith(".yml") || p.endsWith(".yaml"))
      );
      for (const wfPath of workflowPaths) {
        const content = await safeReadFile(octokit, owner, repo.name, wfPath, ctx);
        if (content && environmentGatePattern.test(content)) {
          foundFormalApproval = true;
          foundApproval = true;
          break;
        }
      }
    }

    if (foundFormalApproval) {
      reposWithFormalApproval.push(repo.fullName);
      if (!reposWithApproval.includes(repo.fullName)) {
        reposWithApproval.push(repo.fullName);
      }
    } else if (foundApproval) {
      reposWithApproval.push(repo.fullName);
    }
  }

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: { reposWithApproval, reposWithFormalApproval, totalRepos: repos.length },
      summary:
        reposWithApproval.length === 0
          ? "No approval gates found in hook configs or workflows."
          : reposWithFormalApproval.length > 0
            ? `Formal approval gates found in: ${reposWithFormalApproval.join(", ")}`
            : `Informal approval hooks found in: ${reposWithApproval.join(", ")}`,
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (reposWithFormalApproval.length >= 1) score = 2;
  else if (reposWithApproval.length >= 1) score = 1;

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D7-Q40",
      score,
      evidence,
      confidence: 0.6,
    },
    errors: ctx.errors(),
  };
}

/** Q41 — Versioned & reviewed instructions */
export async function collectVersionedInstructionsSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:repo-scan:q41-versioned-instructions");
  const reposWithInstructions: string[] = [];
  const reposWithPRReview: string[] = [];

  const instructionFilePattern = /\.(md|txt|yaml|yml|json)$/i;
  const agentInstructionDirs = [".github/agents", ".claude/agents", "agents"];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch, ctx);

    const instructionFiles = paths.filter(
      (p) =>
        agentInstructionDirs.some((dir) => p.startsWith(`${dir}/`)) &&
        instructionFilePattern.test(p)
    );

    if (instructionFiles.length === 0) continue;
    reposWithInstructions.push(repo.fullName);

    let prs: Awaited<ReturnType<Octokit["pulls"]["list"]>>["data"] = [];
    try {
      const { data } = await octokit.pulls.list({
        owner,
        repo: repo.name,
        state: "closed",
        sort: "updated",
        direction: "desc",
        per_page: 30,
      });
      prs = data;
    } catch (err) {
      if (statusOf(err) !== 404) ctx.report(err);
      continue;
    }

    const recentMergedPRs = prs.filter(
      (pr) => pr.merged_at !== null && pr.merged_at !== undefined && pr.merged_at >= thirtyDaysAgo
    );

    let foundPRReview = false;
    for (const pr of recentMergedPRs) {
      try {
        const { data: prFiles } = await octokit.pulls.listFiles({
          owner,
          repo: repo.name,
          pull_number: pr.number,
        });
        const touchesInstructionFiles = prFiles.some((f) =>
          instructionFiles.some((instr) => f.filename === instr)
        );
        if (touchesInstructionFiles) {
          foundPRReview = true;
          break;
        }
      } catch (err) {
        if (statusOf(err) !== 404) ctx.report(err);
      }
    }

    if (foundPRReview) {
      reposWithPRReview.push(repo.fullName);
    }
  }

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: { reposWithInstructions, reposWithPRReview, totalRepos: repos.length },
      summary:
        reposWithInstructions.length === 0
          ? "No agent instruction files found."
          : reposWithPRReview.length > 0
            ? `Agent instructions reviewed via PRs in: ${reposWithPRReview.join(", ")}`
            : `Agent instruction files found in: ${reposWithInstructions.join(", ")} but no PR review evidence.`,
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (reposWithPRReview.length >= 1) score = 2;
  else if (reposWithInstructions.length >= 1) score = 1;

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D7-Q41",
      score,
      evidence,
      confidence: 0.7,
    },
    errors: ctx.errors(),
  };
}
