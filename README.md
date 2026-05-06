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
repeatable, data-driven answer to: _"How far along are we, really?"_

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
   Scorecard Report        ← 0–94 score, tier, dimension breakdown, top gaps
```

The tool runs entirely from the command line. Point it at a GitHub org, hand it a
read-only token, and get a structured report in seconds.

---

## The 8 Dimensions

Your score is built from **47 questions** across **8 dimensions** (max 2 points each,
94 points total). Each question is backed by evidence extracted from your repos.

| #   | Dimension                               | Questions | Max Points | What It Measures                                                                                                                |
| --- | --------------------------------------- | :-------: | :--------: | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Platform & Infrastructure**           |     6     |     12     | AI gateways, model registries, MCP servers, RAG infra, prompt management, secrets hygiene                                       |
| 2   | **Developer Tooling & Adoption**        |     7     |     14     | AI steering files, rules, modalities used, custom skills, plugin ecosystem, model selection, agent task coverage                |
| 3   | **CI/CD & Velocity**                    |     6     |     12     | Pipeline scaling for AI-driven PR volume, bottleneck measurement, AI code review catch rate, flaky test trends, PR cycle time   |
| 4   | **Governance & Security**               |     5     |     10     | AI artifact SDLC, prompt security, usage policy, AI code attribution, differentiated review process                             |
| 5   | **Observability & Cost**                |     6     |     12     | LLM tracing, dev-workflow dashboards, per-team cost attribution, RAG savings measurement, SRE metrics                           |
| 6   | **Documentation & Context Engineering** |     5     |     10     | AI-friendly docs, spec accuracy, context delivery strategy, knowledge base freshness, auto-generated docs                       |
| 7   | **Agent Maturity**                      |     6     |     12     | Agent scoping and permissions, structured outputs, composable workflows, session tracing, human-in-the-loop, instruction SDLC   |
| 8   | **Eval Quality**                        |     6     |     12     | Automated eval frameworks, CI-gated evals, versioned datasets, benchmark suites, business-outcome metrics, regression detection |

See [`SPEC.md`](SPEC.md) for the full question set, scoring rubrics, and evidence sources.

---

## How Scoring Works

The scorecard is **hybrid by design**. Some questions can be answered straight from
GitHub data (file presence, commit activity, CI configs, branch protection, etc.).
Others — like _"do you have a centralized AI gateway?"_ or _"is your usage policy
enforced?"_ — can't be settled by repo scanning alone, so the tool reads the relevant
files and asks an LLM (Anthropic Claude) to make a judgment based on what it finds.

Of the 47 questions:

- **23 are answered by deterministic GitHub data collectors** — file scans, Actions
  workflow analysis, PR/commit metadata, secret scanning settings.
- **24 are answered by AI inference** when `--ai-inference` is enabled (otherwise they
  score 0 with no evidence).

AI-inferred answers are LLM judgments and are **less certain than direct measurements
by design**. The scoring engine clamps inferred-question confidence to the **0.3–0.7
range** (see `packages/adapters/src/ai-inference/index.ts`) so they cannot drown out
high-confidence GitHub signals when computing the overall confidence score.

Every score ships with its `evidence.source` (e.g. `github:repos`, `github:actions`,
`ai-inference`). The dashboard surfaces this on each question so you can tell at a
glance whether a number came from a measurement or a model. See [`SPEC.md`](SPEC.md)
for the per-question evidence mapping.

---

## Maturity Tiers

| Tier    | Score | Label               |
| ------- | ----- | ------------------- |
| Level 1 | 0–22  | 🔴 AI-Curious       |
| Level 2 | 23–46 | 🟡 AI-Experimenting |
| Level 3 | 47–69 | 🟢 AI-Scaling       |
| Level 4 | 70–94 | 🚀 AI-Native        |

> **V1 → V1.1:** V1 measured 6 dimensions (35 questions, 70 pts). V1.1 adds two new dimensions —
> **Agent Maturity** and **Eval Quality** — that V1 missed entirely. Read the full story:
> [What V1 of the AI Adoption Scorecard Missed: Agents and Eval](https://blog.angelcantugr.dev/what-v1-missed)

---

## Quickstart

### Prerequisites

- Node.js ≥ 18
- A GitHub personal access token with **read-only** org access:
  `repo`, `read:org`, `read:user`
- _(Optional)_ For AI inference on questions the GitHub API can't measure
  directly, choose **one** of:
  - An **Anthropic API key** (cloud, default), or
  - A local **[Ollama](https://ollama.com)** server — `ollama serve` plus a
    pulled model (e.g. `ollama pull llama3.1`). No API key, no data leaves
    your machine.

### Install

> **Note:** `@ai-scorecard/cli` is not yet published to npm. Until the first release, run from source:

```bash
git clone https://github.com/AngelCantugr/ai-scorecard.git
cd ai-scorecard
pnpm install && pnpm build

# Run directly
node packages/cli/dist/index.js assess --github-org <your-org> --github-token <token>

# Or expose the `ai-scorecard` binary globally via npm link
cd packages/cli && npm link
ai-scorecard assess --github-org <your-org> --github-token <token>
```

Once published, install will be a one-liner:

```bash
# Coming after the first npm release
npx @ai-scorecard/cli assess --github-org <your-org> --github-token <token>
npm install -g @ai-scorecard/cli
```

### Run Your First Assessment

```bash
# Basic assessment — GitHub signals only
ai-scorecard assess \
  --github-org acme-corp \
  --github-token ghp_xxxxxxxxxxxx

# With AI inference (Anthropic, default) — fills gaps the GitHub API can't answer
ai-scorecard assess \
  --github-org acme-corp \
  --github-token ghp_xxxxxxxxxxxx \
  --ai-inference \
  --anthropic-key sk-ant-xxxxxxxxxxxx

# With AI inference using a LOCAL Ollama server — no API key, no data leaves
# your machine. Requires `ollama serve` running and `ollama pull llama3.1`.
ai-scorecard assess \
  --github-org acme-corp \
  --github-token ghp_xxxxxxxxxxxx \
  --ai-inference --provider ollama --model llama3.1

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
║  AI ADOPTION SCORECARD  (V1.1)                           ║
║  Organization: org:acme-corp                             ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Overall Score: 51/94 (54%)                              ║
║  Maturity Tier: 🟢 Level 3 — AI-Scaling                  ║
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
║  Agent Maturity                 ████████░░░░  7/12 (58%) ║
║  Eval Quality                   ████░░░░░░░░  6/12 (50%) ║
╠══════════════════════════════════════════════════════════╣
║  TOP GAPS (biggest opportunities)                        ║
╠══════════════════════════════════════════════════════════╣
║  ⚠ D1Q1: Centralized AI gateway with logging             ║
║  ⚠ D4Q22: Formal AI usage policy                         ║
║  ⚠ D8Q43: Evals as a required CI gate                    ║
║  ⚠ D7Q40: Human-in-the-loop approval for agent actions   ║
╚══════════════════════════════════════════════════════════╝

Completed in 8.3s
```

---

## All CLI Options

| Flag                     | Description                                        | Default                  |
| ------------------------ | -------------------------------------------------- | ------------------------ |
| `--github-org <org>`     | GitHub organization to assess                      | —                        |
| `--github-token <token>` | GitHub PAT (or `GITHUB_TOKEN` env var)             | —                        |
| `--ai-inference`         | Enable LLM analysis for unmeasurable questions     | off                      |
| `--provider <name>`      | `anthropic` (cloud) or `ollama` (local)            | `anthropic`              |
| `--anthropic-key <key>`  | Anthropic API key (or `ANTHROPIC_API_KEY` env var) | —                        |
| `--ollama-url <url>`     | Ollama base URL (or `OLLAMA_URL` env var)          | `http://localhost:11434` |
| `--model <model>`        | LLM model to use for inference                     | provider default ¹       |
| `--output <format>`      | `table` \| `json` \| `markdown`                    | `table`                  |
| `--repos <list>`         | Comma-separated repo names to scope the scan       | all repos                |
| `--max-repos <n>`        | Maximum repos to scan                              | `50`                     |
| `--dry-run`              | Print config and exit — no API calls               | off                      |

¹ Default model: `claude-sonnet-4-6` for `--provider anthropic`, `llama3.1` for
`--provider ollama`. Override with `--model <name>` for either provider.

---

## Architecture

```
packages/
├── adapters/     # Data collection — GitHub API, CI/CD signals
├── core/         # Scoring engine, 47 questions, 8 dimensions, evidence model, tiers
├── cli/          # CLI entry point and formatters (table, JSON, Markdown)
└── dashboard/    # Next.js results UI — radar chart, dimension breakdown, gap
                  # analysis, PDF export, URL-encoded shareable links
```

Data flows strictly in one direction: **adapters → core → cli/dashboard**.

The adapter layer abstracts data sources. GitHub is the V1 adapter; GitLab, Jira, and
Slack adapters are planned for V2.

The dashboard already renders interactive results from a CLI run (paste a JSON output
or open a shareable link). Live continuous monitoring with scheduled re-scans is the
remaining V2 milestone — see the roadmap.

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
- [x] Scoring engine — 47 questions, 8 dimensions, confidence levels (V1.1)
- [x] CLI — table / JSON / Markdown output, dry-run mode
- [x] Dashboard — radar chart, dimension breakdown, gap analysis, PDF export, shareable links
- [x] V1.1 — Agent Maturity (D7) and Eval Quality (D8) dimensions added
- [ ] npm release of `@ai-scorecard/cli`
- [ ] Continuous monitoring — scheduled re-scans + trend tracking (V2)
- [ ] GitLab adapter (V2)
- [ ] Anonymous org benchmarking — "how do you compare to similar-sized orgs?" (V2)
- [ ] Prior Art & Related Frameworks comparison (coming soon)

---

## Try It On Your Repo

Until the first npm release, clone and run from source:

```bash
git clone https://github.com/AngelCantugr/ai-scorecard.git
cd ai-scorecard && pnpm install && pnpm build
node packages/cli/dist/index.js assess \
  --github-org <your-org> \
  --github-token <your-token>
```

Found it useful? [Start a discussion](https://github.com/AngelCantugr/ai-scorecard/discussions),
[open an issue](https://github.com/AngelCantugr/ai-scorecard/issues), or
[contribute a PR](https://github.com/AngelCantugr/ai-scorecard/pulls).

Support the project: [GitHub Sponsors](https://github.com/sponsors/AngelCantugr)

---

_Built for engineering leaders who want evidence, not vibes._
