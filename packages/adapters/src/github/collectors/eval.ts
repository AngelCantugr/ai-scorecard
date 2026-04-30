import type { Octokit } from "@octokit/rest";
import type { SignalResult, Evidence } from "@ai-scorecard/core";
import type { RepoInfo } from "./repo-scan.js";
import {
  createCollectorContext,
  type CollectorContext,
  type CollectorOutcome,
} from "../collector-error.js";

const EVAL_FRAMEWORK_DEPS = [
  "langsmith",
  "braintrust",
  "arize-phoenix",
  "arize",
  "@arizeai/openinference-core",
  "@opentelemetry/instrumentation-openai",
  "opentelemetry-instrumentation-openai",
  "opentelemetry-semantic-conventions-ai",
  "openai-evals",
  "evals",
  "deepeval",
  "promptfoo",
  "ragas",
  "trulens-eval",
  "trulens",
  "promptlayer",
];

const EVAL_DEP_PATTERN = new RegExp(
  EVAL_FRAMEWORK_DEPS.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "i"
);

const EVAL_CI_PATTERNS = [
  /langsmith/i,
  /braintrust\s+eval/i,
  /phoenix\s+eval/i,
  /openai\s+evals?/i,
  /deepeval\s+test/i,
  /promptfoo\s+eval/i,
  /ragas/i,
  /trulens/i,
  /run[_-]evals?/i,
  /pytest.*eval/i,
  /eval[_-]suite/i,
  /benchmark.*run/i,
  /run.*benchmark/i,
];

const EVAL_DATASET_DIRS = ["evals", "eval", "tests/eval", "golden", "goldens"];

function statusOf(err: unknown): number | undefined {
  if (err === null || typeof err !== "object") return undefined;
  const s = (err as { status?: unknown }).status;
  return typeof s === "number" ? s : undefined;
}

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

/** Q42 — Automated eval framework */
export async function collectEvalFrameworkSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:eval:q42-eval-framework");
  const reposWithDeps: string[] = [];
  const reposWithCIIntegration: string[] = [];
  const detectedFrameworks: string[] = [];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch, ctx);

    const manifestPaths = paths.filter(
      (p) => p === "package.json" || p === "pyproject.toml" || p === "requirements.txt"
    );

    let foundDep = false;
    for (const manifestPath of manifestPaths) {
      const content = await safeReadFile(octokit, owner, repo.name, manifestPath, ctx);
      if (content && EVAL_DEP_PATTERN.test(content)) {
        foundDep = true;
        for (const dep of EVAL_FRAMEWORK_DEPS) {
          if (new RegExp(dep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(content)) {
            if (!detectedFrameworks.includes(dep)) detectedFrameworks.push(dep);
          }
        }
        break;
      }
    }

    if (foundDep) reposWithDeps.push(repo.fullName);

    const workflowPaths = paths.filter(
      (p) => p.startsWith(".github/workflows/") && (p.endsWith(".yml") || p.endsWith(".yaml"))
    );

    let foundCIEval = false;
    for (const wfPath of workflowPaths) {
      const content = await safeReadFile(octokit, owner, repo.name, wfPath, ctx);
      if (content && EVAL_CI_PATTERNS.some((rx) => rx.test(content))) {
        foundCIEval = true;
        break;
      }
    }

    if (foundDep && foundCIEval) reposWithCIIntegration.push(repo.fullName);
  }

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: {
        reposWithDeps,
        reposWithCIIntegration,
        detectedFrameworks,
        totalRepos: repos.length,
      },
      summary:
        reposWithDeps.length === 0
          ? "No eval framework dependencies found in any repo."
          : reposWithCIIntegration.length > 0
            ? `Eval framework with CI integration found in: ${reposWithCIIntegration.join(", ")} (frameworks: ${detectedFrameworks.join(", ")})`
            : `Eval framework deps found in: ${reposWithDeps.join(", ")} but no CI eval integration detected.`,
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (reposWithCIIntegration.length >= 1) score = 2;
  else if (reposWithDeps.length >= 1) score = 1;

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D8-Q42",
      score,
      evidence,
      confidence: 0.75,
    },
    errors: ctx.errors(),
  };
}

/** Q44 — Eval datasets in version control */
export async function collectEvalDatasetSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:eval:q44-eval-datasets");
  const reposWithDatasets: string[] = [];
  const datasetDirsByRepo: Record<string, string[]> = {};

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch, ctx);

    const foundDirs = EVAL_DATASET_DIRS.filter((dir) =>
      paths.some((p) => p === dir || p.startsWith(`${dir}/`))
    );

    if (foundDirs.length > 0) {
      reposWithDatasets.push(repo.fullName);
      datasetDirsByRepo[repo.fullName] = foundDirs;
    }
  }

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: { reposWithDatasets, datasetDirsByRepo, totalRepos: repos.length },
      summary:
        reposWithDatasets.length === 0
          ? "No eval dataset directories found in any repo."
          : `Eval dataset directories found in: ${reposWithDatasets.join(", ")} (dirs: ${Object.values(datasetDirsByRepo).flat().join(", ")})`,
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (reposWithDatasets.length >= 2) score = 2;
  else if (reposWithDatasets.length === 1) score = 1;

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D8-Q44",
      score,
      evidence,
      confidence: 0.7,
    },
    errors: ctx.errors(),
  };
}

/** Q45 — Benchmark suite for model promotion */
export async function collectBenchmarkSuiteSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:eval:q45-benchmark-suite");
  const reposWithBenchmarkCI: string[] = [];
  const reposWithBranchProtection: string[] = [];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch, ctx);

    const workflowPaths = paths.filter(
      (p) => p.startsWith(".github/workflows/") && (p.endsWith(".yml") || p.endsWith(".yaml"))
    );

    let foundBenchmarkCI = false;
    for (const wfPath of workflowPaths) {
      const content = await safeReadFile(octokit, owner, repo.name, wfPath, ctx);
      if (content && EVAL_CI_PATTERNS.some((rx) => rx.test(content))) {
        foundBenchmarkCI = true;
        break;
      }
    }

    if (foundBenchmarkCI) reposWithBenchmarkCI.push(repo.fullName);

    // 404 (no protection rules) and 403 (token lacks admin) are both expected
    // outcomes of probing branch protection on every repo — neither indicates
    // a misconfigured run, so we don't surface them.
    try {
      const { data: branch } = await octokit.repos.getBranch({
        owner,
        repo: repo.name,
        branch: repo.defaultBranch,
      });

      const requiredChecks = branch.protection?.required_status_checks?.contexts ?? [];

      const hasEvalCheck = requiredChecks.some((check: string) =>
        /eval|benchmark|quality-gate/i.test(check)
      );

      if (hasEvalCheck) reposWithBranchProtection.push(repo.fullName);
    } catch (err) {
      const status = statusOf(err);
      if (status !== 404 && status !== 403) ctx.report(err);
    }
  }

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: {
        reposWithBenchmarkCI,
        reposWithBranchProtection,
        totalRepos: repos.length,
      },
      summary:
        reposWithBenchmarkCI.length === 0
          ? "No benchmark or eval CI steps found."
          : reposWithBranchProtection.length > 0
            ? `Eval branch-protection gates found in: ${reposWithBranchProtection.join(", ")}`
            : `Benchmark CI steps found in: ${reposWithBenchmarkCI.join(", ")} but not enforced as branch-protection gates.`,
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (reposWithBranchProtection.length >= 1) score = 2;
  else if (reposWithBenchmarkCI.length >= 1) score = 1;

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D8-Q45",
      score,
      evidence,
      confidence: 0.65,
    },
    errors: ctx.errors(),
  };
}
