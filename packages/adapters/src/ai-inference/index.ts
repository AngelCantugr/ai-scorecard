/**
 * AI Inference Engine
 *
 * Uses an LLM (Anthropic Claude by default) to analyze repository contents and
 * score questions that cannot be directly measured by the GitHub adapter.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { SignalResult } from "@ai-scorecard/core";
import type {
  AIInferenceConfig,
  AIAnalysisResult,
  BatchAnalysisResult,
  ContentBundle,
  TokenUsage,
} from "./types.js";
import { buildPolicyAnalysisPrompt } from "./prompts/policy-analysis.js";
import { buildArchitectureAnalysisPrompt } from "./prompts/architecture-analysis.js";
import { buildDocumentationAnalysisPrompt } from "./prompts/documentation-analysis.js";
import { buildGovernanceAnalysisPrompt } from "./prompts/governance-analysis.js";

/** Default model to use when none is specified */
const DEFAULT_MODEL = "claude-sonnet-4-6";
/** Default max tokens per request */
const DEFAULT_MAX_TOKENS = 4096;
/** Signal ID prefix for AI-inferred signals */
const SIGNAL_ID_PREFIX = "ai-inference";

/**
 * Maps analysis type to the question IDs it covers.
 * Used to decide which prompts to call.
 */
const ANALYSIS_QUESTION_MAP: Record<string, string[]> = {
  policy: ["D4-Q22"],
  architecture: ["D1-Q2", "D1-Q3", "D1-Q4", "D2-Q9", "D2-Q10", "D2-Q11", "D2-Q12", "D3-Q19"],
  documentation: ["D6-Q33", "D6-Q34", "D6-Q35"],
  governance: ["D3-Q15", "D4-Q24", "D5-Q26", "D5-Q27", "D5-Q28", "D5-Q29", "D5-Q30"],
};

/** All question IDs handled by the AI inference engine */
export const AI_INFERENCE_QUESTION_IDS: ReadonlyArray<string> = Object.values(
  ANALYSIS_QUESTION_MAP
).flat();

/**
 * AI Inference Engine — uses an LLM to analyze repository content and produce
 * SignalResults for questions that cannot be directly measured.
 */
export class AIInferenceEngine {
  private readonly config: AIInferenceConfig;
  private readonly client: Anthropic | null;

  constructor(config: AIInferenceConfig) {
    this.config = config;
    // Only instantiate the client when not in dry-run mode
    this.client = config.dryRun
      ? null
      : new Anthropic({ apiKey: config.apiKey });
  }

  /**
   * Analyze a content bundle and produce SignalResults for all supported questions.
   * When dryRun is enabled, logs the analysis plan and returns empty results.
   */
  async analyze(bundle: ContentBundle): Promise<SignalResult[]> {
    const model = this.config.model ?? DEFAULT_MODEL;
    const maxTokens = this.config.maxTokens ?? DEFAULT_MAX_TOKENS;

    if (this.config.dryRun) {
      this.logDryRun(bundle, model, maxTokens);
      return [];
    }

    const batches = await Promise.all([
      this.runBatch("policy", buildPolicyAnalysisPrompt(bundle), model, maxTokens),
      this.runBatch(
        "architecture",
        buildArchitectureAnalysisPrompt(bundle),
        model,
        maxTokens
      ),
      this.runBatch(
        "documentation",
        buildDocumentationAnalysisPrompt(bundle),
        model,
        maxTokens
      ),
      this.runBatch(
        "governance",
        buildGovernanceAnalysisPrompt(bundle),
        model,
        maxTokens
      ),
    ]);

    const signalResults: SignalResult[] = [];
    for (const batch of batches) {
      for (const result of batch.results) {
        signalResults.push(this.toSignalResult(result));
      }
    }

    return signalResults;
  }

  /**
   * Run a single batch analysis call against the LLM.
   */
  private async runBatch(
    analysisType: string,
    prompt: string,
    model: string,
    maxTokens: number
  ): Promise<BatchAnalysisResult> {
    if (!this.client) {
      throw new Error("Anthropic client is not initialized (dry-run mode)");
    }

    let rawText = "";
    let tokenUsage: TokenUsage | undefined;

    try {
      const message = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      });

      tokenUsage = {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      };

      console.log(
        `[ai-inference] ${analysisType}: ${tokenUsage.inputTokens} input tokens, ` +
          `${tokenUsage.outputTokens} output tokens`
      );

      const textBlock = message.content.find((block) => block.type === "text");
      rawText = textBlock?.type === "text" ? textBlock.text : "";
    } catch (error) {
      console.error(`[ai-inference] Error in ${analysisType} batch:`, error);
      return { analysisType, results: this.fallbackResults(analysisType) };
    }

    const parsed = this.parseAnalysisResults(rawText, analysisType);
    return { analysisType, results: parsed, tokenUsage };
  }

  /**
   * Parse the raw LLM text response into AIAnalysisResult objects.
   * Falls back to zero-confidence results if parsing fails.
   */
  private parseAnalysisResults(
    rawText: string,
    analysisType: string
  ): AIAnalysisResult[] {
    // Strip markdown code fences if present
    const cleaned = rawText
      .replace(/^```(?:json)?\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error(
        `[ai-inference] Failed to parse JSON for ${analysisType}. Raw response:\n${rawText}`
      );
      return this.fallbackResults(analysisType);
    }

    if (!Array.isArray(parsed)) {
      console.error(
        `[ai-inference] Expected JSON array for ${analysisType}, got ${typeof parsed}`
      );
      return this.fallbackResults(analysisType);
    }

    const validated: AIAnalysisResult[] = [];
    const expectedIds = new Set(ANALYSIS_QUESTION_MAP[analysisType] ?? []);

    for (const item of parsed) {
      if (!isAIAnalysisResult(item)) {
        console.warn(`[ai-inference] Skipping invalid result item:`, item);
        continue;
      }
      if (!expectedIds.has(item.questionId)) {
        console.warn(
          `[ai-inference] Unexpected questionId ${item.questionId} in ${analysisType} batch`
        );
        continue;
      }
      validated.push(item);
    }

    // Fill in any missing questions with zero-confidence results
    const foundIds = new Set(validated.map((r) => r.questionId));
    for (const questionId of expectedIds) {
      if (!foundIds.has(questionId)) {
        validated.push(missingResult(questionId));
      }
    }

    return validated;
  }

  /**
   * Return zero-confidence fallback results for all questions in an analysis batch.
   * Used when the LLM call fails or returns unparseable output.
   */
  private fallbackResults(analysisType: string): AIAnalysisResult[] {
    return (ANALYSIS_QUESTION_MAP[analysisType] ?? []).map(missingResult);
  }

  /**
   * Convert an AIAnalysisResult to a SignalResult for the scoring engine.
   */
  private toSignalResult(result: AIAnalysisResult): SignalResult {
    return {
      signalId: `${SIGNAL_ID_PREFIX}:${result.questionId}`,
      questionId: result.questionId,
      score: result.score,
      confidence: result.confidence,
      evidence: [
        {
          source: "ai-inference",
          data: { reasoning: result.reasoning },
          summary: result.evidence_summary,
        },
      ],
    };
  }

  /** Log the dry-run analysis plan without making API calls */
  private logDryRun(bundle: ContentBundle, model: string, maxTokens: number): void {
    console.log(`[ai-inference] DRY RUN — source: ${bundle.source}`);
    console.log(`[ai-inference] Model: ${model}, maxTokens: ${maxTokens}`);
    console.log(`[ai-inference] Files: ${bundle.files.length} file(s)`);
    for (const file of bundle.files) {
      console.log(`  - ${file.path} (${file.content.length} chars)`);
    }
    for (const [analysisType, questionIds] of Object.entries(ANALYSIS_QUESTION_MAP)) {
      console.log(`[ai-inference] Batch: ${analysisType} → ${questionIds.join(", ")}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Type guard to validate an AIAnalysisResult from the LLM response */
function isAIAnalysisResult(value: unknown): value is AIAnalysisResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["questionId"] === "string" &&
    (v["score"] === 0 || v["score"] === 1 || v["score"] === 2) &&
    typeof v["confidence"] === "number" &&
    typeof v["reasoning"] === "string" &&
    typeof v["evidence_summary"] === "string"
  );
}

/** Create a zero-confidence result for a question where content is missing */
function missingResult(questionId: string): AIAnalysisResult {
  return {
    questionId,
    score: 0,
    confidence: 0,
    reasoning: "Content not available for analysis.",
    evidence_summary: "No relevant files were provided for this question.",
  };
}
