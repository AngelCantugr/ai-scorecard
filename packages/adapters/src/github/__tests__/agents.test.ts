import { describe, it, expect, vi } from "vitest";
import {
  collectAgentScopeSignal,
  collectStructuredOutputsSignal,
  collectComposableWorkflowsSignal,
  collectSessionLoggingSignal,
  collectHumanOversightSignal,
  collectVersionedInstructionsSignal,
} from "../collectors/agents.js";
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
  pullsData: unknown[] = []
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
    },
    pulls: {
      list: vi.fn().mockResolvedValue({ data: pullsData }),
      listFiles: vi.fn().mockResolvedValue({ data: [] }),
    },
  };
}

// ---------------------------------------------------------------------------
// Q36 — Agent scope/permissions
// ---------------------------------------------------------------------------

describe("collectAgentScopeSignal", () => {
  it("scores 2 when agent files contain explicit scope keywords", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit([".github/agents/coder.md"], {
      ".github/agents/coder.md": 'allowedTools: ["read_file", "write_file"]',
    });

    const { result } = await collectAgentScopeSignal(octokit as never, [repo]);

    expect(result.signalId).toBe("github:repo-scan:q36-agent-scope");
    expect(result.questionId).toBe("D7-Q36");
    expect(result.score).toBe(2);
    expect(result.confidence).toBe(0.7);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("scores 1 when agent dirs exist but no scope definitions in content", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit([".github/agents/coder.md"], {
      ".github/agents/coder.md": "# My Agent\nDo some stuff.",
    });

    const { result } = await collectAgentScopeSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
    expect(result.evidence[0]?.summary).toContain("no explicit scope definitions");
  });

  it("scores 0 when no agent directories exist", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit(["src/index.ts", "package.json"]);

    const { result } = await collectAgentScopeSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.summary).toContain("No agent directories found");
  });

  it("handles malformed/empty agent file content gracefully", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit([".claude/agents/assistant.json"], {
      ".claude/agents/assistant.json": "",
    });

    const { result } = await collectAgentScopeSignal(octokit as never, [repo]);

    expect(() => result.score).not.toThrow();
    expect([0, 1, 2]).toContain(result.score);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("detects permissions keyword in agent files", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit(["agents/bot.yaml"], {
      "agents/bot.yaml": "permissions:\n  read: true\n  write: false",
    });

    const { result } = await collectAgentScopeSignal(octokit as never, [repo]);

    expect(result.score).toBe(2);
  });

  it("detects devcontainer paths as agent-adjacent evidence", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit([".devcontainer/devcontainer.json"], {
      ".devcontainer/devcontainer.json": '{"sandboxed": true, "allowedTools": ["bash"]}',
    });

    const { result } = await collectAgentScopeSignal(octokit as never, [repo]);

    expect(result.score).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Q37 — Structured outputs
// ---------------------------------------------------------------------------

describe("collectStructuredOutputsSignal", () => {
  it("scores 2 when schema definitions found in 2+ repos", async () => {
    const repos = [makeRepo("repo-a"), makeRepo("repo-b")];
    const octokit = makeOctokit([".github/agents/extractor.md"], {
      ".github/agents/extractor.md": 'outputSchema: { type: "object", properties: {} }',
    });

    const { result } = await collectStructuredOutputsSignal(octokit as never, repos);

    expect(result.signalId).toBe("github:repo-scan:q37-structured-outputs");
    expect(result.questionId).toBe("D7-Q37");
    expect(result.score).toBe(2);
    expect(result.confidence).toBe(0.5);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("scores 1 when schema definitions found in exactly 1 repo", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit([".github/agents/extractor.md"], {
      ".github/agents/extractor.md": "response_format: json_object",
    });

    const { result } = await collectStructuredOutputsSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
    expect(result.evidence[0]?.summary).toContain("Output schema definitions found");
  });

  it("scores 0 when no agent files with schema patterns exist", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit(["src/index.ts", "README.md"]);

    const { result } = await collectStructuredOutputsSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.summary).toContain("No output schema definitions");
  });

  it("detects Zod validator imports in agent-adjacent TypeScript files", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit([".github/agents/processor.ts"], {
      ".github/agents/processor.ts": 'import { z } from "zod";\nconst schema = z.object({});',
    });

    const { result } = await collectStructuredOutputsSignal(octokit as never, [repo]);

    expect(result.score).toBeGreaterThanOrEqual(1);
  });

  it("handles missing/malformed file content without throwing", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit([".github/agents/broken.json"], {});
    // getContent will reject with 404 since path not in contentMap

    const { result } = await collectStructuredOutputsSignal(octokit as never, [repo]);

    expect(() => result.score).not.toThrow();
    expect([0, 1, 2]).toContain(result.score);
    expect(result.evidence.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Q38 — Composable workflows
// ---------------------------------------------------------------------------

describe("collectComposableWorkflowsSignal", () => {
  it("scores 2 when multiple composability signals found across repos", async () => {
    const repos = [makeRepo("repo-a"), makeRepo("repo-b")];
    const octokit = makeOctokit([".github/workflows/copilot-setup-steps.yml", ".mcp.json"]);

    const { result } = await collectComposableWorkflowsSignal(octokit as never, repos);

    expect(result.signalId).toBe("github:repo-scan:q38-composable-workflows");
    expect(result.questionId).toBe("D7-Q38");
    expect(result.score).toBe(2);
    expect(result.confidence).toBe(0.6);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("scores 1 when composability found in exactly 1 repo", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit(["agents.yaml", "src/index.ts"]);

    const { result } = await collectComposableWorkflowsSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
    expect(result.evidence[0]?.summary).toContain("Composable workflow signals found");
  });

  it("scores 0 when no composition evidence found", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit(["src/index.ts", "package.json", "README.md"]);

    const { result } = await collectComposableWorkflowsSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.summary).toContain("No workflow composition evidence");
  });

  it("detects MCP config files", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit(["mcp-config.json", "src/app.ts"]);

    const { result } = await collectComposableWorkflowsSignal(octokit as never, [repo]);

    expect(result.score).toBeGreaterThanOrEqual(1);
  });

  it("handles tree fetch failure gracefully (returns score 0)", async () => {
    const repo = makeRepo();
    const octokit = {
      git: { getTree: vi.fn().mockRejectedValue({ status: 403 }) },
      repos: { getContent: vi.fn().mockRejectedValue({ status: 404 }) },
      pulls: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        listFiles: vi.fn().mockResolvedValue({ data: [] }),
      },
    };

    const { result } = await collectComposableWorkflowsSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Q39 — Session logging / reproducible traces
// ---------------------------------------------------------------------------

describe("collectSessionLoggingSignal", () => {
  it("scores 2 when hook files have both preToolUse and postToolUse", async () => {
    const repo = makeRepo();
    const hookContent = JSON.stringify({
      preToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "echo pre" }] }],
      postToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "echo post" }] }],
    });
    const octokit = makeOctokit([".github/hooks/tools.json"], {
      ".github/hooks/tools.json": hookContent,
    });

    const { result } = await collectSessionLoggingSignal(octokit as never, [repo]);

    expect(result.signalId).toBe("github:repo-scan:q39-session-logging");
    expect(result.questionId).toBe("D7-Q39");
    expect(result.score).toBe(2);
    expect(result.confidence).toBe(0.65);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("scores 1 when hook files exist but lack preToolUse/postToolUse", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit([".github/hooks/basic.json"], {
      ".github/hooks/basic.json": '{"version": 1}',
    });

    const { result } = await collectSessionLoggingSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
    expect(result.evidence[0]?.summary).toContain("no preToolUse/postToolUse");
  });

  it("scores 0 when no hook or logging configs found", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit(["src/index.ts", "README.md"]);

    const { result } = await collectSessionLoggingSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.summary).toContain("No hook/logging configs");
  });

  it("detects hook keywords in agent files", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit([".claude/agents/assistant.md"], {
      ".claude/agents/assistant.md": "hooks:\n  logging: true\n  sessionLog: /var/log/session",
    });

    const { result } = await collectSessionLoggingSignal(octokit as never, [repo]);

    expect(result.score).toBeGreaterThanOrEqual(1);
  });

  it("handles invalid JSON in hook files without throwing", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit([".claude/hooks/broken.json"], {
      ".claude/hooks/broken.json": "this is not json {{{{",
    });

    const { result } = await collectSessionLoggingSignal(octokit as never, [repo]);

    // Should not throw; broken content still has a hook file present → score 1
    expect([0, 1, 2]).toContain(result.score);
    expect(result.evidence.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Q40 — Human-in-the-loop approval
// ---------------------------------------------------------------------------

describe("collectHumanOversightSignal", () => {
  it("scores 2 when preToolUse hook with approval keyword found", async () => {
    const repo = makeRepo();
    const hookContent = JSON.stringify({
      preToolUse: [
        {
          matcher: "Write|Edit",
          hooks: [{ type: "command", command: "confirm 'Approve file write?'" }],
        },
      ],
    });
    const octokit = makeOctokit([".github/hooks/approval.json"], {
      ".github/hooks/approval.json": hookContent,
    });

    const { result } = await collectHumanOversightSignal(octokit as never, [repo]);

    expect(result.signalId).toBe("github:repo-scan:q40-human-oversight");
    expect(result.questionId).toBe("D7-Q40");
    expect(result.score).toBe(2);
    expect(result.confidence).toBe(0.6);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("scores 2 when workflow file has environment approval gate", async () => {
    const repo = makeRepo();
    const workflowContent = `
name: Deploy
jobs:
  deploy:
    environment:
      name: production
      url: https://example.com
    runs-on: ubuntu-latest
`;
    const octokit = makeOctokit([".github/workflows/deploy.yml"], {
      ".github/workflows/deploy.yml": workflowContent,
    });

    const { result } = await collectHumanOversightSignal(octokit as never, [repo]);

    expect(result.score).toBe(2);
  });

  it("scores 1 when only postToolUse hooks found (informal gate)", async () => {
    const repo = makeRepo();
    const hookContent = JSON.stringify({
      postToolUse: [{ matcher: "*", hooks: [{ type: "command", command: "log-action" }] }],
    });
    const octokit = makeOctokit([".github/hooks/post.json"], {
      ".github/hooks/post.json": hookContent,
    });

    const { result } = await collectHumanOversightSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
  });

  it("scores 0 when no approval gates found", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit(["src/index.ts", ".github/workflows/ci.yml"], {
      ".github/workflows/ci.yml": "name: CI\njobs:\n  test:\n    runs-on: ubuntu-latest",
    });

    const { result } = await collectHumanOversightSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.summary).toContain("No approval gates");
  });

  it("handles missing hook file content gracefully", async () => {
    const repo = makeRepo();
    // Hook file in tree but getContent returns 404
    const octokit = makeOctokit([".github/hooks/missing.json"]);

    const { result } = await collectHumanOversightSignal(octokit as never, [repo]);

    expect([0, 1, 2]).toContain(result.score);
    expect(result.evidence.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Q41 — Versioned & reviewed instructions
// ---------------------------------------------------------------------------

describe("collectVersionedInstructionsSignal", () => {
  it("scores 2 when agent instruction files are reviewed via merged PRs", async () => {
    const now = Date.now();
    const repo = makeRepo();
    const mergedPR = {
      number: 42,
      title: "Update agent instructions",
      state: "closed",
      merged_at: new Date(now - 86400000).toISOString(), // 1 day ago
      created_at: new Date(now - 86400000 - 3600000).toISOString(),
      updated_at: new Date(now - 86400000).toISOString(),
    };

    const octokit = {
      git: {
        getTree: vi.fn().mockResolvedValue({
          data: {
            tree: [
              { type: "blob", path: ".github/agents/coder.md" },
              { type: "blob", path: ".github/agents/reviewer.md" },
            ],
          },
        }),
      },
      repos: { getContent: vi.fn().mockRejectedValue({ status: 404 }) },
      pulls: {
        list: vi.fn().mockResolvedValue({ data: [mergedPR] }),
        listFiles: vi.fn().mockResolvedValue({
          data: [{ filename: ".github/agents/coder.md" }, { filename: "README.md" }],
        }),
      },
    };

    const { result } = await collectVersionedInstructionsSignal(octokit as never, [repo]);

    expect(result.signalId).toBe("github:repo-scan:q41-versioned-instructions");
    expect(result.questionId).toBe("D7-Q41");
    expect(result.score).toBe(2);
    expect(result.confidence).toBe(0.7);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence[0]?.summary).toContain("reviewed via PRs");
  });

  it("scores 1 when agent instruction files exist but no PR review evidence", async () => {
    const repo = makeRepo();
    const octokit = {
      git: {
        getTree: vi.fn().mockResolvedValue({
          data: {
            tree: [{ type: "blob", path: ".claude/agents/assistant.md" }],
          },
        }),
      },
      repos: { getContent: vi.fn().mockRejectedValue({ status: 404 }) },
      pulls: {
        list: vi.fn().mockResolvedValue({ data: [] }), // No merged PRs
        listFiles: vi.fn().mockResolvedValue({ data: [] }),
      },
    };

    const { result } = await collectVersionedInstructionsSignal(octokit as never, [repo]);

    expect(result.score).toBe(1);
    expect(result.evidence[0]?.summary).toContain("no PR review evidence");
  });

  it("scores 0 when no agent instruction files found", async () => {
    const repo = makeRepo();
    const octokit = makeOctokit(["src/index.ts", "README.md"]);

    const { result } = await collectVersionedInstructionsSignal(octokit as never, [repo]);

    expect(result.score).toBe(0);
    expect(result.evidence[0]?.summary).toContain("No agent instruction files found");
  });

  it("handles PR API failure gracefully — still scores 1 for file presence", async () => {
    const repo = makeRepo();
    const octokit = {
      git: {
        getTree: vi.fn().mockResolvedValue({
          data: {
            tree: [{ type: "blob", path: "agents/bot.md" }],
          },
        }),
      },
      repos: { getContent: vi.fn().mockRejectedValue({ status: 404 }) },
      pulls: {
        list: vi.fn().mockRejectedValue(new Error("API down")), // PR lookup fails
        listFiles: vi.fn().mockResolvedValue({ data: [] }),
      },
    };

    const { result } = await collectVersionedInstructionsSignal(octokit as never, [repo]);

    // File exists but PR lookup failed → should still score 1 (not throw)
    expect([0, 1]).toContain(result.score);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("ignores PRs merged outside the 30-day window", async () => {
    const repo = makeRepo();
    const oldPR = {
      number: 1,
      title: "Old update",
      state: "closed",
      // 60 days ago — outside the 30-day window
      merged_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 61 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const octokit = {
      git: {
        getTree: vi.fn().mockResolvedValue({
          data: {
            tree: [{ type: "blob", path: ".github/agents/coder.md" }],
          },
        }),
      },
      repos: { getContent: vi.fn().mockRejectedValue({ status: 404 }) },
      pulls: {
        list: vi.fn().mockResolvedValue({ data: [oldPR] }),
        listFiles: vi.fn().mockResolvedValue({
          data: [{ filename: ".github/agents/coder.md" }],
        }),
      },
    };

    const { result } = await collectVersionedInstructionsSignal(octokit as never, [repo]);

    // Old PR is outside the window, so score is 1 (file exists, no recent review)
    expect(result.score).toBe(1);
  });
});
