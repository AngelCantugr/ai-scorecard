/**
 * AI-specific types for the AI Inference Engine.
 */

/** Configuration for the AI Inference Engine */
export interface AIInferenceConfig {
  /** LLM provider (start with Anthropic Claude) */
  provider: "anthropic";
  /** API key for the LLM provider */
  apiKey: string;
  /** Model to use (default: claude-sonnet-4-6) */
  model?: string;
  /** Maximum tokens per analysis request */
  maxTokens?: number;
  /** When true, shows what would be analyzed without making API calls */
  dryRun?: boolean;
}

/** A bundle of files and metadata to be analyzed by the AI inference engine */
export interface ContentBundle {
  /** Source identifier */
  source: string;
  /** File paths and their contents to analyze */
  files: Array<{ path: string; content: string }>;
  /** Additional context (e.g., repo metadata) */
  metadata?: Record<string, unknown>;
}

/** Structured JSON output returned by the LLM for a single question */
export interface AIAnalysisResult {
  /** Question ID (e.g., "D1-Q2") */
  questionId: string;
  /** Score: 0 = not adopted, 1 = partial, 2 = fully adopted */
  score: 0 | 1 | 2;
  /** Confidence 0–1 (AI inference is typically 0.3–0.7) */
  confidence: number;
  /** Reasoning for the score */
  reasoning: string;
  /** Summary of evidence found */
  evidence_summary: string;
}

/** Token usage information from the LLM response */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Result of a single batch LLM analysis call */
export interface BatchAnalysisResult {
  analysisType: string;
  results: AIAnalysisResult[];
  tokenUsage?: TokenUsage;
}
