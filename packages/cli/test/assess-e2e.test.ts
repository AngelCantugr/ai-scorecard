/**
 * End-to-end smoke test for the `assess` command.
 *
 * Locks the contract that a fully-mocked assess invocation returns a complete
 * 8-dimension / 0–94 scorecard with a valid tier label. This is the regression
 * net the home-page V1.0 → V1.1 mismatch (commit 8972acf) slipped through —
 * the previous CI ran unit tests but never wired the full CLI flow end-to-end.
 *
 * External dependencies (Octokit + Anthropic SDK) are stubbed via vi.mock so
 * the test runs hermetically with no network access.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SignalResult } from "@ai-scorecard/core";

const fakeGithubSignals: SignalResult[] = [
  {
    signalId: "github:repos",
    questionId: "D1-Q1",
    score: 2,
    evidence: [
      {
        source: "github:repos",
        data: { count: 12 },
        summary: "Found 12 active repositories under the org",
      },
    ],
    confidence: 1,
  },
  {
    signalId: "github:actions",
    questionId: "D3-Q11",
    score: 1,
    evidence: [
      {
        source: "github:actions",
        data: { workflows: 4 },
        summary: "Detected 4 GitHub Actions workflows",
      },
    ],
    confidence: 0.9,
  },
];

const fakeAiSignals: SignalResult[] = [
  {
    signalId: "ai:inference",
    questionId: "D6-Q26",
    score: 1,
    evidence: [
      {
        source: "ai-inference",
        data: { rationale: "fixture" },
        summary: "AI inferred partial documentation coverage",
      },
    ],
    confidence: 0.5,
  },
];

vi.mock("@ai-scorecard/adapters", () => {
  class GitHubAdapter {
    name = "github";
    signals = [];
    async connect(): Promise<void> {
      /* fixture — no-op */
    }
    async collect(): Promise<SignalResult[]> {
      return fakeGithubSignals;
    }
    async collectWithDiagnostics(): Promise<{
      results: SignalResult[];
      errors: readonly never[];
    }> {
      return { results: fakeGithubSignals, errors: [] };
    }
  }

  class AIInferenceEngine {
    constructor(_config: unknown) {
      void _config;
    }
    async analyze(_bundle: unknown): Promise<SignalResult[]> {
      void _bundle;
      return fakeAiSignals;
    }
  }

  return { GitHubAdapter, AIInferenceEngine };
});

const VALID_TIERS = ["AI-Curious", "AI-Experimenting", "AI-Scaling", "AI-Native"] as const;

describe("assess command end-to-end", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit called with ${code ?? 0}`);
    }) as never);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
    exitSpy.mockRestore();
    vi.resetModules();
  });

  it("dry-run exits cleanly without external calls", async () => {
    const { runAssess } = await import("../src/commands/assess.js");
    await runAssess({
      githubOrg: "acme",
      githubToken: "fake-token",
      output: "json",
      dryRun: true,
    });
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("full flow with mocked adapters produces an 8-dimension scorecard", async () => {
    const { runAssess } = await import("../src/commands/assess.js");

    await runAssess({
      githubOrg: "acme",
      githubToken: "fake-token",
      aiInference: true,
      anthropicKey: "fake-anthropic-key",
      output: "json",
    });

    expect(exitSpy).not.toHaveBeenCalled();

    const jsonCall = logSpy.mock.calls.find((args) => {
      const first = args[0];
      return typeof first === "string" && first.trim().startsWith("{");
    });
    expect(jsonCall, "expected JSON scorecard on stdout").toBeDefined();

    const result = JSON.parse(jsonCall![0] as string);

    expect(result.dimensions).toHaveLength(8);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(94);
    expect(result.maxScore).toBe(94);
    expect(VALID_TIERS).toContain(result.tier.label);
    expect(typeof result.overallConfidence).toBe("number");
    expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
    expect(result.overallConfidence).toBeLessThanOrEqual(1);
    expect(result.metadata.adapterName).toBe("github");
    expect(result.metadata.target).toBe("org:acme");
  });

  it("missing required options exits with non-zero code", async () => {
    const { runAssess } = await import("../src/commands/assess.js");

    await expect(
      runAssess({
        // no githubOrg, no githubToken
        output: "json",
      })
    ).rejects.toThrow(/process\.exit called with 1/);
  });
});
