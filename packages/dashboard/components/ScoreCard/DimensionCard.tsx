"use client";

import { useState } from "react";
import type { DimensionScore, Question } from "@ai-scorecard/core";
import { Card } from "@/components/ui/Card";
import { QuestionRow } from "./QuestionRow";

interface DimensionCardProps {
  dimension: DimensionScore;
  questions: Question[];
}

function getProgressColor(percentage: number): string {
  if (percentage >= 67) return "bg-green-500";
  if (percentage >= 33) return "bg-yellow-500";
  return "bg-red-500";
}

export function DimensionCard({ dimension, questions }: DimensionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const progressColor = getProgressColor(dimension.percentage);

  const questionMap = new Map(questions.map((q) => [q.id, q]));

  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{dimension.name}</p>
          <p className="mt-0.5 text-2xl font-bold text-white">
            {dimension.score}
            <span className="text-sm font-normal text-slate-400">
              /{dimension.maxScore}
            </span>
          </p>
        </div>
        <span className="text-lg font-semibold text-slate-300">
          {dimension.percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-700"
        role="progressbar"
        aria-valuenow={dimension.percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${dimension.name}: ${dimension.percentage}%`}
      >
        <div
          className={["h-full rounded-full transition-all", progressColor].join(
            " ",
          )}
          style={{ width: `${dimension.percentage}%` }}
        />
      </div>

      {/* Expand / collapse questions */}
      <button
        className="mt-3 flex w-full items-center justify-between text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={`questions-${dimension.dimensionId}`}
      >
        <span>
          {dimension.questionScores.length} question
          {dimension.questionScores.length !== 1 ? "s" : ""}
        </span>
        <span aria-hidden="true">{expanded ? "▲ Hide" : "▼ Show details"}</span>
      </button>

      {/* Question details */}
      {expanded && (
        <div id={`questions-${dimension.dimensionId}`}>
          {dimension.questionScores.map((qs) => {
            const question = questionMap.get(qs.questionId);
            if (!question) return null;
            return (
              <QuestionRow
                key={qs.questionId}
                question={question}
                questionScore={qs}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}
