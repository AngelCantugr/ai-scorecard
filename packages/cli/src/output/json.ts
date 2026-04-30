/**
 * JSON output formatter for @ai-scorecard/cli
 */

import type { ScorecardResult } from "@ai-scorecard/core";
import type { CollectorError } from "@ai-scorecard/adapters";

/**
 * Serialize the scorecard result as indented JSON and print to stdout.
 *
 * Adapter diagnostics (auth/rate-limit/not-found/unexpected) are included
 * verbatim under `errors` — minus the raw `cause` field, which can carry
 * non-serializable Octokit response objects.
 */
export function outputJson(result: ScorecardResult, errors: readonly CollectorError[] = []): void {
  const errorsForOutput = errors.map(({ cause: _cause, ...rest }) => rest);
  const output = JSON.stringify({ ...result, errors: errorsForOutput }, null, 2);
  console.log(output);
}
