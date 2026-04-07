import type { ScorecardResult } from "@ai-scorecard/core";
import { questions } from "@ai-scorecard/core";
import { Card } from "@/components/ui/Card";
import { OverallScore } from "./OverallScore";
import { RadarOverview } from "./RadarOverview";
import { DimensionGrid } from "./DimensionGrid";
import { GapAnalysis } from "./GapAnalysis";
import { Recommendations } from "./Recommendations";

interface ScoreCardProps {
  result: ScorecardResult;
}

export function ScoreCard({ result }: ScoreCardProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* 1. Overall score banner */}
      <OverallScore result={result} />

      {/* 2. Radar chart overview */}
      <RadarOverview dimensions={result.dimensions} />

      {/* 3. Dimension breakdown cards */}
      <DimensionGrid result={result} questions={questions} />

      {/* 4. Gap analysis */}
      <GapAnalysis result={result} questions={questions} />

      {/* 5. Recommendations */}
      <Recommendations result={result} />

      {/* 6. Metadata footer */}
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
