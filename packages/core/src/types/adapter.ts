import { z } from "zod";

/** Configuration passed to an adapter to connect to a data source */
export interface AdapterConfig {
  /** Adapter-specific configuration (e.g., GitHub token, org name) */
  [key: string]: unknown;
}

/** Describes a signal that an adapter can collect */
export interface Signal {
  /** Unique signal ID */
  id: string;
  /** Which question this signal maps to */
  questionId: string;
  /** Human-readable description of what this signal measures */
  description: string;
}

/** Raw evidence backing a signal result */
export interface Evidence {
  /** Data source identifier (e.g., "github:repos", "github:actions") */
  source: string;
  /** Raw data from the adapter */
  data: unknown;
  /** Human-readable summary of the evidence */
  summary: string;
}

/** Result of collecting a single signal */
export interface SignalResult {
  /** Unique signal ID from the adapter manifest */
  signalId: string;
  /** Maps to one of the 35 questions */
  questionId: string;
  /** The score: 0 = not adopted, 1 = partial, 2 = fully adopted */
  score: 0 | 1 | 2;
  /** Evidence items backing the score */
  evidence: Evidence[];
  /** 0-1, how reliable this signal is (1 = high confidence, direct measurement; 0.5 = AI-inferred) */
  confidence: number;
}

/** Base interface all adapters must implement */
export interface Adapter {
  /** Unique adapter name (e.g., "github", "gitlab") */
  name: string;
  /** List of signals this adapter can collect */
  signals: Signal[];
  /** Connect to the data source */
  connect(config: AdapterConfig): Promise<void>;
  /** Collect all signals from the data source */
  collect(): Promise<SignalResult[]>;
}

/**
 * Runtime schema for {@link Evidence}. Used at the engine boundary
 * ({@link computeScorecard}) to reject malformed adapter or AI-inferred output
 * before it can corrupt a score. Mirrors the {@link Evidence} interface.
 */
export const EvidenceSchema: z.ZodType<Evidence> = z.object({
  source: z.string().min(1, "Evidence.source must be a non-empty string"),
  data: z.unknown(),
  summary: z.string().min(1, "Evidence.summary must be a non-empty string"),
});

/**
 * Runtime schema for {@link SignalResult}. Enforces the score (0/1/2) and
 * confidence ([0, 1]) invariants the scoring engine relies on.
 */
export const SignalResultSchema: z.ZodType<SignalResult> = z.object({
  signalId: z.string().min(1, "SignalResult.signalId must be a non-empty string"),
  questionId: z.string().min(1, "SignalResult.questionId must be a non-empty string"),
  score: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  evidence: z.array(EvidenceSchema),
  confidence: z.number().min(0).max(1),
});
