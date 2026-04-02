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

export type { DimensionId, Question, Dimension, Tier } from "./types.js";
export { dimensions } from "./dimensions.js";
export { questions } from "./questions.js";
export { tiers } from "./tiers.js";
