import type { Octokit } from "@octokit/rest";
import type { SignalResult, Evidence } from "@ai-scorecard/core";
import type { RepoInfo } from "./repo-scan.js";
import {
  createCollectorContext,
  type CollectorContext,
  type CollectorOutcome,
} from "../collector-error.js";

function statusOf(err: unknown): number | undefined {
  if (err === null || typeof err !== "object") return undefined;
  const s = (err as { status?: unknown }).status;
  return typeof s === "number" ? s : undefined;
}

/**
 * Fetch workflow runs for a repo over the last 30 days. Per-repo 404s are
 * tolerated silently; auth/rate-limit/unexpected errors are reported via `ctx`.
 */
async function fetchWorkflowRuns(
  octokit: Octokit,
  owner: string,
  repo: string,
  since: Date,
  ctx: CollectorContext
): Promise<
  {
    id: number;
    status: string | null;
    conclusion: string | null;
    createdAt: Date;
    updatedAt: Date;
    runStartedAt: Date | null;
    name: string | null;
  }[]
> {
  try {
    const { data } = await octokit.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      per_page: 100,
      created: `>=${since.toISOString().split("T")[0]}`,
    });

    return data.workflow_runs.map((run) => ({
      id: run.id,
      status: run.status ?? null,
      conclusion: run.conclusion ?? null,
      createdAt: new Date(run.created_at),
      updatedAt: new Date(run.updated_at),
      runStartedAt: run.run_started_at ? new Date(run.run_started_at) : null,
      name: run.name ?? null,
    }));
  } catch (err) {
    if (statusOf(err) !== 404) ctx.report(err);
    return [];
  }
}

/** Q14 — CI/CD pipeline scaling */
export async function collectPipelineScalingSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:actions:q14-pipeline-scaling");
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let totalRuns = 0;
  let failedRuns = 0;
  const durationsSec: number[] = [];

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const runs = await fetchWorkflowRuns(octokit, owner, repo.name, since, ctx);
    totalRuns += runs.length;

    for (const run of runs) {
      if (run.conclusion === "failure" || run.conclusion === "timed_out") {
        failedRuns++;
      }
      if (run.runStartedAt !== null && run.conclusion !== null) {
        const durationSec = (run.updatedAt.getTime() - run.runStartedAt.getTime()) / 1000;
        if (durationSec > 0 && durationSec < 7200) {
          durationsSec.push(durationSec);
        }
      }
    }
  }

  const failureRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0;
  let medianDurationMin: number | null = null;
  if (durationsSec.length > 0) {
    durationsSec.sort((a, b) => a - b);
    const mid = Math.floor(durationsSec.length / 2);
    const median =
      durationsSec.length % 2 !== 0
        ? (durationsSec[mid] ?? 0)
        : ((durationsSec[mid - 1] ?? 0) + (durationsSec[mid] ?? 0)) / 2;
    medianDurationMin = median / 60;
  }

  const evidence: Evidence[] = [
    {
      source: "github:actions",
      data: {
        totalRuns,
        failedRuns,
        failureRate: Math.round(failureRate),
        medianDurationMin: medianDurationMin !== null ? Math.round(medianDurationMin) : null,
      },
      summary:
        totalRuns === 0
          ? "No workflow runs found in the last 30 days."
          : `${totalRuns} runs, ${Math.round(failureRate)}% failure rate, median duration ${medianDurationMin !== null ? Math.round(medianDurationMin) : "N/A"} min.`,
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (totalRuns > 0 && failureRate < 20) score = 1;
  if (totalRuns > 50 && failureRate < 15 && medianDurationMin !== null && medianDurationMin < 15) {
    score = 2;
  }

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D3-Q14",
      score,
      evidence,
      confidence: 0.7,
    },
    errors: ctx.errors(),
  };
}

/** Q17 — Test quality / flaky test rate */
export async function collectTestQualitySignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<CollectorOutcome<SignalResult>> {
  const ctx = createCollectorContext("github:actions:q17-test-quality");
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let testWorkflowsFound = 0;
  let rerunWorkflows = 0;

  for (const repo of repos) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const runs = await fetchWorkflowRuns(octokit, owner, repo.name, since, ctx);

    const testRuns = runs.filter(
      (r) => r.name !== null && /test|spec|coverage|jest|vitest|pytest|mocha/i.test(r.name)
    );
    testWorkflowsFound += testRuns.length;

    const runsByName = new Map<string, number[]>();
    for (const run of testRuns) {
      if (run.name) {
        const times = runsByName.get(run.name) ?? [];
        times.push(run.createdAt.getTime());
        runsByName.set(run.name, times);
      }
    }

    for (const [, times] of runsByName) {
      const daysCovered = 30;
      const runsPerDay = times.length / daysCovered;
      if (runsPerDay > 1.5) {
        rerunWorkflows++;
      }
    }
  }

  const flakyRate = testWorkflowsFound > 0 ? (rerunWorkflows / testWorkflowsFound) * 100 : 0;

  const evidence: Evidence[] = [
    {
      source: "github:actions",
      data: {
        testWorkflowsFound,
        rerunWorkflows,
        flakyRateEstimate: Math.round(flakyRate),
      },
      summary:
        testWorkflowsFound === 0
          ? "No test workflows found in last 30 days."
          : `${testWorkflowsFound} test workflow runs found, estimated flaky re-run rate: ${Math.round(flakyRate)}%.`,
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (testWorkflowsFound > 0 && flakyRate < 20) score = 2;
  else if (testWorkflowsFound > 0) score = 1;

  return {
    result: {
      signalId: ctx.signalId,
      questionId: "D3-Q17",
      score,
      evidence,
      confidence: 0.4,
    },
    errors: ctx.errors(),
  };
}
