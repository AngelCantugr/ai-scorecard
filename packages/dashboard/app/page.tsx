import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const DIMENSIONS = [
  {
    id: "D1",
    name: "Platform & Infrastructure",
    icon: "🏗️",
    description:
      "AI gateways, secret management, and prompt version control.",
  },
  {
    id: "D2",
    name: "Developer Tooling & Adoption",
    icon: "🛠️",
    description:
      "Steering files, AI rules, and measurable agent task adoption.",
  },
  {
    id: "D3",
    name: "CI/CD & Velocity",
    icon: "⚡",
    description:
      "Pipeline scaling, AI-assisted code review, and PR cycle time.",
  },
  {
    id: "D4",
    name: "Governance & Security",
    icon: "🔒",
    description:
      "AI artifact lifecycle, prompt security, and attribution standards.",
  },
  {
    id: "D5",
    name: "Observability & Cost",
    icon: "📊",
    description:
      "LLM tracing, token cost tracking, and quality feedback loops.",
  },
  {
    id: "D6",
    name: "Documentation & Context Engineering",
    icon: "📚",
    description:
      "AI-friendly docs, OpenAPI specs, and context-aware onboarding.",
  },
];

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
            Benchmark your organisation&apos;s AI maturity across 6 dimensions
            in minutes — straight from your GitHub data, with no manual
            questionnaires.
          </p>
          <Link href="/assess">
            <Button size="lg" className="shadow-lg shadow-indigo-900/40">
              Start Assessment →
            </Button>
          </Link>
        </div>
      </section>

      {/* 6 Dimensions */}
      <section className="bg-slate-900 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-white">
              6 Dimensions of AI Maturity
            </h2>
            <p className="mt-3 text-slate-400">
              Each dimension is scored 0–14 pts, giving a total of 70 points
              across four tiers.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {DIMENSIONS.map((dim) => (
              <Card key={dim.id}>
                <div className="flex items-start gap-4">
                  <span className="text-3xl" aria-hidden="true">
                    {dim.icon}
                  </span>
                  <div>
                    <h3 className="mb-1 font-semibold text-white">
                      {dim.name}
                    </h3>
                    <p className="text-sm text-slate-400">{dim.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo-900/30 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-2xl font-bold text-white">
            Ready to see where you stand?
          </h2>
          <p className="mb-8 text-slate-300">
            Connect your GitHub organisation and get a full AI maturity report
            in under 5 minutes.
          </p>
          <Link href="/assess">
            <Button size="lg">Start Assessment →</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
