import type { ScorecardResult, Question } from "@ai-scorecard/core";
import { DimensionCard } from "./DimensionCard";

interface DimensionGridProps {
  result: ScorecardResult;
  questions: Question[];
}

export function DimensionGrid({ result, questions }: DimensionGridProps) {
  const questionsByDimension = new Map<string, Question[]>();
  for (const q of questions) {
    const arr = questionsByDimension.get(q.dimensionId) ?? [];
    arr.push(q);
    questionsByDimension.set(q.dimensionId, arr);
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-white">Dimension Breakdown</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {result.dimensions.map((dim) => (
          <DimensionCard
            key={dim.dimensionId}
            dimension={dim}
            questions={questionsByDimension.get(dim.dimensionId) ?? []}
          />
        ))}
      </div>
    </div>
  );
}
