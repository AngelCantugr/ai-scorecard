/**
 * @ai-scorecard/core
 * Scoring engine, types, and question bank
 */

export const VERSION = "0.0.0";

export interface ScoreResult {
  score: number;
  maxScore: number;
  percentage: number;
}

export function calculatePercentage(score: number, maxScore: number): number {
  if (maxScore === 0) return 0;
  return Math.round((score / maxScore) * 100);
}

export type {
  AdapterConfig,
  Signal,
  Evidence,
  SignalResult,
  Adapter,
  DimensionId,
  Dimension,
  Question,
  QuestionScore,
  DimensionScore,
  TierLevel,
  Tier,
  ScorecardResult,
} from "./types/index.js";
export { EvidenceSchema, SignalResultSchema } from "./types/index.js";
export { dimensions } from "./dimensions.js";
export { questions } from "./questions.js";
export { tiers } from "./tiers.js";
export { computeScorecard } from "./engine.js";
export { ScoringValidationError } from "./errors.js";
export {
  getWeakestDimensions,
  getUnaddressedQuestions,
  getLowConfidenceQuestions,
} from "./analysis.js";
export { encodeResults, decodeResults, SHARE_VERSION } from "./share.js";
