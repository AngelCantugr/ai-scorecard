import { VERSION } from "@ai-scorecard/core";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 text-white">
      <div className="text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight">AI Scorecard</h1>
        <p className="mb-2 text-xl text-slate-300">
          Automated AI adoption scorecard for engineering teams
        </p>
        <p className="text-sm text-slate-400">v{VERSION}</p>
      </div>
    </main>
  );
}
