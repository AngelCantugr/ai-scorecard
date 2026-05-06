/**
 * Anthropic-backed LLMClient implementation.
 *
 * Wraps the @anthropic-ai/sdk Messages API. This is a pure refactor of the
 * call site that previously lived inline in AIInferenceEngine.runBatch.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LLMClient, LLMCompletionRequest, LLMCompletionResponse } from "./types.js";

export class AnthropicClient implements LLMClient {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const message = await this.client.messages.create({
      model: req.model,
      max_tokens: req.maxTokens,
      messages: [{ role: "user", content: req.prompt }],
    });

    // Anthropic responses can contain multiple content blocks (text, tool_use,
    // etc.). For this engine we only care about the first text block — the
    // prompts explicitly request a JSON-only response so additional blocks
    // would indicate a model misbehavior we'd rather surface as parse failure.
    const textBlock = message.content.find((block) => block.type === "text");
    const text = textBlock?.type === "text" ? textBlock.text : "";

    return {
      text,
      tokenUsage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    };
  }
}
