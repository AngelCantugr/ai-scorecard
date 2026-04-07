/**
 * JSON output formatter for @ai-scorecard/cli
 */

import type { ScorecardResult } from "@ai-scorecard/core";

/**
 * Serialize the scorecard result as indented JSON and print to stdout.
 */
export function outputJson(result: ScorecardResult): void {
  const output = JSON.stringify(result, null, 2);
  console.log(output);
}
