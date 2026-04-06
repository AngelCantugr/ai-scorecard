import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-700/80 bg-slate-900/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-white transition-opacity hover:opacity-80"
        >
          <span className="text-2xl" aria-hidden="true">
            🤖
          </span>
          <span className="text-lg font-semibold tracking-tight">
            AI Scorecard
          </span>
        </Link>

        <nav aria-label="Main navigation">
          <ul className="flex items-center gap-1">
            <li>
              <Link
                href="/"
                className="rounded-md px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                href="/assess"
                className="rounded-md px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                Assess
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
