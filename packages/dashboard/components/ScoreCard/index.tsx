import type { ScorecardResult } from "@ai-scorecard/core";
import { Card } from "@/components/ui/Card";

interface ScoreCardProps {
  result: ScorecardResult;
}

const tierColors: Record<number, string> = {
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

export function ScoreCard({ result }: ScoreCardProps) {
  const tierColor = tierColors[result.tier.level] ?? "text-white";
  const tierBg = tierBgColors[result.tier.level] ?? "bg-slate-700/50";

  return (
    <div className="flex flex-col gap-6">
      {/* Overall score */}
      <Card className={tierBg}>
        <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-sm font-medium text-slate-400">Overall Score</p>
            <p className="text-4xl font-bold text-white">
              {result.totalScore}
              <span className="text-xl text-slate-400">/{result.maxScore}</span>
            </p>
            <p className={["text-lg font-semibold", tierColor].join(" ")}>
              Tier {result.tier.level}: {result.tier.label}
            </p>
          </div>
          <div className="flex flex-col items-center">
            <svg
              viewBox="0 0 36 36"
              className="h-24 w-24"
              aria-label={`${result.percentage}%`}
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
                className="fill-white text-[8px] font-bold"
                style={{ fontSize: "8px" }}
              >
                {result.percentage}%
              </text>
            </svg>
          </div>
        </div>
      </Card>

      {/* Dimension breakdown */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">
          Dimension Breakdown
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {result.dimensions.map((dim) => (
            <Card key={dim.dimensionId} padding="sm">
              <p className="mb-1 text-xs font-medium text-slate-400">
                {dim.name}
              </p>
              <p className="text-xl font-bold text-white">
                {dim.score}
                <span className="text-sm text-slate-400">/{dim.maxScore}</span>
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${dim.percentage}%` }}
                  role="progressbar"
                  aria-valuenow={dim.percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <p className="mt-1 text-right text-xs text-slate-400">
                {dim.percentage}%
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* Metadata */}
      <Card padding="sm">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-400">Target</dt>
            <dd className="font-medium text-white">{result.metadata.target}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Adapter</dt>
            <dd className="font-medium text-white">
              {result.metadata.adapterName}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Assessed At</dt>
            <dd className="font-medium text-white">
              {new Date(result.assessedAt).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Confidence</dt>
            <dd className="font-medium text-white">
              {Math.round(result.overallConfidence * 100)}%
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
