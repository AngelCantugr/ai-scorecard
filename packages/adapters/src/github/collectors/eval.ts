import type { Octokit } from "@octokit/rest";
import type { SignalResult, Evidence } from "@ai-scorecard/core";
import type { RepoInfo } from "./repo-scan.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Known eval framework package names (npm / pip) whose presence in a
 * dependency manifest signals an automated evaluation practice.
 */
const EVAL_FRAMEWORK_DEPS = [
  // LangSmith
  "langsmith",
  // Braintrust
  "braintrust",
  // Arize Phoenix
  "arize-phoenix",
  "arize",
  "@arizeai/openinference-core",
  // OpenTelemetry GenAI semantic conventions
  "@opentelemetry/instrumentation-openai",
  "opentelemetry-instrumentation-openai",
  "opentelemetry-semantic-conventions-ai",
  // openai-evals / OpenAI Evals
  "openai-evals",
  "evals",
  // deepeval
  "deepeval",
  // promptfoo
  "promptfoo",
  // RAGAS
  "ragas",
  // trulens
  "trulens-eval",
  "trulens",
  // Promptlayer
  "promptlayer",
];

/**
 * Regex that matches any eval-framework identifier inside a manifest file.
 * Tested against the raw file content (package.json or pyproject.toml).
 */
const EVAL_DEP_PATTERN = new RegExp(
  EVAL_FRAMEWORK_DEPS.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "i"
);

/**
 * Eval CLI invocation patterns to look for in CI workflow YAML files.
 * These indicate that eval runs are wired into CI pipelines.
 */
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

/**
 * Directories whose presence indicates version-controlled eval datasets.
 */
const EVAL_DATASET_DIRS = ["evals", "eval", "tests/eval", "golden", "goldens"];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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
    const status =
      err !== null && typeof err === "object" && "status" in err
        ? (err as { status: number }).status
        : undefined;
    if (status === 404 || status === 403) return [];
    throw err;
  }
}

async function safeReadFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    if (!Array.isArray(data) && "content" in data && data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Q42 — Automated eval framework
// ---------------------------------------------------------------------------

/**
 * Q42 — Is there an automated evaluation framework to measure AI output quality?
 *
 * Score 0: No eval framework deps or CI eval steps found.
 * Score 1: Eval framework dep present in at least one repo, but no CI integration.
 * Score 2: Eval framework dep present AND at least one CI workflow runs the eval suite.
 */
export async function collectEvalFrameworkSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<SignalResult> {
  const reposWithDeps: string[] = [];
  const reposWithCIIntegration: string[] = [];
  const detectedFrameworks: string[] = [];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch);

    // 1. Check manifest files for eval framework deps
    const manifestPaths = paths.filter(
      (p) => p === "package.json" || p === "pyproject.toml" || p === "requirements.txt"
    );

    let foundDep = false;
    for (const manifestPath of manifestPaths) {
      const content = await safeReadFile(octokit, owner, repo.name, manifestPath);
      if (content && EVAL_DEP_PATTERN.test(content)) {
        foundDep = true;
        // Record which frameworks matched
        for (const dep of EVAL_FRAMEWORK_DEPS) {
          if (new RegExp(dep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(content)) {
            if (!detectedFrameworks.includes(dep)) detectedFrameworks.push(dep);
          }
        }
        break;
      }
    }

    if (foundDep) reposWithDeps.push(repo.fullName);

    // 2. Check CI workflows for eval invocations
    const workflowPaths = paths.filter(
      (p) => p.startsWith(".github/workflows/") && (p.endsWith(".yml") || p.endsWith(".yaml"))
    );

    let foundCIEval = false;
    for (const wfPath of workflowPaths) {
      const content = await safeReadFile(octokit, owner, repo.name, wfPath);
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
    signalId: "github:eval:q42-eval-framework",
    questionId: "D8-Q42",
    score,
    evidence,
    confidence: 0.75,
  };
}

// ---------------------------------------------------------------------------
// Q44 — Eval datasets in version control
// ---------------------------------------------------------------------------

/**
 * Q44 — Are evaluation datasets maintained in version control with clear ownership?
 *
 * Score 0: No eval dataset directories found.
 * Score 1: Eval dataset directories exist in at least one repo.
 * Score 2: Eval dataset directories found in 2+ repos (suggests org-wide practice).
 */
export async function collectEvalDatasetSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<SignalResult> {
  const reposWithDatasets: string[] = [];
  const datasetDirsByRepo: Record<string, string[]> = {};

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch);

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
    signalId: "github:eval:q44-eval-datasets",
    questionId: "D8-Q44",
    score,
    evidence,
    confidence: 0.7,
  };
}

// ---------------------------------------------------------------------------
// Q45 — Benchmark suite for model promotion
// ---------------------------------------------------------------------------

/**
 * Q45 — Is there a benchmark suite used to compare model versions before promotion?
 *
 * Score 0: No benchmark CI steps and no eval-related branch-protection status checks.
 * Score 1: Benchmark/eval CI steps exist but are not enforced as branch-protection gates.
 * Score 2: Eval status checks are referenced in branch-protection rules, indicating
 *          that model promotion is gated on benchmark results.
 */
export async function collectBenchmarkSuiteSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<SignalResult> {
  const reposWithBenchmarkCI: string[] = [];
  const reposWithBranchProtection: string[] = [];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const paths = await fetchRepoFilePaths(octokit, owner, repo.name, repo.defaultBranch);

    // 1. Check CI workflows for benchmark / eval invocations
    const workflowPaths = paths.filter(
      (p) => p.startsWith(".github/workflows/") && (p.endsWith(".yml") || p.endsWith(".yaml"))
    );

    let foundBenchmarkCI = false;
    for (const wfPath of workflowPaths) {
      const content = await safeReadFile(octokit, owner, repo.name, wfPath);
      if (content && EVAL_CI_PATTERNS.some((rx) => rx.test(content))) {
        foundBenchmarkCI = true;
        break;
      }
    }

    if (foundBenchmarkCI) reposWithBenchmarkCI.push(repo.fullName);

    // 2. Check branch-protection rules for eval status checks
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
    } catch {
      // Branch protection API may return 404 for repos without branch protection
      // or 403 when the token lacks admin access — both are non-fatal.
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
    signalId: "github:eval:q45-benchmark-suite",
    questionId: "D8-Q45",
    score,
    evidence,
    confidence: 0.65,
  };
}
