import test from "node:test";
import assert from "node:assert/strict";

import {
  AIInferenceEngine,
  AI_INFERENCE_QUESTION_IDS,
} from "../../../dist/ai-inference/index.js";

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

test("AI_INFERENCE_QUESTION_IDS exports the correct 19 question IDs", () => {
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
  ];
  assert.equal(AI_INFERENCE_QUESTION_IDS.length, expected.length);
  for (const id of expected) {
    assert.ok(
      AI_INFERENCE_QUESTION_IDS.includes(id),
      `Missing question ID: ${id}`
    );
  }
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

  let callCount = 0;
  const batchResponses = [policyResults, archResults, docResults, govResults];

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

  assert.equal(results.length, 19, "Should return one SignalResult per question");
  assert.equal(callCount, 4, "Should make exactly 4 LLM calls (one per batch)");

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

  let callCount = 0;
  const batchResponses = [partialPolicyResults, archResults, docResults, govResults];

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

  // All 19 questions should have fallback zero-confidence results
  assert.equal(results.length, 19);
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

  assert.equal(results.length, 19);
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
