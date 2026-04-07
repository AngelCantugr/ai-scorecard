import type { ScorecardResult } from "@ai-scorecard/core";
import { Card } from "@/components/ui/Card";

const tierIcons: Record<number, string> = {
  1: "🔵",
  2: "🟡",
  3: "🟠",
  4: "🟢",
};

const tierTextColors: Record<number, string> = {
  1: "text-slate-400",
  2: "text-yellow-400",
  3: "text-blue-400",
  4: "text-green-400",
};

const tierBgColors: Record<number, string> = {
  1: "bg-slate-700/50",
  2: "bg-yellow-900/30 border-yellow-700/50",
  3: "bg-blue-900/30 border-blue-700/50",
  4: "bg-green-900/30 border-green-700/50",
};

interface OverallScoreProps {
  result: ScorecardResult;
}

export function OverallScore({ result }: OverallScoreProps) {
  const tierColor = tierTextColors[result.tier.level] ?? "text-white";
  const tierBg = tierBgColors[result.tier.level] ?? "bg-slate-700/50";
  const tierIcon = tierIcons[result.tier.level] ?? "⬜";
  const confidencePct = Math.round(result.overallConfidence * 100);

  return (
    <Card className={tierBg}>
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
        {/* Left: score + tier */}
        <div>
          <p className="text-sm font-medium text-slate-400">Overall Score</p>
          <p className="text-5xl font-bold text-white">
            {result.totalScore}
            <span className="text-2xl text-slate-400">/{result.maxScore}</span>
            <span className="ml-2 text-2xl text-slate-300">
              ({result.percentage}%)
            </span>
          </p>
          <p className={["mt-1 text-xl font-semibold", tierColor].join(" ")}>
            {tierIcon} Level {result.tier.level} —{" "}
            <span>{result.tier.label}</span>
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Assessment confidence:{" "}
            <span className="font-medium text-slate-200">{confidencePct}%</span>
          </p>
          <p className="text-xs text-slate-500">
            Assessed{" "}
            <time dateTime={new Date(result.assessedAt).toISOString()}>
              {new Date(result.assessedAt).toLocaleString()}
            </time>
          </p>
        </div>

        {/* Right: circular progress */}
        <div className="shrink-0">
          <svg
            viewBox="0 0 36 36"
            className="h-28 w-28"
            role="img"
            aria-label={`Overall score: ${result.percentage}%`}
          >
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="#334155"
              strokeWidth="3"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${result.percentage}, 100`}
              className={tierColor}
            />
            <text
              x="18"
              y="20.35"
              textAnchor="middle"
              className="fill-white"
              style={{ fontSize: "8px", fontWeight: "bold" }}
            >
              {result.percentage}%
            </text>
          </svg>
        </div>
      </div>
    </Card>
  );
}
