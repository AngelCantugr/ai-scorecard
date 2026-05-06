/**
 * Provider factory — turns a discriminated AIInferenceConfig into a concrete
 * LLMClient. Centralising the switch here keeps AIInferenceEngine free of
 * provider-specific imports and makes adding a new provider a one-file change.
 */

import type { AIInferenceConfig } from "../types.js";
import { AnthropicClient } from "./anthropic.js";
import { OllamaClient } from "./ollama.js";
import type { LLMClient } from "./types.js";

export function createLLMClient(config: AIInferenceConfig): LLMClient {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicClient(config.apiKey);
    case "ollama":
      return new OllamaClient(config.baseUrl);
  }
}
