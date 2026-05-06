/**
 * Ollama-backed LLMClient implementation.
 *
 * Talks to a local (or remote) Ollama server via its native /api/chat HTTP
 * endpoint. We use the global `fetch` instead of the `ollama` npm package
 * because the surface area we need is tiny — adding a dependency would be
 * premature.
 *
 * Why /api/chat (not /api/generate) and not the OpenAI-compatible endpoint:
 *  - /api/chat takes the same role/content message shape as Anthropic and
 *    OpenAI, so the prompt format we already build is portable.
 *  - The native endpoint accepts `format: "json"` which biases the model
 *    toward valid JSON output. The engine still re-parses defensively via
 *    extractJsonArray() because local models occasionally emit prose around
 *    JSON even with the flag set.
 */

import type { LLMClient, LLMCompletionRequest, LLMCompletionResponse } from "./types.js";

const DEFAULT_BASE_URL = "http://localhost:11434";

interface OllamaChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaClient implements LLMClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    // Trim trailing slash so we can join paths with a single `/`.
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const url = `${this.baseUrl}/api/chat`;
    const body = {
      model: req.model,
      messages: [{ role: "user", content: req.prompt }],
      stream: false,
      format: "json",
      options: { num_predict: req.maxTokens },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await safeReadText(response);
      throw new Error(`Ollama request to ${url} failed with status ${response.status}: ${detail}`);
    }

    const parsed = (await response.json()) as OllamaChatResponse;
    const text = parsed.message?.content;
    if (typeof text !== "string") {
      throw new Error(
        `Ollama response from ${url} is missing message.content (model: ${req.model})`
      );
    }

    // Ollama exposes prompt_eval_count / eval_count when it wasn't a fully
    // cached response; map them to the canonical input/output token names.
    const inputTokens = parsed.prompt_eval_count;
    const outputTokens = parsed.eval_count;
    const tokenUsage =
      typeof inputTokens === "number" && typeof outputTokens === "number"
        ? { inputTokens, outputTokens }
        : undefined;

    return tokenUsage ? { text, tokenUsage } : { text };
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "<unreadable response body>";
  }
}
