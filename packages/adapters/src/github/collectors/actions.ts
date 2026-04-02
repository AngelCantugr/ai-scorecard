import type { Octokit } from "@octokit/rest";
import type { SignalResult, Evidence } from "@ai-scorecard/core";
import type { RepoInfo } from "./repo-scan.js";

/**
 * Fetch workflow runs for a repo over the last 30 days.
 */
async function fetchWorkflowRuns(
  octokit: Octokit,
  owner: string,
  repo: string,
  since: Date
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
  } catch {
    return [];
  }
}

/**
 * Q14 — CI/CD pipeline scaling
 * Analyzes workflow run times, queue times, and failure rates.
 */
export async function collectPipelineScalingSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<SignalResult> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let totalRuns = 0;
  let failedRuns = 0;
  const durationsSec: number[] = [];

  for (const repo of repos.slice(0, 10)) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const runs = await fetchWorkflowRuns(octokit, owner, repo.name, since);
    totalRuns += runs.length;

    for (const run of runs) {
      if (run.conclusion === "failure" || run.conclusion === "timed_out") {
        failedRuns++;
      }
      if (run.runStartedAt !== null && run.conclusion !== null) {
        const durationSec =
          (run.updatedAt.getTime() - run.runStartedAt.getTime()) / 1000;
        if (durationSec > 0 && durationSec < 7200) {
          // sanity check < 2hrs
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
    signalId: "github:actions:q14-pipeline-scaling",
    questionId: "D3-Q14",
    score,
    evidence,
    confidence: 0.7,
  };
}

/**
 * Q17 — Test quality / flaky test rate
 * Analyzes test workflow results for flaky re-runs.
 */
export async function collectTestQualitySignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<SignalResult> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let testWorkflowsFound = 0;
  let rerunWorkflows = 0;

  for (const repo of repos.slice(0, 10)) {
    const owner = repo.fullName.split("/")[0] ?? "";
    const runs = await fetchWorkflowRuns(octokit, owner, repo.name, since);

    const testRuns = runs.filter(
      (r) =>
        r.name !== null &&
        /test|spec|coverage|jest|vitest|pytest|mocha/i.test(r.name)
    );
    testWorkflowsFound += testRuns.length;

    // Check for re-runs (same workflow name running multiple times in short succession)
    const runsByName = new Map<string, number[]>();
    for (const run of testRuns) {
      if (run.name) {
        const times = runsByName.get(run.name) ?? [];
        times.push(run.createdAt.getTime());
        runsByName.set(run.name, times);
      }
    }

    for (const [, times] of runsByName) {
      // If workflow ran more than expected (> 1.5 runs per day on average), suggest flakiness
      const daysCovered = 30;
      const runsPerDay = times.length / daysCovered;
      if (runsPerDay > 1.5) {
        rerunWorkflows++;
      }
    }
  }

  const flakyRate =
    testWorkflowsFound > 0 ? (rerunWorkflows / testWorkflowsFound) * 100 : 0;

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
    signalId: "github:actions:q17-test-quality",
    questionId: "D3-Q17",
    score,
    evidence,
    confidence: 0.4,
  };
}
