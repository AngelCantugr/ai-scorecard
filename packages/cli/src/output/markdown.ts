/**
 * Markdown output formatter for @ai-scorecard/cli
 */

import type { ScorecardResult, QuestionScore } from "@ai-scorecard/core";
import { questions } from "@ai-scorecard/core";
import { getUnaddressedQuestions, getLowConfidenceQuestions } from "@ai-scorecard/core";

/** Render a simple progress bar in markdown using Unicode block elements */
function markdownBar(percentage: number, width = 12): string {
  const filled = Math.round((percentage / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

/** Find the question text for a given questionId */
function questionText(questionId: string): string {
  return questions.find((q) => q.id === questionId)?.text ?? questionId;
}

/** Format a QuestionScore as a markdown list item */
function formatGap(qs: QuestionScore): string {
  const text = questionText(qs.questionId);
  return `- **${qs.questionId}**: ${text}`;
}

/** Format a low-confidence question as a markdown list item */
function formatLowConfidence(qs: QuestionScore): string {
  const text = questionText(qs.questionId);
  const pct = Math.round(qs.confidence * 100);
  return `- **${qs.questionId}**: ${text} *(confidence: ${pct}%)*`;
}

/**
 * Render the scorecard result as a Markdown document and print to stdout.
 */
export function outputMarkdown(result: ScorecardResult): void {
  const lines: string[] = [];

  // Header
  lines.push("# AI Adoption Scorecard");
  lines.push("");
  lines.push(`**Organization:** ${result.metadata.target}`);
  lines.push(`**Assessed at:** ${result.assessedAt.toISOString()}`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Overall Score | ${result.totalScore}/${result.maxScore} (${result.percentage}%) |`);
  lines.push(`| Maturity Tier | ${result.tier.label} (Level ${result.tier.level}) |`);
  lines.push(`| Overall Confidence | ${Math.round(result.overallConfidence * 100)}% |`);
  lines.push("");

  // Dimension Breakdown
  lines.push("## Dimension Breakdown");
  lines.push("");
  lines.push("| Dimension | Score | Max | % | Progress |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const dim of result.dimensions) {
    const bar = markdownBar(dim.percentage);
    lines.push(
      `| ${dim.name} | ${dim.score} | ${dim.maxScore} | ${dim.percentage}% | \`${bar}\` |`
    );
  }
  lines.push("");

  // Top Gaps
  const gaps = getUnaddressedQuestions(result).slice(0, 10);
  if (gaps.length > 0) {
    lines.push("## Top Gaps (Biggest Opportunities)");
    lines.push("");
    for (const gap of gaps) {
      lines.push(formatGap(gap));
    }
    lines.push("");
  }

  // Low Confidence
  const lowConf = getLowConfidenceQuestions(result, 0.5);
  if (lowConf.length > 0) {
    lines.push("## Low Confidence (Verify Manually)");
    lines.push("");
    for (const lc of lowConf) {
      lines.push(formatLowConfidence(lc));
    }
    lines.push("");
  }

  console.log(lines.join("\n"));
}
