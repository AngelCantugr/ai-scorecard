import { describe, it, expect, vi } from "vitest";

import {
  collectGatewaySignal,
  collectPromptManagementSignal,
  collectSteeringFilesSignal,
  collectAIRulesSignal,
  collectPromptSecuritySignal,
  collectTracingSignal,
  collectDocumentationSignal,
  collectSpecAccuracySignal,
} from "../../src/github/collectors/repo-scan.js";

import { loadFixture, makeRepo, makeOctokitError } from "../fixtures/helpers.js";

type TreeFixture = {
  data: { tree: Array<{ type: string; path: string }>; truncated?: boolean };
};
type ContentFixture = { data: { content: string; encoding: string } };

/**
 * Reusable Octokit mock factory. `treePaths` is the list of blob paths returned
 * by git.getTree; `contentByPath` maps `repos.getContent({ path })` to fixture data.
 */
function makeOctokit(opts: {
  treePaths?: string[];
  contentByPath?: Record<string, { data: { content: string; encoding: string } }>;
  treeError?: Error & { status?: number };
}) {
  const { treePaths = [], contentByPath = {}, treeError } = opts;

  return {
    git: {
      getTree: treeError
        ? vi.fn().mockRejectedValue(treeError)
        : vi.fn().mockResolvedValue({
            data: {
              tree: treePaths.map((path) => ({ type: "blob", path })),
            },
          }),
    },
    repos: {
      getContent: vi.fn().mockImplementation(({ path }: { path: string }) => {
        if (path in contentByPath) return Promise.resolve(contentByPath[path]);
        return Promise.reject(makeOctokitError(404, "Not Found"));
      }),
    },
  };
}

describe("collectGatewaySignal — Q1", () => {
  it("happy path: scores 2 when exactly one repo has a centralized gateway config", async () => {
    const repo = makeRepo("ai-gateway");
    const octokit = makeOctokit({ treePaths: ["litellm.yaml", "src/index.ts"] });

    const result = await collectGatewaySignal(octokit as never, [repo]);

    expect(result.signalId).toBe("github:repo-scan:q1-gateway");
    expect(result.questionId).toBe("D1-Q1");
    expect(result.score).toBe(2);
    expect(result.confidence).toBe(0.7);
    expect(result.evidence[0]?.data).toMatchObject({
      matchedRepos: ["test-org/ai-gateway"],
    });
  });

  it("scores 1 when gateway configs are distributed across 2+ repos", async () => {
    const repos = [makeRepo("svc-a"), makeRepo("svc-b")];
    const octokit = makeOctokit({ treePaths: ["litellm.yaml"] });

    const result = await collectGatewaySignal(octokit as never, repos);

    expect(result.score).toBe(1);
  });

  it("scores 0 when no gateway config files are present", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ treePaths: ["src/index.ts", "package.json"] });

    const result = await collectGatewaySignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.summary).toContain("No AI gateway");
  });

  it("error path: returns score 0 when getTree throws 404 (repo not accessible)", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ treeError: makeOctokitError(404, "Not Found") });

    const result = await collectGatewaySignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    // TODO(reliability): once PR3 (typed-error propagation) lands, expect a typed error
    // result instead of the legacy "treat 404 as empty paths" behavior.
  });

  it("error path: returns score 0 when getTree throws 403 (insufficient scope)", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ treeError: makeOctokitError(403, "Forbidden") });

    const result = await collectGatewaySignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });

  it("error path: propagates unexpected errors (non-404/403)", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ treeError: makeOctokitError(500, "Server Error") });

    await expect(collectGatewaySignal(octokit as never, [repo])).rejects.toThrow();
  });
});

describe("collectPromptManagementSignal — Q5", () => {
  it("happy path: scores 2 when prompt dirs found in 3+ repos", async () => {
    const repos = [makeRepo("a"), makeRepo("b"), makeRepo("c")];
    const octokit = makeOctokit({ treePaths: ["prompts/system.txt"] });

    const result = await collectPromptManagementSignal(octokit as never, repos);

    expect(result.signalId).toBe("github:repo-scan:q5-prompt-management");
    expect(result.questionId).toBe("D1-Q5");
    expect(result.score).toBe(2);
  });

  it("scores 1 when prompt dirs found in fewer than 3 repos", async () => {
    const repos = [makeRepo("a"), makeRepo("b")];
    const octokit = makeOctokit({ treePaths: ["templates/welcome.md"] });

    const result = await collectPromptManagementSignal(octokit as never, repos);

    expect(result.score).toBe(1);
  });

  it("scores 0 when no prompt dirs are found", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ treePaths: ["src/index.ts"] });

    const result = await collectPromptManagementSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });

  it("error path: 404 from getTree degrades to score 0 without throwing", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ treeError: makeOctokitError(404, "Not Found") });

    const result = await collectPromptManagementSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });
});

describe("collectSteeringFilesSignal — Q7", () => {
  it("happy path: scores 2 when fixture repo has CLAUDE.md, agents.md, .cursorrules", async () => {
    const fixture = loadFixture<TreeFixture>("repo-with-claude-md.json");
    const repo = makeRepo("repo-with-steering");
    const octokit = {
      git: { getTree: vi.fn().mockResolvedValue(fixture) },
      repos: { getContent: vi.fn() },
    };

    const result = await collectSteeringFilesSignal(octokit as never, [repo]);

    expect(result.signalId).toBe("github:repo-scan:q7-steering-files");
    expect(result.questionId).toBe("D2-Q7");
    expect(result.score).toBe(2);
    expect(result.evidence[0]?.data).toMatchObject({
      matchedRepos: ["test-org/repo-with-steering"],
      coveragePercent: 100,
    });
  });

  it("scores 1 when only some repos have steering files (coverage > 0 but < 50%)", async () => {
    const repos = [makeRepo("a"), makeRepo("b"), makeRepo("c")];
    let call = 0;
    const octokit = {
      git: {
        getTree: vi.fn().mockImplementation(() => {
          call++;
          return Promise.resolve({
            data: {
              tree:
                call === 1
                  ? [{ type: "blob", path: "CLAUDE.md" }]
                  : [{ type: "blob", path: "src/index.ts" }],
            },
          });
        }),
      },
      repos: { getContent: vi.fn() },
    };

    const result = await collectSteeringFilesSignal(octokit as never, repos);

    expect(result.score).toBe(1);
  });

  it("scores 0 when no steering files are found", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ treePaths: ["src/index.ts"] });

    const result = await collectSteeringFilesSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.summary).toContain("No AI steering files");
  });

  it("error path: 401 unauthorized propagates (auth failure is not silently swallowed)", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ treeError: makeOctokitError(401, "Bad credentials") });

    await expect(collectSteeringFilesSignal(octokit as never, [repo])).rejects.toThrow();
    // TODO(reliability): once PR3 lands, the adapter should propagate a typed
    // AuthenticationError. Today an HTTP error with status 401 bubbles up as-is,
    // which is the legacy behavior asserted here.
  });
});

describe("collectAIRulesSignal — Q8", () => {
  it("happy path: scores 2 when CLAUDE.md content covers lint+test+debug rules", async () => {
    const treeFixture = loadFixture<TreeFixture>("repo-with-claude-md.json");
    const contentFixture = loadFixture<ContentFixture>("claude-md-comprehensive-content.json");
    const repo = makeRepo("repo-with-steering");

    const octokit = {
      git: { getTree: vi.fn().mockResolvedValue(treeFixture) },
      repos: {
        getContent: vi.fn().mockImplementation(({ path }: { path: string }) => {
          if (path === "CLAUDE.md") return Promise.resolve(contentFixture);
          return Promise.reject(makeOctokitError(404, "Not Found"));
        }),
      },
    };

    const result = await collectAIRulesSignal(octokit as never, [repo]);

    expect(result.signalId).toBe("github:repo-scan:q8-ai-rules");
    expect(result.questionId).toBe("D2-Q8");
    expect(result.score).toBe(2);
    expect(result.evidence[0]?.data).toMatchObject({
      comprehensiveRepos: ["test-org/repo-with-steering"],
    });
  });

  it("scores 1 when CLAUDE.md exists but lacks lint/test/debug keywords", async () => {
    const repo = makeRepo();
    const longShallowContent = "This is a long but shallow rules file. ".repeat(20);
    const octokit = makeOctokit({
      treePaths: ["CLAUDE.md"],
      contentByPath: {
        "CLAUDE.md": {
          data: {
            content: Buffer.from(longShallowContent).toString("base64"),
            encoding: "base64",
          },
        },
      },
    });

    const result = await collectAIRulesSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
  });

  it("scores 0 when no steering files are present", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ treePaths: ["src/index.ts"] });

    const result = await collectAIRulesSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });

  it("error path: getContent failure does not crash the collector", async () => {
    const repo = makeRepo();
    const octokit = {
      git: {
        getTree: vi.fn().mockResolvedValue({
          data: { tree: [{ type: "blob", path: "CLAUDE.md" }] },
        }),
      },
      repos: {
        getContent: vi.fn().mockRejectedValue(makeOctokitError(500, "Server Error")),
      },
    };

    const result = await collectAIRulesSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.summary).toContain("No AI rule files");
  });
});

describe("collectPromptSecuritySignal — Q21", () => {
  it("happy path: scores 2 when server-side prompts exist with no client exposure", async () => {
    const repo = makeRepo("api-service");
    const octokit = makeOctokit({
      treePaths: ["prompts/system.txt", "prompts/user.txt", "src/server.ts"],
    });

    const result = await collectPromptSecuritySignal(octokit as never, [repo]);

    expect(result.score).toBe(2);
    expect(result.evidence[0]?.data).toMatchObject({
      serverSidePromptRepos: ["test-org/api-service"],
      exposedRepos: [],
    });
  });

  it("scores 0 when prompt files are exposed in client-side directories", async () => {
    const repo = makeRepo("webapp");
    const octokit = makeOctokit({
      treePaths: ["public/prompts/system.txt", "src/index.ts"],
    });

    const result = await collectPromptSecuritySignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.data).toMatchObject({
      exposedRepos: ["test-org/webapp"],
    });
  });

  it("error path: tree fetch failure (404) leaves score at default for missing repo", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ treeError: makeOctokitError(404, "Not Found") });

    const result = await collectPromptSecuritySignal(octokit as never, [repo]);

    // 404 → empty paths → no client exposure, no server prompts, but repo exists in input → score 1
    expect(result.score).toBe(1);
  });
});

describe("collectTracingSignal — Q25", () => {
  it("happy path: scores 2 when 2+ repos have observability configs", async () => {
    const repos = [makeRepo("a"), makeRepo("b")];
    const octokit = makeOctokit({ treePaths: ["opentelemetry.yaml"] });

    const result = await collectTracingSignal(octokit as never, repos);

    expect(result.signalId).toBe("github:repo-scan:q25-tracing");
    expect(result.score).toBe(2);
  });

  it("scores 1 when one repo has obs deps in package.json", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({
      treePaths: ["package.json", "src/index.ts"],
      contentByPath: {
        "package.json": {
          data: {
            content: Buffer.from(JSON.stringify({ dependencies: { langfuse: "^2.0.0" } })).toString(
              "base64"
            ),
            encoding: "base64",
          },
        },
      },
    });

    const result = await collectTracingSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
  });

  it("scores 0 when no observability evidence found", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ treePaths: ["src/index.ts"] });

    const result = await collectTracingSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });
});

describe("collectDocumentationSignal — Q31", () => {
  it("happy path: scores 2 when both OpenAPI spec and TypeScript files are present", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ treePaths: ["openapi.yaml", "src/index.ts", "src/types.d.ts"] });

    const result = await collectDocumentationSignal(octokit as never, [repo]);

    expect(result.signalId).toBe("github:repo-scan:q31-ai-friendly-docs");
    expect(result.score).toBe(2);
  });

  it("scores 1 when only TypeScript (no OpenAPI) is present in 2+ repos", async () => {
    const repos = [makeRepo("a"), makeRepo("b")];
    const octokit = makeOctokit({ treePaths: ["src/index.ts"] });

    const result = await collectDocumentationSignal(octokit as never, repos);

    expect(result.score).toBe(1);
  });

  it("scores 0 when neither OpenAPI nor TypeScript is found", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ treePaths: ["src/index.js", "README.md"] });

    const result = await collectDocumentationSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });
});

describe("collectSpecAccuracySignal — Q32", () => {
  it("happy path: scores 2 when OpenAPI spec is referenced in a CI workflow", async () => {
    const repo = makeRepo("api-service");
    const workflowContent = "steps:\n  - run: npx @redocly/openapi-cli lint openapi.yaml";
    const octokit = makeOctokit({
      treePaths: ["openapi.yaml", ".github/workflows/spec.yml"],
      contentByPath: {
        ".github/workflows/spec.yml": {
          data: {
            content: Buffer.from(workflowContent).toString("base64"),
            encoding: "base64",
          },
        },
      },
    });

    const result = await collectSpecAccuracySignal(octokit as never, [repo]);

    expect(result.signalId).toBe("github:repo-scan:q32-spec-accuracy");
    expect(result.score).toBe(2);
    expect(result.evidence[0]?.data).toMatchObject({
      specsValidatedInCI: ["test-org/api-service"],
    });
  });

  it("scores 1 when spec exists but no CI validation workflow references it", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ treePaths: ["openapi.yaml"] });

    const result = await collectSpecAccuracySignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
  });

  it("scores 0 when no spec file is found", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit({ treePaths: ["src/index.ts"] });

    const result = await collectSpecAccuracySignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
  });

  it("error path: workflow getContent failure does not break the collector", async () => {
    const repo = makeRepo();
    const octokit = {
      git: {
        getTree: vi.fn().mockResolvedValue({
          data: {
            tree: [
              { type: "blob", path: "openapi.yaml" },
              { type: "blob", path: ".github/workflows/spec.yml" },
            ],
          },
        }),
      },
      repos: {
        getContent: vi.fn().mockRejectedValue(makeOctokitError(500, "Server Error")),
      },
    };

    const result = await collectSpecAccuracySignal(octokit as never, [repo]);

    // Spec exists but CI validation cannot be confirmed → score 1 (not 2, not crash)
    expect(result.score).toBe(1);
  });
});
