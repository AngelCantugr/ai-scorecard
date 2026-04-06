/**
 * Returns dimensions sorted by score (ascending) — i.e., weakest areas first.
 * Useful for generating recommendations like "Focus on Governance & Security first."
 */
export function getWeakestDimensions(result) {
    return [...result.dimensions].sort((a, b) => a.score - b.score);
}
/**
 * Returns questions that were measured but scored 0 — confirmed gaps, not adopted.
 * Excludes unmeasured questions (confidence === 0) to avoid conflating "not assessed" with "not adopted".
 */
export function getUnaddressedQuestions(result) {
    return result.dimensions
        .flatMap((d) => d.questionScores)
        .filter((qs) => qs.confidence > 0 && qs.score === 0);
}
/**
 * Returns questions with low confidence — where the assessment is uncertain.
 * Useful for suggesting "You should manually verify these areas."
 */
export function getLowConfidenceQuestions(result, threshold = 0.5) {
    return result.dimensions
        .flatMap((d) => d.questionScores)
        .filter((qs) => qs.confidence > 0 && qs.confidence < threshold);
}
//# sourceMappingURL=analysis.js.map