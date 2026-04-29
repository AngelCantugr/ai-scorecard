import Link from "next/link";
import { dimensions, type DimensionId } from "@ai-scorecard/core";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const DIMENSION_PRESENTATION: Record<DimensionId, { icon: string; description: string }> = {
  "platform-infrastructure": {
    icon: "🏗️",
    description: "AI gateways, secret management, and prompt version control.",
  },
  "developer-tooling": {
    icon: "🛠️",
    description: "Steering files, AI rules, and measurable agent task adoption.",
  },
  "cicd-velocity": {
    icon: "⚡",
    description: "Pipeline scaling, AI-assisted code review, and PR cycle time.",
  },
  "governance-security": {
    icon: "🔒",
    description: "AI artifact lifecycle, prompt security, and attribution standards.",
  },
  "observability-cost": {
    icon: "📊",
    description: "LLM tracing, token cost tracking, and quality feedback loops.",
  },
  "documentation-context": {
    icon: "📚",
    description: "AI-friendly docs, OpenAPI specs, and context-aware onboarding.",
  },
  "agent-maturity": {
    icon: "🤖",
    description: "Agent scoping, structured outputs, oversight, and versioned instructions.",
  },
  "eval-quality": {
    icon: "🧪",
    description: "Automated eval frameworks, CI gates, datasets, and regression detection.",
  },
};

const TOTAL_POINTS = dimensions.reduce((sum, d) => sum + d.maxScore, 0);
const DIMENSION_COUNT = dimensions.length;
const MIN_DIM_SCORE = Math.min(...dimensions.map((d) => d.maxScore));
const MAX_DIM_SCORE = Math.max(...dimensions.map((d) => d.maxScore));

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <span className="mb-4 inline-block rounded-full bg-indigo-500/20 px-4 py-1.5 text-sm font-medium text-indigo-300 ring-1 ring-indigo-500/30">
            Free &amp; Open Source
          </span>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Automated AI Adoption Scorecard
            <br />
            <span className="text-indigo-400">for Engineering Leaders</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-300">
            Benchmark your organisation&apos;s AI maturity across {DIMENSION_COUNT} dimensions in
            minutes — straight from your GitHub data, with no manual questionnaires.
          </p>
          <Link href="/assess">
            <Button size="lg" className="shadow-lg shadow-indigo-900/40">
              Start Assessment →
            </Button>
          </Link>
        </div>
      </section>

      {/* Dimensions */}
      <section className="bg-slate-900 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-white">
              {DIMENSION_COUNT} Dimensions of AI Maturity
            </h2>
            <p className="mt-3 text-slate-400">
              Each dimension is scored {MIN_DIM_SCORE}–{MAX_DIM_SCORE} pts, totaling {TOTAL_POINTS}{" "}
              points across four tiers.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {dimensions.map((dim) => {
              const presentation = DIMENSION_PRESENTATION[dim.id];
              return (
                <Card key={dim.id}>
                  <div className="flex items-start gap-4">
                    <span className="text-3xl" aria-hidden="true">
                      {presentation.icon}
                    </span>
                    <div>
                      <h3 className="mb-1 font-semibold text-white">{dim.name}</h3>
                      <p className="text-sm text-slate-400">{presentation.description}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo-900/30 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-2xl font-bold text-white">Ready to see where you stand?</h2>
          <p className="mb-8 text-slate-300">
            Connect your GitHub organisation and get a full AI maturity report in under 5 minutes.
          </p>
          <Link href="/assess">
            <Button size="lg">Start Assessment →</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
