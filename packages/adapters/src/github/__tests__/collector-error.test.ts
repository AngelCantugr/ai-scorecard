import { describe, it, expect, vi, type Mock } from "vitest";
import { GitHubAdapter } from "../index.js";
import { classifyError, createCollectorContext } from "../collector-error.js";
import type { GitHubAdapterConfig } from "../config.js";

vi.mock("@octokit/rest", () => {
  const OctokitMock = vi.fn();
  return { Octokit: OctokitMock };
});

function makeOctokit(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const defaultTree = {
    data: {
      tree: [{ type: "blob", path: "src/index.ts" }],
    },
  };
  return {
    git: { getTree: vi.fn().mockResolvedValue(defaultTree) },
    repos: {
      get: vi.fn().mockResolvedValue({
        data: { name: "r", full_name: "o/r", default_branch: "main" },
      }),
      listForOrg: vi.fn().mockResolvedValue({ data: [] }),
      getContent: vi.fn().mockRejectedValue({ status: 404 }),
      listCommits: vi.fn().mockResolvedValue({ data: [] }),
      getBranch: vi.fn().mockRejectedValue({ status: 404 }),
    },
    pulls: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      listReviews: vi.fn().mockResolvedValue({ data: [] }),
      listCommits: vi.fn().mockResolvedValue({ data: [] }),
      listFiles: vi.fn().mockResolvedValue({ data: [] }),
    },
    actions: {
      listWorkflowRunsForRepo: vi.fn().mockResolvedValue({ data: { workflow_runs: [] } }),
    },
    ...overrides,
  };
}

async function createConnectedAdapter(
  octokitInstance: Record<string, unknown>
): Promise<GitHubAdapter> {
  const { Octokit } = await import("@octokit/rest");
  (Octokit as unknown as Mock).mockImplementation(function () {
    return octokitInstance;
  });
  const adapter = new GitHubAdapter();
  const config: GitHubAdapterConfig = {
    token: "test-token",
    org: "test-org",
    maxRepos: 5,
  };
  await adapter.connect(config);
  return adapter;
}

describe("classifyError", () => {
  it("classifies 401 as auth", () => {
    const err = classifyError("sig", { status: 401, message: "Bad creds" });
    expect(err.kind).toBe("auth");
    if (err.kind === "auth") expect(err.status).toBe(401);
    expect(err.signalId).toBe("sig");
    expect(err.message).toBe("Bad creds");
  });

  it("classifies 403 with non-rate-limit headers as auth", () => {
    const err = classifyError("sig", {
      status: 403,
      message: "Resource not accessible by integration",
      response: { headers: { "x-ratelimit-remaining": "4995" } },
    });
    expect(err.kind).toBe("auth");
  });

  it("classifies 429 as rate_limit", () => {
    const err = classifyError("sig", { status: 429, message: "Too Many Requests" });
    expect(err.kind).toBe("rate_limit");
    if (err.kind === "rate_limit") expect(err.status).toBe(429);
  });

  it("classifies 403 with x-ratelimit-remaining=0 as rate_limit", () => {
    const err = classifyError("sig", {
      status: 403,
      message: "API rate limit exceeded",
      response: { headers: { "x-ratelimit-remaining": "0" } },
    });
    expect(err.kind).toBe("rate_limit");
  });

  it("classifies 403 mentioning rate-limit in message as rate_limit", () => {
    const err = classifyError("sig", {
      status: 403,
      message: "You have exceeded a secondary rate limit",
    });
    expect(err.kind).toBe("rate_limit");
  });

  it("classifies 404 as not_found", () => {
    const err = classifyError("sig", { status: 404, message: "Not Found" });
    expect(err.kind).toBe("not_found");
  });

  it("classifies 500 as unexpected", () => {
    const err = classifyError("sig", { status: 500, message: "Server error" });
    expect(err.kind).toBe("unexpected");
    if (err.kind === "unexpected") expect(err.status).toBe(500);
  });

  it("classifies a non-status throwable as unexpected", () => {
    const err = classifyError("sig", new Error("boom"));
    expect(err.kind).toBe("unexpected");
    expect(err.message).toBe("boom");
  });

  it("handles non-object throwables", () => {
    const err = classifyError("sig", "string error");
    expect(err.kind).toBe("unexpected");
    expect(err.message).toBe("string error");
  });
});

describe("CollectorContext", () => {
  it("accumulates classified errors in order", () => {
    const ctx = createCollectorContext("sig-x");
    ctx.report({ status: 401 });
    ctx.report({ status: 429 });
    ctx.report(new Error("boom"));
    const errs = ctx.errors();
    expect(errs).toHaveLength(3);
    expect(errs[0]?.kind).toBe("auth");
    expect(errs[1]?.kind).toBe("rate_limit");
    expect(errs[2]?.kind).toBe("unexpected");
    for (const e of errs) expect(e.signalId).toBe("sig-x");
  });
});

describe("GitHubAdapter — error variants surface via collectWithDiagnostics", () => {
  it("auth: 401 from git.getTree is classified as auth and reported on every affected collector", async () => {
    const octokit = makeOctokit();
    (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
      data: [{ name: "r", full_name: "o/r", default_branch: "main" }],
    });
    (octokit.git as Record<string, Mock>)["getTree"] = vi
      .fn()
      .mockRejectedValue({ status: 401, message: "Bad credentials" });

    const adapter = await createConnectedAdapter(octokit);
    const { results, errors } = await adapter.collectWithDiagnostics();

    expect(results).toHaveLength(25);
    const authErrors = errors.filter((e) => e.kind === "auth");
    expect(authErrors.length).toBeGreaterThan(0);
    expect(adapter.lastErrors).toBe(errors);
  });

  it("rate_limit: 403 with x-ratelimit-remaining=0 from git.getTree is classified as rate_limit", async () => {
    const octokit = makeOctokit();
    (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
      data: [{ name: "r", full_name: "o/r", default_branch: "main" }],
    });
    // withRetry will see the 403-rate-limit and back off, so eventually it
    // exhausts attempts. The orchestrator catches the thrown error and
    // classifies it.
    (octokit.git as Record<string, Mock>)["getTree"] = vi.fn().mockRejectedValue({
      status: 403,
      message: "API rate limit exceeded",
      response: { headers: { "x-ratelimit-remaining": "0" } },
    });

    const adapter = await createConnectedAdapter(octokit);
    const { errors } = await adapter.collectWithDiagnostics();

    const rateLimitErrors = errors.filter((e) => e.kind === "rate_limit");
    expect(rateLimitErrors.length).toBeGreaterThan(0);
  }, 20000);

  it("not_found: per-repo 404 from git.getTree is silent (no errors reported)", async () => {
    const octokit = makeOctokit();
    (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
      data: [{ name: "r", full_name: "o/r", default_branch: "main" }],
    });
    (octokit.git as Record<string, Mock>)["getTree"] = vi
      .fn()
      .mockRejectedValue({ status: 404, message: "Not Found" });

    const adapter = await createConnectedAdapter(octokit);
    const { results, errors } = await adapter.collectWithDiagnostics();

    // Per-repo 404s are expected outcomes (private/empty repos) and must not
    // be surfaced as errors — the auth-failure signal must stay distinct.
    expect(errors).toHaveLength(0);
    expect(results).toHaveLength(25);
  });

  it("unexpected: a generic Error from git.getTree is classified as unexpected", async () => {
    const octokit = makeOctokit();
    (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
      data: [{ name: "r", full_name: "o/r", default_branch: "main" }],
    });
    (octokit.git as Record<string, Mock>)["getTree"] = vi
      .fn()
      .mockRejectedValue(new Error("EAI_AGAIN getaddrinfo failed"));

    const adapter = await createConnectedAdapter(octokit);
    const { errors } = await adapter.collectWithDiagnostics();

    const unexpected = errors.filter((e) => e.kind === "unexpected");
    expect(unexpected.length).toBeGreaterThan(0);
    expect(unexpected[0]?.message).toContain("EAI_AGAIN");
  });

  it("collect() stays interface-compatible and writes lastErrors as a side effect", async () => {
    const octokit = makeOctokit();
    (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
      data: [{ name: "r", full_name: "o/r", default_branch: "main" }],
    });
    (octokit.git as Record<string, Mock>)["getTree"] = vi
      .fn()
      .mockRejectedValue({ status: 401, message: "Bad credentials" });

    const adapter = await createConnectedAdapter(octokit);
    const results = await adapter.collect();

    expect(results).toHaveLength(25);
    expect(adapter.lastErrors.length).toBeGreaterThan(0);
    expect(adapter.lastErrors.every((e) => e.kind === "auth")).toBe(true);
  });
});
