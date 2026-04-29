import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { CollectorError } from "@ai-scorecard/adapters";
import type { ScorecardResult } from "@ai-scorecard/core";

import { chooseExitCode } from "../src/commands/assess.js";
import { outputJson } from "../src/output/json.js";
import { outputMarkdown } from "../src/output/markdown.js";
import { outputTable } from "../src/output/table.js";

/**
 * Why these tests exist: PR #53 introduces a new behavior contract — the
 * CLI now exits with code 2 ONLY when the adapter reports a `kind: "auth"`
 * collector error, and renders an "Adapter Diagnostics" block in all three
 * output formats (json, markdown, table). Without these tests the contract
 * has no regression safety net, which the local PR review flagged as the
 * primary remaining gap.
 */

const baseResult: ScorecardResult = {
  metadata: { adapterName: "github", target: "test-org" },
  assessedAt: new Date("2026-04-29T00:00:00Z"),
  totalScore: 0,
  maxScore: 94,
  percentage: 0,
  overallConfidence: 0,
  tier: { level: 1, label: "AI-Curious", minScore: 0, maxScore: 22 },
  dimensions: [],
};

const authErr: CollectorError = {
  kind: "auth",
  signalId: "github:repo-scan:q1",
  status: 401,
  message: "Bad credentials",
  cause: { status: 401 },
};

const rateErr: CollectorError = {
  kind: "rate_limit",
  signalId: "github:pr-analytics:q18",
  status: 429,
  message: "API rate limit exceeded for installation",
  cause: { status: 429 },
};

const notFoundErr: CollectorError = {
  kind: "not_found",
  signalId: "github:eval:q42",
  status: 404,
  message: "Not Found",
  cause: { status: 404 },
};

const unexpectedErr: CollectorError = {
  kind: "unexpected",
  signalId: "github:agents:q36",
  status: 500,
  message: "Internal Server Error",
  cause: { status: 500 },
};

/** Capture every console.log call in this test for assertion. */
function captureStdout(): { read: () => string } {
  const buffer: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    buffer.push(args.map(String).join(" "));
  });
  return { read: () => buffer.join("\n") };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("chooseExitCode", () => {
  it("returns 0 when there are no errors", () => {
    expect(chooseExitCode([])).toBe(0);
  });

  it("returns 2 when at least one error is auth-classified", () => {
    expect(chooseExitCode([authErr])).toBe(2);
    expect(chooseExitCode([rateErr, authErr])).toBe(2);
  });

  it("returns 0 for rate_limit alone (no exit-2 escalation)", () => {
    expect(chooseExitCode([rateErr])).toBe(0);
  });

  it("returns 0 for not_found alone", () => {
    expect(chooseExitCode([notFoundErr])).toBe(0);
  });

  it("returns 0 for unexpected alone", () => {
    expect(chooseExitCode([unexpectedErr])).toBe(0);
  });

  it("returns 0 for any combination that lacks auth", () => {
    expect(chooseExitCode([rateErr, notFoundErr, unexpectedErr])).toBe(0);
  });
});

describe("outputJson", () => {
  let stdout: { read: () => string };
  beforeEach(() => {
    stdout = captureStdout();
  });

  it("includes errors array in JSON output", () => {
    outputJson(baseResult, [authErr, rateErr]);
    const parsed = JSON.parse(stdout.read());
    expect(parsed.errors).toHaveLength(2);
    expect(parsed.errors[0].kind).toBe("auth");
    expect(parsed.errors[1].kind).toBe("rate_limit");
  });

  it("strips the non-serializable `cause` field from errors", () => {
    outputJson(baseResult, [authErr]);
    const parsed = JSON.parse(stdout.read());
    expect(parsed.errors[0]).not.toHaveProperty("cause");
    expect(parsed.errors[0].message).toBe("Bad credentials");
    expect(parsed.errors[0].signalId).toBe("github:repo-scan:q1");
  });

  it("emits an empty errors array when none reported", () => {
    outputJson(baseResult, []);
    const parsed = JSON.parse(stdout.read());
    expect(parsed.errors).toEqual([]);
  });
});

describe("outputMarkdown", () => {
  let stdout: { read: () => string };
  beforeEach(() => {
    stdout = captureStdout();
  });

  it("renders an Adapter Diagnostics section when errors are present", () => {
    outputMarkdown(baseResult, [authErr, rateErr, rateErr]);
    const out = stdout.read();
    expect(out).toContain("## Adapter Diagnostics");
    expect(out).toMatch(/\| auth \| 1 \| Bad credentials \|/);
    expect(out).toMatch(/\| rate_limit \| 2 \| API rate limit exceeded/);
  });

  it("includes an explicit warning callout when an auth error is present", () => {
    outputMarkdown(baseResult, [authErr]);
    const out = stdout.read();
    expect(out).toContain("**Warning:**");
    expect(out).toContain("auth-classified");
  });

  it("does NOT include the auth warning when only non-auth errors are reported", () => {
    outputMarkdown(baseResult, [rateErr, notFoundErr]);
    const out = stdout.read();
    expect(out).toContain("## Adapter Diagnostics");
    expect(out).not.toContain("**Warning:**");
  });

  it("omits the diagnostics section entirely when no errors are reported", () => {
    outputMarkdown(baseResult, []);
    const out = stdout.read();
    expect(out).not.toContain("## Adapter Diagnostics");
  });
});

describe("outputTable", () => {
  let stdout: { read: () => string };
  beforeEach(() => {
    stdout = captureStdout();
  });

  function stripAnsi(s: string): string {
    return s.replace(/\[[0-9;]*m/g, "");
  }

  it("renders a diagnostics row when errors are present", () => {
    outputTable(baseResult, [authErr, rateErr]);
    const out = stripAnsi(stdout.read());
    expect(out).toMatch(/auth/);
    expect(out).toMatch(/rate_limit/);
  });

  it("renders an auth warning line when an auth error is present", () => {
    outputTable(baseResult, [authErr]);
    const out = stripAnsi(stdout.read());
    expect(out).toMatch(/Auth errors reported/);
  });

  it("does not render an auth warning when no auth error", () => {
    outputTable(baseResult, [rateErr]);
    const out = stripAnsi(stdout.read());
    expect(out).not.toMatch(/Auth errors reported/);
  });
});
