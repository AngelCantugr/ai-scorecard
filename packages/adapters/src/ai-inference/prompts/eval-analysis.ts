/**
 * Eval quality analysis prompts — covers Q43, Q46, Q47.
 *
 * Q43: CI gate signal — detects whether eval runs are triggered automatically on
 *      every change to prompts, models, or agent definitions, including LLM-as-judge
 *      or rubric-scoring patterns in the eval framework configuration.
 * Q46: Triage loop signal — detects whether eval failure events feed back into
 *      prompt iteration by correlating eval-related commit history with prompt-file
 *      changes and business-outcome metric definitions.
 * Q47: Regression detection — estimates eval cycle maturity from automation level,
 *      alert/quality-gate configs, and historical trend analysis evidence.
 */

import type { ContentBundle } from "../types.js";
import { buildFileList } from "./utils.js";

/** Question rubrics for eval quality questions */
const RUBRICS = {
  "D8-Q43": {
    text: "Are evals executed in CI on every change to prompts, models, or agent definitions?",
    0: "Evals are not tied to the development lifecycle.",
    1: "Evals are run manually or on a schedule.",
    2: "Evals are a required CI gate — any change to AI components triggers the eval suite automatically.",
  },
  "D8-Q46": {
    text: "Do evals measure business-relevant outcomes alongside technical metrics?",
    0: "Evals only measure technical metrics (e.g., BLEU, perplexity).",
    1: "Some business-relevant metrics tracked but not standardized.",
    2: "Evals include business KPIs (task completion rate, user satisfaction, cost per outcome) alongside technical metrics.",
  },
  "D8-Q47": {
    text: "Is there a regression detection process to catch quality degradation in AI outputs over time?",
    0: "No regression detection — quality issues are discovered in production.",
    1: "Periodic manual checks for quality regression.",
    2: "Automated regression detection with alerts, quality gates, and historical trend analysis.",
  },
} as const;

/**
 * Build a prompt for eval quality analysis.
 * Analyzes Q43 (CI eval gate / LLM-as-judge), Q46 (business-outcome metrics / triage loop),
 * and Q47 (regression detection / cycle time).
 */
export function buildEvalAnalysisPrompt(bundle: ContentBundle): string {
  const fileList = buildFileList(bundle, (path) => {
    // CI/CD workflow files that may contain eval job definitions
    if (/^\.github\/workflows\//i.test(path) && /\.(yml|yaml)$/i.test(path)) {
      return true;
    }
    // Eval framework config files (Promptfoo, RAGAS, custom harnesses)
    if (
      /promptfoo|ragas|evals?[-_]|[-_]evals?|evaluation/i.test(path) &&
      /\.(yml|yaml|json|ts|js|py)$/i.test(path)
    ) {
      return true;
    }
    // Dashboard and monitoring definition files
    if (/dashboard|monitor|alert|grafana|datadog/i.test(path) && /\.(yml|yaml|json)$/i.test(path)) {
      return true;
    }
    // Benchmark and regression test configs
    if (
      /benchmark|regression|quality[-_]gate|quality_gate/i.test(path) &&
      /\.(yml|yaml|json|ts|js|py)$/i.test(path)
    ) {
      return true;
    }
    // General CI/CD config files at root level
    if (/^(\.?circleci|\.?travis|\.?buildkite|\.?tekton)\//i.test(path)) {
      return true;
    }
    // Prompt definition and prompt iteration files
    if (/prompts?\//i.test(path) && /\.(md|txt|yaml|yml|json|ts|js)$/i.test(path)) {
      return true;
    }
    return false;
  });

  const commitHistoryContext = buildEvalCommitHistoryContext(bundle);

  return `You are an AI maturity analyst. Analyze the following repository files and commit history to score the organization's AI evaluation quality practices.

## Repository: ${bundle.source}

## Eval and CI Files to Analyze
${fileList}
${commitHistoryContext}
## Questions to Score

For each question below, analyze the provided files and output a JSON score.

### D8-Q43: ${RUBRICS["D8-Q43"].text}
Rubric:
- Score 0: ${RUBRICS["D8-Q43"][0]}
- Score 1: ${RUBRICS["D8-Q43"][1]}
- Score 2: ${RUBRICS["D8-Q43"][2]}
Look for: GitHub Actions or CI workflow files that trigger eval jobs on push/PR to prompt or model files (path filters like \`prompts/**\`, \`models/**\`, \`agents/**\`); Promptfoo, RAGAS, or custom harness configurations with CI integration; LLM-as-judge configurations (a separate judge model evaluating outputs against a rubric prompt — e.g., \`judge: model: ...\` in Promptfoo YAML or an evaluator that calls an LLM with a scoring rubric); required CI status checks enforcing eval passage. A score of 2 requires automated CI triggering — manual or scheduled-only runs warrant a 1.
Confidence guidance: Use confidence 0.6–0.7 when CI workflow files are present and clearly show eval jobs with path-based triggers. Use 0.4–0.5 when eval configs exist but CI integration is unclear or partial.

### D8-Q46: ${RUBRICS["D8-Q46"].text}
Rubric:
- Score 0: ${RUBRICS["D8-Q46"][0]}
- Score 1: ${RUBRICS["D8-Q46"][1]}
- Score 2: ${RUBRICS["D8-Q46"][2]}
Look for: eval metric definitions that include business KPIs (task completion rate, user satisfaction score, cost per outcome, revenue impact, retention) alongside technical metrics (latency, accuracy, BLEU, perplexity); dashboard configs or tracking files that correlate eval failures with business outcomes; triage loop evidence — commit history showing that eval failure events (e.g., dropped metrics) triggered prompt-file changes or model updates; outcome tracking configs linking AI output quality to product metrics.
Confidence guidance: Use confidence 0.5–0.7 when metric definition files are present and clearly include or exclude business KPIs. Use 0.4 when only technical metrics are visible or content is ambiguous.

### D8-Q47: ${RUBRICS["D8-Q47"].text}
Rubric:
- Score 0: ${RUBRICS["D8-Q47"][0]}
- Score 1: ${RUBRICS["D8-Q47"][1]}
- Score 2: ${RUBRICS["D8-Q47"][2]}
Look for: automated regression test suites that compare AI output quality across time or model versions; alert configs that fire on metric degradation (e.g., accuracy drop below threshold); quality gates in CI that block promotion when regression is detected; monitoring dashboards with historical trend charts for AI output quality; eval cycle time evidence — the commit history can suggest how frequently the eval-to-fix cycle runs (frequent small corrections imply a tight automated loop; infrequent large corrections suggest manual periodic checks). A score of 2 requires both automated detection AND alerting/gating; a score of 1 accepts periodic manual checks without automation.
Confidence guidance: Use confidence 0.5–0.7 when regression configs or alert definitions are clearly present or absent. Use 0.4–0.5 when cycle-time evidence must be inferred from commit cadence alone.

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

/**
 * Build a commit history context section from bundle metadata.
 * The GitHub adapter can populate bundle.metadata.evalCommits with recent commits
 * touching eval framework files, prompt files, or model definition files.
 * Returns an empty string when no commit history is available.
 */
function buildEvalCommitHistoryContext(bundle: ContentBundle): string {
  const commits = bundle.metadata?.["evalCommits"];
  if (!Array.isArray(commits) || commits.length === 0) return "";

  const lines: string[] = ["## Recent Commit History (Eval / Prompt Files)"];
  for (const commit of commits.slice(0, 20)) {
    if (typeof commit === "object" && commit !== null) {
      const c = commit as Record<string, unknown>;
      const sha = typeof c["sha"] === "string" ? c["sha"].slice(0, 7) : "unknown";
      const message = typeof c["message"] === "string" ? c["message"].split("\n")[0] : "";
      const author = typeof c["author"] === "string" ? c["author"] : "";
      const date = typeof c["date"] === "string" ? c["date"].slice(0, 10) : "";
      lines.push(`- ${sha} (${date}) [${author}]: ${message}`);
    }
  }
  lines.push("");
  return "\n" + lines.join("\n") + "\n";
}
