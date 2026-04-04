import type {
  DimensionScore,
  QuestionScore,
  ScorecardResult,
} from "./types/index.js";

/**
 * Returns dimensions sorted by score (ascending) — i.e., weakest areas first.
 * Useful for generating recommendations like "Focus on Governance & Security first."
 */
export function getWeakestDimensions(result: ScorecardResult): DimensionScore[] {
  return [...result.dimensions].sort((a, b) => a.score - b.score);
}

/**
 * Returns questions scored 0 (not adopted) — the biggest opportunities.
 * Sorted by dimension, then by question order.
 */
export function getUnaddressedQuestions(result: ScorecardResult): QuestionScore[] {
  return result.dimensions
    .flatMap((d) => d.questionScores)
    .filter((qs) => qs.score === 0);
}

/**
 * Returns questions with low confidence — where the assessment is uncertain.
 * Useful for suggesting "You should manually verify these areas."
 */
export function getLowConfidenceQuestions(
  result: ScorecardResult,
  threshold = 0.5,
): QuestionScore[] {
  return result.dimensions
    .flatMap((d) => d.questionScores)
    .filter((qs) => qs.confidence > 0 && qs.confidence < threshold);
}
