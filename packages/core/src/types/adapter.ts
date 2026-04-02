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
