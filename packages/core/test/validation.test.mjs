import test from "node:test";
import assert from "node:assert/strict";

import { computeScorecard, ScoringValidationError } from "../dist/index.js";

const META = { adapterName: "test", target: "test-org" };

test("computeScorecard throws ScoringValidationError when evidence.summary is missing", () => {
  const malformed = [
    {
      signalId: "sig-malformed",
      questionId: "D1-Q1",
      score: 2,
      evidence: [{ source: "github:repos", data: {} }],
      confidence: 1,
    },
  ];

  assert.throws(
    () => computeScorecard(malformed, META),
    (err) => {
      assert.ok(err instanceof ScoringValidationError, "expected ScoringValidationError");
      assert.match(err.message, /summary/i);
      assert.ok(err.issues.length >= 1, "should expose Zod issues for diagnostics");
      return true;
    }
  );
});

test("computeScorecard throws ScoringValidationError when score is not 0/1/2", () => {
  const malformed = [
    {
      signalId: "sig-bad-score",
      questionId: "D1-Q1",
      score: 3,
      evidence: [],
      confidence: 1,
    },
  ];

  assert.throws(
    () => computeScorecard(malformed, META),
    (err) => {
      assert.ok(err instanceof ScoringValidationError);
      assert.match(err.message, /score/i);
      return true;
    }
  );
});

test("computeScorecard throws when confidence is outside [0, 1]", () => {
  const malformed = [
    {
      signalId: "sig-bad-confidence",
      questionId: "D1-Q1",
      score: 2,
      evidence: [],
      confidence: 1.5,
    },
  ];

  assert.throws(
    () => computeScorecard(malformed, META),
    (err) => {
      assert.ok(err instanceof ScoringValidationError);
      assert.match(err.message, /confidence/i);
      return true;
    }
  );
});

test("computeScorecard throws when evidence.source is missing", () => {
  const malformed = [
    {
      signalId: "sig-bad-source",
      questionId: "D1-Q1",
      score: 1,
      evidence: [{ data: { foo: "bar" }, summary: "ok" }],
      confidence: 0.9,
    },
  ];

  assert.throws(
    () => computeScorecard(malformed, META),
    (err) => {
      assert.ok(err instanceof ScoringValidationError);
      return true;
    }
  );
});

test("ScoringValidationError.issues is iterable for boundary diagnostics", () => {
  const malformed = [
    {
      signalId: "",
      questionId: "D1-Q1",
      score: 5,
      evidence: [],
      confidence: -0.1,
    },
  ];

  try {
    computeScorecard(malformed, META);
    assert.fail("expected throw");
  } catch (err) {
    assert.ok(err instanceof ScoringValidationError);
    // Multiple invariants violated → multiple issues surfaced
    assert.ok(err.issues.length >= 2);
  }
});

test("computeScorecard accepts valid input (regression: validation does not break the happy path)", () => {
  const valid = [
    {
      signalId: "sig-ok",
      questionId: "D1-Q1",
      score: 2,
      evidence: [
        { source: "github:repos", data: { count: 3 }, summary: "Three repos found" },
      ],
      confidence: 1,
    },
  ];
  const result = computeScorecard(valid, META);
  assert.equal(result.totalScore, 2);
});
