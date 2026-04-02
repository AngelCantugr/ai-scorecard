import test from "node:test";
import assert from "node:assert/strict";

import { computeScorecard } from "../dist/engine.js";
import {
  getWeakestDimensions,
  getUnaddressedQuestions,
  getLowConfidenceQuestions,
} from "../dist/analysis.js";
import { questions } from "../dist/questions.js";

const META = { adapterName: "test", target: "test-org" };

/** Helper — create a minimal SignalResult for a question */
function makeSignal(questionId, score, confidence = 1) {
  return { signalId: `sig-${questionId}`, questionId, score, evidence: [], confidence };
}

test("perfect score: all 35 questions scored 2 → total 70, tier AI-Native", () => {
  const signals = questions.map((q) => makeSignal(q.id, 2));
  const result = computeScorecard(signals, META);

  assert.equal(result.totalScore, 70);
  assert.equal(result.maxScore, 70);
  assert.equal(result.percentage, 100);
  assert.equal(result.tier.label, "AI-Native");
  assert.equal(result.tier.level, 4);
});

test("zero score: no signals → total 0, tier AI-Curious", () => {
  const result = computeScorecard([], META);

  assert.equal(result.totalScore, 0);
  assert.equal(result.tier.label, "AI-Curious");
  assert.equal(result.tier.level, 1);
  assert.equal(result.overallConfidence, 0);
});

test("mid-range score: 18 questions × 2 → total 36, tier AI-Scaling", () => {
  const signals = questions.slice(0, 18).map((q) => makeSignal(q.id, 2));
  const result = computeScorecard(signals, META);

  assert.equal(result.totalScore, 36);
  assert.equal(result.tier.label, "AI-Scaling");
  assert.equal(result.tier.level, 3);
});

test("tier boundaries: 17 → L1 (AI-Curious), 18 → L2 (AI-Experimenting)", () => {
  // 8 × 2 + 1 × 1 = 17
  const signals17 = [
    ...questions.slice(0, 8).map((q) => makeSignal(q.id, 2)),
    makeSignal(questions[8].id, 1),
  ];
  const result17 = computeScorecard(signals17, META);
  assert.equal(result17.totalScore, 17);
  assert.equal(result17.tier.level, 1);
  assert.equal(result17.tier.label, "AI-Curious");

  // 9 × 2 = 18
  const signals18 = questions.slice(0, 9).map((q) => makeSignal(q.id, 2));
  const result18 = computeScorecard(signals18, META);
  assert.equal(result18.totalScore, 18);
  assert.equal(result18.tier.level, 2);
  assert.equal(result18.tier.label, "AI-Experimenting");
});

test("tier boundaries: 35 → L2 (AI-Experimenting), 36 → L3 (AI-Scaling)", () => {
  // 17 × 2 + 1 × 1 = 35
  const signals35 = [
    ...questions.slice(0, 17).map((q) => makeSignal(q.id, 2)),
    makeSignal(questions[17].id, 1),
  ];
  const result35 = computeScorecard(signals35, META);
  assert.equal(result35.totalScore, 35);
  assert.equal(result35.tier.level, 2);
  assert.equal(result35.tier.label, "AI-Experimenting");

  // 18 × 2 = 36
  const signals36 = questions.slice(0, 18).map((q) => makeSignal(q.id, 2));
  const result36 = computeScorecard(signals36, META);
  assert.equal(result36.totalScore, 36);
  assert.equal(result36.tier.level, 3);
  assert.equal(result36.tier.label, "AI-Scaling");
});

test("tier boundaries: 52 → L3 (AI-Scaling), 53 → L4 (AI-Native)", () => {
  // 26 × 2 = 52
  const signals52 = questions.slice(0, 26).map((q) => makeSignal(q.id, 2));
  const result52 = computeScorecard(signals52, META);
  assert.equal(result52.totalScore, 52);
  assert.equal(result52.tier.level, 3);
  assert.equal(result52.tier.label, "AI-Scaling");

  // 26 × 2 + 1 × 1 = 53
  const signals53 = [
    ...questions.slice(0, 26).map((q) => makeSignal(q.id, 2)),
    makeSignal(questions[26].id, 1),
  ];
  const result53 = computeScorecard(signals53, META);
  assert.equal(result53.totalScore, 53);
  assert.equal(result53.tier.level, 4);
  assert.equal(result53.tier.label, "AI-Native");
});

test("signal deduplication: two signals for same question → highest confidence wins", () => {
  const signals = [
    { signalId: "sig-a", questionId: "D1-Q1", score: 1, evidence: [], confidence: 0.5 },
    { signalId: "sig-b", questionId: "D1-Q1", score: 0, evidence: [], confidence: 0.9 },
  ];
  const result = computeScorecard(signals, META);
  const d1 = result.dimensions.find((d) => d.dimensionId === "platform-infrastructure");
  const q1 = d1.questionScores.find((qs) => qs.questionId === "D1-Q1");

  assert.equal(q1.confidence, 0.9);
  assert.equal(q1.score, 0); // the higher-confidence signal had score 0
});

test("confidence tie-breaking: same confidence → higher score wins", () => {
  const signals = [
    { signalId: "sig-a", questionId: "D1-Q1", score: 1, evidence: [], confidence: 0.7 },
    { signalId: "sig-b", questionId: "D1-Q1", score: 2, evidence: [], confidence: 0.7 },
  ];
  const result = computeScorecard(signals, META);
  const d1 = result.dimensions.find((d) => d.dimensionId === "platform-infrastructure");
  const q1 = d1.questionScores.find((qs) => qs.questionId === "D1-Q1");

  assert.equal(q1.score, 2);
  assert.equal(q1.confidence, 0.7);
});

test("gap analysis: getWeakestDimensions returns dimensions sorted ascending by score", () => {
  // Score only platform-infrastructure questions at 2; rest 0
  const signals = questions
    .filter((q) => q.dimensionId === "platform-infrastructure")
    .map((q) => makeSignal(q.id, 2));
  const result = computeScorecard(signals, META);
  const weakest = getWeakestDimensions(result);

  // Ensure ascending order
  for (let i = 1; i < weakest.length; i++) {
    assert.ok(
      weakest[i - 1].score <= weakest[i].score,
      `dimensions not sorted: index ${i - 1} score ${weakest[i - 1].score} > index ${i} score ${weakest[i].score}`,
    );
  }

  // platform-infrastructure should be last (highest score)
  assert.equal(weakest.at(-1).dimensionId, "platform-infrastructure");
  // All other dimensions should have score 0
  assert.ok(weakest.slice(0, -1).every((d) => d.score === 0));
});

test("missing signals: questions with no signal get score 0, confidence 0, empty evidence", () => {
  const result = computeScorecard([], META);

  for (const dim of result.dimensions) {
    for (const qs of dim.questionScores) {
      assert.equal(qs.score, 0);
      assert.equal(qs.confidence, 0);
      assert.deepEqual(qs.evidence, []);
    }
  }
});

test("getUnaddressedQuestions returns only questions with score 0, excluding scored ones", () => {
  const signals = [makeSignal("D1-Q1", 2), makeSignal("D1-Q2", 1)];
  const result = computeScorecard(signals, META);
  const unaddressed = getUnaddressedQuestions(result);

  assert.ok(unaddressed.every((qs) => qs.score === 0));
  assert.ok(!unaddressed.some((qs) => qs.questionId === "D1-Q1"));
  assert.ok(!unaddressed.some((qs) => qs.questionId === "D1-Q2"));
});

test("getLowConfidenceQuestions uses 0.5 default threshold", () => {
  const signals = [
    makeSignal("D1-Q1", 2, 0.3), // below threshold → included
    makeSignal("D1-Q2", 1, 0.8), // above threshold → excluded
  ];
  const result = computeScorecard(signals, META);
  const lowConf = getLowConfidenceQuestions(result);

  assert.ok(lowConf.some((qs) => qs.questionId === "D1-Q1"));
  assert.ok(!lowConf.some((qs) => qs.questionId === "D1-Q2"));
});

test("getLowConfidenceQuestions respects custom threshold", () => {
  const signals = [
    makeSignal("D1-Q1", 2, 0.6), // below custom threshold 0.7 → included
    makeSignal("D1-Q2", 1, 0.8), // above custom threshold 0.7 → excluded
  ];
  const result = computeScorecard(signals, META);
  const lowConf = getLowConfidenceQuestions(result, 0.7);

  assert.ok(lowConf.some((qs) => qs.questionId === "D1-Q1"));
  assert.ok(!lowConf.some((qs) => qs.questionId === "D1-Q2"));
});
