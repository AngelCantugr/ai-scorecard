/**
 * @ai-scorecard/adapters
 * Plugin system for data sources (GitHub, GitLab, etc.)
 */

export type { Adapter } from "@ai-scorecard/core";
export { AIInferenceEngine, AI_INFERENCE_QUESTION_IDS } from "./ai-inference/index.js";
export type {
  AIInferenceConfig,
  AnthropicInferenceConfig,
  OllamaInferenceConfig,
  ContentBundle,
  AIAnalysisResult,
  TokenUsage,
  BatchAnalysisResult,
} from "./ai-inference/types.js";
export type {
  LLMClient,
  LLMCompletionRequest,
  LLMCompletionResponse,
} from "./ai-inference/clients/types.js";
export { GitHubAdapter } from "./github/index.js";
export type { GitHubAdapterConfig } from "./github/config.js";
export type { GitHubCollectResult } from "./github/index.js";
export type {
  CollectorError,
  CollectorErrorKind,
  CollectorAuthError,
  CollectorRateLimitError,
  CollectorNotFoundError,
  CollectorUnexpectedError,
} from "./github/collector-error.js";
