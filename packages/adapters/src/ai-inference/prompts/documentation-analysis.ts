/**
 * Documentation analysis prompts — covers Q33, Q34, Q35.
 */

import type { ContentBundle } from "../types.js";

/** Question rubrics for documentation/context engineering questions */
const RUBRICS = {
  "D6-Q33": {
    text: "Is there a context delivery strategy — how is relevant context assembled and delivered to agents?",
    0: "No context strategy — agents get whatever is in the prompt.",
    1: "Some context curation (e.g., selected files).",
    2: "Engineered context delivery — dynamic context assembly, relevance ranking, and token budget management.",
  },
  "D6-Q34": {
    text: "Are knowledge bases and RAG sources maintained with the same rigor as production code?",
    0: "Knowledge bases are stale or unmaintained.",
    1: "Periodically updated but no formal process.",
    2: "Knowledge bases have CI/CD — automated ingestion, freshness checks, and quality validation.",
  },
  "D6-Q35": {
    text: "Is there a strategy to reduce dependency on human-written docs by using verified, structured sources?",
    0: "Fully dependent on human-written prose.",
    1: "Some auto-generated docs (e.g., from code).",
    2: "Strategy to derive documentation from code, tests, and types — with accuracy guarantees.",
  },
} as const;

/**
 * Build a prompt for documentation and context engineering analysis.
 * Analyzes Q33, Q34, Q35.
 */
export function buildDocumentationAnalysisPrompt(bundle: ContentBundle): string {
  const fileList = bundle.files
    .map((f) => `=== ${f.path} ===\n${f.content}`)
    .join("\n\n");

  return `You are an AI maturity analyst. Analyze the following repository files to score the organization's documentation quality and context engineering practices.

## Repository: ${bundle.source}

## Files to Analyze
${fileList || "(no files provided)"}

## Questions to Score

For each question below, analyze the provided files and output a JSON score.

### D6-Q33: ${RUBRICS["D6-Q33"].text}
Rubric:
- Score 0: ${RUBRICS["D6-Q33"][0]}
- Score 1: ${RUBRICS["D6-Q33"][1]}
- Score 2: ${RUBRICS["D6-Q33"][2]}
Look for: context assembly configs, RAG pipeline configs, agent instruction files (CLAUDE.md, agents.md), token budget configurations, relevance ranking logic.

### D6-Q34: ${RUBRICS["D6-Q34"].text}
Rubric:
- Score 0: ${RUBRICS["D6-Q34"][0]}
- Score 1: ${RUBRICS["D6-Q34"][1]}
- Score 2: ${RUBRICS["D6-Q34"][2]}
Look for: knowledge base CI/CD pipelines, ingestion pipeline configs, freshness check scripts, automated quality validation for RAG sources.

### D6-Q35: ${RUBRICS["D6-Q35"].text}
Rubric:
- Score 0: ${RUBRICS["D6-Q35"][0]}
- Score 1: ${RUBRICS["D6-Q35"][1]}
- Score 2: ${RUBRICS["D6-Q35"][2]}
Look for: auto-doc tooling configs (TypeDoc, Swagger, JSDoc), doc generation scripts in CI, OpenAPI spec generation, type-derived documentation strategies.

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
