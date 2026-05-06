/**
 * Provider-agnostic LLM client contract.
 *
 * The AI Inference Engine talks to LLM providers through this minimal surface.
 * Each provider implementation (Anthropic, Ollama, …) wraps its own SDK or
 * HTTP transport and normalises the response shape so the engine can stay
 * provider-blind.
 */

/** A single completion request — one user prompt, one response. */
export interface LLMCompletionRequest {
  model: string;
  maxTokens: number;
  prompt: string;
}

/** Normalised response across providers. `tokenUsage` is optional because
 *  not every provider reports it (e.g., older Ollama versions). */
export interface LLMCompletionResponse {
  text: string;
  tokenUsage?: { inputTokens: number; outputTokens: number };
}

/** All providers implement this interface. The engine only uses `complete`. */
export interface LLMClient {
  complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse>;
}
