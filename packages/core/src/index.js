/**
 * @ai-scorecard/core
 * Scoring engine, types, and question bank
 */
export const VERSION = "0.0.0";
export function calculatePercentage(score, maxScore) {
    if (maxScore === 0)
        return 0;
    return Math.round((score / maxScore) * 100);
}
export { dimensions } from "./dimensions.js";
export { questions } from "./questions.js";
export { tiers } from "./tiers.js";
export { computeScorecard } from "./engine.js";
export { getWeakestDimensions, getUnaddressedQuestions, getLowConfidenceQuestions, } from "./analysis.js";
//# sourceMappingURL=index.js.map