# Implementation Plan

## Dependency Graph

```
Phase 0: Foundation
  #3 Monorepo Setup ─────────────────────────────┐
                                                  │
Phase 1: Core (depends on #3)                    ▼
  #4 Core Types & Interfaces ──┬──► #5 Question Bank
                               │         │
Phase 2: Engine (all parallel) │         │
  ┌────────────────────────────┤         │
  ▼              ▼             ▼         │
  #6 Scoring     #7 GitHub     #8 AI    │
  Engine         Adapter       Inference │
  │              │             │         │
  └──────────────┼─────────────┘         │
                 │                       │
Phase 3: CLI     ▼                       │
  #9 CLI Runner ◄────────────────────────┘
                 │
Phase 4: Dashboard (parallel with CLI)
  #10 Dashboard Shell ──┬──► #11 Results Visualization
                        ├──► #12 PDF Export
                        └──► #13 Shareable Links
```

## Phases & Parallelism

### Phase 0 — Foundation (1 issue, sequential)

| Issue | Title | Parallel | Blocks |
|-------|-------|----------|--------|
| #3 | Monorepo Setup — Turborepo, TypeScript, ESLint, Tailwind | No | Everything |

**Must complete before any other work begins.**

### Phase 1 — Core (2 issues, parallel)

| Issue | Title | Parallel | Depends On | Blocks |
|-------|-------|----------|------------|--------|
| #4 | Core Types & Interfaces | Yes | #3 | #5, #6, #7, #8 |
| #5 | Question Bank — 35 Questions | Yes | #3, #4 | #6, #7, #8 |

Issues #4 and #5 can be worked on **in parallel** once #3 is done. However, #5 depends on the `Question` type from #4, so coordinate on the interface.

### Phase 2 — Engine (3 issues, all parallel)

| Issue | Title | Parallel | Depends On | Blocks |
|-------|-------|----------|------------|--------|
| #6 | Scoring Engine | Yes | #4, #5 | #9, #10 |
| #7 | GitHub Adapter | Yes | #4, #5 | #9 |
| #8 | AI Inference Engine | Yes | #4, #5 | #9 |

All three issues can be worked on **simultaneously** — they share the same inputs (types + questions) but have no dependencies on each other.

### Phase 3 — CLI (1 issue)

| Issue | Title | Parallel | Depends On | Blocks |
|-------|-------|----------|------------|--------|
| #9 | CLI Tool | With #10 | #6, #7, #8 | — |

Can start as soon as all three Phase 2 issues are complete. Can be built **in parallel** with the dashboard.

### Phase 4 — Dashboard (4 issues, partially parallel)

| Issue | Title | Parallel | Depends On | Blocks |
|-------|-------|----------|------------|--------|
| #10 | Dashboard Shell | With #9 | #4, #6 | #11, #12, #13 |
| #11 | Results Visualization | Yes | #10 | — |
| #12 | PDF Export | Yes | #10 | — |
| #13 | Shareable Links | Yes | #10 | — |

#10 (Dashboard Shell) can start as soon as the scoring engine (#6) is ready — it doesn't need adapters to be complete (can use mock data). Once #10 is done, issues #11, #12, and #13 can all be worked on **simultaneously**.

## Maximum Parallelism Schedule

For teams with multiple AI agents or developers working concurrently:

```
Week 1:  #3 (Monorepo Setup)
Week 2:  #4 (Types) + #5 (Questions)          ← 2 parallel
Week 3:  #6 (Scoring) + #7 (GitHub) + #8 (AI) ← 3 parallel
Week 4:  #9 (CLI) + #10 (Dashboard Shell)      ← 2 parallel
Week 5:  #11 (Viz) + #12 (PDF) + #13 (Share)   ← 3 parallel
```

Maximum concurrency: **3 agents/developers** working simultaneously.

## Labels

| Label | Color | Description |
|-------|-------|-------------|
| `phase:0-foundation` | Green | Foundation — blocks everything |
| `phase:1-core` | Blue | Core types, interfaces, question bank |
| `phase:2-engine` | Purple | Scoring engine, adapters, AI inference |
| `phase:3-cli` | Orange | CLI tool |
| `phase:4-dashboard` | Yellow | Next.js dashboard and results delivery |
| `parallel` | Light Green | Can be worked on in parallel with other same-phase issues |
| `blocking` | Red | Blocks other issues from starting |
