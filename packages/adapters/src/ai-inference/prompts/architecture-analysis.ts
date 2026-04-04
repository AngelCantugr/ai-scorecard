/**
 * Architecture analysis prompts — covers Q2, Q3, Q4, Q9, Q10, Q11, Q12, Q19.
 */

import type { ContentBundle } from "../types.js";
import { buildFileList } from "./utils.js";

/** Question rubrics for architecture questions */
const RUBRICS = {
  "D1-Q2": {
    text: "Is there a model registry with versioning and access controls?",
    0: "No registry.",
    1: "Informal list or wiki of models.",
    2: "Versioned registry with access controls and deprecation policies.",
  },
  "D1-Q3": {
    text: "Are MCP servers deployed and managed centrally? How many, how often called?",
    0: "No MCP servers.",
    1: "Ad-hoc MCP servers in individual repos.",
    2: "Centrally managed MCP servers with usage tracking.",
  },
  "D1-Q4": {
    text: "Is there a context engine (RAG infrastructure, knowledge bases, context assembly)?",
    0: "No context engine.",
    1: "Basic RAG or retrieval setup in one project.",
    2: "Org-wide context engine with maintained knowledge bases and delivery strategy.",
  },
  "D2-Q9": {
    text: "What modalities are devs using — chat, copilot, agents, dev workflows? Is there variety?",
    0: "Single modality (e.g., only chat).",
    1: "Two modalities in use.",
    2: "Developers use the right modality for the task — chat, inline completion, agents, and workflows.",
  },
  "D2-Q10": {
    text: "What skills are used most frequently? Are devs creating custom skills?",
    0: "No skills usage.",
    1: "Using built-in skills only.",
    2: "Active creation and sharing of custom skills with usage tracking.",
  },
  "D2-Q11": {
    text: "What plugins/integrations are installed and actively used?",
    0: "No AI plugins beyond basic autocomplete.",
    1: "Some plugins installed but low usage.",
    2: "Curated plugin ecosystem with tracked installation and execution metrics.",
  },
  "D2-Q12": {
    text: "Are developers selecting appropriate models for task complexity (not always the most expensive)?",
    0: "Always using the most expensive model.",
    1: "Some model selection awareness but no guidelines.",
    2: "Clear model selection guidelines with cost tracking per task type.",
  },
  "D3-Q19": {
    text: "What percentage of tasks have moved from deterministic → probabilistic → back to deterministic?",
    0: "No tracking of this pattern.",
    1: "Anecdotal awareness.",
    2: "Tracked pipeline maturity — LLM calls that have been replaced by deterministic code after validation.",
  },
} as const;

/**
 * Build a prompt for architecture analysis.
 * Analyzes Q2, Q3, Q4, Q9, Q10, Q11, Q12, Q19.
 */
export function buildArchitectureAnalysisPrompt(bundle: ContentBundle): string {
  // Architecture analysis focuses on source code and configuration, not docs.
  const fileList = buildFileList(bundle, (path) =>
    /\.(ts|js|tsx|jsx|py|go|java|kt|rb|rs|json|yaml|yml|toml|dockerfile)$/i.test(path) ||
    /dockerfile|docker-compose|\.github\/|makefile|justfile/i.test(path)
  );

  return `You are an AI maturity analyst. Analyze the following repository files to score the organization's AI platform infrastructure and developer tooling architecture.

## Repository: ${bundle.source}

## Files to Analyze
${fileList}

## Questions to Score

For each question below, analyze the provided files and output a JSON score.

### D1-Q2: ${RUBRICS["D1-Q2"].text}
Rubric:
- Score 0: ${RUBRICS["D1-Q2"][0]}
- Score 1: ${RUBRICS["D1-Q2"][1]}
- Score 2: ${RUBRICS["D1-Q2"][2]}
Look for: model catalog files, ML ops configs, models/ directories with version tags, model versioning patterns, access control configs.

### D1-Q3: ${RUBRICS["D1-Q3"].text}
Rubric:
- Score 0: ${RUBRICS["D1-Q3"][0]}
- Score 1: ${RUBRICS["D1-Q3"][1]}
- Score 2: ${RUBRICS["D1-Q3"][2]}
Look for: mcp.json, .mcp/ directories, server definitions, MCP configuration files, usage tracking configs.

### D1-Q4: ${RUBRICS["D1-Q4"].text}
Rubric:
- Score 0: ${RUBRICS["D1-Q4"][0]}
- Score 1: ${RUBRICS["D1-Q4"][1]}
- Score 2: ${RUBRICS["D1-Q4"][2]}
Look for: RAG configs, vector DB setup (Pinecone, Weaviate, Qdrant, Chroma), embedding pipeline configs, knowledge base definitions.

### D2-Q9: ${RUBRICS["D2-Q9"].text}
Rubric:
- Score 0: ${RUBRICS["D2-Q9"][0]}
- Score 1: ${RUBRICS["D2-Q9"][1]}
- Score 2: ${RUBRICS["D2-Q9"][2]}
Look for: steering files (CLAUDE.md, agents.md) mentioning different AI tools/modalities, workflow configs, agent definitions, copilot settings.

### D2-Q10: ${RUBRICS["D2-Q10"].text}
Rubric:
- Score 0: ${RUBRICS["D2-Q10"][0]}
- Score 1: ${RUBRICS["D2-Q10"][1]}
- Score 2: ${RUBRICS["D2-Q10"][2]}
Look for: custom skill definitions, skill-related configs, skills/ directories, usage tracking for skills.

### D2-Q11: ${RUBRICS["D2-Q11"].text}
Rubric:
- Score 0: ${RUBRICS["D2-Q11"][0]}
- Score 1: ${RUBRICS["D2-Q11"][1]}
- Score 2: ${RUBRICS["D2-Q11"][2]}
Look for: plugin configs, MCP tool definitions, extension manifests, .vscode/extensions.json, plugin usage tracking.

### D2-Q12: ${RUBRICS["D2-Q12"].text}
Rubric:
- Score 0: ${RUBRICS["D2-Q12"][0]}
- Score 1: ${RUBRICS["D2-Q12"][1]}
- Score 2: ${RUBRICS["D2-Q12"][2]}
Look for: model selection logic in code, routing configs, model selection guidelines in docs, cost tracking per model/task.

### D3-Q19: ${RUBRICS["D3-Q19"].text}
Rubric:
- Score 0: ${RUBRICS["D3-Q19"][0]}
- Score 1: ${RUBRICS["D3-Q19"][1]}
- Score 2: ${RUBRICS["D3-Q19"][2]}
Look for: patterns of LLM calls replaced by deterministic code, migration tracking, architectural docs about probabilistic-to-deterministic transitions.

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
