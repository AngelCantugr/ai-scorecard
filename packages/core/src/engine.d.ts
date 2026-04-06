import type { ScorecardResult, SignalResult } from "./types/index.js";
/**
 * Takes raw signal results from adapters and computes the full scorecard.
 *
 * When multiple signals map to the same question (e.g., GitHub adapter + AI inference
 * both score Q7), use the signal with the highest confidence. If confidence is equal,
 * use the higher score (benefit of the doubt).
 */
export declare function computeScorecard(signals: SignalResult[], metadata: {
    adapterName: string;
    target: string;
}, assessedAt?: Date): ScorecardResult;
//# sourceMappingURL=engine.d.ts.map