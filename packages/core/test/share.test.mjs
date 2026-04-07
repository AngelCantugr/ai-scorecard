import test from "node:test";
import assert from "node:assert/strict";

import { encodeResults, decodeResults, SHARE_VERSION } from "../dist/share.js";
import { questions } from "../dist/questions.js";
import { computeScorecard } from "../dist/engine.js";

const META = { adapterName: "github", target: "org:mycompany" };
const DATE = new Date("2026-04-01T00:00:00.000Z");

/** Build a ScorecardResult with all questions scored at a given value */
function makeResult(scoreValue, meta = META, date = DATE) {
  const signals = questions.map((q) => ({
    signalId: `sig-${q.id}`,
    questionId: q.id,
    score: scoreValue,
    evidence: [],
    confidence: 1,
  }));
  return computeScorecard(signals, meta, date);
}

/** Build a ScorecardResult with custom per-question scores */
function makeResultFromScores(scores, meta = META, date = DATE) {
  const signals = questions.map((q, i) => ({
    signalId: `sig-${q.id}`,
    questionId: q.id,
    score: scores[i] ?? 0,
    evidence: [],
    confidence: 1,
  }));
  return computeScorecard(signals, meta, date);
}

// ── Round-trip tests ────────────────────────────────────────────────────────

test("round-trip: all zeros encodes and decodes correctly", () => {
  const original = makeResult(0);
  const encoded = encodeResults(original);
  const decoded = decodeResults(encoded);

  assert.equal(decoded.totalScore, 0);
  assert.equal(decoded.metadata.target, META.target);
  assert.equal(decoded.metadata.adapterName, META.adapterName);
  assert.equal(decoded.assessedAt.toISOString(), DATE.toISOString());

  for (const dim of decoded.dimensions) {
    for (const qs of dim.questionScores) {
      assert.equal(qs.score, 0);
    }
  }
});

test("round-trip: all twos (perfect score) encodes and decodes correctly", () => {
  const original = makeResult(2);
  const encoded = encodeResults(original);
  const decoded = decodeResults(encoded);

  assert.equal(decoded.totalScore, 70);
  assert.equal(decoded.tier.label, "AI-Native");

  for (const dim of decoded.dimensions) {
    for (const qs of dim.questionScores) {
      assert.equal(qs.score, 2);
    }
  }
});

test("round-trip: mixed scores preserve per-question values", () => {
  // Create a known pattern: alternating 0, 1, 2
  const expectedScores = questions.map((_, i) => [0, 1, 2][i % 3]);
  const original = makeResultFromScores(expectedScores);
  const encoded = encodeResults(original);
  const decoded = decodeResults(encoded);

  const allDecodedScores = decoded.dimensions
    .flatMap((d) => d.questionScores)
    .sort((a, b) => a.questionId.localeCompare(b.questionId));

  const allExpected = questions
    .map((q, i) => ({ questionId: q.id, score: expectedScores[i] }))
    .sort((a, b) => a.questionId.localeCompare(b.questionId));

  for (let i = 0; i < allExpected.length; i++) {
    assert.equal(
      allDecodedScores[i].score,
      allExpected[i].score,
      `Score mismatch at question ${allExpected[i].questionId}`
    );
  }
});

test("round-trip: metadata (org, adapter, date) survives encode/decode", () => {
  const customMeta = { adapterName: "gitlab", target: "org:acme" };
  const customDate = new Date("2025-12-31T23:59:59.000Z");
  const original = makeResult(1, customMeta, customDate);
  const encoded = encodeResults(original);
  const decoded = decodeResults(encoded);

  assert.equal(decoded.metadata.target, "org:acme");
  assert.equal(decoded.metadata.adapterName, "gitlab");
  assert.equal(decoded.assessedAt.toISOString(), customDate.toISOString());
});

// ── URL safety ──────────────────────────────────────────────────────────────

test("URL safety: encoded query string contains only URL-safe characters", () => {
  const result = makeResult(2);
  const encoded = encodeResults(result);

  // Query string should only contain URL-safe characters
  assert.match(encoded, /^[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/);

  // Specifically, no raw '+', '/', or '=' in the scores parameter value
  const params = new URLSearchParams(encoded);
  const scoresValue = params.get("s") ?? "";
  assert.ok(!scoresValue.includes("+"), "scores contains '+'");
  assert.ok(!scoresValue.includes("/"), "scores contains '/'");
  assert.ok(!scoresValue.includes("="), "scores contains '='");
});

// ── Compact size ────────────────────────────────────────────────────────────

test("compact size: encoded URL is under 200 characters total", () => {
  const result = makeResult(2);
  const encoded = encodeResults(result);
  const fullUrl = `https://ai-scorecard.dev/results?${encoded}`;

  assert.ok(
    fullUrl.length < 200,
    `URL is too long: ${fullUrl.length} characters (max 200)\n${fullUrl}`
  );
});

// ── Version ─────────────────────────────────────────────────────────────────

test("version: encoded params include the correct version", () => {
  const result = makeResult(1);
  const encoded = encodeResults(result);
  const params = new URLSearchParams(encoded);

  assert.equal(params.get("v"), SHARE_VERSION);
});

test("version mismatch: different version shows warning but still decodes", () => {
  const result = makeResult(1);
  const encoded = encodeResults(result);
  const params = new URLSearchParams(encoded);
  params.set("v", "99.0"); // simulate future version

  // Should not throw — just warn
  const decoded = decodeResults(params.toString());
  assert.equal(decoded.totalScore, result.totalScore);
});

// ── Error handling ──────────────────────────────────────────────────────────

test("invalid input: corrupted encoded string throws, not crash", () => {
  assert.throws(
    () => decodeResults("s=!!!invalid!!!&o=org&d=2026-01-01T00:00:00.000Z&a=github&v=1.0"),
    (err) => {
      assert.ok(err instanceof Error, "should throw an Error");
      return true;
    }
  );
});

test("invalid input: missing scores parameter throws", () => {
  assert.throws(
    () => decodeResults("o=org&d=2026-01-01T00:00:00.000Z&a=github&v=1.0"),
    /Missing required parameter/
  );
});

test("invalid input: missing org parameter throws", () => {
  const result = makeResult(0);
  const encoded = encodeResults(result);
  const params = new URLSearchParams(encoded);
  params.delete("o");

  assert.throws(
    () => decodeResults(params.toString()),
    /Missing required parameter/
  );
});

test("invalid input: leading '?' is stripped correctly", () => {
  const result = makeResult(1);
  const encoded = encodeResults(result);
  // Decode with leading ?
  const decoded = decodeResults("?" + encoded);
  assert.equal(decoded.totalScore, result.totalScore);
});

// ── Score reconstruction ────────────────────────────────────────────────────

test("dimension scores are recomputed correctly after decode", () => {
  const original = makeResult(2);
  const encoded = encodeResults(original);
  const decoded = decodeResults(encoded);

  assert.equal(decoded.dimensions.length, original.dimensions.length);
  for (let i = 0; i < original.dimensions.length; i++) {
    assert.equal(decoded.dimensions[i].score, original.dimensions[i].score);
    assert.equal(decoded.dimensions[i].maxScore, original.dimensions[i].maxScore);
    assert.equal(decoded.dimensions[i].percentage, original.dimensions[i].percentage);
  }
});
