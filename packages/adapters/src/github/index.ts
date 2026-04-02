import { Octokit } from "@octokit/rest";
import type { Adapter, AdapterConfig, Signal, SignalResult } from "@ai-scorecard/core";
import type { GitHubAdapterConfig } from "./config.js";
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
];

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap an async operation with exponential backoff on rate limit errors (429/403).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status =
        err !== null &&
        typeof err === "object" &&
        "status" in err
          ? (err as { status: number }).status
          : undefined;

      if (status === 429 || status === 403) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        await sleep(delayMs);
      } else {
        // Don't retry on other errors
        throw err;
      }
    }
  }
  throw lastError;
}

/**
 * GitHub adapter — collects AI maturity signals from GitHub org repos, PRs, and Actions.
 */
export class GitHubAdapter implements Adapter {
  readonly name = "github";
  readonly signals: Signal[] = GITHUB_SIGNALS;

  private octokit: Octokit | null = null;
  private config: GitHubAdapterConfig | null = null;

  async connect(config: AdapterConfig): Promise<void> {
    const ghConfig = config as GitHubAdapterConfig;
    this.config = ghConfig;
    this.octokit = new Octokit({
      auth: ghConfig.token,
    });
  }

  async collect(): Promise<SignalResult[]> {
    if (!this.octokit || !this.config) {
      throw new Error("GitHubAdapter: call connect() before collect()");
    }

    const repos = await this.fetchRepos();

    if (repos.length === 0) {
      // Return zero scores for all signals when org has no repos
      return this.signals.map((signal) => ({
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
      }));
    }

    const octokit = this.octokit;
    const results: SignalResult[] = [];

    const collectors = [
      () => withRetry(() => collectGatewaySignal(octokit, repos)),
      () => withRetry(() => collectSecretsManagementSignal(octokit, repos)),
      () => withRetry(() => collectPromptManagementSignal(octokit, repos)),
      () => withRetry(() => collectSteeringFilesSignal(octokit, repos)),
      () => withRetry(() => collectAIRulesSignal(octokit, repos)),
      () => withRetry(() => collectAgentTaskPercentSignal(octokit, repos)),
      () => withRetry(() => collectPipelineScalingSignal(octokit, repos)),
      () => withRetry(() => collectAICodeReviewSignal(octokit, repos)),
      () => withRetry(() => collectTestQualitySignal(octokit, repos)),
      () => withRetry(() => collectPRCycleTimeSignal(octokit, repos)),
      () => withRetry(() => collectAIArtifactSDLCSignal(octokit, repos)),
      () => withRetry(() => collectPromptSecuritySignal(octokit, repos)),
      () => withRetry(() => collectAIAttributionSignal(octokit, repos)),
      () => withRetry(() => collectTracingSignal(octokit, repos)),
      () => withRetry(() => collectDocumentationSignal(octokit, repos)),
      () => withRetry(() => collectSpecAccuracySignal(octokit, repos)),
    ];

    for (const collector of collectors) {
      try {
        const result = await collector();
        results.push(result);
      } catch (err) {
        // Log and continue — partial results are better than a full failure
        console.warn(`GitHubAdapter: collector failed`, err);
      }
    }

    return results;
  }

  /**
   * Fetch repos for the org, respecting the maxRepos limit and optional allowlist.
   */
  private async fetchRepos(): Promise<RepoInfo[]> {
    if (!this.octokit || !this.config) return [];

    const { org, repos: repoAllowlist, maxRepos = DEFAULT_MAX_REPOS } = this.config;

    if (repoAllowlist && repoAllowlist.length > 0) {
      // Fetch only specified repos
      const repoInfos: RepoInfo[] = [];
      for (const repoName of repoAllowlist.slice(0, maxRepos)) {
        try {
          const { data } = await this.octokit.repos.get({ owner: org, repo: repoName });
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

    // Fetch all org repos up to maxRepos
    const repoInfos: RepoInfo[] = [];
    let page = 1;
    while (repoInfos.length < maxRepos) {
      try {
        const { data } = await this.octokit.repos.listForOrg({
          org,
          type: "all",
          per_page: Math.min(100, maxRepos - repoInfos.length),
          page,
          sort: "pushed",
          direction: "desc",
        });
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
