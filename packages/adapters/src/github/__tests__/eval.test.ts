import { describe, it, expect, vi } from "vitest";
import {
  collectEvalFrameworkSignal,
  collectEvalDatasetSignal,
  collectBenchmarkSuiteSignal,
} from "../collectors/eval.js";
import type { RepoInfo } from "../collectors/repo-scan.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRepo(name = "test-repo", org = "test-org"): RepoInfo {
  return { name, fullName: `${org}/${name}`, defaultBranch: "main" };
}

function b64(content: string): string {
  return Buffer.from(content).toString("base64");
}

/** Build a minimal Octokit mock with sensible defaults */
function makeOctokit(
  treeBlobs: string[] = [],
  contentMap: Record<string, string> = {},
  branchProtection: { contexts?: string[] } | null = null
) {
  return {
    git: {
      getTree: vi.fn().mockResolvedValue({
        data: {
          tree: treeBlobs.map((path) => ({ type: "blob", path })),
        },
      }),
    },
    repos: {
      getContent: vi.fn().mockImplementation(({ path }: { path: string }) => {
        if (path in contentMap) {
          return Promise.resolve({
            data: { content: b64(contentMap[path]!), encoding: "base64" },
          });
        }
        return Promise.reject({ status: 404 });
      }),
      getBranch: vi.fn().mockResolvedValue({
        data: {
          protection: branchProtection ? { required_status_checks: branchProtection } : undefined,
        },
      }),
    },
  };
}

// ---------------------------------------------------------------------------
// Q42 — Automated eval framework
// ---------------------------------------------------------------------------

describe("collectEvalFrameworkSignal", () => {
  it("scores 2 when eval framework dep AND CI eval step both found", async () => {
    const repo = makeRepo();
    const workflowContent = `
name: CI
jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - run: deepeval test run tests/
`;
    const packageJson = JSON.stringify({
      dependencies: { deepeval: "^0.20.0" },
    });

    const octokit = makeOctokit(["package.json", ".github/workflows/eval.yml"], {
      "package.json": packageJson,
      ".github/workflows/eval.yml": workflowContent,
    });

    const result = await collectEvalFrameworkSignal(octokit as never, [repo]);

    expect(result.signalId).toBe("github:eval:q42-eval-framework");
    expect(result.questionId).toBe("D8-Q42");
    expect(result.score).toBe(2);
    expect(result.confidence).toBe(0.75);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence[0]?.summary).toContain("CI integration");
  });

  it("scores 1 when eval dep found but no CI eval step", async () => {
    const repo = makeRepo();
    const packageJson = JSON.stringify({
      dependencies: { langsmith: "^0.1.0" },
    });

    const octokit = makeOctokit(["package.json"], { "package.json": packageJson });

    const result = await collectEvalFrameworkSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
    expect(result.evidence[0]?.summary).toContain("no CI eval integration");
  });

  it("scores 0 when no eval framework dependencies found", async () => {
    const repo = makeRepo();
    const packageJson = JSON.stringify({ dependencies: { express: "^4.0.0" } });

    const octokit = makeOctokit(["package.json"], { "package.json": packageJson });

    const result = await collectEvalFrameworkSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.summary).toContain("No eval framework");
  });

  it("detects braintrust in package.json", async () => {
    const repo = makeRepo();
    const packageJson = JSON.stringify({
      devDependencies: { braintrust: "^0.0.100" },
    });

    const octokit = makeOctokit(["package.json"], { "package.json": packageJson });

    const result = await collectEvalFrameworkSignal(octokit as never, [repo]);

    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.evidence[0]?.data).toMatchObject({
      detectedFrameworks: expect.arrayContaining(["braintrust"]),
    });
  });

  it("detects arize-phoenix in pyproject.toml", async () => {
    const repo = makeRepo();
    const pyproject = `
[tool.poetry.dependencies]
arize-phoenix = "^3.0.0"
`;

    const octokit = makeOctokit(["pyproject.toml"], { "pyproject.toml": pyproject });

    const result = await collectEvalFrameworkSignal(octokit as never, [repo]);

    expect(result.score).toBeGreaterThanOrEqual(1);
  });

  it("detects ragas in requirements.txt", async () => {
    const repo = makeRepo();
    const requirements = "ragas==0.1.7\nlangchain>=0.1.0\n";

    const octokit = makeOctokit(["requirements.txt"], {
      "requirements.txt": requirements,
    });

    const result = await collectEvalFrameworkSignal(octokit as never, [repo]);

    expect(result.score).toBeGreaterThanOrEqual(1);
  });

  it("detects promptfoo eval in CI workflow", async () => {
    const repo = makeRepo();
    const workflowContent = `
name: Eval
jobs:
  eval:
    steps:
      - run: promptfoo eval --config promptfooconfig.yaml
`;
    const packageJson = JSON.stringify({
      devDependencies: { promptfoo: "^0.50.0" },
    });

    const octokit = makeOctokit(["package.json", ".github/workflows/promptfoo.yml"], {
      "package.json": packageJson,
      ".github/workflows/promptfoo.yml": workflowContent,
    });

    const result = await collectEvalFrameworkSignal(octokit as never, [repo]);

    expect(result.score).toBe(2);
  });

  it("handles missing manifest gracefully", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit(["src/index.ts"]);

    const result = await collectEvalFrameworkSignal(octokit as never, [repo]);

    expect([0, 1, 2]).toContain(result.score);
    expect(result.evidence.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Q44 — Eval datasets in version control
// ---------------------------------------------------------------------------

describe("collectEvalDatasetSignal", () => {
  it("scores 2 when eval dataset dirs found in 2+ repos", async () => {
    const repos = [makeRepo("repo-a"), makeRepo("repo-b")];
    const octokit = makeOctokit(["evals/sample.json", "evals/edge-cases.json"]);

    const result = await collectEvalDatasetSignal(octokit as never, repos);

    expect(result.signalId).toBe("github:eval:q44-eval-datasets");
    expect(result.questionId).toBe("D8-Q44");
    expect(result.score).toBe(2);
    expect(result.confidence).toBe(0.7);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence[0]?.summary).toContain("Eval dataset directories");
  });

  it("scores 1 when eval dataset dirs found in exactly 1 repo", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit(["golden/test1.json", "golden/test2.json"]);

    const result = await collectEvalDatasetSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
    expect(result.evidence[0]?.summary).toContain("Eval dataset directories");
  });

  it("scores 0 when no eval dataset dirs found", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit(["src/index.ts", "tests/unit.test.ts"]);

    const result = await collectEvalDatasetSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.summary).toContain("No eval dataset directories");
  });

  it("detects tests/eval directory", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit(["tests/eval/fixture1.json", "tests/eval/fixture2.json"]);

    const result = await collectEvalDatasetSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
  });

  it("detects goldens directory", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit(["goldens/qa_pairs.jsonl"]);

    const result = await collectEvalDatasetSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
  });

  it("handles tree fetch failure gracefully", async () => {
    const repo = makeRepo();
    const octokit = {
      git: { getTree: vi.fn().mockRejectedValue({ status: 403 }) },
      repos: {
        getContent: vi.fn().mockRejectedValue({ status: 404 }),
        getBranch: vi.fn().mockRejectedValue({ status: 404 }),
      },
    };

    const result = await collectEvalDatasetSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Q45 — Benchmark suite for model promotion
// ---------------------------------------------------------------------------

describe("collectBenchmarkSuiteSignal", () => {
  it("scores 2 when eval status check is referenced in branch protection", async () => {
    const repo = makeRepo();
    const workflowContent = `
name: Benchmarks
jobs:
  benchmark:
    steps:
      - run: run-evals --suite full
`;
    const octokit = makeOctokit(
      [".github/workflows/bench.yml"],
      { ".github/workflows/bench.yml": workflowContent },
      { contexts: ["benchmark / run", "ci / test"] }
    );

    const result = await collectBenchmarkSuiteSignal(octokit as never, [repo]);

    expect(result.signalId).toBe("github:eval:q45-benchmark-suite");
    expect(result.questionId).toBe("D8-Q45");
    expect(result.score).toBe(2);
    expect(result.confidence).toBe(0.65);
    expect(result.evidence[0]?.summary).toContain("branch-protection gates");
  });

  it("scores 1 when benchmark CI exists but no branch protection gate", async () => {
    const repo = makeRepo();
    const workflowContent = `
name: Eval
jobs:
  eval:
    steps:
      - run: pytest tests/eval
`;
    const octokit = makeOctokit(
      [".github/workflows/eval.yml"],
      { ".github/workflows/eval.yml": workflowContent },
      { contexts: ["ci / lint"] } // no eval check
    );

    const result = await collectBenchmarkSuiteSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
    expect(result.evidence[0]?.summary).toContain("not enforced as branch-protection gates");
  });

  it("scores 0 when no benchmark CI steps and no branch protection checks", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit(
      [".github/workflows/ci.yml"],
      { ".github/workflows/ci.yml": "name: CI\njobs:\n  test:\n    runs-on: ubuntu-latest" },
      null
    );

    const result = await collectBenchmarkSuiteSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.summary).toContain("No benchmark or eval CI steps");
  });

  it("detects langsmith eval run in CI workflow", async () => {
    const repo = makeRepo();
    const workflowContent = `
name: LangSmith Evals
jobs:
  eval:
    steps:
      - run: python -m langsmith eval --dataset my-ds
`;
    const octokit = makeOctokit(
      [".github/workflows/langsmith.yml"],
      { ".github/workflows/langsmith.yml": workflowContent },
      null
    );

    const result = await collectBenchmarkSuiteSignal(octokit as never, [repo]);

    expect(result.score).toBeGreaterThanOrEqual(1);
  });

  it("detects quality-gate eval check in branch protection", async () => {
    const repo = makeRepo();
    const workflowContent = `
name: Quality Gate
jobs:
  check:
    steps:
      - run: run-evals
`;
    const octokit = makeOctokit(
      [".github/workflows/quality.yml"],
      { ".github/workflows/quality.yml": workflowContent },
      { contexts: ["quality-gate / evals"] }
    );

    const result = await collectBenchmarkSuiteSignal(octokit as never, [repo]);

    expect(result.score).toBe(2);
  });

  it("handles branch protection API failure gracefully — falls back to CI-only score", async () => {
    const repo = makeRepo();
    const workflowContent = `
name: Benchmarks
jobs:
  bench:
    steps:
      - run: braintrust eval
`;
    const octokit = {
      git: {
        getTree: vi.fn().mockResolvedValue({
          data: {
            tree: [{ type: "blob", path: ".github/workflows/bench.yml" }],
          },
        }),
      },
      repos: {
        getContent: vi.fn().mockImplementation(({ path }: { path: string }) => {
          if (path === ".github/workflows/bench.yml") {
            return Promise.resolve({
              data: { content: b64(workflowContent), encoding: "base64" },
            });
          }
          return Promise.reject({ status: 404 });
        }),
        getBranch: vi.fn().mockRejectedValue({ status: 403 }), // No admin access
      },
    };

    const result = await collectBenchmarkSuiteSignal(octokit as never, [repo]);

    // CI step found (score 1); branch protection check failed gracefully
    expect(result.score).toBe(1);
    expect(result.evidence.length).toBeGreaterThan(0);
  });
});
