interface ConfidenceBadgeProps {
  confidence: number;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  if (confidence >= 0.75) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-400"
        aria-label={`High confidence: ${Math.round(confidence * 100)}%`}
      >
        ● High
      </span>
    );
  }
  if (confidence >= 0.5) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-yellow-900/40 px-2 py-0.5 text-xs font-medium text-yellow-400"
        aria-label={`Medium confidence: ${Math.round(confidence * 100)}%`}
      >
        ◐ Medium
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-400"
      aria-label={`Low confidence: ${Math.round(confidence * 100)}%`}
    >
      ○ Low
    </span>
  );
}
