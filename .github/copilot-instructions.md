# AI Adoption Scorecard — Copilot Instructions

This is an open-source TypeScript monorepo that generates evidence-based AI maturity
scorecards for engineering organizations. It collects real signals from GitHub, CI/CD, and
developer tooling to produce a 0–70 point score across 6 dimensions.

Full project context, architecture, conventions, and agent instructions are in
[AGENTS.md](../AGENTS.md).

## Quick Reference

| | |
|---|---|
| **Stack** | TypeScript (strict), pnpm workspaces, Turbo, Vitest, Next.js |
| **Packages** | `adapters` → `core` → `cli` / `dashboard` |
| **Test** | `pnpm typecheck && pnpm test` |
| **Build** | `pnpm build` |

## Custom Agents

This repository includes custom Copilot agents for development work:

- **`@dev-loop`** — Orchestrates the full dev workflow: explores → implements → reviews,
  up to 5 iterations until the implementation scores ≥ 8/10
- **`@explorer`** — Read-only codebase audit; maps affected files, patterns, and reuse
  candidates before any implementation starts
- **`@developer`** — Senior developer agent; implements features/fixes and validates with
  `pnpm typecheck` + `pnpm test`
- **`@reviewer`** — Outcome-focused code reviewer; scores implementation 1–10 against
  the original problem statement (not just acceptance criteria)

Assign `@dev-loop` to any issue to start an autonomous dev cycle.
