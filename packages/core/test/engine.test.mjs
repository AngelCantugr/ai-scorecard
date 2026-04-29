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

test("perfect score: all 47 questions scored 2 → total 94, tier AI-Native", () => {
  const signals = questions.map((q) => makeSignal(q.id, 2));
  const result = computeScorecard(signals, META);

  assert.equal(result.totalScore, 94);
  assert.equal(result.maxScore, 94);
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

test("mid-range score: 24 questions × 2 → total 48, tier AI-Scaling", () => {
  const signals = questions.slice(0, 24).map((q) => makeSignal(q.id, 2));
  const result = computeScorecard(signals, META);

  assert.equal(result.totalScore, 48);
  assert.equal(result.tier.label, "AI-Scaling");
  assert.equal(result.tier.level, 3);
});

test("tier boundaries: 22 → L1 (AI-Curious), 23 → L2 (AI-Experimenting)", () => {
  // 11 × 2 = 22
  const signals22 = questions.slice(0, 11).map((q) => makeSignal(q.id, 2));
  const result22 = computeScorecard(signals22, META);
  assert.equal(result22.totalScore, 22);
  assert.equal(result22.tier.level, 1);
  assert.equal(result22.tier.label, "AI-Curious");

  // 11 × 2 + 1 × 1 = 23
  const signals23 = [
    ...questions.slice(0, 11).map((q) => makeSignal(q.id, 2)),
    makeSignal(questions[11].id, 1),
  ];
  const result23 = computeScorecard(signals23, META);
  assert.equal(result23.totalScore, 23);
  assert.equal(result23.tier.level, 2);
  assert.equal(result23.tier.label, "AI-Experimenting");
});

test("tier boundaries: 46 → L2 (AI-Experimenting), 47 → L3 (AI-Scaling)", () => {
  // 23 × 2 = 46
  const signals46 = questions.slice(0, 23).map((q) => makeSignal(q.id, 2));
  const result46 = computeScorecard(signals46, META);
  assert.equal(result46.totalScore, 46);
  assert.equal(result46.tier.level, 2);
  assert.equal(result46.tier.label, "AI-Experimenting");

  // 23 × 2 + 1 × 1 = 47
  const signals47 = [
    ...questions.slice(0, 23).map((q) => makeSignal(q.id, 2)),
    makeSignal(questions[23].id, 1),
  ];
  const result47 = computeScorecard(signals47, META);
  assert.equal(result47.totalScore, 47);
  assert.equal(result47.tier.level, 3);
  assert.equal(result47.tier.label, "AI-Scaling");
});

test("tier boundaries: 69 → L3 (AI-Scaling), 70 → L4 (AI-Native)", () => {
  // 34 × 2 + 1 × 1 = 69
  const signals69 = [
    ...questions.slice(0, 34).map((q) => makeSignal(q.id, 2)),
    makeSignal(questions[34].id, 1),
  ];
  const result69 = computeScorecard(signals69, META);
  assert.equal(result69.totalScore, 69);
  assert.equal(result69.tier.level, 3);
  assert.equal(result69.tier.label, "AI-Scaling");

  // 35 × 2 = 70
  const signals70 = questions.slice(0, 35).map((q) => makeSignal(q.id, 2));
  const result70 = computeScorecard(signals70, META);
  assert.equal(result70.totalScore, 70);
  assert.equal(result70.tier.level, 4);
  assert.equal(result70.tier.label, "AI-Native");
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

test("overallConfidence: only includes measured questions (confidence > 0)", () => {
  const signals = [
    makeSignal("D1-Q1", 2, 1.0),
    makeSignal("D1-Q2", 1, 0.5),
  ];
  const result = computeScorecard(signals, META);

  // average of 1.0 and 0.5 is 0.75; it should NOT include the 45 unmeasured questions at 0
  assert.equal(result.overallConfidence, 0.75);
});

test("getLowConfidenceQuestions: excludes unmeasured questions (confidence 0)", () => {
  const signals = [
    makeSignal("D1-Q1", 2, 0.3), // measured, low confidence → included
  ];
  const result = computeScorecard(signals, META);
  const lowConf = getLowConfidenceQuestions(result, 0.5);

  assert.equal(lowConf.length, 1);
  assert.equal(lowConf[0].questionId, "D1-Q1");
  // Ensure unmeasured D1-Q2 (which has confidence 0 < 0.5) is NOT here
  assert.ok(!lowConf.some((qs) => qs.questionId === "D1-Q2"));
});

test("assessedAt injection: uses provided date", () => {
  const customDate = new Date("2020-01-01T00:00:00Z");
  const result = computeScorecard([], META, customDate);

  assert.equal(result.assessedAt.getTime(), customDate.getTime());
});
