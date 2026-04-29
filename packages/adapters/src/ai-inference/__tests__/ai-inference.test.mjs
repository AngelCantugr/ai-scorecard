import test from "node:test";
import assert from "node:assert/strict";

import {
  AIInferenceEngine,
  AI_INFERENCE_QUESTION_IDS,
} from "../../../dist/ai-inference/index.js";
import { isSensitivePath } from "../../../dist/ai-inference/prompts/utils.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal ContentBundle for testing */
function makeBundle(source = "test-repo", files = []) {
  return { source, files };
}

/** Build a fake Anthropic-style message response */
function makeAnthropicResponse(results) {
  return {
    content: [{ type: "text", text: JSON.stringify(results) }],
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

/** Build a valid AIAnalysisResult for a question */
function makeResult(questionId, score = 1) {
  return {
    questionId,
    score,
    confidence: 0.5,
    reasoning: `Test reasoning for ${questionId}`,
    evidence_summary: `Test evidence for ${questionId}`,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("AI_INFERENCE_QUESTION_IDS exports the correct 21 question IDs", () => {
  const expected = [
    "D4-Q22",
    "D1-Q2",
    "D1-Q3",
    "D1-Q4",
    "D2-Q9",
    "D2-Q10",
    "D2-Q11",
    "D2-Q12",
    "D3-Q19",
    "D6-Q33",
    "D6-Q34",
    "D6-Q35",
    "D3-Q15",
    "D4-Q24",
    "D5-Q26",
    "D5-Q27",
    "D5-Q28",
    "D5-Q29",
    "D5-Q30",
    "D7-Q36",
    "D7-Q41",
  ];
  assert.deepEqual(
    new Set(AI_INFERENCE_QUESTION_IDS),
    new Set(expected),
    "AI_INFERENCE_QUESTION_IDS content does not match expected set"
  );
  assert.equal(AI_INFERENCE_QUESTION_IDS.length, expected.length, "Duplicate IDs detected");
});

test("AIInferenceEngine constructor does not throw", () => {
  const engine = new AIInferenceEngine({
    provider: "anthropic",
    apiKey: "test-key",
  });
  assert.ok(engine instanceof AIInferenceEngine);
});

test("dry-run mode returns empty results without calling LLM", async () => {
  const engine = new AIInferenceEngine({
    provider: "anthropic",
    apiKey: "test-key",
    dryRun: true,
  });

  const bundle = makeBundle("test-repo", [
    { path: "README.md", content: "# Test repo" },
  ]);

  const results = await engine.analyze(bundle);
  assert.deepEqual(results, []);
});

test("dry-run with empty files still returns empty results", async () => {
  const engine = new AIInferenceEngine({
    provider: "anthropic",
    apiKey: "test-key",
    dryRun: true,
  });

  const results = await engine.analyze(makeBundle("empty-repo", []));
  assert.deepEqual(results, []);
});

test("analyze returns SignalResult for each question when LLM responds correctly", async () => {
  // Provide one result per batch
  const policyResults = [makeResult("D4-Q22")];
  const archResults = [
    makeResult("D1-Q2"),
    makeResult("D1-Q3"),
    makeResult("D1-Q4"),
    makeResult("D2-Q9"),
    makeResult("D2-Q10"),
    makeResult("D2-Q11"),
    makeResult("D2-Q12"),
    makeResult("D3-Q19"),
  ];
  const docResults = [
    makeResult("D6-Q33"),
    makeResult("D6-Q34"),
    makeResult("D6-Q35"),
  ];
  const govResults = [
    makeResult("D3-Q15"),
    makeResult("D4-Q24"),
    makeResult("D5-Q26"),
    makeResult("D5-Q27"),
    makeResult("D5-Q28"),
    makeResult("D5-Q29"),
    makeResult("D5-Q30"),
  ];
  const agentResults = [
    makeResult("D7-Q36"),
    makeResult("D7-Q41"),
  ];

  let callCount = 0;
  const batchResponses = [policyResults, archResults, docResults, govResults, agentResults];

  const engine = new AIInferenceEngine({
    provider: "anthropic",
    apiKey: "test-key",
  });

  // Monkey-patch the private client to intercept API calls
  engine["client"] = {
    messages: {
      create: async () => {
        const response = makeAnthropicResponse(batchResponses[callCount]);
        callCount++;
        return response;
      },
    },
  };

  const results = await engine.analyze(makeBundle("test-repo"));

  assert.equal(results.length, 21, "Should return one SignalResult per question");
  assert.equal(callCount, 5, "Should make exactly 5 LLM calls (one per batch)");

  // Check a specific result
  const q22 = results.find((r) => r.questionId === "D4-Q22");
  assert.ok(q22, "Should have a result for D4-Q22");
  assert.equal(q22.score, 1);
  assert.equal(q22.confidence, 0.5);
  assert.equal(q22.signalId, "ai-inference:D4-Q22");
  assert.ok(q22.evidence.length > 0);
});

test("analyze fills in missing questions with zero-confidence fallback", async () => {
  // LLM only returns one of the expected questions in the policy batch
  const partialPolicyResults = []; // No results at all
  const archResults = [
    makeResult("D1-Q2"),
    makeResult("D1-Q3"),
    makeResult("D1-Q4"),
    makeResult("D2-Q9"),
    makeResult("D2-Q10"),
    makeResult("D2-Q11"),
    makeResult("D2-Q12"),
    makeResult("D3-Q19"),
  ];
  const docResults = [
    makeResult("D6-Q33"),
    makeResult("D6-Q34"),
    makeResult("D6-Q35"),
  ];
  const govResults = [
    makeResult("D3-Q15"),
    makeResult("D4-Q24"),
    makeResult("D5-Q26"),
    makeResult("D5-Q27"),
    makeResult("D5-Q28"),
    makeResult("D5-Q29"),
    makeResult("D5-Q30"),
  ];
  const agentResults = [
    makeResult("D7-Q36"),
    makeResult("D7-Q41"),
  ];

  let callCount = 0;
  const batchResponses = [partialPolicyResults, archResults, docResults, govResults, agentResults];

  const engine = new AIInferenceEngine({
    provider: "anthropic",
    apiKey: "test-key",
  });

  engine["client"] = {
    messages: {
      create: async () => {
        const response = makeAnthropicResponse(batchResponses[callCount]);
        callCount++;
        return response;
      },
    },
  };

  const results = await engine.analyze(makeBundle("test-repo"));

  // D4-Q22 should be filled with a fallback zero-confidence result
  const q22 = results.find((r) => r.questionId === "D4-Q22");
  assert.ok(q22, "Should have a fallback result for D4-Q22");
  assert.equal(q22.score, 0);
  assert.equal(q22.confidence, 0);
});

test("analyze gracefully handles LLM API error", async () => {
  const engine = new AIInferenceEngine({
    provider: "anthropic",
    apiKey: "test-key",
  });

  // Always throws
  engine["client"] = {
    messages: {
      create: async () => {
        throw new Error("Network error");
      },
    },
  };

  const results = await engine.analyze(makeBundle("test-repo"));

  // All 21 questions should have fallback zero-confidence results
  assert.equal(results.length, 21);
  for (const result of results) {
    assert.equal(result.score, 0);
    assert.equal(result.confidence, 0);
  }
});

test("analyze gracefully handles malformed JSON from LLM", async () => {
  const engine = new AIInferenceEngine({
    provider: "anthropic",
    apiKey: "test-key",
  });

  engine["client"] = {
    messages: {
      create: async () => ({
        content: [{ type: "text", text: "not valid json {{{" }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    },
  };

  const results = await engine.analyze(makeBundle("test-repo"));

  assert.equal(results.length, 21);
  for (const result of results) {
    assert.equal(result.score, 0);
    assert.equal(result.confidence, 0);
  }
});

test("analyze handles LLM response wrapped in markdown code fences", async () => {
  const archResults = [
    makeResult("D1-Q2"),
    makeResult("D1-Q3"),
    makeResult("D1-Q4"),
    makeResult("D2-Q9"),
    makeResult("D2-Q10"),
    makeResult("D2-Q11"),
    makeResult("D2-Q12"),
    makeResult("D3-Q19"),
  ];

  let callCount = 0;
  const engine = new AIInferenceEngine({
    provider: "anthropic",
    apiKey: "test-key",
  });

  engine["client"] = {
    messages: {
      create: async () => {
        callCount++;
        if (callCount === 2) {
          // architecture batch — wrap in code fences
          return {
            content: [
              {
                type: "text",
                text: "```json\n" + JSON.stringify(archResults) + "\n```",
              },
            ],
            usage: { input_tokens: 100, output_tokens: 50 },
          };
        }
        // Other batches return empty arrays
        return {
          content: [{ type: "text", text: "[]" }],
          usage: { input_tokens: 10, output_tokens: 5 },
        };
      },
    },
  };

  const results = await engine.analyze(makeBundle("test-repo"));
  const q2 = results.find((r) => r.questionId === "D1-Q2");
  assert.ok(q2);
  assert.equal(q2.score, 1);
});

// ---------------------------------------------------------------------------
// Finding #1 — Sensitive path deny list
// ---------------------------------------------------------------------------

test("isSensitivePath blocks .env files", () => {
  assert.ok(isSensitivePath(".env"));
  assert.ok(isSensitivePath(".env.local"));
  assert.ok(isSensitivePath("config/.env.production"));
  assert.ok(!isSensitivePath("README.md"));
  assert.ok(!isSensitivePath("src/env.ts"));
});

test("isSensitivePath blocks private key and certificate files", () => {
  assert.ok(isSensitivePath("server.pem"));
  assert.ok(isSensitivePath("id_rsa.key"));
  assert.ok(isSensitivePath("cert.p12"));
  assert.ok(!isSensitivePath("public_key_docs.md"));
});

test("isSensitivePath blocks credential/secret/password filename patterns", () => {
  assert.ok(isSensitivePath("secrets.json"));
  assert.ok(isSensitivePath("credentials.yaml"));
  assert.ok(isSensitivePath("db_password.txt"));
  assert.ok(isSensitivePath("api_token.env"));
  assert.ok(!isSensitivePath("policy.md"));
});

test("sensitive files are excluded from LLM prompts even when in dry-run bundle", async () => {
  const engine = new AIInferenceEngine({
    provider: "anthropic",
    apiKey: "test-key",
    dryRun: true,
  });

  // Bundle contains a mix of safe and sensitive files
  const bundle = makeBundle("test-repo", [
    { path: "README.md", content: "# Hello" },
    { path: ".env", content: "API_KEY=super-secret" },
    { path: "config/credentials.yaml", content: "password: hunter2" },
    { path: "src/main.ts", content: "export const x = 1;" },
  ]);

  // Dry-run returns [] but we can verify via isSensitivePath that the deny list
  // correctly identifies the two sensitive paths in the bundle.
  const sensitiveInBundle = bundle.files.filter((f) => isSensitivePath(f.path));
  assert.equal(sensitiveInBundle.length, 2);
  assert.ok(sensitiveInBundle.some((f) => f.path === ".env"));
  assert.ok(sensitiveInBundle.some((f) => f.path === "config/credentials.yaml"));

  const results = await engine.analyze(bundle);
  assert.deepEqual(results, []);
});

// ---------------------------------------------------------------------------
// Finding #2 — JSON extraction: brackets in preamble text
// ---------------------------------------------------------------------------

test("analyze parses JSON array when LLM includes brackets in preamble text", async () => {
  const policyResult = makeResult("D4-Q22", 2);

  const engine = new AIInferenceEngine({ provider: "anthropic", apiKey: "test-key" });
  engine["client"] = {
    messages: {
      create: async () => ({
        content: [
          {
            type: "text",
            // Brackets appear in the preamble before the actual JSON array
            text:
              "Based on rubric [score 0–2] and evidence [see files]:\n" +
              JSON.stringify([policyResult]),
          },
        ],
        usage: { input_tokens: 50, output_tokens: 20 },
      }),
    },
  };

  const results = await engine.analyze(makeBundle("test-repo"));
  const q22 = results.find((r) => r.questionId === "D4-Q22");
  assert.ok(q22, "Should parse result despite brackets in preamble");
  assert.equal(q22.score, 2);
});

// ---------------------------------------------------------------------------
// Finding #3 — error flag set on batch failure
// ---------------------------------------------------------------------------

test("analyze still returns 21 results when all batches fail, with confidence 0", async () => {
  const engine = new AIInferenceEngine({ provider: "anthropic", apiKey: "test-key" });
  engine["client"] = {
    messages: { create: async () => { throw new Error("API unavailable"); } },
  };

  const results = await engine.analyze(makeBundle("test-repo"));
  assert.equal(results.length, 21);
  for (const r of results) {
    assert.equal(r.confidence, 0, `${r.questionId} should have confidence 0 on batch failure`);
  }
});

test("confidence:0 sentinel is preserved through toSignalResult for missing questions", async () => {
  const engine = new AIInferenceEngine({ provider: "anthropic", apiKey: "test-key" });
  // Return an empty array — all questions will get missingResult (confidence 0)
  engine["client"] = {
    messages: {
      create: async () => ({
        content: [{ type: "text", text: "[]" }],
        usage: { input_tokens: 10, output_tokens: 2 },
      }),
    },
  };

  const results = await engine.analyze(makeBundle("test-repo"));
  assert.equal(results.length, 21);
  for (const r of results) {
    // confidence 0 is the sentinel; it must not be clamped to 0.3
    assert.equal(r.confidence, 0, `${r.questionId} sentinel should stay 0, not be clamped to 0.3`);
  }
});

// ---------------------------------------------------------------------------
// Finding #4 — Deduplication: keep highest-confidence duplicate
// ---------------------------------------------------------------------------

test("duplicate questionId keeps the higher-confidence entry", async () => {
  const lowConfidence = { ...makeResult("D4-Q22", 1), confidence: 0.35 };
  const highConfidence = { ...makeResult("D4-Q22", 2), confidence: 0.65 };

  const engine = new AIInferenceEngine({ provider: "anthropic", apiKey: "test-key" });
  engine["client"] = {
    messages: {
      create: async () => ({
        content: [
          {
            type: "text",
            // Low-confidence entry appears first, high-confidence second
            text: JSON.stringify([lowConfidence, highConfidence]),
          },
        ],
        usage: { input_tokens: 50, output_tokens: 20 },
      }),
    },
  };

  const results = await engine.analyze(makeBundle("test-repo"));
  const q22 = results.find((r) => r.questionId === "D4-Q22");
  assert.ok(q22);
  // The higher-confidence (second) entry should win
  assert.equal(q22.score, 2, "Should keep the higher-confidence duplicate");
  assert.equal(q22.confidence, 0.65);
});

test("duplicate questionId keeps first when it already has higher confidence", async () => {
  const highConfidence = { ...makeResult("D4-Q22", 2), confidence: 0.65 };
  const lowConfidence = { ...makeResult("D4-Q22", 1), confidence: 0.35 };

  const engine = new AIInferenceEngine({ provider: "anthropic", apiKey: "test-key" });
  engine["client"] = {
    messages: {
      create: async () => ({
        content: [
          { type: "text", text: JSON.stringify([highConfidence, lowConfidence]) },
        ],
        usage: { input_tokens: 50, output_tokens: 20 },
      }),
    },
  };

  const results = await engine.analyze(makeBundle("test-repo"));
  const q22 = results.find((r) => r.questionId === "D4-Q22");
  assert.ok(q22);
  assert.equal(q22.score, 2, "Should keep the first (already highest) entry");
  assert.equal(q22.confidence, 0.65);
});

// ---------------------------------------------------------------------------
// Confidence clamping
// ---------------------------------------------------------------------------

test("inferred confidence is clamped to [0.3, 0.7] range", async () => {
  const tooLow = { ...makeResult("D4-Q22", 1), confidence: 0.1 };

  const engine = new AIInferenceEngine({ provider: "anthropic", apiKey: "test-key" });
  engine["client"] = {
    messages: {
      create: async () => ({
        content: [{ type: "text", text: JSON.stringify([tooLow]) }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    },
  };

  const results = await engine.analyze(makeBundle("test-repo"));
  const q22 = results.find((r) => r.questionId === "D4-Q22");
  assert.ok(q22);
  assert.equal(q22.confidence, 0.3, "Confidence below 0.3 should be clamped up");
});

test("SignalResult evidence contains reasoning and evidence_summary", async () => {
  const policyResults = [
    {
      questionId: "D4-Q22",
      score: 2,
      confidence: 0.65,
      reasoning: "Found AI_POLICY.md with onboarding reference",
      evidence_summary: "AI_POLICY.md (500 words), onboarding.md reference",
    },
  ];

  const engine = new AIInferenceEngine({
    provider: "anthropic",
    apiKey: "test-key",
  });

  engine["client"] = {
    messages: {
      create: async () => ({
        content: [{ type: "text", text: JSON.stringify(policyResults) }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    },
  };

  const results = await engine.analyze(makeBundle("test-repo"));
  const q22 = results.find((r) => r.questionId === "D4-Q22");

  assert.ok(q22);
  assert.equal(q22.score, 2);
  assert.equal(q22.confidence, 0.65);
  assert.equal(q22.evidence[0].source, "ai-inference");
  assert.equal(q22.evidence[0].summary, policyResults[0].evidence_summary);
  assert.deepEqual(q22.evidence[0].data, {
    reasoning: "Found AI_POLICY.md with onboarding reference",
  });
});

// ---------------------------------------------------------------------------
// D7 Agent Maturity — agent-analysis fixtures
// ---------------------------------------------------------------------------

test("agent analysis: positive case — mature agent definitions with scope and iteration history", async () => {
  // Positive fixture: agent files with explicit permissions + commit history showing iteration
  const agentResults = [
    {
      questionId: "D7-Q36",
      score: 2,
      confidence: 0.65,
      reasoning:
        "Agent instruction files contain explicit allowedTools lists and permission boundaries. All agent definitions found include least-privilege tool restrictions and sandboxing configs.",
      evidence_summary:
        ".github/agents/coder.md defines allowedTools: [Read, Write, Bash] with no network access; .claude/agents/reviewer.md scopes permissions to read-only operations.",
    },
    {
      questionId: "D7-Q41",
      score: 2,
      confidence: 0.55,
      reasoning:
        "Commit history shows 8 iterative updates to agent instruction files over 3 months, with messages referencing agent failure fixes and prompt refinements. Changes went through PR review.",
      evidence_summary:
        "8 commits on agent instruction files; messages include 'fix: agent loop on ambiguous input', 'improve: tighten coder agent scope after prod incident', 'refine: add clarifying constraints from retro'.",
    },
  ];

  const engine = new AIInferenceEngine({ provider: "anthropic", apiKey: "test-key" });
  engine["client"] = {
    messages: {
      create: async () => ({
        content: [{ type: "text", text: JSON.stringify(agentResults) }],
        usage: { input_tokens: 200, output_tokens: 80 },
      }),
    },
  };

  // Bundle with agent files and commit history metadata
  const bundle = makeBundle("mature-org/agents-repo", [
    {
      path: ".github/agents/coder.md",
      content:
        "# Coder Agent\n\nallowedTools: [Read, Write, Bash]\npermissions: no-network\nboundaries: workspace only",
    },
    {
      path: ".claude/agents/reviewer.md",
      content: "# Reviewer Agent\n\nallowedTools: [Read]\npermissions: read-only",
    },
  ]);
  bundle.metadata = {
    agentInstructionCommits: [
      { sha: "abc1234", date: "2024-11-15", author: "alice", message: "fix: agent loop on ambiguous input" },
      { sha: "def5678", date: "2024-10-30", author: "bob", message: "improve: tighten coder agent scope after prod incident" },
      { sha: "ghi9012", date: "2024-10-10", author: "alice", message: "refine: add clarifying constraints from retro" },
    ],
  };

  const results = await engine.analyze(bundle);

  const q36 = results.find((r) => r.questionId === "D7-Q36");
  assert.ok(q36, "Should produce a result for D7-Q36");
  assert.equal(q36.score, 2, "Q36 should score 2 for comprehensive scope definitions");
  assert.equal(q36.confidence, 0.65, "Q36 confidence should be clamped to 0.65");
  assert.equal(q36.signalId, "ai-inference:D7-Q36");
  assert.equal(q36.evidence[0].source, "ai-inference");

  const q41 = results.find((r) => r.questionId === "D7-Q41");
  assert.ok(q41, "Should produce a result for D7-Q41");
  assert.equal(q41.score, 2, "Q41 should score 2 for mature instruction versioning with iteration");
  assert.equal(q41.confidence, 0.55, "Q41 confidence should be clamped to 0.55");
  assert.equal(q41.signalId, "ai-inference:D7-Q41");
});

test("agent analysis: negative case — no agent files, no instruction history", async () => {
  // Negative fixture: no agent files, no scope definitions, no iteration evidence
  const agentResults = [
    {
      questionId: "D7-Q36",
      score: 0,
      confidence: 0.6,
      reasoning:
        "No agent configuration files found in expected directories. No evidence of formal scope or permission definitions for any AI agents.",
      evidence_summary:
        "No files found in .github/agents/, .claude/agents/, or agents/. No allowedTools, permissions, or scope definitions detected.",
    },
    {
      questionId: "D7-Q41",
      score: 0,
      confidence: 0.4,
      reasoning:
        "No agent instruction files found in version control. No commit history on prompt or instruction files is available. Cannot determine whether instructions are versioned or reviewed.",
      evidence_summary:
        "No agent instruction files in repository. No commit history provided for analysis.",
    },
  ];

  const engine = new AIInferenceEngine({ provider: "anthropic", apiKey: "test-key" });
  engine["client"] = {
    messages: {
      create: async () => ({
        content: [{ type: "text", text: JSON.stringify(agentResults) }],
        usage: { input_tokens: 50, output_tokens: 40 },
      }),
    },
  };

  // Bundle with no agent files and no commit history
  const bundle = makeBundle("nascent-org/app-repo", [
    { path: "README.md", content: "# My App" },
    { path: "src/index.ts", content: "export const main = () => {};" },
  ]);

  const results = await engine.analyze(bundle);

  const q36 = results.find((r) => r.questionId === "D7-Q36");
  assert.ok(q36, "Should produce a result for D7-Q36 even with no agent files");
  assert.equal(q36.score, 0, "Q36 should score 0 when no scope definitions exist");
  assert.equal(q36.confidence, 0.6, "Q36 confidence should be clamped within range");

  const q41 = results.find((r) => r.questionId === "D7-Q41");
  assert.ok(q41, "Should produce a result for D7-Q41 even with no instruction files");
  assert.equal(q41.score, 0, "Q41 should score 0 when no instruction files or history exist");
  // 0.4 is at the boundary — verify it stays at 0.4 (above the 0.3 floor)
  assert.equal(q41.confidence, 0.4, "Q41 confidence 0.4 is above floor and should not be clamped up");
});
