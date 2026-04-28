import { questions } from "./questions.js";
import { computeScorecard } from "./engine.js";
import type { ScorecardResult } from "./types/index.js";

/** Current encoding version — increment on breaking spec changes */
export const SHARE_VERSION = "1.0";

/** URL query parameter names */
const PARAM_SCORES = "s";
const PARAM_ORG = "o";
const PARAM_DATE = "d";
const PARAM_ADAPTER = "a";
const PARAM_VERSION = "v";

/**
 * Encode 35 question scores (0–2 each) into a base64url string.
 * Each score occupies 2 bits; 35 × 2 = 70 bits packed into 9 bytes.
 */
function encodeScores(scores: (0 | 1 | 2)[]): string {
  // Pack 2-bit values into bytes (4 scores per byte)
  const byteCount = Math.ceil((scores.length * 2) / 8);
  const bytes = Buffer.alloc(byteCount);

  for (let i = 0; i < scores.length; i++) {
    const byteIndex = Math.floor((i * 2) / 8);
    const bitOffset = (i * 2) % 8;
    const score = scores[i] ?? 0;
    const current = bytes[byteIndex] ?? 0;
    bytes[byteIndex] = current | ((score & 0b11) << bitOffset);
  }

  // Convert to base64url (no padding, URL-safe)
  return bytes.toString("base64url");
}

/**
 * Decode a base64url string back into an array of 35 scores (0–2 each).
 */
function decodeScores(encoded: string): (0 | 1 | 2)[] {
  // Validate that the encoded string contains only valid base64url characters
  if (!/^[A-Za-z0-9\-_]*$/.test(encoded)) {
    throw new Error("Invalid base64url encoding in scores parameter");
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(encoded, "base64url");
    if (bytes.length === 0 && encoded.length > 0) {
      throw new Error("Empty decoded buffer");
    }
  } catch {
    throw new Error("Invalid base64url encoding in scores parameter");
  }

  const scores: (0 | 1 | 2)[] = [];
  for (let i = 0; i < questions.length; i++) {
    const byteIndex = Math.floor((i * 2) / 8);
    const bitOffset = (i * 2) % 8;
    const byteVal = bytes[byteIndex] ?? 0;
    const raw = (byteVal >> bitOffset) & 0b11;
    // Clamp to valid range 0–2
    const score = (raw > 2 ? 2 : raw) as 0 | 1 | 2;
    scores.push(score);
  }

  return scores;
}

/**
 * Encode a ScorecardResult into URL-safe query parameters.
 * Only encodes scores — not evidence or confidence (to keep URL short).
 *
 * @returns A query string (without leading `?`) ready to append to a URL.
 */
export function encodeResults(result: ScorecardResult): string {
  // Collect all question scores in canonical question order
  const allQuestionScores = result.dimensions.flatMap((d) => d.questionScores);
  const scoreMap = new Map(allQuestionScores.map((qs) => [qs.questionId, qs.score]));

  const scores: (0 | 1 | 2)[] = questions.map((q) => (scoreMap.get(q.id) ?? 0) as 0 | 1 | 2);
  const encodedScores = encodeScores(scores);

  const assessedAt =
    result.assessedAt instanceof Date
      ? result.assessedAt.toISOString()
      : String(result.assessedAt);

  const parts: string[] = [
    `${PARAM_SCORES}=${encodeURIComponent(encodedScores)}`,
    `${PARAM_ORG}=${encodeURIComponent(result.metadata.target)}`,
    `${PARAM_DATE}=${encodeURIComponent(assessedAt)}`,
    `${PARAM_ADAPTER}=${encodeURIComponent(result.metadata.adapterName)}`,
    `${PARAM_VERSION}=${encodeURIComponent(SHARE_VERSION)}`,
  ];

  return parts.join("&");
}

/**
 * Decode URL query parameters back into a partial ScorecardResult.
 * Recomputes dimension scores, tier, etc. from the raw question scores.
 * Confidence is set to 0 (not available in shared links).
 * Evidence is empty (not available in shared links).
 *
 * @param encoded - A query string (with or without leading `?`)
 * @throws {Error} if the encoded string is missing required parameters or is corrupt
 */
export function decodeResults(encoded: string): ScorecardResult {
  const queryString = encoded.startsWith("?") ? encoded.slice(1) : encoded;

  // Parse key=value pairs manually to avoid DOM dependency
  const params = new Map<string, string>();
  for (const part of queryString.split("&")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const key = decodeURIComponent(part.slice(0, eqIdx));
    const value = decodeURIComponent(part.slice(eqIdx + 1));
    params.set(key, value);
  }

  const scoresParam = params.get(PARAM_SCORES);
  const orgParam = params.get(PARAM_ORG);
  const dateParam = params.get(PARAM_DATE);
  const adapterParam = params.get(PARAM_ADAPTER);
  const versionParam = params.get(PARAM_VERSION);

  if (!scoresParam) {
    throw new Error("Missing required parameter: scores (s)");
  }
  if (!orgParam) {
    throw new Error("Missing required parameter: org (o)");
  }
  if (!adapterParam) {
    throw new Error("Missing required parameter: adapter (a)");
  }

  // Warn on version mismatch but still attempt decode
  if (versionParam !== undefined && versionParam !== SHARE_VERSION) {
    console.warn(
      `[ai-scorecard] Share link version mismatch: expected ${SHARE_VERSION}, got ${versionParam}. Attempting decode anyway.`
    );
  }

  const scores = decodeScores(scoresParam);

  const assessedAt = dateParam ? new Date(dateParam) : new Date();
  if (isNaN(assessedAt.getTime())) {
    throw new Error(`Invalid date parameter: ${dateParam}`);
  }

  // Build SignalResult objects so computeScorecard can reconstruct everything.
  // Confidence 0 indicates "not measured / shared link" (evidence not included).
  const signals = questions.map((q, i) => ({
    signalId: `shared-${q.id}`,
    questionId: q.id,
    score: (scores[i] ?? 0) as 0 | 1 | 2,
    evidence: [] as never[],
    confidence: 0,
  }));

  return computeScorecard(
    signals,
    { adapterName: adapterParam, target: orgParam },
    assessedAt
  );
}
