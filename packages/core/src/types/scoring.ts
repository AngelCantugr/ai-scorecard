import type { Evidence } from "./adapter.js";

/** The 8 dimensions of the scorecard */
export type DimensionId =
  | "platform-infrastructure"
  | "developer-tooling"
  | "cicd-velocity"
  | "governance-security"
  | "observability-cost"
  | "documentation-context"
  | "agent-maturity"
  | "eval-quality";

/** Dimension metadata */
export interface Dimension {
  id: DimensionId;
  name: string;
  questionCount: number;
  maxScore: number;
}

/** A single question in the scorecard */
export interface Question {
  /** Unique question ID (e.g., "D1-Q1") */
  id: string;
  /** Which dimension this question belongs to */
  dimensionId: DimensionId;
  /** The question text */
  text: string;
  /** Scoring rubric for each level */
  rubric: {
    0: string;
    1: string;
    2: string;
  };
  /** How this question can be measured */
  measurementStrategy: string;
}

/** Score result for a single question */
export interface QuestionScore {
  questionId: string;
  score: 0 | 1 | 2;
  /** 0-1, how reliable this signal is (1 = high confidence, direct measurement; 0.5 = AI-inferred) */
  confidence: number;
  evidence: Evidence[];
}

/** Score result for a dimension (group of questions) */
export interface DimensionScore {
  dimensionId: DimensionId;
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
  questionScores: QuestionScore[];
}

/** Maturity tier */
export type TierLevel = 1 | 2 | 3 | 4;
export interface Tier {
  level: TierLevel;
  label: string; // e.g., "AI-Curious", "AI-Native"
  minScore: number;
  maxScore: number;
}

/** The complete scorecard result */
export interface ScorecardResult {
  /** Overall score (0-94): 47 questions × 2 points max */
  totalScore: number;
  /** Maximum possible score */
  maxScore: number;
  /** Overall percentage */
  percentage: number;
  /** Maturity tier */
  tier: Tier;
  /** Per-dimension breakdown */
  dimensions: DimensionScore[];
  /** Average confidence across all signals */
  overallConfidence: number;
  /** Timestamp of the assessment */
  assessedAt: Date;
  /** Metadata about what was assessed */
  metadata: {
    adapterName: string;
    target: string; // e.g., "org:mycompany" or "repo:mycompany/myrepo"
  };
}
