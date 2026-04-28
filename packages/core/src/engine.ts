import { dimensions } from "./dimensions.js";
import { questions } from "./questions.js";
import { tiers } from "./tiers.js";
import type {
  DimensionScore,
  QuestionScore,
  ScorecardResult,
  SignalResult,
} from "./types/index.js";

/**
 * Takes raw signal results from adapters and computes the full scorecard.
 *
 * When multiple signals map to the same question (e.g., GitHub adapter + AI inference
 * both score Q7), use the signal with the highest confidence. If confidence is equal,
 * use the higher score (benefit of the doubt).
 */
export function computeScorecard(
  signals: SignalResult[],
  metadata: { adapterName: string; target: string },
  assessedAt: Date = new Date()
): ScorecardResult {
  // 1. Deduplicate signals — keep highest confidence; break ties with higher score
  const dedupedSignals = new Map<string, SignalResult>();
  for (const signal of signals) {
    const existing = dedupedSignals.get(signal.questionId);
    if (
      !existing ||
      signal.confidence > existing.confidence ||
      (signal.confidence === existing.confidence && signal.score > existing.score)
    ) {
      dedupedSignals.set(signal.questionId, signal);
    }
  }

  // 2. Build per-dimension scores
  const dimensionScores: DimensionScore[] = dimensions.map((dimension) => {
    const dimensionQuestions = questions.filter((q) => q.dimensionId === dimension.id);

    const questionScores: QuestionScore[] = dimensionQuestions.map((question) => {
      const signal = dedupedSignals.get(question.id);
      return {
        questionId: question.id,
        score: signal ? signal.score : 0,
        confidence: signal ? signal.confidence : 0,
        evidence: signal ? signal.evidence : [],
      };
    });

    const score = questionScores.reduce((sum, qs) => sum + qs.score, 0);
    const percentage =
      dimension.maxScore === 0 ? 0 : Math.round((score / dimension.maxScore) * 100);

    return {
      dimensionId: dimension.id,
      name: dimension.name,
      score,
      maxScore: dimension.maxScore,
      percentage,
      questionScores,
    };
  });

  // 3. Compute overall score
  const totalScore = dimensionScores.reduce((sum, ds) => sum + ds.score, 0);
  const maxScore = dimensionScores.reduce((sum, ds) => sum + ds.maxScore, 0);
  const percentage = maxScore === 0 ? 0 : Math.round((totalScore / maxScore) * 100);

  // 4. Determine tier
  const tier = tiers.find((t) => totalScore >= t.minScore && totalScore <= t.maxScore);
  if (tier === undefined) {
    throw new Error(
      `No tier found for score ${totalScore} (valid range: ${tiers[0]?.minScore}–${tiers.at(-1)?.maxScore})`
    );
  }

  // 5. Average confidence across only measured questions
  const measuredQuestionScores = dimensionScores
    .flatMap((ds) => ds.questionScores)
    .filter((qs) => qs.confidence > 0);

  const overallConfidence =
    measuredQuestionScores.length === 0
      ? 0
      : measuredQuestionScores.reduce((sum, qs) => sum + qs.confidence, 0) /
        measuredQuestionScores.length;

  return {
    totalScore,
    maxScore,
    percentage,
    tier,
    dimensions: dimensionScores,
    overallConfidence,
    assessedAt,
    metadata,
  };
}
