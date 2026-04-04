/**
 * Governance analysis prompts — covers Q15, Q24, Q26, Q27, Q28, Q29, Q30.
 */

import type { ContentBundle } from "../types.js";
import { buildFileList } from "./utils.js";

/** Question rubrics for governance, observability, and cost questions */
const RUBRICS = {
  "D3-Q15": {
    text: "Where are the current SDLC bottlenecks? Has faster coding shifted the bottleneck to review/CI/deploy?",
    0: "No bottleneck analysis.",
    1: "Aware of bottlenecks but no measurement.",
    2: "Measured bottleneck analysis with data-driven improvements (e.g., reduced review wait times).",
  },
  "D4-Q24": {
    text: "Is there a review process specifically for AI-generated code (beyond standard code review)?",
    0: "No differentiated review.",
    1: "Informal extra scrutiny for AI code.",
    2: "Defined review checklist or process for AI-generated code with tracked outcomes.",
  },
  "D5-Q26": {
    text: "Is there observability into AI development workflows (agent sessions, tool usage, error rates)?",
    0: "No visibility into AI dev workflows.",
    1: "Some logging but no dashboards.",
    2: "Dashboards tracking agent sessions, tool calls, success/error rates, and trends.",
  },
  "D5-Q27": {
    text: "Are model costs tracked per team/project/use-case?",
    0: "No cost tracking.",
    1: "Aggregate cost known but not broken down.",
    2: "Per-team/project cost attribution with budgets and alerts.",
  },
  "D5-Q28": {
    text: "What are the measured dollar savings from RAG and optimized prompting vs naive approaches?",
    0: "No measurement.",
    1: "Anecdotal savings estimates.",
    2: "A/B tested cost comparisons with documented savings from RAG, caching, and prompt optimization.",
  },
  "D5-Q29": {
    text: "Are there dashboards showing AI SRE metrics (latency, error rates, token usage, cost)?",
    0: "No AI-specific SRE dashboards.",
    1: "Basic metrics collected but not visualized.",
    2: "Real-time dashboards with alerting on latency, errors, token usage, and cost anomalies.",
  },
  "D5-Q30": {
    text: "What productivity metrics are being tracked (cycle time, throughput, developer satisfaction)?",
    0: "No productivity metrics.",
    1: "Some metrics but not correlated with AI adoption.",
    2: "Comprehensive metrics suite with before/after AI baselines and ongoing tracking.",
  },
} as const;

/**
 * Build a prompt for governance, observability, and cost analysis.
 * Analyzes Q15, Q24, Q26, Q27, Q28, Q29, Q30.
 */
export function buildGovernanceAnalysisPrompt(bundle: ContentBundle): string {
  const fileList = buildFileList(bundle);

  return `You are an AI maturity analyst. Analyze the following repository files to score the organization's AI governance, observability, and cost management practices.

## Repository: ${bundle.source}

## Files to Analyze
${fileList}

## Questions to Score

For each question below, analyze the provided files and output a JSON score.

### D3-Q15: ${RUBRICS["D3-Q15"].text}
Rubric:
- Score 0: ${RUBRICS["D3-Q15"][0]}
- Score 1: ${RUBRICS["D3-Q15"][1]}
- Score 2: ${RUBRICS["D3-Q15"][2]}
Look for: CI configs mentioning bottleneck analysis, dev docs about SDLC improvements, PR review time tracking, bottleneck measurement tooling.

### D4-Q24: ${RUBRICS["D4-Q24"].text}
Rubric:
- Score 0: ${RUBRICS["D4-Q24"][0]}
- Score 1: ${RUBRICS["D4-Q24"][1]}
- Score 2: ${RUBRICS["D4-Q24"][2]}
Look for: AI-specific review checklists, PR templates mentioning AI code review, review process documentation, AI review automation configs.

### D5-Q26: ${RUBRICS["D5-Q26"].text}
Rubric:
- Score 0: ${RUBRICS["D5-Q26"][0]}
- Score 1: ${RUBRICS["D5-Q26"][1]}
- Score 2: ${RUBRICS["D5-Q26"][2]}
Look for: agent telemetry configs, session logging configurations, workflow observability dashboards, tool usage tracking.

### D5-Q27: ${RUBRICS["D5-Q27"].text}
Rubric:
- Score 0: ${RUBRICS["D5-Q27"][0]}
- Score 1: ${RUBRICS["D5-Q27"][1]}
- Score 2: ${RUBRICS["D5-Q27"][2]}
Look for: cost management configs, billing dashboard definitions, per-team cost attribution configs, budget alert configurations.

### D5-Q28: ${RUBRICS["D5-Q28"].text}
Rubric:
- Score 0: ${RUBRICS["D5-Q28"][0]}
- Score 1: ${RUBRICS["D5-Q28"][1]}
- Score 2: ${RUBRICS["D5-Q28"][2]}
Look for: A/B test configs, cost comparison reports, RAG vs baseline cost analysis, prompt optimization measurement configs.

### D5-Q29: ${RUBRICS["D5-Q29"].text}
Rubric:
- Score 0: ${RUBRICS["D5-Q29"][0]}
- Score 1: ${RUBRICS["D5-Q29"][1]}
- Score 2: ${RUBRICS["D5-Q29"][2]}
Look for: Grafana/Datadog dashboard definitions related to AI, alert configs for AI SRE metrics, latency/error/token usage monitoring.

### D5-Q30: ${RUBRICS["D5-Q30"].text}
Rubric:
- Score 0: ${RUBRICS["D5-Q30"][0]}
- Score 1: ${RUBRICS["D5-Q30"][1]}
- Score 2: ${RUBRICS["D5-Q30"][2]}
Look for: DORA metrics configs, developer survey tooling, productivity analytics dashboards, before/after AI adoption tracking.

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
