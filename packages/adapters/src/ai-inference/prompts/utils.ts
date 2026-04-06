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
 * Patterns for files that must never be sent to an external LLM regardless of
 * domain filter. Matches .env files, private keys, credential files, and similar
 * secrets that could exfiltrate sensitive data to a third-party API.
 */
const SENSITIVE_PATH_PATTERNS = [
  /\.env(\.|$)/i,
  /\.(pem|key|p12|pfx|crt|cer|der)$/i,
  /(secret|credential|password|passwd|token|private)[^/]*$/i,
  /\.aws\//i,
  /\.ssh\//i,
  /(\.npmrc|\.pypirc|\.netrc)$/i,
];

/** Returns true if a file path matches any sensitive deny-list pattern. */
export function isSensitivePath(path: string): boolean {
  return SENSITIVE_PATH_PATTERNS.some((re) => re.test(path));
}

/**
 * Build a formatted file listing from a ContentBundle with a character budget.
 *
 * Sensitive files (secrets, credentials, private keys) are always excluded
 * before the optional domain `pathFilter` is applied.
 *
 * When `pathFilter` is provided, only files whose paths match are included.
 * This keeps each analysis batch focused on relevant files and avoids wasting
 * token budget on unrelated content (e.g., source files in a policy analysis).
 *
 * Truncates individual files at MAX_PER_FILE_CHARS and stops adding files once
 * MAX_TOTAL_FILE_CHARS is reached, to stay within model context limits.
 */
export function buildFileList(
  bundle: ContentBundle,
  pathFilter?: (path: string) => boolean
): string {
  const safeFiles = bundle.files.filter((f) => !isSensitivePath(f.path));
  const files = pathFilter ? safeFiles.filter((f) => pathFilter(f.path)) : safeFiles;

  let remaining = MAX_TOTAL_FILE_CHARS;
  const parts: string[] = [];

  for (const f of files) {
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
