/**
 * @ai-scorecard/adapters
 * Plugin system for data sources (GitHub, GitLab, etc.)
 */

export type { Adapter } from "@ai-scorecard/core";
export { AIInferenceEngine, AI_INFERENCE_QUESTION_IDS } from "./ai-inference/index.js";
export type {
  AIInferenceConfig,
  ContentBundle,
  AIAnalysisResult,
  TokenUsage,
  BatchAnalysisResult,
} from "./ai-inference/types.js";
