import { describe, it, expect, vi } from "vitest";

import {
  collectAgentTaskPercentSignal,
  collectAICodeReviewSignal,
  collectPRCycleTimeSignal,
  collectAIArtifactSDLCSignal,
  collectAIAttributionSignal,
} from "../../src/github/collectors/pr-analytics.js";

import { makeRepo, makeOctokitError } from "../fixtures/helpers.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** A PR list mock that returns a fixed array, with empty reviews/commits/files. */
function makeOctokit(opts: {
  prs?: unknown[];
  reviewsByPR?: Record<number, unknown[]>;
  commitsByPR?: Record<number, unknown[]>;
  filesByPR?: Record<number, unknown[]>;
  commits?: unknown[];
  prsError?: Error & { status?: number };
}) {
  const {
    prs = [],
    reviewsByPR = {},
    commitsByPR = {},
    filesByPR = {},
    commits = [],
    prsError,
  } = opts;

  return {
    pulls: {
      list: prsError
        ? vi.fn().mockRejectedValue(prsError)
        : vi.fn().mockResolvedValue({ data: prs }),
      listReviews: vi
        .fn()
        .mockImplementation(({ pull_number }: { pull_number: number }) =>
          Promise.resolve({ data: reviewsByPR[pull_number] ?? [] })
        ),
      listCommits: vi
        .fn()
        .mockImplementation(({ pull_number }: { pull_number: number }) =>
          Promise.resolve({ data: commitsByPR[pull_number] ?? [] })
        ),
      listFiles: vi
        .fn()
        .mockImplementation(({ pull_number }: { pull_number: number }) =>
          Promise.resolve({ data: filesByPR[pull_number] ?? [] })
        ),
    },
    repos: {
      listCommits: vi.fn().mockResolvedValue({ data: commits }),
      getContent: vi.fn().mockRejectedValue(makeOctokitError(404, "Not Found")),
    },
    git: {
      getTree: vi.fn().mockResolvedValue({ data: { tree: [] } }),
    },
  };
}

function buildPR(opts: {
  number: number;
  hoursAgoMerged?: number;
  cycleHours?: number;
  body?: string | null;
  title?: string;
}) {
  const { number, hoursAgoMerged = 24, cycleHours = 4, body = null, title = `PR ${number}` } = opts;
  const mergedAt = new Date(Date.now() - hoursAgoMerged * HOUR);
  const createdAt = new Date(mergedAt.getTime() - cycleHours * HOUR);
  return {
    number,
    title,
    body,
    state: "closed",
    merged_at: mergedAt.toISOString(),
    created_at: createdAt.toISOString(),
    updated_at: mergedAt.toISOString(),
  };
}

describe("collectAgentTaskPercentSignal — Q13", () => {
  it("happy path: scores 2 when >30% of recent PRs are AI-attributed", async () => {
    const repo = makeRepo();
    const prs = Array.from({ length: 10 }, (_, i) => buildPR({ number: i + 1 }));
    const commitsByPR: Record<number, unknown[]> = {};
    // Mark 5 of 10 PRs as AI-attributed via co-authored-by
    for (let i = 1; i <= 5; i++) {
      commitsByPR[i] = [
        {
          commit: {
            message: "feat: add foo\n\nCo-authored-by: copilot <copilot@github.com>",
          },
          author: { login: "alice" },
        },
      ];
    }
    const octokit = makeOctokit({ prs, commitsByPR });

    const result = await collectAgentTaskPercentSignal(octokit as never, [repo]);

    expect(result.signalId).toBe("github:pr-analytics:q13-agent-task-percent");
    expect(result.questionId).toBe("D2-Q13");
    expect(result.score).toBe(2);
  });

  it("scores 1 when between 5% and 30% of PRs are AI-attributed", async () => {
    const repo = makeRepo();
    const prs = Array.from({ length: 10 }, (_, i) => buildPR({ number: i + 1 }));
    const commitsByPR: Record<number, unknown[]> = {
      1: [
        {
          commit: { message: "Co-authored-by: copilot <copilot@github.com>" },
          author: { login: "alice" },
        },
      ],
    };
    const octokit = makeOctokit({ prs, commitsByPR });

    const result = await collectAgentTaskPercentSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
  });

  it("scores 0 when no AI attribution found", async () => {
    const repo = makeRepo();
    const prs = [buildPR({ number: 1 })];
    const octokit = makeOctokit({ prs });

    const result = await collectAgentTaskPercentSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });

  it("error path: pulls.list 401 → empty result, score 0 (legacy graceful fallback)", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ prsError: makeOctokitError(401, "Bad credentials") });

    const result = await collectAgentTaskPercentSignal(octokit as never, [repo]);

    // Today: fetchRecentPRs catches all errors and returns []. Once PR3 lands,
    // a typed AuthenticationError should propagate instead.
    expect(result.score).toBe(0);
    // TODO(reliability): tighten after PR3 — assert typed error propagation.
  });

  it("error path: pulls.list 429 rate-limit → empty result, no throw", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ prsError: makeOctokitError(429, "Rate limited") });

    const result = await collectAgentTaskPercentSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.confidence).toBe(0.4);
  });
});

describe("collectAICodeReviewSignal — Q16", () => {
  it("happy path: scores 2 when >10 bot reviews observed across recent PRs", async () => {
    const repo = makeRepo();
    const prs = Array.from({ length: 12 }, (_, i) => buildPR({ number: i + 1 }));
    const reviewsByPR: Record<number, unknown[]> = {};
    for (let i = 1; i <= 12; i++) {
      reviewsByPR[i] = [{ user: { login: "coderabbitai[bot]" }, body: "Review summary..." }];
    }
    const octokit = makeOctokit({ prs, reviewsByPR });

    const result = await collectAICodeReviewSignal(octokit as never, [repo]);

    expect(result.signalId).toBe("github:pr-analytics:q16-ai-code-review");
    expect(result.questionId).toBe("D3-Q16");
    expect(result.score).toBe(2);
    expect(result.evidence[0]?.data).toMatchObject({
      botNames: expect.arrayContaining(["coderabbitai[bot]"]),
    });
  });

  it("scores 1 when 1-10 bot reviews are present", async () => {
    const repo = makeRepo();
    const prs = [buildPR({ number: 1 })];
    const reviewsByPR = { 1: [{ user: { login: "snyk-bot" }, body: "vuln found" }] };
    const octokit = makeOctokit({ prs, reviewsByPR });

    const result = await collectAICodeReviewSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
  });

  it("scores 0 when no bot reviews found", async () => {
    const repo = makeRepo();
    const prs = [buildPR({ number: 1 })];
    const reviewsByPR = { 1: [{ user: { login: "alice" }, body: "LGTM" }] };
    const octokit = makeOctokit({ prs, reviewsByPR });

    const result = await collectAICodeReviewSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });

  it("error path: pulls.list 500 server error → empty PR list, score 0", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ prsError: makeOctokitError(500, "Server Error") });

    const result = await collectAICodeReviewSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });
});

describe("collectPRCycleTimeSignal — Q18", () => {
  it("happy path: scores 2 with 10+ merged PRs (cycle time measured at scale)", async () => {
    const repo = makeRepo();
    const prs = Array.from({ length: 15 }, (_, i) =>
      buildPR({ number: i + 1, hoursAgoMerged: i + 1, cycleHours: 2 })
    );
    const octokit = makeOctokit({ prs });

    const result = await collectPRCycleTimeSignal(octokit as never, [repo]);

    expect(result.signalId).toBe("github:pr-analytics:q18-pr-cycle-time");
    expect(result.score).toBe(2);
    expect(result.evidence[0]?.data).toMatchObject({ totalMergedPRs: 15 });
  });

  it("scores 1 with fewer than 10 merged PRs", async () => {
    const repo = makeRepo();
    const prs = Array.from({ length: 3 }, (_, i) => buildPR({ number: i + 1 }));
    const octokit = makeOctokit({ prs });

    const result = await collectPRCycleTimeSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
  });

  it("scores 0 when no merged PRs are returned", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ prs: [] });

    const result = await collectPRCycleTimeSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });

  it("error path: 404 from pulls.list → empty, score 0", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ prsError: makeOctokitError(404, "Not Found") });

    const result = await collectPRCycleTimeSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });
});

describe("collectAIArtifactSDLCSignal — Q20", () => {
  it("happy path: scores 2 when 2+ repos have merged PRs touching AI config files", async () => {
    const repos = [makeRepo("repo-a"), makeRepo("repo-b")];
    const pr = buildPR({ number: 1, hoursAgoMerged: 24 });
    const octokit = makeOctokit({
      prs: [pr],
      filesByPR: { 1: [{ filename: "CLAUDE.md" }, { filename: "src/index.ts" }] },
    });

    const result = await collectAIArtifactSDLCSignal(octokit as never, repos);

    expect(result.score).toBe(2);
    expect(result.evidence[0]?.data).toMatchObject({
      reviewedRepos: expect.arrayContaining(["test-org/repo-a", "test-org/repo-b"]),
    });
  });

  it("scores 1 when only direct unreviewed commits touch AI config", async () => {
    const repo = makeRepo("repo-a");
    const octokit = makeOctokit({
      prs: [],
      commits: [
        { commit: { message: "update CLAUDE.md with new rules" }, author: { login: "dev" } },
      ],
    });

    const result = await collectAIArtifactSDLCSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
    expect(result.evidence[0]?.data).toMatchObject({
      unreviewedRepos: ["test-org/repo-a"],
    });
  });

  it("scores 0 when no AI config changes found in PRs or commits", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({
      prs: [buildPR({ number: 1 })],
      filesByPR: { 1: [{ filename: "src/index.ts" }] },
    });

    const result = await collectAIArtifactSDLCSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });

  it("error path: pulls.list 401 → repo skipped, score 0", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ prsError: makeOctokitError(401, "Bad credentials") });

    const result = await collectAIArtifactSDLCSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });
});

describe("collectAIAttributionSignal — Q23", () => {
  it("happy path: scores 2 when 5+ commits attributed and >10% of total", async () => {
    const repo = makeRepo();
    const commits = Array.from({ length: 20 }, (_, i) => ({
      commit: {
        message:
          i < 6 ? `feat: thing\n\nCo-authored-by: claude <noreply@anthropic.com>` : "fix: nothing",
      },
    }));
    const octokit = makeOctokit({ commits });

    const result = await collectAIAttributionSignal(octokit as never, [repo]);

    expect(result.score).toBe(2);
  });

  it("scores 1 when at least one attributed commit found", async () => {
    const repo = makeRepo();
    const commits = [
      { commit: { message: "feat: x\n\nCo-authored-by: copilot <copilot@github.com>" } },
      ...Array.from({ length: 19 }, () => ({ commit: { message: "fix: y" } })),
    ];
    const octokit = makeOctokit({ commits });

    const result = await collectAIAttributionSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
  });

  it("scores 0 when no AI-attributed commits found", async () => {
    const repo = makeRepo();
    const commits = [{ commit: { message: "feat: regular work" } }];
    const octokit = makeOctokit({ commits });

    const result = await collectAIAttributionSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });

  it("error path: repos.listCommits failure is caught — score 0, no throw", async () => {
    const repo = makeRepo();
    const octokit = {
      pulls: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        listReviews: vi.fn().mockResolvedValue({ data: [] }),
        listCommits: vi.fn().mockResolvedValue({ data: [] }),
        listFiles: vi.fn().mockResolvedValue({ data: [] }),
      },
      repos: {
        listCommits: vi.fn().mockRejectedValue(makeOctokitError(500, "Server Error")),
        getContent: vi.fn().mockRejectedValue(makeOctokitError(404, "Not Found")),
      },
      git: { getTree: vi.fn().mockResolvedValue({ data: { tree: [] } }) },
    };

    const result = await collectAIAttributionSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });
});

// Defensively prevent unused imports from breaking lint
void DAY;
