import type { DimensionScore, QuestionScore, ScorecardResult } from "./types/index.js";
/**
 * Returns dimensions sorted by score (ascending) — i.e., weakest areas first.
 * Useful for generating recommendations like "Focus on Governance & Security first."
 */
export declare function getWeakestDimensions(result: ScorecardResult): DimensionScore[];
/**
 * Returns questions that were measured but scored 0 — confirmed gaps, not adopted.
 * Excludes unmeasured questions (confidence === 0) to avoid conflating "not assessed" with "not adopted".
 */
export declare function getUnaddressedQuestions(result: ScorecardResult): QuestionScore[];
/**
 * Returns questions with low confidence — where the assessment is uncertain.
 * Useful for suggesting "You should manually verify these areas."
 */
export declare function getLowConfidenceQuestions(result: ScorecardResult, threshold?: number): QuestionScore[];
//# sourceMappingURL=analysis.d.ts.map