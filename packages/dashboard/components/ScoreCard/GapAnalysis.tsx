import type { ScorecardResult, Question } from "@ai-scorecard/core";
import {
  getUnaddressedQuestions,
  getLowConfidenceQuestions,
} from "@ai-scorecard/core";
import { Card } from "@/components/ui/Card";

interface GapAnalysisProps {
  result: ScorecardResult;
  questions: Question[];
}

export function GapAnalysis({ result, questions }: GapAnalysisProps) {
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  const dimensionNameMap = new Map(
    result.dimensions.map((d) => [d.dimensionId, d.name]),
  );

  const unaddressed = getUnaddressedQuestions(result);
  const lowConfidence = getLowConfidenceQuestions(result);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Gaps */}
      <Card>
        <h2
          className="mb-1 text-lg font-semibold text-white"
          aria-label="Top Gaps — Biggest Opportunities"
        >
          <span aria-hidden="true">⚠</span> Top Gaps — Biggest Opportunities
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          Questions scored 0 (not adopted). These represent the highest-impact
          areas for improvement.
        </p>
        {unaddressed.length === 0 ? (
          <p className="text-sm text-green-400">
            🎉 No completely unaddressed questions found!
          </p>
        ) : (
          <ul className="space-y-4" role="list" aria-label="Top gaps">
            {unaddressed.map((qs) => {
              const question = questionMap.get(qs.questionId);
              if (!question) return null;
              const dimName = dimensionNameMap.get(question.dimensionId) ?? question.dimensionId;
              return (
                <li
                  key={qs.questionId}
                  className="border-t border-slate-700/60 pt-3"
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <span className="text-xs font-mono text-slate-500">
                      {question.id}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-400">
                      {dimName}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-200">{question.text}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    <span className="font-medium text-green-400">Goal: </span>
                    {question.rubric[2]}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Low Confidence */}
      <Card>
        <h2
          className="mb-1 text-lg font-semibold text-white"
          aria-label="Low Confidence Areas — Verify Manually"
        >
          <span aria-hidden="true">?</span> Low Confidence Areas — Verify Manually
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          These areas were assessed with low confidence. Consider verifying
          manually or running with{" "}
          <code className="rounded bg-slate-700 px-1 text-xs text-slate-200">
            --ai-inference
          </code>{" "}
          for deeper analysis.
        </p>
        {lowConfidence.length === 0 ? (
          <p className="text-sm text-green-400">
            ✓ All questions were assessed with sufficient confidence.
          </p>
        ) : (
          <ul className="space-y-4" role="list" aria-label="Low confidence areas">
            {lowConfidence.map((qs) => {
              const question = questionMap.get(qs.questionId);
              if (!question) return null;
              const evidenceSummary = qs.evidence.find((e) => e.summary);
              return (
                <li
                  key={qs.questionId}
                  className="border-t border-slate-700/60 pt-3"
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <span className="text-xs font-mono text-slate-500">
                      {question.id}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-yellow-900/40 px-2 py-0.5 text-xs font-medium text-yellow-400">
                      {Math.round(qs.confidence * 100)}% confidence
                    </span>
                    <span className="inline-flex items-center rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-400">
                      Score: {qs.score}/2
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-200">{question.text}</p>
                  {evidenceSummary && (
                    <p className="mt-1 text-xs text-slate-500">
                      📎 {evidenceSummary.summary}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
