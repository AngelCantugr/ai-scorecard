/**
 * @ai-scorecard/core
 * Scoring engine, types, and question bank
 */
export declare const VERSION = "0.0.0";
export interface ScoreResult {
    score: number;
    maxScore: number;
    percentage: number;
}
export declare function calculatePercentage(score: number, maxScore: number): number;
export type { AdapterConfig, Signal, Evidence, SignalResult, Adapter, DimensionId, Dimension, Question, QuestionScore, DimensionScore, TierLevel, Tier, ScorecardResult, } from './types/index.js';
export { dimensions } from "./dimensions.js";
export { questions } from "./questions.js";
export { tiers } from "./tiers.js";
export { computeScorecard } from "./engine.js";
export { getWeakestDimensions, getUnaddressedQuestions, getLowConfidenceQuestions, } from "./analysis.js";
//# sourceMappingURL=index.d.ts.map