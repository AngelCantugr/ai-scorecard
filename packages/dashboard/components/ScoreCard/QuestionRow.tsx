import type { Question, QuestionScore } from "@ai-scorecard/core";
import { ConfidenceBadge } from "./ConfidenceBadge";

interface QuestionRowProps {
  question: Question;
  questionScore: QuestionScore;
}

const scoreLabels: Record<0 | 1 | 2, string> = {
  0: "Not adopted",
  1: "Partial",
  2: "Fully adopted",
};

const scoreBgColors: Record<0 | 1 | 2, string> = {
  0: "bg-red-900/40 text-red-400",
  1: "bg-yellow-900/40 text-yellow-400",
  2: "bg-green-900/40 text-green-400",
};

export function QuestionRow({ question, questionScore }: QuestionRowProps) {
  const scoreLevel = questionScore.score;
  const rubricText = question.rubric[scoreLevel];

  const evidenceSummaries = questionScore.evidence.filter((e) => e.summary).slice(0, 2);

  return (
    <div className="border-t border-slate-700/60 py-3">
      <div className="flex flex-wrap items-start gap-2">
        <span className="text-xs font-mono text-slate-500">{question.id}</span>
        <p className="flex-1 text-sm text-slate-200">{question.text}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className={[
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            scoreBgColors[scoreLevel],
          ].join(" ")}
          aria-label={`Score: ${scoreLevel}/2 — ${scoreLabels[scoreLevel]}`}
        >
          {scoreLevel}/2 — {scoreLabels[scoreLevel]}
        </span>
        <ConfidenceBadge confidence={questionScore.confidence} />
      </div>
      {rubricText && <p className="mt-1 text-xs text-slate-400 italic">"{rubricText}"</p>}
      {evidenceSummaries.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {evidenceSummaries.map((e, i) => (
            <li key={i} className="text-xs text-slate-500">
              📎 {e.summary}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
