import type { Evidence } from "@ai-scorecard/core";

export type DataSourceKind = "github" | "ai-inference" | "other";

/**
 * Classify an evidence source string into a coarse "where did this come from?" bucket.
 * Anything starting with `github:` is a deterministic GitHub data collector; anything
 * starting with `ai-inference` is an LLM judgment with confidence clamped to 0.3-0.7.
 */
export function classifyEvidenceSource(source: string): DataSourceKind {
  if (source.startsWith("github:")) return "github";
  if (source.startsWith("ai-inference")) return "ai-inference";
  return "other";
}

/**
 * Pick the dominant source for a question — `ai-inference` wins if any evidence is
 * AI-inferred (so users see the lower-confidence label), otherwise `github`, otherwise
 * "other". Returns null when there is no evidence at all.
 */
export function dominantSource(evidence: Evidence[]): DataSourceKind | null {
  if (evidence.length === 0) return null;
  let sawGithub = false;
  let sawOther = false;
  for (const e of evidence) {
    const kind = classifyEvidenceSource(e.source);
    if (kind === "ai-inference") return "ai-inference";
    if (kind === "github") sawGithub = true;
    else sawOther = true;
  }
  if (sawGithub) return "github";
  if (sawOther) return "other";
  return null;
}

interface DataSourceBadgeProps {
  source: DataSourceKind;
}

export function DataSourceBadge({ source }: DataSourceBadgeProps) {
  if (source === "github") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-slate-700/60 px-2 py-0.5 text-xs font-medium text-slate-200"
        title="Answered by a deterministic GitHub data collector"
        aria-label="Data source: GitHub data"
      >
        Data Source: github
      </span>
    );
  }
  if (source === "ai-inference") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-amber-500/30"
        title="Answered by an LLM reading repo contents — confidence clamped to 0.3-0.7"
        aria-label="Data source: AI inference"
      >
        Data Source: ai-inference
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-slate-800/60 px-2 py-0.5 text-xs font-medium text-slate-400"
      aria-label={`Data source: ${source}`}
    >
      Data Source: {source}
    </span>
  );
}
