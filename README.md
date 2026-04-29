# AI Adoption Scorecard

**Evidence-based AI maturity scoring for engineering orgs — automated, not survey-based.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange)](https://pnpm.io/)

---

Most AI maturity frameworks ask people to rate themselves. This one reads your repos,
CI/CD pipelines, and tooling configs and computes a score from real signals — no surveys,
no guesswork.

Built for **CTOs and engineering leaders at 50–500-engineer organizations** who want a
repeatable, data-driven answer to: *"How far along are we, really?"*

---

## How It Works

```
GitHub Repos + Actions + Settings
         │
         ▼
   GitHub Adapter          ← collects raw signals
         │
         ▼
   Scoring Engine          ← maps signals → 0/1/2 per question
         │
         ▼
   AI Inference (optional) ← LLM fills gaps that can't be measured directly
         │
         ▼
   Scorecard Report        ← 0–70 score, tier, dimension breakdown, top gaps
```

The tool runs entirely from the command line. Point it at a GitHub org, hand it a
read-only token, and get a structured report in seconds.

---

## The 6 Dimensions

Your score is built from **35 questions** across **6 dimensions** (max 2 points each,
70 points total). Each question is backed by evidence extracted from your repos.

| # | Dimension | Questions | Max Points | What It Measures |
|---|-----------|:---------:|:----------:|-----------------|
| 1 | **Platform & Infrastructure** | 6 | 12 | AI gateways, model registries, MCP servers, RAG infra, prompt management, secrets hygiene |
| 2 | **Developer Tooling & Adoption** | 7 | 14 | AI steering files, rules, modalities used, custom skills, plugin ecosystem, model selection, agent task coverage |
| 3 | **CI/CD & Velocity** | 6 | 12 | Pipeline scaling for AI-driven PR volume, bottleneck measurement, AI code review catch rate, flaky test trends, PR cycle time |
| 4 | **Governance & Security** | 5 | 10 | AI artifact SDLC, prompt security, usage policy, AI code attribution, differentiated review process |
| 5 | **Observability & Cost** | 6 | 12 | LLM tracing, dev-workflow dashboards, per-team cost attribution, RAG savings measurement, SRE metrics |
| 6 | **Documentation & Context Engineering** | 5 | 10 | AI-friendly docs, spec accuracy, context delivery strategy, knowledge base freshness, auto-generated docs |

See [`SPEC.md`](SPEC.md) for the full question set, scoring rubrics, and evidence sources.

---

## Maturity Tiers

| Tier | Score | Label |
|------|-------|-------|
| Level 1 | 0–17 | 🔵 AI-Curious |
| Level 2 | 18–35 | 🟡 AI-Experimenting |
| Level 3 | 36–52 | 🟠 AI-Scaling |
| Level 4 | 53–70 | 🟢 AI-Native |

---

## Quickstart

### Prerequisites

- Node.js ≥ 18
- A GitHub personal access token with **read-only** org access:
  `repo`, `read:org`, `read:user`
- *(Optional)* An Anthropic API key for AI inference on questions that can't be
  directly measured from repo data

### Install

```bash
# Using npx (no install required)
npx @ai-scorecard/cli assess --github-org <your-org> --github-token <token>

# Or install globally
npm install -g @ai-scorecard/cli
ai-scorecard assess --github-org <your-org> --github-token <token>
```

### Run Your First Assessment

```bash
# Basic assessment — GitHub signals only
ai-scorecard assess \
  --github-org acme-corp \
  --github-token ghp_xxxxxxxxxxxx

# With AI inference — fills gaps the GitHub API can't answer directly
ai-scorecard assess \
  --github-org acme-corp \
  --github-token ghp_xxxxxxxxxxxx \
  --ai-inference \
  --anthropic-key sk-ant-xxxxxxxxxxxx

# Scope to specific repos
ai-scorecard assess \
  --github-org acme-corp \
  --github-token ghp_xxxxxxxxxxxx \
  --repos api-service,frontend,infra

# Output as Markdown (great for saving to a file or pasting into Notion)
ai-scorecard assess \
  --github-org acme-corp \
  --github-token ghp_xxxxxxxxxxxx \
  --output markdown > scorecard.md

# Preview what would be analyzed — no API calls made
ai-scorecard assess \
  --github-org acme-corp \
  --github-token ghp_xxxxxxxxxxxx \
  --dry-run
```

### Using Environment Variables

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
export ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

ai-scorecard assess --github-org acme-corp --ai-inference
```

---

## Example Output

```
╔══════════════════════════════════════════════════════════╗
║  AI ADOPTION SCORECARD                                   ║
║  Organization: org:acme-corp                             ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Overall Score: 38/70 (54%)                              ║
║  Maturity Tier: 🟠 Level 3 — AI-Scaling                  ║
║  Confidence: 81%                                         ║
║                                                          ║
╠══════════════════════════════════════════════════════════╣
║  DIMENSION BREAKDOWN                                     ║
╠══════════════════════════════════════════════════════════╣
║  Platform & Infrastructure      ████████░░░░  7/12 (58%) ║
║  Developer Tooling & Adoption   ██████████░░  10/14 (71%)║
║  CI/CD & Velocity               ██████░░░░░░  6/12 (50%) ║
║  Governance & Security          ████░░░░░░░░  4/10 (40%) ║
║  Observability & Cost           ██████░░░░░░  6/12 (50%) ║
║  Documentation & Context Eng.   █████░░░░░░░  5/10 (50%) ║
╠══════════════════════════════════════════════════════════╣
║  TOP GAPS (biggest opportunities)                        ║
╠══════════════════════════════════════════════════════════╣
║  ⚠ D1Q1: Centralized AI gateway with logging             ║
║  ⚠ D4Q22: Formal AI usage policy                         ║
║  ⚠ D5Q27: Per-team model cost attribution                ║
║  ⚠ D3Q16: AI code review catch rate tracked              ║
╚══════════════════════════════════════════════════════════╝

Completed in 8.3s
```

---

## All CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--github-org <org>` | GitHub organization to assess | — |
| `--github-token <token>` | GitHub PAT (or `GITHUB_TOKEN` env var) | — |
| `--ai-inference` | Enable LLM analysis for unmeasurable questions | off |
| `--anthropic-key <key>` | Anthropic API key (or `ANTHROPIC_API_KEY` env var) | — |
| `--model <model>` | LLM model to use for inference | `claude-sonnet-4-6` |
| `--output <format>` | `table` \| `json` \| `markdown` | `table` |
| `--repos <list>` | Comma-separated repo names to scope the scan | all repos |
| `--max-repos <n>` | Maximum repos to scan | `50` |
| `--dry-run` | Print config and exit — no API calls | off |

---

## Architecture

```
packages/
├── adapters/     # Data collection — GitHub API, CI/CD signals
├── core/         # Scoring engine, 35 questions, evidence model, tiers
├── cli/          # CLI entry point and formatters (table, JSON, Markdown)
└── dashboard/    # Next.js continuous monitoring dashboard (coming in V2)
```

Data flows strictly in one direction: **adapters → core → cli/dashboard**.

The adapter layer abstracts data sources. GitHub is the V1 adapter; GitLab, Jira, and
Slack adapters are planned for V2.

---

## Accuracy Trade-offs

Not every question can be answered from GitHub metadata alone. The tool is transparent
about this: every score ships with a **confidence level** (0–100%) so you know which
numbers to trust and which to verify manually.

- **High-confidence signals** (≥ 80%): file presence, commit patterns, CI configs,
  PR metadata, secret scanning results
- **Medium-confidence signals** (50–79%): inferred from adjacent signals or
  AI analysis of repo content
- **Low-confidence signals** (< 50%): flagged in the report as "verify manually"

Run with `--ai-inference` to improve coverage on questions that require reading
documentation, configs, and policy files.

---

## Contributing

Contributions are welcome. The highest-leverage areas right now:

1. **New signals** in the GitHub adapter (`packages/adapters/src/`)
2. **Question refinements** — better rubrics, more precise evidence mappings
   (see [`SPEC.md`](SPEC.md))
3. **Additional adapters** — GitLab, Linear, Slack, Datadog
4. **Dashboard** — the Next.js UI in `packages/dashboard/` is scaffolded but not
   fully built out

### Development Setup

```bash
git clone https://github.com/AngelCantugr/ai-scorecard.git
cd ai-scorecard
pnpm install
pnpm build
pnpm test
```

Key commands:

```bash
pnpm typecheck   # TypeScript strict-mode check across all packages
pnpm test        # Vitest across all packages
pnpm lint        # ESLint
pnpm build       # Full build (Turbo, dependency order)
```

See [`AGENTS.md`](AGENTS.md) for architecture conventions, code style rules, and
agent instructions for AI-assisted development on this repo.

---

## Roadmap

- [x] GitHub adapter — repos, PRs, Actions, security settings
- [x] Scoring engine — 35 questions, 6 dimensions, confidence levels
- [x] CLI — table / JSON / Markdown output, dry-run mode
- [ ] Dashboard — continuous monitoring web UI (V2)
- [ ] GitLab adapter (V2)
- [ ] Anonymous org benchmarking — "how do you compare to similar-sized orgs?" (V2)
- [ ] Trend tracking — retake over time and see delta (V2)
- [ ] Prior Art & Related Frameworks comparison (coming soon)

---

## Try It On Your Repo

```bash
npx @ai-scorecard/cli assess \
  --github-org <your-org> \
  --github-token <your-token>
```

Found it useful? [Start a discussion](https://github.com/AngelCantugr/ai-scorecard/discussions),
[open an issue](https://github.com/AngelCantugr/ai-scorecard/issues), or
[contribute a PR](https://github.com/AngelCantugr/ai-scorecard/pulls).

Support the project: [GitHub Sponsors](https://github.com/sponsors/AngelCantugr)

---

*Built for engineering leaders who want evidence, not vibes.*
