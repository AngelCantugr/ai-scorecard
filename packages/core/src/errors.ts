import type { ZodError } from "zod";

/**
 * Thrown when {@link computeScorecard} receives signal results that do not
 * conform to {@link SignalResultSchema}. Carries the original Zod issues so
 * callers (CLI, dashboard, integration tests) can surface field-level
 * diagnostics without re-parsing the message.
 */
export class ScoringValidationError extends Error {
  readonly issues: ZodError["issues"];

  constructor(zodError: ZodError, prefix = "Invalid signal results") {
    const summary = zodError.issues
      .slice(0, 5)
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
        return `${path}: ${issue.message}`;
      })
      .join("; ");
    const overflow = zodError.issues.length > 5 ? ` (+${zodError.issues.length - 5} more)` : "";
    super(`${prefix}: ${summary}${overflow}`);
    this.name = "ScoringValidationError";
    this.issues = zodError.issues;
  }
}
