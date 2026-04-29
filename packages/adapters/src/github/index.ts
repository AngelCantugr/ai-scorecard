import { Octokit } from "@octokit/rest";
import type { Adapter, AdapterConfig, Signal, SignalResult } from "@ai-scorecard/core";
import type { GitHubAdapterConfig } from "./config.js";
import { classifyError, type CollectorError, type CollectorOutcome } from "./collector-error.js";
import {
  collectGatewaySignal,
  collectPromptManagementSignal,
  collectSteeringFilesSignal,
  collectAIRulesSignal,
  collectPromptSecuritySignal,
  collectTracingSignal,
  collectDocumentationSignal,
  collectSpecAccuracySignal,
  type RepoInfo,
} from "./collectors/repo-scan.js";
import {
  collectAgentTaskPercentSignal,
  collectAICodeReviewSignal,
  collectPRCycleTimeSignal,
  collectAIArtifactSDLCSignal,
  collectAIAttributionSignal,
} from "./collectors/pr-analytics.js";
import { collectPipelineScalingSignal, collectTestQualitySignal } from "./collectors/actions.js";
import { collectSecretsManagementSignal } from "./collectors/security.js";
import {
  collectAgentScopeSignal,
  collectStructuredOutputsSignal,
  collectComposableWorkflowsSignal,
  collectSessionLoggingSignal,
  collectHumanOversightSignal,
  collectVersionedInstructionsSignal,
} from "./collectors/agents.js";
import {
  collectEvalFrameworkSignal,
  collectEvalDatasetSignal,
  collectBenchmarkSuiteSignal,
} from "./collectors/eval.js";

const DEFAULT_MAX_REPOS = 50;

/** All signals this adapter can collect, one entry per question */
const GITHUB_SIGNALS: Signal[] = [
  {
    id: "github:repo-scan:q1-gateway",
    questionId: "D1-Q1",
    description: "Scan repos for AI gateway config files (litellm, portkey, helicone, etc.)",
  },
  {
    id: "github:security:q6-secrets-management",
    questionId: "D1-Q6",
    description: "Check for .env files in git, hardcoded API keys, secrets manager configs",
  },
  {
    id: "github:repo-scan:q5-prompt-management",
    questionId: "D1-Q5",
    description: "Scan for prompt template directories and version-controlled prompt files",
  },
  {
    id: "github:repo-scan:q7-steering-files",
    questionId: "D2-Q7",
    description: "Scan repos for AI steering files (CLAUDE.md, agents.md, .cursorrules, etc.)",
  },
  {
    id: "github:repo-scan:q8-ai-rules",
    questionId: "D2-Q8",
    description: "Analyze content depth of steering files for linting/testing/debugging rules",
  },
  {
    id: "github:pr-analytics:q13-agent-task-percent",
    questionId: "D2-Q13",
    description: "Look for AI-attributed commits and bot-authored PRs over last 30 days",
  },
  {
    id: "github:actions:q14-pipeline-scaling",
    questionId: "D3-Q14",
    description: "Analyze GitHub Actions run times, queue times, and failure rates",
  },
  {
    id: "github:pr-analytics:q16-ai-code-review",
    questionId: "D3-Q16",
    description: "Look for bot review comments (CodeRabbit, Copilot, etc.) on PRs",
  },
  {
    id: "github:actions:q17-test-quality",
    questionId: "D3-Q17",
    description: "Analyze test workflow results for flaky test re-runs",
  },
  {
    id: "github:pr-analytics:q18-pr-cycle-time",
    questionId: "D3-Q18",
    description: "Calculate median PR open-to-merge time over last 30 days",
  },
  {
    id: "github:pr-analytics:q20-ai-artifact-sdlc",
    questionId: "D4-Q20",
    description: "Check if AI config files have PR review history vs direct commits",
  },
  {
    id: "github:repo-scan:q21-prompt-security",
    questionId: "D4-Q21",
    description: "Scan for prompt files in client-side code directories",
  },
  {
    id: "github:pr-analytics:q23-ai-attribution",
    questionId: "D4-Q23",
    description: "Search commits for Co-authored-by AI attribution patterns",
  },
  {
    id: "github:repo-scan:q25-tracing",
    questionId: "D5-Q25",
    description: "Scan for observability configs (OpenTelemetry, Langfuse, Langsmith, Datadog)",
  },
  {
    id: "github:repo-scan:q31-ai-friendly-docs",
    questionId: "D6-Q31",
    description: "Scan for OpenAPI specs, JSDoc, TypeScript declarations",
  },
  {
    id: "github:repo-scan:q32-spec-accuracy",
    questionId: "D6-Q32",
    description: "Check if OpenAPI specs exist and are validated in CI",
  },
  {
    id: "github:repo-scan:q36-agent-scope",
    questionId: "D7-Q36",
    description: "Scan agent configs for permission scopes, RBAC definitions, sandbox configs",
  },
  {
    id: "github:repo-scan:q37-structured-outputs",
    questionId: "D7-Q37",
    description: "Scan for output schema definitions, Zod/JSON Schema validators in agent code",
  },
  {
    id: "github:repo-scan:q38-composable-workflows",
    questionId: "D7-Q38",
    description:
      "Scan for workflow orchestration configs, shared agent libraries, workflow definitions",
  },
  {
    id: "github:repo-scan:q39-session-logging",
    questionId: "D7-Q39",
    description: "Scan for hook configs (preToolUse/postToolUse), session log configs",
  },
  {
    id: "github:repo-scan:q40-human-oversight",
    questionId: "D7-Q40",
    description: "Scan for approval workflow configs, review gates in agent pipelines",
  },
  {
    id: "github:repo-scan:q41-versioned-instructions",
    questionId: "D7-Q41",
    description: "Check git history on agent instruction files, PR review patterns",
  },
  {
    id: "github:eval:q42-eval-framework",
    questionId: "D8-Q42",
    description:
      "Scan for eval framework deps (LangSmith, Braintrust, deepeval, etc.) and CI eval runs",
  },
  {
    id: "github:eval:q44-eval-datasets",
    questionId: "D8-Q44",
    description: "Scan repos for eval dataset directories (evals/, eval/, golden/, etc.)",
  },
  {
    id: "github:eval:q45-benchmark-suite",
    questionId: "D8-Q45",
    description:
      "Detect benchmark CI steps and branch-protection rules referencing eval status checks",
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true only for genuine rate-limit errors.
 * A 403 from an auth/permission failure should NOT be retried.
 */
function isRateLimitError(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;
  const e = err as {
    status?: number;
    message?: string;
    response?: { headers?: Record<string, string> };
  };

  if (e.status === 429) return true;

  if (e.status === 403) {
    const remaining = e.response?.headers?.["x-ratelimit-remaining"];
    if (remaining === "0") return true;
    if (typeof e.message === "string" && /rate.?limit|secondary rate/i.test(e.message)) return true;
  }

  return false;
}

/**
 * Wrap an async operation with exponential backoff on rate limit errors (429
 * or rate-limit 403). Auth/permission 403s are NOT retried — they fail
 * immediately.
 */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, baseDelayMs = 1000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      if (isRateLimitError(err)) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        await sleep(delayMs);
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

/** Result of a full GitHub adapter `collect()` invocation, with diagnostics. */
export interface GitHubCollectResult {
  /** One SignalResult per registered signal (length === signals.length). */
  results: SignalResult[];
  /** All errors recorded by collectors during the run, in order. */
  errors: CollectorError[];
}

/**
 * GitHub adapter — collects AI maturity signals from GitHub org repos, PRs,
 * and Actions.
 *
 * `collect()` returns `SignalResult[]` to satisfy the `Adapter` interface.
 * To also receive the typed `CollectorError[]` surfaced from individual
 * collectors (auth/rate-limit/not-found/unexpected), call
 * `collectWithDiagnostics()` instead — diagnostics are returned per-call
 * so concurrent invocations cannot stomp each other.
 */
export class GitHubAdapter implements Adapter {
  readonly name = "github";
  readonly signals: Signal[] = GITHUB_SIGNALS;

  private octokit: Octokit | null = null;
  private config: GitHubAdapterConfig | null = null;

  connect(config: AdapterConfig): Promise<void> {
    const ghConfig = config as GitHubAdapterConfig;
    this.config = ghConfig;
    this.octokit = new Octokit({
      auth: ghConfig.token,
    });
    return Promise.resolve();
  }

  async collect(): Promise<SignalResult[]> {
    const { results } = await this.collectWithDiagnostics();
    return results;
  }

  async collectWithDiagnostics(): Promise<GitHubCollectResult> {
    if (!this.octokit || !this.config) {
      throw new Error("GitHubAdapter: call connect() before collect()");
    }

    const repos = await this.fetchRepos();

    if (repos.length === 0) {
      return {
        results: this.signals.map((signal) => ({
          signalId: signal.id,
          questionId: signal.questionId,
          score: 0 as const,
          evidence: [
            {
              source: "github:repos",
              data: { totalRepos: 0 },
              summary: "No repositories found in org.",
            },
          ],
          confidence: 1.0,
        })),
        errors: [],
      };
    }

    const octokit = this.octokit;
    const results: SignalResult[] = [];
    const errors: CollectorError[] = [];

    /**
     * `outcome`-style runners return `CollectorOutcome<SignalResult>` (the
     * refactored collectors). `signal`-style runners still return a bare
     * `SignalResult` (legacy collectors not yet migrated, e.g. security.ts).
     * We adapt both shapes here.
     */
    type Pair =
      | { kind: "outcome"; signal: Signal; run: () => Promise<CollectorOutcome<SignalResult>> }
      | { kind: "signal"; signal: Signal; run: () => Promise<SignalResult> };

    const collectorPairs: Pair[] = [
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[0]!,
        run: () => withRetry(() => collectGatewaySignal(octokit, repos)),
      },
      {
        kind: "signal",
        signal: GITHUB_SIGNALS[1]!,
        run: () => withRetry(() => collectSecretsManagementSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[2]!,
        run: () => withRetry(() => collectPromptManagementSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[3]!,
        run: () => withRetry(() => collectSteeringFilesSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[4]!,
        run: () => withRetry(() => collectAIRulesSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[5]!,
        run: () => withRetry(() => collectAgentTaskPercentSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[6]!,
        run: () => withRetry(() => collectPipelineScalingSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[7]!,
        run: () => withRetry(() => collectAICodeReviewSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[8]!,
        run: () => withRetry(() => collectTestQualitySignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[9]!,
        run: () => withRetry(() => collectPRCycleTimeSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[10]!,
        run: () => withRetry(() => collectAIArtifactSDLCSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[11]!,
        run: () => withRetry(() => collectPromptSecuritySignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[12]!,
        run: () => withRetry(() => collectAIAttributionSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[13]!,
        run: () => withRetry(() => collectTracingSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[14]!,
        run: () => withRetry(() => collectDocumentationSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[15]!,
        run: () => withRetry(() => collectSpecAccuracySignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[16]!,
        run: () => withRetry(() => collectAgentScopeSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[17]!,
        run: () => withRetry(() => collectStructuredOutputsSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[18]!,
        run: () => withRetry(() => collectComposableWorkflowsSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[19]!,
        run: () => withRetry(() => collectSessionLoggingSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[20]!,
        run: () => withRetry(() => collectHumanOversightSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[21]!,
        run: () => withRetry(() => collectVersionedInstructionsSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[22]!,
        run: () => withRetry(() => collectEvalFrameworkSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[23]!,
        run: () => withRetry(() => collectEvalDatasetSignal(octokit, repos)),
      },
      {
        kind: "outcome",
        signal: GITHUB_SIGNALS[24]!,
        run: () => withRetry(() => collectBenchmarkSuiteSignal(octokit, repos)),
      },
    ];

    for (const pair of collectorPairs) {
      try {
        if (pair.kind === "outcome") {
          const outcome = await pair.run();
          results.push(outcome.result);
          errors.push(...outcome.errors);
        } else {
          results.push(await pair.run());
        }
      } catch (err) {
        // Collector threw before producing a result (typical: withRetry
        // exhausted attempts on a rate-limit, or an unhandled exception).
        // Classify the error and emit a zero-score fallback so the output
        // shape stays stable.
        const classified = classifyError(pair.signal.id, err);
        errors.push(classified);
        results.push({
          signalId: pair.signal.id,
          questionId: pair.signal.questionId,
          score: 0,
          evidence: [
            {
              source: "github:error",
              data: { error: classified.message, kind: classified.kind },
              summary: `Collector failed (${classified.kind}) — score unavailable.`,
            },
          ],
          confidence: 0,
        });
      }
    }

    return { results, errors };
  }

  /** Fetch repos for the org, respecting the maxRepos limit and optional allowlist. */
  private async fetchRepos(): Promise<RepoInfo[]> {
    if (!this.octokit || !this.config) return [];

    const { org, repos: repoAllowlist, maxRepos = DEFAULT_MAX_REPOS } = this.config;

    if (repoAllowlist && repoAllowlist.length > 0) {
      const repoInfos: RepoInfo[] = [];
      for (const repoName of repoAllowlist.slice(0, maxRepos)) {
        try {
          const { data } = await withRetry(() =>
            this.octokit!.repos.get({ owner: org, repo: repoName })
          );
          repoInfos.push({
            name: data.name,
            fullName: data.full_name,
            defaultBranch: data.default_branch,
          });
        } catch {
          console.warn(`GitHubAdapter: could not fetch repo ${org}/${repoName}`);
        }
      }
      return repoInfos;
    }

    const repoInfos: RepoInfo[] = [];
    let page = 1;
    while (repoInfos.length < maxRepos) {
      try {
        const { data } = await withRetry(() =>
          this.octokit!.repos.listForOrg({
            org,
            type: "all",
            per_page: Math.min(100, maxRepos - repoInfos.length),
            page,
            sort: "pushed",
            direction: "desc",
          })
        );
        if (data.length === 0) break;
        for (const repo of data) {
          repoInfos.push({
            name: repo.name,
            fullName: repo.full_name,
            defaultBranch: repo.default_branch ?? "main",
          });
        }
        if (data.length < 100) break;
        page++;
      } catch (err) {
        console.warn(`GitHubAdapter: could not list repos for org ${org}`, err);
        break;
      }
    }

    return repoInfos.slice(0, maxRepos);
  }
}
