import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { GitHubAdapter } from "../index.js";
import type { GitHubAdapterConfig } from "../config.js";

// ---------------------------------------------------------------------------
// Minimal Octokit mock factory
// ---------------------------------------------------------------------------
function makeOctokit(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const defaultTree = {
    data: {
      tree: [
        { type: "blob", path: "src/index.ts" },
        { type: "blob", path: "package.json" },
        { type: "blob", path: "README.md" },
      ],
    },
  };

  return {
    git: {
      getTree: vi.fn().mockResolvedValue(defaultTree),
    },
    repos: {
      get: vi.fn().mockResolvedValue({
        data: {
          name: "test-repo",
          full_name: "test-org/test-repo",
          default_branch: "main",
        },
      }),
      listForOrg: vi.fn().mockResolvedValue({ data: [] }),
      getContent: vi.fn().mockRejectedValue({ status: 404 }),
      listCommits: vi.fn().mockResolvedValue({ data: [] }),
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

// ---------------------------------------------------------------------------
// Mock @octokit/rest so the adapter uses our mock instead
// ---------------------------------------------------------------------------
vi.mock("@octokit/rest", () => {
  const OctokitMock = vi.fn();
  return { Octokit: OctokitMock };
});

async function createConnectedAdapter(
  octokitInstance: Record<string, unknown>,
  configOverrides: Partial<GitHubAdapterConfig> = {}
): Promise<GitHubAdapter> {
  const { Octokit } = await import("@octokit/rest");
  // Use a regular function (not arrow) so it works as a constructor
  (Octokit as unknown as Mock).mockImplementation(function () {
    return octokitInstance;
  });

  const adapter = new GitHubAdapter();
  const config: GitHubAdapterConfig = {
    token: "test-token",
    org: "test-org",
    maxRepos: 5,
    ...configOverrides,
  };
  await adapter.connect(config);
  return adapter;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GitHubAdapter", () => {
  describe("interface compliance", () => {
    it("has correct name", () => {
      const adapter = new GitHubAdapter();
      expect(adapter.name).toBe("github");
    });

    it("exposes 16 signals", () => {
      const adapter = new GitHubAdapter();
      expect(adapter.signals).toHaveLength(16);
    });

    it("all signals have unique IDs", () => {
      const adapter = new GitHubAdapter();
      const ids = adapter.signals.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("all signals reference valid question IDs (D#-Q# format)", () => {
      const adapter = new GitHubAdapter();
      for (const signal of adapter.signals) {
        expect(signal.questionId).toMatch(/^D\d+-Q\d+$/);
      }
    });

    it("throws if collect() is called before connect()", async () => {
      const adapter = new GitHubAdapter();
      await expect(adapter.collect()).rejects.toThrow("connect()");
    });
  });

  describe("empty org — no repos", () => {
    it("returns zero scores for all signals when org has no repos", async () => {
      const octokit = makeOctokit();
      const adapter = await createConnectedAdapter(octokit);

      const results = await adapter.collect();

      expect(results).toHaveLength(16);
      for (const result of results) {
        expect(result.score).toBe(0);
        expect(result.confidence).toBe(1.0);
        expect(result.evidence[0]?.summary).toContain("No repositories");
      }
    });
  });

  describe("collect() with repos", () => {
    let octokit: ReturnType<typeof makeOctokit>;

    beforeEach(() => {
      octokit = makeOctokit();
      // Provide a list of repos
      (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
        data: [
          { name: "test-repo", full_name: "test-org/test-repo", default_branch: "main" },
        ],
      });
    });

    it("returns a SignalResult for every registered signal", async () => {
      const adapter = await createConnectedAdapter(octokit);
      const results = await adapter.collect();

      const adapter2 = new GitHubAdapter();
      expect(results).toHaveLength(adapter2.signals.length);
    });

    it("each result has required fields", async () => {
      const adapter = await createConnectedAdapter(octokit);
      const results = await adapter.collect();

      for (const result of results) {
        expect(result).toHaveProperty("signalId");
        expect(result).toHaveProperty("questionId");
        expect(result).toHaveProperty("score");
        expect(result).toHaveProperty("evidence");
        expect(result).toHaveProperty("confidence");
        expect([0, 1, 2]).toContain(result.score);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        expect(Array.isArray(result.evidence)).toBe(true);
        expect(result.evidence.length).toBeGreaterThan(0);
      }
    });

    it("result signalIds match declared signals", async () => {
      const adapter = await createConnectedAdapter(octokit);
      const results = await adapter.collect();
      const declaredIds = new Set(adapter.signals.map((s) => s.id));

      for (const result of results) {
        expect(declaredIds.has(result.signalId)).toBe(true);
      }
    });
  });

  describe("collect() with repos allowlist", () => {
    it("fetches only specified repos from allowlist", async () => {
      const octokit = makeOctokit();
      const getRepo = vi.fn().mockResolvedValue({
        data: {
          name: "specific-repo",
          full_name: "test-org/specific-repo",
          default_branch: "main",
        },
      });
      (octokit.repos as Record<string, unknown>)["get"] = getRepo;

      const adapter = await createConnectedAdapter(octokit, {
        repos: ["specific-repo"],
      });
      await adapter.collect();

      expect(getRepo).toHaveBeenCalledWith({
        owner: "test-org",
        repo: "specific-repo",
      });
    });
  });

  describe("repo-scan collectors", () => {
    it("detects gateway config files and scores Q1", async () => {
      const octokit = makeOctokit();
      (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
        data: [{ name: "infra", full_name: "test-org/infra", default_branch: "main" }],
      });
      (octokit.git as Record<string, Mock>)["getTree"] = vi.fn().mockResolvedValue({
        data: {
          tree: [
            { type: "blob", path: "litellm.yaml" },
            { type: "blob", path: "src/index.ts" },
          ],
        },
      });

      const adapter = await createConnectedAdapter(octokit);
      const results = await adapter.collect();
      const q1 = results.find((r) => r.questionId === "D1-Q1");

      expect(q1).toBeDefined();
      expect(q1?.score).toBeGreaterThanOrEqual(1);
      expect(q1?.confidence).toBeGreaterThan(0);
    });

    it("detects AI steering files and scores Q7", async () => {
      const octokit = makeOctokit();
      (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
        data: [
          { name: "repo1", full_name: "test-org/repo1", default_branch: "main" },
          { name: "repo2", full_name: "test-org/repo2", default_branch: "main" },
        ],
      });
      (octokit.git as Record<string, Mock>)["getTree"] = vi.fn().mockResolvedValue({
        data: {
          tree: [
            { type: "blob", path: "CLAUDE.md" },
            { type: "blob", path: "src/index.ts" },
          ],
        },
      });

      const adapter = await createConnectedAdapter(octokit);
      const results = await adapter.collect();
      const q7 = results.find((r) => r.questionId === "D2-Q7");

      expect(q7).toBeDefined();
      expect(q7?.score).toBeGreaterThanOrEqual(1);
    });

    it("scores Q7 as 0 when no steering files present", async () => {
      const octokit = makeOctokit();
      (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
        data: [{ name: "repo1", full_name: "test-org/repo1", default_branch: "main" }],
      });
      (octokit.git as Record<string, Mock>)["getTree"] = vi.fn().mockResolvedValue({
        data: {
          tree: [{ type: "blob", path: "src/index.ts" }],
        },
      });

      const adapter = await createConnectedAdapter(octokit);
      const results = await adapter.collect();
      const q7 = results.find((r) => r.questionId === "D2-Q7");

      expect(q7?.score).toBe(0);
    });

    it("detects OpenAPI specs for Q31 and Q32", async () => {
      const octokit = makeOctokit();
      (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
        data: [{ name: "api-service", full_name: "test-org/api-service", default_branch: "main" }],
      });
      (octokit.git as Record<string, Mock>)["getTree"] = vi.fn().mockResolvedValue({
        data: {
          tree: [
            { type: "blob", path: "openapi.yaml" },
            { type: "blob", path: "src/index.ts" },
            { type: "blob", path: ".github/workflows/validate-spec.yml" },
          ],
        },
      });
      // Mock getContent to return a workflow that references openapi
      (octokit.repos as Record<string, Mock>)["getContent"] = vi
        .fn()
        .mockImplementation(({ path }: { path: string }) => {
          if (path === ".github/workflows/validate-spec.yml") {
            return Promise.resolve({
              data: {
                content: Buffer.from("steps:\n  - run: npx @redocly/openapi-cli lint openapi.yaml").toString("base64"),
                encoding: "base64",
              },
            });
          }
          return Promise.reject({ status: 404 });
        });

      const adapter = await createConnectedAdapter(octokit);
      const results = await adapter.collect();
      const q31 = results.find((r) => r.questionId === "D6-Q31");
      const q32 = results.find((r) => r.questionId === "D6-Q32");

      expect(q31?.score).toBeGreaterThanOrEqual(1);
      expect(q32?.score).toBe(2); // CI-validated
    });
  });

  describe("security collector", () => {
    it("scores Q6 as 0 when .env is committed to a repo", async () => {
      const octokit = makeOctokit();
      (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
        data: [{ name: "insecure-repo", full_name: "test-org/insecure-repo", default_branch: "main" }],
      });
      // .env found
      (octokit.repos as Record<string, Mock>)["getContent"] = vi.fn().mockResolvedValue({
        data: { content: Buffer.from("API_KEY=sk-abc123").toString("base64") },
      });

      const adapter = await createConnectedAdapter(octokit);
      const results = await adapter.collect();
      const q6 = results.find((r) => r.questionId === "D1-Q6");

      expect(q6?.score).toBe(0);
    });

    it("scores Q6 as 1 when no .env found and no secrets manager", async () => {
      const octokit = makeOctokit();
      (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
        data: [{ name: "ok-repo", full_name: "test-org/ok-repo", default_branch: "main" }],
      });
      // .env not found, no secrets manager files
      (octokit.repos as Record<string, Mock>)["getContent"] = vi.fn().mockRejectedValue({ status: 404 });
      (octokit.git as Record<string, Mock>)["getTree"] = vi.fn().mockResolvedValue({
        data: {
          tree: [{ type: "blob", path: "src/index.ts" }],
        },
      });

      const adapter = await createConnectedAdapter(octokit);
      const results = await adapter.collect();
      const q6 = results.find((r) => r.questionId === "D1-Q6");

      expect(q6?.score).toBe(1);
    });
  });

  describe("PR analytics collectors", () => {
    it("calculates PR cycle time for Q18", async () => {
      const now = Date.now();
      const octokit = makeOctokit();
      (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
        data: [{ name: "active-repo", full_name: "test-org/active-repo", default_branch: "main" }],
      });

      // Return 15 merged PRs with known cycle times (~2 hours each)
      const prs = Array.from({ length: 15 }, (_, i) => ({
        number: i + 1,
        title: `PR ${i + 1}`,
        body: null,
        state: "closed",
        merged_at: new Date(now - i * 86400000).toISOString(),
        created_at: new Date(now - i * 86400000 - 7200000).toISOString(),
        updated_at: new Date(now - i * 86400000).toISOString(),
      }));

      (octokit.pulls as Record<string, Mock>)["list"] = vi.fn().mockResolvedValue({ data: prs });
      (octokit.pulls as Record<string, Mock>)["listReviews"] = vi.fn().mockResolvedValue({ data: [] });
      (octokit.pulls as Record<string, Mock>)["listCommits"] = vi.fn().mockResolvedValue({ data: [] });

      const adapter = await createConnectedAdapter(octokit);
      const results = await adapter.collect();
      const q18 = results.find((r) => r.questionId === "D3-Q18");

      expect(q18).toBeDefined();
      expect(q18?.score).toBe(2); // ≥10 PRs → score 2
      expect(q18?.evidence[0]?.data).toMatchObject({ totalMergedPRs: 15 });
    });
  });

  describe("actions collectors", () => {
    it("scores Q14 higher with many passing runs", async () => {
      const now = Date.now();
      const octokit = makeOctokit();
      (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
        data: [{ name: "ci-repo", full_name: "test-org/ci-repo", default_branch: "main" }],
      });

      const runs = Array.from({ length: 60 }, (_, i) => ({
        id: i,
        status: "completed",
        conclusion: "success",
        name: "CI",
        created_at: new Date(now - i * 3600000).toISOString(),
        updated_at: new Date(now - i * 3600000 + 600000).toISOString(), // 10 min runs
        run_started_at: new Date(now - i * 3600000).toISOString(),
      }));

      (octokit.actions as Record<string, Mock>)["listWorkflowRunsForRepo"] = vi
        .fn()
        .mockResolvedValue({ data: { workflow_runs: runs } });

      const adapter = await createConnectedAdapter(octokit);
      const results = await adapter.collect();
      const q14 = results.find((r) => r.questionId === "D3-Q14");

      expect(q14?.score).toBe(2); // 60 runs, 0% failure, 10min median → score 2
    });
  });

  describe("rate limiting", () => {
    it("retries on 429 and eventually succeeds", async () => {
      const octokit = makeOctokit();
      let callCount = 0;
      (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          return Promise.reject({ status: 429 });
        }
        return Promise.resolve({ data: [] });
      });

      const adapter = await createConnectedAdapter(octokit);
      // Should not throw — retries on 429
      const results = await adapter.collect();
      expect(results).toHaveLength(16);
      // Verify that a retry actually occurred (not just the empty-org fallback)
      expect(callCount).toBeGreaterThan(1);
    });
  });

  describe("Q20 — AI artifact SDLC (collectAIArtifactSDLCSignal)", () => {
    it("scores 2 when 2+ repos have merged PRs that modified AI config files", async () => {
      const now = Date.now();
      const octokit = makeOctokit();
      (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
        data: [
          { name: "repo-a", full_name: "test-org/repo-a", default_branch: "main" },
          { name: "repo-b", full_name: "test-org/repo-b", default_branch: "main" },
        ],
      });

      const mergedPR = {
        number: 1,
        title: "Update CLAUDE.md",
        body: null,
        state: "closed",
        merged_at: new Date(now - 86400000).toISOString(), // 1 day ago
        created_at: new Date(now - 86400000 - 3600000).toISOString(),
        updated_at: new Date(now - 86400000).toISOString(),
      };

      (octokit.pulls as Record<string, Mock>)["list"] = vi.fn().mockResolvedValue({ data: [mergedPR] });
      (octokit.pulls as Record<string, Mock>)["listFiles"] = vi.fn().mockResolvedValue({
        data: [{ filename: "CLAUDE.md" }, { filename: "src/index.ts" }],
      });
      (octokit.repos as Record<string, Mock>)["listCommits"] = vi.fn().mockResolvedValue({ data: [] });

      const adapter = await createConnectedAdapter(octokit);
      const results = await adapter.collect();
      const q20 = results.find((r) => r.questionId === "D4-Q20");

      expect(q20).toBeDefined();
      expect(q20?.score).toBe(2); // 2 repos both have reviewed AI config PRs
      expect(q20?.evidence[0]?.data).toMatchObject({ reviewedRepos: expect.arrayContaining(["test-org/repo-a", "test-org/repo-b"]) });
    });

    it("scores 1 when only unreviewed direct commits touch AI config files", async () => {
      const octokit = makeOctokit();
      (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
        data: [{ name: "repo-a", full_name: "test-org/repo-a", default_branch: "main" }],
      });

      // No merged PRs but a commit with CLAUDE.md in message
      (octokit.pulls as Record<string, Mock>)["list"] = vi.fn().mockResolvedValue({ data: [] });
      (octokit.repos as Record<string, Mock>)["listCommits"] = vi.fn().mockResolvedValue({
        data: [
          {
            commit: { message: "update CLAUDE.md with new rules" },
            author: { login: "dev" },
          },
        ],
      });

      const adapter = await createConnectedAdapter(octokit);
      const results = await adapter.collect();
      const q20 = results.find((r) => r.questionId === "D4-Q20");

      expect(q20?.score).toBe(1);
      expect(q20?.evidence[0]?.data).toMatchObject({ unreviewedRepos: ["test-org/repo-a"] });
    });
  });

  describe("Q21 — prompt security (collectPromptSecuritySignal)", () => {
    it("scores 2 when server-side prompt dirs found and no client exposure", async () => {
      const octokit = makeOctokit();
      (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
        data: [{ name: "api-service", full_name: "test-org/api-service", default_branch: "main" }],
      });
      (octokit.git as Record<string, Mock>)["getTree"] = vi.fn().mockResolvedValue({
        data: {
          tree: [
            { type: "blob", path: "prompts/system-prompt.txt" },
            { type: "blob", path: "prompts/user-template.txt" },
            { type: "blob", path: "src/server.ts" },
          ],
        },
      });

      const adapter = await createConnectedAdapter(octokit);
      const results = await adapter.collect();
      const q21 = results.find((r) => r.questionId === "D4-Q21");

      expect(q21?.score).toBe(2);
      expect(q21?.evidence[0]?.data).toMatchObject({
        serverSidePromptRepos: ["test-org/api-service"],
        exposedRepos: [],
      });
    });

    it("scores 0 when prompt files found in client-side directories", async () => {
      const octokit = makeOctokit();
      (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
        data: [{ name: "webapp", full_name: "test-org/webapp", default_branch: "main" }],
      });
      (octokit.git as Record<string, Mock>)["getTree"] = vi.fn().mockResolvedValue({
        data: {
          tree: [
            { type: "blob", path: "public/prompts/system-prompt.txt" },
            { type: "blob", path: "src/index.ts" },
          ],
        },
      });

      const adapter = await createConnectedAdapter(octokit);
      const results = await adapter.collect();
      const q21 = results.find((r) => r.questionId === "D4-Q21");

      expect(q21?.score).toBe(0);
      expect(q21?.evidence[0]?.data).toMatchObject({ exposedRepos: ["test-org/webapp"] });
    });
  });

  describe("collector fallback behavior", () => {
    it("emits a zero-score result with confidence 0 when a collector throws", async () => {
      const octokit = makeOctokit();
      (octokit.repos as Record<string, Mock>)["listForOrg"] = vi.fn().mockResolvedValue({
        data: [{ name: "test-repo", full_name: "test-org/test-repo", default_branch: "main" }],
      });
      // Make git.getTree throw an unrecoverable error — will affect multiple repo-scan collectors
      (octokit.git as Record<string, Mock>)["getTree"] = vi.fn().mockRejectedValue(
        new Error("unexpected API error")
      );

      const adapter = await createConnectedAdapter(octokit);
      const results = await adapter.collect();

      // Output must always have exactly 16 entries
      expect(results).toHaveLength(16);

      // Any failed collector should produce confidence:0 and score:0
      const failedResults = results.filter((r) => r.confidence === 0);
      expect(failedResults.length).toBeGreaterThan(0);
      for (const r of failedResults) {
        expect(r.score).toBe(0);
        expect(r.evidence[0]?.summary).toContain("Collector failed");
      }
    });
  });

  describe("covers at least 15 of the 35 questions", () => {
    it("has signals for 15+ unique question IDs", () => {
      const adapter = new GitHubAdapter();
      const questionIds = new Set(adapter.signals.map((s) => s.questionId));
      expect(questionIds.size).toBeGreaterThanOrEqual(15);
    });
  });
});
