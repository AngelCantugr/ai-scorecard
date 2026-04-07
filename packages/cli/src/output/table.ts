/**
 * Table output formatter for @ai-scorecard/cli
 * Renders a box-drawing ASCII table to stdout.
 */

import chalk from "chalk";
import type { ScorecardResult, QuestionScore } from "@ai-scorecard/core";
import { questions } from "@ai-scorecard/core";
import { getUnaddressedQuestions, getLowConfidenceQuestions } from "@ai-scorecard/core";

const BOX_WIDTH = 60;

function pad(text: string, width: number): string {
  const visible = stripAnsi(text);
  const padLen = width - visible.length;
  return text + " ".repeat(Math.max(0, padLen));
}

/** Naive ANSI escape sequence stripper for width calculations */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function row(content: string): string {
  return `║  ${pad(content, BOX_WIDTH - 4)}║`;
}

function divider(): string {
  return `╠${"═".repeat(BOX_WIDTH - 2)}╣`;
}

function top(): string {
  return `╔${"═".repeat(BOX_WIDTH - 2)}╗`;
}

function bottom(): string {
  return `╚${"═".repeat(BOX_WIDTH - 2)}╝`;
}

function sectionHeader(title: string): string {
  return row(chalk.bold(title));
}

/** Render a 12-char progress bar */
function progressBar(percentage: number, width = 12): string {
  const filled = Math.round((percentage / 100) * width);
  const bar =
    chalk.green("█".repeat(filled)) +
    chalk.gray("░".repeat(width - filled));
  return bar;
}

/** Find question text for a given questionId */
function questionText(questionId: string): string {
  return questions.find((q) => q.id === questionId)?.text ?? questionId;
}

/** Truncate a string to a given max length, adding "…" if truncated */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

function formatGapRow(qs: QuestionScore): string {
  const text = truncate(questionText(qs.questionId), BOX_WIDTH - 14);
  return `${chalk.yellow("⚠")} ${qs.questionId}: ${text}`;
}

function formatLowConfRow(qs: QuestionScore): string {
  const pct = Math.round(qs.confidence * 100);
  const text = truncate(questionText(qs.questionId), BOX_WIDTH - 22);
  return `${chalk.cyan("?")} ${qs.questionId}: ${text} (${pct}%)`;
}

/** Tier emoji */
function tierEmoji(level: number): string {
  switch (level) {
    case 1:
      return "🔵";
    case 2:
      return "🟡";
    case 3:
      return "🟠";
    case 4:
      return "🟢";
    default:
      return "⚪";
  }
}

/**
 * Render the scorecard as a box-drawing table and print to stdout.
 */
export function outputTable(result: ScorecardResult): void {
  const lines: string[] = [];

  lines.push(top());
  lines.push(row(chalk.bold.cyan("AI ADOPTION SCORECARD")));
  lines.push(row(`Organization: ${chalk.bold(result.metadata.target)}`));
  lines.push(divider());
  lines.push(row(""));

  // Overall score
  lines.push(
    row(
      `Overall Score: ${chalk.bold(`${result.totalScore}/${result.maxScore}`)} (${result.percentage}%)`,
    ),
  );
  const emoji = tierEmoji(result.tier.level);
  lines.push(
    row(
      `Maturity Tier: ${emoji} Level ${result.tier.level} — ${chalk.bold(result.tier.label)}`,
    ),
  );
  lines.push(
    row(
      `Confidence: ${Math.round(result.overallConfidence * 100)}%`,
    ),
  );
  lines.push(row(""));

  // Dimension breakdown
  lines.push(divider());
  lines.push(sectionHeader("DIMENSION BREAKDOWN"));
  lines.push(divider());

  for (const dim of result.dimensions) {
    const bar = progressBar(dim.percentage);
    const label = truncate(dim.name, 32);
    const score = `${dim.score}/${dim.maxScore} (${dim.percentage}%)`;
    // Compose the row: label + bar + score
    const content = `${pad(label, 32)}  ${bar}  ${score}`;
    lines.push(row(content));
  }

  // Top gaps
  const gaps = getUnaddressedQuestions(result).slice(0, 4);
  if (gaps.length > 0) {
    lines.push(divider());
    lines.push(sectionHeader("TOP GAPS (biggest opportunities)"));
    lines.push(divider());
    for (const gap of gaps) {
      lines.push(row(formatGapRow(gap)));
    }
  }

  // Low confidence
  const lowConf = getLowConfidenceQuestions(result, 0.5);
  if (lowConf.length > 0) {
    lines.push(divider());
    lines.push(sectionHeader("LOW CONFIDENCE (verify manually)"));
    lines.push(divider());
    for (const lc of lowConf) {
      lines.push(row(formatLowConfRow(lc)));
    }
  }

  lines.push(bottom());

  console.log(lines.join("\n"));
}
