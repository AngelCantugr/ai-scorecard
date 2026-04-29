import { describe, it, expect, vi } from "vitest";

import { collectSecretsManagementSignal } from "../../src/github/collectors/security.js";

import { loadFixture, makeRepo, makeOctokitError } from "../fixtures/helpers.js";

type TreeFixture = {
  data: { tree: Array<{ type: string; path: string }> };
};
type ContentFixture = { data: { content: string; encoding: string } };

describe("collectSecretsManagementSignal — Q6", () => {
  it("happy path: scores 2 when a secrets manager config is present and no .env committed", async () => {
    const tree = loadFixture<TreeFixture>("repo-with-secrets-manager.json");
    const repo = makeRepo("safe-repo");

    const octokit = {
      git: { getTree: vi.fn().mockResolvedValue(tree) },
      repos: {
        getContent: vi.fn().mockImplementation(({ path }: { path: string }) => {
          // .env not present → 404
          if (path === ".env") return Promise.reject(makeOctokitError(404, "Not Found"));
          // sample TS file: clean
          if (path === "src/index.ts") {
            return Promise.resolve({
              data: { content: Buffer.from("export const x = 1;").toString("base64") },
            });
          }
          if (path === ".env.example") {
            return Promise.resolve({
              data: { content: Buffer.from("API_KEY=").toString("base64") },
            });
          }
          if (path === "infra/secrets/vault.hcl") {
            return Promise.resolve({
              data: { content: Buffer.from('path "secret/data/*"').toString("base64") },
            });
          }
          return Promise.reject(makeOctokitError(404, "Not Found"));
        }),
      },
    };

    const result = await collectSecretsManagementSignal(octokit as never, [repo]);

    expect(result.signalId).toBe("github:security:q6-secrets-management");
    expect(result.questionId).toBe("D1-Q6");
    expect(result.score).toBe(2);
    expect(result.evidence[0]?.data).toMatchObject({
      secretsManagerRepos: ["test-org/safe-repo"],
      envInGitRepos: [],
    });
  });

  it("scores 0 when .env is committed to a repo (fixture: repo-with-secrets)", async () => {
    const tree = loadFixture<TreeFixture>("repo-with-secrets.json");
    const envContent = loadFixture<ContentFixture>("env-file-content.json");
    const repo = makeRepo("insecure-repo");

    const octokit = {
      git: { getTree: vi.fn().mockResolvedValue(tree) },
      repos: {
        getContent: vi.fn().mockImplementation(({ path }: { path: string }) => {
          if (path === ".env") return Promise.resolve(envContent);
          return Promise.reject(makeOctokitError(404, "Not Found"));
        }),
      },
    };

    const result = await collectSecretsManagementSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.data).toMatchObject({
      envInGitRepos: ["test-org/insecure-repo"],
    });
  });

  it("scores 0 when a hardcoded API key pattern is found in source files", async () => {
    const repo = makeRepo("leaky-repo");
    const octokit = {
      git: {
        getTree: vi.fn().mockResolvedValue({
          data: {
            tree: [
              { type: "blob", path: "src/client.ts" },
              { type: "blob", path: "package.json" },
            ],
          },
        }),
      },
      repos: {
        getContent: vi.fn().mockImplementation(({ path }: { path: string }) => {
          if (path === ".env") return Promise.reject(makeOctokitError(404, "Not Found"));
          if (path === "src/client.ts") {
            return Promise.resolve({
              data: {
                content: Buffer.from(
                  'const key = "sk-abcdefghijklmnopqrstuvwxyz1234567890";'
                ).toString("base64"),
              },
            });
          }
          if (path === "package.json") {
            return Promise.resolve({
              data: { content: Buffer.from('{"name":"x"}').toString("base64") },
            });
          }
          return Promise.reject(makeOctokitError(404, "Not Found"));
        }),
      },
    };

    const result = await collectSecretsManagementSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.data).toMatchObject({
      hardcodedKeyRepos: ["test-org/leaky-repo"],
    });
  });

  it("scores 1 when no .env and no hardcoded keys but no secrets manager either", async () => {
    const repo = makeRepo("ok-repo");
    const octokit = {
      git: {
        getTree: vi.fn().mockResolvedValue({
          data: { tree: [{ type: "blob", path: "src/index.ts" }] },
        }),
      },
      repos: {
        getContent: vi.fn().mockImplementation(({ path }: { path: string }) => {
          if (path === "src/index.ts") {
            return Promise.resolve({
              data: { content: Buffer.from("export const x = 1;").toString("base64") },
            });
          }
          return Promise.reject(makeOctokitError(404, "Not Found"));
        }),
      },
    };

    const result = await collectSecretsManagementSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
  });

  it("error path: getTree 401 → repo skipped, falls through to score 1", async () => {
    const repo = makeRepo();
    const octokit = {
      git: { getTree: vi.fn().mockRejectedValue(makeOctokitError(401, "Bad credentials")) },
      repos: {
        getContent: vi.fn().mockRejectedValue(makeOctokitError(404, "Not Found")),
      },
    };

    const result = await collectSecretsManagementSignal(octokit as never, [repo]);

    // .env probe fails (404), tree fails (401) — both swallowed; default score is 1.
    // TODO(reliability): once PR3 lands, this should propagate a typed AuthenticationError
    // instead of silently producing a clean-looking score 1 from a failed scan.
    expect(result.score).toBe(1);
  });

  it("error path: getTree 429 rate-limit → no throw, repo treated as empty", async () => {
    const repo = makeRepo();
    const octokit = {
      git: { getTree: vi.fn().mockRejectedValue(makeOctokitError(429, "Rate limited")) },
      repos: {
        getContent: vi.fn().mockRejectedValue(makeOctokitError(404, "Not Found")),
      },
    };

    const result = await collectSecretsManagementSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
  });
});
