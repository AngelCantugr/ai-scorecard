/**
 * AI-specific types for the AI Inference Engine.
 *
 * AIInferenceConfig is a discriminated union over `provider`. Each provider
 * carries only the fields it needs — TypeScript prevents mixing (e.g., setting
 * an `apiKey` when using Ollama, which doesn't authenticate).
 */

/** Anthropic-backed inference (default). Requires an API key. */
export interface AnthropicInferenceConfig {
  provider: "anthropic";
  /** API key for the Anthropic API */
  apiKey: string;
  /** Model to use (default: claude-sonnet-4-6) */
  model?: string;
  /** Maximum tokens per analysis request */
  maxTokens?: number;
  /** When true, shows what would be analyzed without making API calls */
  dryRun?: boolean;
}

/** Ollama-backed inference (local or self-hosted). No API key required. */
export interface OllamaInferenceConfig {
  provider: "ollama";
  /** Base URL of the Ollama server (default: http://localhost:11434) */
  baseUrl?: string;
  /** Model to use (default: llama3.1) */
  model?: string;
  /** Maximum tokens per analysis request */
  maxTokens?: number;
  /** When true, shows what would be analyzed without making API calls */
  dryRun?: boolean;
}

/** Configuration for the AI Inference Engine. */
export type AIInferenceConfig = AnthropicInferenceConfig | OllamaInferenceConfig;

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
  /**
   * True when the batch failed (LLM API error or unparseable response).
   * Results will contain zero-confidence fallbacks for all questions in the batch.
   * Callers can use this to detect silent scoring failures and surface them as
   * observability signals rather than treating them as low-confidence results.
   */
  error?: boolean;
}
