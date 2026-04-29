import { describe, it, expect, vi } from "vitest";

import {
  collectPipelineScalingSignal,
  collectTestQualitySignal,
} from "../../src/github/collectors/actions.js";

import { makeRepo, makeOctokitError } from "../fixtures/helpers.js";

const HOUR = 60 * 60 * 1000;

type WorkflowRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string;
  created_at: string;
  updated_at: string;
  run_started_at: string;
};

function makeRun(opts: {
  id: number;
  hoursAgo?: number;
  durationSec?: number;
  conclusion?: string;
  name?: string;
}): WorkflowRun {
  const { id, hoursAgo = 1, durationSec = 600, conclusion = "success", name = "CI" } = opts;
  const start = new Date(Date.now() - hoursAgo * HOUR);
  const end = new Date(start.getTime() + durationSec * 1000);
  return {
    id,
    name,
    status: "completed",
    conclusion,
    created_at: start.toISOString(),
    updated_at: end.toISOString(),
    run_started_at: start.toISOString(),
  };
}

function makeOctokit(opts: { runs?: WorkflowRun[]; runsError?: Error & { status?: number } }) {
  const { runs = [], runsError } = opts;
  return {
    actions: {
      listWorkflowRunsForRepo: runsError
        ? vi.fn().mockRejectedValue(runsError)
        : vi.fn().mockResolvedValue({ data: { workflow_runs: runs } }),
    },
  };
}

describe("collectPipelineScalingSignal — Q14", () => {
  it("happy path: scores 2 with >50 fast successful runs and <15% failure", async () => {
    const repo = makeRepo();
    const runs = Array.from({ length: 60 }, (_, i) =>
      makeRun({ id: i, hoursAgo: i + 1, durationSec: 600, conclusion: "success" })
    );
    const octokit = makeOctokit({ runs });

    const result = await collectPipelineScalingSignal(octokit as never, [repo]);

    expect(result.signalId).toBe("github:actions:q14-pipeline-scaling");
    expect(result.questionId).toBe("D3-Q14");
    expect(result.score).toBe(2);
    expect(result.evidence[0]?.data).toMatchObject({
      totalRuns: 60,
      failedRuns: 0,
      failureRate: 0,
    });
  });

  it("scores 1 with low total runs but acceptable failure rate", async () => {
    const repo = makeRepo();
    const runs = Array.from({ length: 5 }, (_, i) =>
      makeRun({ id: i, hoursAgo: i + 1, durationSec: 300 })
    );
    const octokit = makeOctokit({ runs });

    const result = await collectPipelineScalingSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
  });

  it("scores 0 when failure rate >= 20%", async () => {
    const repo = makeRepo();
    const runs = [
      makeRun({ id: 1, conclusion: "success" }),
      makeRun({ id: 2, conclusion: "failure" }),
      makeRun({ id: 3, conclusion: "failure" }),
      makeRun({ id: 4, conclusion: "success" }),
      makeRun({ id: 5, conclusion: "success" }),
    ];
    const octokit = makeOctokit({ runs });

    const result = await collectPipelineScalingSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.data).toMatchObject({ failureRate: 40 });
  });

  it("scores 0 when no workflow runs exist", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ runs: [] });

    const result = await collectPipelineScalingSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.summary).toContain("No workflow runs");
  });

  it("error path: 401 from listWorkflowRunsForRepo → empty result, score 0", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ runsError: makeOctokitError(401, "Bad credentials") });

    const result = await collectPipelineScalingSignal(octokit as never, [repo]);

    // fetchWorkflowRuns catches all errors → []. Once PR3 lands, expect typed propagation.
    expect(result.score).toBe(0);
    // TODO(reliability): tighten after PR3.
  });

  it("error path: 429 rate-limit → empty result, no throw", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ runsError: makeOctokitError(429, "Rate limited") });

    const result = await collectPipelineScalingSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });

  it("error path: 500 server error is swallowed today, returns score 0", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ runsError: makeOctokitError(500, "Server Error") });

    const result = await collectPipelineScalingSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });
});

describe("collectTestQualitySignal — Q17", () => {
  it("happy path: scores 2 when test workflows exist with low re-run rate", async () => {
    const repo = makeRepo();
    const runs = [
      makeRun({ id: 1, name: "test", hoursAgo: 24 * 5 }),
      makeRun({ id: 2, name: "test", hoursAgo: 24 * 10 }),
      makeRun({ id: 3, name: "test", hoursAgo: 24 * 15 }),
    ];
    const octokit = makeOctokit({ runs });

    const result = await collectTestQualitySignal(octokit as never, [repo]);

    expect(result.signalId).toBe("github:actions:q17-test-quality");
    expect(result.questionId).toBe("D3-Q17");
    expect(result.score).toBe(2);
  });

  it("scores 0 when no test workflows are observed", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ runs: [makeRun({ id: 1, name: "lint" })] });

    const result = await collectTestQualitySignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.summary).toContain("No test workflows");
  });

  it("error path: failed listWorkflowRunsForRepo → score 0, no throw", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ runsError: makeOctokitError(500, "Server Error") });

    const result = await collectTestQualitySignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });
});
