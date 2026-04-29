/**
 * Typed error model for GitHub collectors.
 *
 * Each collector previously caught failures and returned `[]`, which made
 * an auth-misconfigured run indistinguishable from a clean low-score run.
 * Collectors now classify failures into one of these variants so the CLI
 * can surface them and exit non-zero on auth problems.
 */

/** Variant tag for the discriminated union. */
export type CollectorErrorKind = "auth" | "rate_limit" | "not_found" | "unexpected";

/** Common shape across all variants. */
type CollectorErrorBase<K extends CollectorErrorKind> = {
  kind: K;
  signalId: string;
  message: string;
  /** Original thrown value, kept for downstream logging/debugging. */
  cause: unknown;
};

export type CollectorAuthError = CollectorErrorBase<"auth"> & {
  /** HTTP status as returned by Octokit (typically 401 or 403). */
  status: number;
};

export type CollectorRateLimitError = CollectorErrorBase<"rate_limit"> & {
  status: number;
};

export type CollectorNotFoundError = CollectorErrorBase<"not_found"> & {
  status: 404;
};

export type CollectorUnexpectedError = CollectorErrorBase<"unexpected"> & {
  /** Status, if the cause was an HTTP error. */
  status?: number;
};

export type CollectorError =
  | CollectorAuthError
  | CollectorRateLimitError
  | CollectorNotFoundError
  | CollectorUnexpectedError;

/** Pull a numeric `status` field off any thrown value, if present. */
function readStatus(err: unknown): number | undefined {
  if (err === null || typeof err !== "object") return undefined;
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

/** Pull a string `message` off any thrown value, falling back to String(err). */
function readMessage(err: unknown): string {
  if (err !== null && typeof err === "object") {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return String(err);
}

/**
 * Detects rate-limit responses. Mirrors the logic in
 * `./index.ts#isRateLimitError` so collectors and the orchestrator agree on
 * what counts as a rate-limit. A 403 only counts as rate-limited when the
 * response carries `x-ratelimit-remaining: 0` or its message mentions a
 * rate/secondary limit; auth-failure 403s fall through to `auth`.
 */
function isRateLimit(err: unknown, status: number | undefined): boolean {
  if (status === 429) return true;
  if (status !== 403) return false;
  if (err === null || typeof err !== "object") return false;
  const e = err as {
    message?: unknown;
    response?: { headers?: Record<string, string> };
  };
  const remaining = e.response?.headers?.["x-ratelimit-remaining"];
  if (remaining === "0") return true;
  if (typeof e.message === "string" && /rate.?limit|secondary rate/i.test(e.message)) return true;
  return false;
}

/**
 * Map an unknown thrown value into a {@link CollectorError} for `signalId`.
 *
 * Classification rules:
 * - 401 → `auth`
 * - 403 (non-rate-limit) → `auth` (token lacks scope/permission)
 * - 429, or 403 with `x-ratelimit-remaining: 0` / rate-limit message → `rate_limit`
 * - 404 → `not_found`
 * - everything else → `unexpected`
 */
export function classifyError(signalId: string, err: unknown): CollectorError {
  const status = readStatus(err);
  const message = readMessage(err);

  if (isRateLimit(err, status)) {
    return {
      kind: "rate_limit",
      signalId,
      status: status ?? 429,
      message,
      cause: err,
    };
  }

  if (status === 401 || status === 403) {
    return {
      kind: "auth",
      signalId,
      status,
      message,
      cause: err,
    };
  }

  if (status === 404) {
    return {
      kind: "not_found",
      signalId,
      status: 404,
      message,
      cause: err,
    };
  }

  return {
    kind: "unexpected",
    signalId,
    ...(status !== undefined ? { status } : {}),
    message,
    cause: err,
  };
}

/**
 * Per-collector context passed to each collector. Collectors call
 * `ctx.report(err)` from within helper try/catch blocks instead of
 * swallowing the error; the resulting list is returned alongside the
 * `SignalResult` so the orchestrator can aggregate diagnostics across
 * the run.
 */
export interface CollectorContext {
  readonly signalId: string;
  /** Classify and record `err`. Returns the classified error. */
  report(err: unknown): CollectorError;
  /** Snapshot of errors recorded so far. */
  errors(): readonly CollectorError[];
}

/** Create a fresh {@link CollectorContext} bound to `signalId`. */
export function createCollectorContext(signalId: string): CollectorContext {
  const collected: CollectorError[] = [];
  return {
    signalId,
    report(err: unknown): CollectorError {
      const classified = classifyError(signalId, err);
      collected.push(classified);
      return classified;
    },
    errors(): readonly CollectorError[] {
      return collected;
    },
  };
}

/** Result envelope every collector returns. */
export interface CollectorOutcome<T> {
  result: T;
  errors: readonly CollectorError[];
}
