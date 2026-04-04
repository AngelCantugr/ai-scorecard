/**
 * Policy analysis prompts — covers Q22 (AI usage policy).
 */

import type { ContentBundle } from "../types.js";
import { buildFileList } from "./utils.js";

/** Question rubrics for policy questions */
const RUBRICS = {
  "D4-Q22": {
    text: "Is there a formal AI usage policy that developers know and follow?",
    0: "No policy.",
    1: "Policy exists but not enforced or widely known.",
    2: "Living policy document, referenced in onboarding, with compliance tracking.",
  },
} as const;

/**
 * Build a prompt for policy analysis.
 * Analyzes Q22 (AI usage policy).
 */
export function buildPolicyAnalysisPrompt(bundle: ContentBundle): string {
  // Policy analysis focuses on governance and policy documents, not source code.
  const fileList = buildFileList(bundle, (path) =>
    /\.(md|txt|rst|adoc)$/i.test(path) ||
    /policy|governance|conduct|security|compliance|legal/i.test(path)
  );

  return `You are an AI maturity analyst. Analyze the following repository files to score the organization's AI governance policies.

## Repository: ${bundle.source}

## Files to Analyze
${fileList}

## Questions to Score

For each question below, analyze the provided files and output a JSON score.

### D4-Q22: ${RUBRICS["D4-Q22"].text}
Rubric:
- Score 0: ${RUBRICS["D4-Q22"][0]}
- Score 1: ${RUBRICS["D4-Q22"][1]}
- Score 2: ${RUBRICS["D4-Q22"][2]}

Look for: AI policy documents (e.g. AI_POLICY.md, acceptable-use.md), onboarding docs referencing AI tools, compliance configs, governance frameworks.

## Output Format

Respond ONLY with a valid JSON array. Each element must match this structure:
{
  "questionId": "<question-id>",
  "score": <0|1|2>,
  "confidence": <0.3-0.7>,
  "reasoning": "<explanation of the score>",
  "evidence_summary": "<summary of evidence found or not found>"
}

Output the JSON array now:`;
}
