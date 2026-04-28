# AI Adoption Scorecard — Agent Instructions

## Project Purpose

Open-source, automated AI adoption scorecard for engineering leaders at mid-size companies
(50–500 engineers). Unlike self-assessment surveys, this tool **extracts real data** from
repositories, CI/CD pipelines, and developer tooling to produce an evidence-based maturity
score (0–70 points across 6 dimensions).

---

## Architecture

```
packages/adapters   → Data collection (GitHub, GitLab, CI/CD integrations)
        │
        ▼
packages/core       → Scoring engine: rules + AI inference → normalized scores
        │
        ├──► packages/cli        → One-off assessments via command line
        └──► packages/dashboard  → Continuous monitoring web UI (Next.js)
```

Data always flows **adapters → core → cli/dashboard**. Never import `core` from `adapters`
or `dashboard` from `cli`.

---

## Repository Layout

```
ai-scorecard/
├── packages/
│   ├── adapters/     # GitHub adapter (primary), extensible for GitLab, CI/CD
│   ├── cli/          # CLI entry point, assessment runner
│   ├── core/         # Scoring engine, question definitions, evidence model
│   └── dashboard/    # Next.js web dashboard
├── AGENTS.md         # This file — canonical agent instructions
├── CLAUDE.md         # Symlink → AGENTS.md
├── SPEC.md           # Full product specification (scoring model, 35 questions)
├── turbo.json        # Turbo pipeline definitions
├── pnpm-workspace.yaml
└── package.json      # Root workspace
```

---

## Stack & Tooling

| Concern | Tool |
|---------|------|
| Language | TypeScript (strict mode) |
| Package manager | pnpm v10 with workspaces |
| Build orchestration | Turbo |
| Testing | Vitest |
| Linting | ESLint |
| Formatting | Prettier |
| Dashboard framework | Next.js (in `packages/dashboard`) |

---

## Key Commands

Run from the **repo root** unless filtering to a specific package:

```bash
pnpm build          # Build all packages (Turbo, respects dependency order)
pnpm test           # Run all tests (Vitest across all packages)
pnpm typecheck      # TypeScript check across all packages
pnpm lint           # ESLint across all packages
pnpm dev            # Start dashboard in dev mode
pnpm format         # Prettier format all files
```

To run in a single package:
```bash
pnpm --filter @ai-scorecard/core test
pnpm --filter @ai-scorecard/dashboard dev
```

---

## Scoring Model

- **35 questions** across **6 dimensions** (Platform, Developer Tooling, AI Governance,
  Code Quality, Security, Culture)
- **0–1–2 scale** per question; max **70 points**
- Each score requires **evidence** (data from adapters) + **confidence level**
- See `SPEC.md` for full dimension/question definitions

---

## Code Conventions

### TypeScript
- Strict mode is on — no `any`, no implicit returns, explicit return types on public APIs
- Prefer `type` over `interface` for data shapes; use `interface` only when extension is
  intended
- Use `zod` for runtime validation at system boundaries (external API responses, CLI input)

### Comments
- Only comment WHY, never WHAT — well-named identifiers explain themselves
- Always document: public API signatures, non-obvious algorithmic decisions,
  security-sensitive logic
- Never: narrate obvious flow, describe what the function name already says

### Error Handling
- Errors at system boundaries (adapters, CLI input) must be caught and returned as typed
  `Result<T, E>` or surfaced to the user with actionable messages
- Never swallow errors silently; never log raw stack traces to end users

### Security
- No hardcoded secrets or API keys — use environment variables
- Validate all external data with zod schemas before use
- GitHub tokens must be scoped to minimum required permissions

---

## Testing Strategy

- **Unit tests**: Pure logic in `core/` (scoring rules, evidence parsing)
- **Integration tests**: Adapter behavior with real/mocked GitHub API responses
- **Test files**: Co-located with source, named `*.test.ts`
- **Always run** `pnpm typecheck && pnpm test` before marking any implementation complete

---

## What NOT to Do

- Do not add features beyond what was explicitly requested
- Do not introduce new dependencies without justification
- Do not commit `.env` files or secrets
- Do not bypass TypeScript strict mode with `@ts-ignore` or `as any`
- Do not create cross-package imports that violate the adapters → core → cli/dashboard flow
