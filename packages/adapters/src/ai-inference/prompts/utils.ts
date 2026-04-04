/**
 * Shared utilities for AI inference prompt builders.
 */

import type { ContentBundle } from "../types.js";

/**
 * Character budget for file content in prompts.
 * Prevents exceeding model context window limits on large repos.
 */
const MAX_TOTAL_FILE_CHARS = 20_000;
const MAX_PER_FILE_CHARS = 4_000;

/**
 * Build a formatted file listing from a ContentBundle with a character budget.
 * Truncates individual files at MAX_PER_FILE_CHARS and stops adding files once
 * MAX_TOTAL_FILE_CHARS is reached, to stay within model context limits.
 */
export function buildFileList(bundle: ContentBundle): string {
  let remaining = MAX_TOTAL_FILE_CHARS;
  const parts: string[] = [];

  for (const f of bundle.files) {
    if (remaining <= 0) break;

    const header = `=== ${f.path} ===\n`;
    const budget = Math.min(remaining - header.length, MAX_PER_FILE_CHARS);
    if (budget <= 0) break;

    const isTruncated = f.content.length > budget;
    const content = isTruncated ? f.content.slice(0, budget) + "\n...[truncated]..." : f.content;
    const entry = header + content;

    parts.push(entry);
    remaining -= entry.length;
  }

  return parts.length > 0 ? parts.join("\n\n") : "(no files provided)";
}
