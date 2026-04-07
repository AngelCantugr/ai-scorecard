import type { ScorecardResult } from "@ai-scorecard/core";
import {
  getWeakestDimensions,
  getLowConfidenceQuestions,
} from "@ai-scorecard/core";
import { Card } from "@/components/ui/Card";

interface RecommendationsProps {
  result: ScorecardResult;
}

export function Recommendations({ result }: RecommendationsProps) {
  const sorted = getWeakestDimensions(result);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];
  const lowConfidence = getLowConfidenceQuestions(result);

  const recommendations: { icon: string; text: string }[] = [];

  if (weakest) {
    recommendations.push({
      icon: "🎯",
      text: `Your weakest dimension is **${weakest.name}** (${weakest.percentage}%). Focus here first for the highest impact on your overall maturity score.`,
    });
  }

  if (strongest && strongest.dimensionId !== weakest?.dimensionId) {
    recommendations.push({
      icon: "🚀",
      text: `Your strongest dimension is **${strongest.name}** (${strongest.percentage}%). Consider sharing these practices across teams as an internal case study.`,
    });
  }

  if (lowConfidence.length > 0) {
    recommendations.push({
      icon: "🔍",
      text: `${lowConfidence.length} question${lowConfidence.length !== 1 ? "s" : ""} could not be confidently assessed. Run with \`--ai-inference\` for deeper analysis.`,
    });
  }

  if (result.percentage < 33) {
    recommendations.push({
      icon: "📋",
      text: "Start by establishing foundational AI practices: a usage policy, secrets management, and steering files in your main repositories.",
    });
  } else if (result.percentage >= 66) {
    recommendations.push({
      icon: "🏆",
      text: "You have strong AI foundations. Focus on advanced observability, cost attribution, and moving more tasks to fully deterministic pipelines.",
    });
  }

  function renderText(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={i}
            className="rounded bg-slate-700 px-1 text-xs text-slate-200"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <Card>
      <h2
        className="mb-4 text-lg font-semibold text-white"
        aria-label="Recommendations"
      >
        <span aria-hidden="true">💡</span> Recommendations
      </h2>
      {recommendations.length === 0 ? (
        <p className="text-sm text-slate-400">No recommendations available.</p>
      ) : (
        <ul className="space-y-3" role="list" aria-label="Recommendations">
          {recommendations.map((rec, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-300">
              <span className="shrink-0" aria-hidden="true">
                {rec.icon}
              </span>
              <span>{renderText(rec.text)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
