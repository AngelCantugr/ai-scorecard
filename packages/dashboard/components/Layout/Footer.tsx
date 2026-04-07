export function Footer() {
  return (
    <footer className="border-t border-slate-700/80 bg-slate-900/90">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">
        <p className="text-sm text-slate-400">
          © {new Date().getFullYear()} AI Scorecard. Open source.
        </p>
        <nav aria-label="Footer navigation">
          <ul className="flex items-center gap-4 text-sm text-slate-400">
            <li>
              <a
                href="https://github.com/AngelCantugr/ai-scorecard"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-white"
              >
                GitHub
              </a>
            </li>
            <li>
              <a
                href="/assess"
                className="transition-colors hover:text-white"
              >
                Start Assessment
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
