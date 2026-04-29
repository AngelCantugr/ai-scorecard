# AI Adoption Scorecard — V1.1 Spec

## Overview

An open-source, automated AI adoption scorecard for CTOs and engineering leaders at mid-size companies (50–500 engineers). Unlike self-assessment surveys, this tool **extracts real data** from repositories, CI/CD pipelines, and developer tooling to produce an evidence-based maturity score.

## Architecture

```
┌─────────────────────────┐
│   Adapters / Plugins     │
│                          │
│  GitHub  ─┐              │
│  GitLab  ─┤              │
│  CI/CD   ─┤  ──► Scoring Engine ──► Dashboard
│  Custom  ─┘     (rules + AI        (what the CTO sees)
│                  inference)
└─────────────────────────┘
```

- **CLI + Server**: CLI for one-off assessments, optional server mode for continuous monitoring.
- **GitHub as first adapter**: Richest signal source — repos, PRs, Actions, Copilot usage, security settings.
- **AI inference for hard-to-automate questions**: LLM analyzes repo contents, docs, and configs to infer answers where direct measurement isn't possible.

## Scoring Model

- **47 questions** across **8 dimensions**
- **0–1–2 scale** per question (0 = not adopted, 1 = partial, 2 = fully adopted)
- **94 maximum points**
- Each score is backed by **evidence** (data from adapters) and a **confidence level** (how reliable the signal is)

## Maturity Tiers

| Tier    | Score Range | Label               |
| ------- | ----------- | ------------------- |
| Level 1 | 0–22        | 🔴 AI-Curious       |
| Level 2 | 23–46       | 🟡 AI-Experimenting |
| Level 3 | 47–69       | 🟢 AI-Scaling       |
| Level 4 | 70–94       | 🚀 AI-Native        |

## Dimensions & Questions

### D1: Platform & Infrastructure (6 questions, max 12 points)

Evaluates the foundational AI platform capabilities that enable safe, scalable AI adoption across the engineering organization.

| #   | Question                                                                           | Scoring Rubric                                                                                                                                                                                   | Measurable Via                                                                |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1   | Is there a centralized AI gateway/proxy with logging and rate limiting?            | **0**: Teams call model APIs directly. **1**: Shared wrapper but no centralized routing. **2**: Centralized gateway with logging, rate limiting, and model abstraction.                          | Repo scan for gateway configs, infrastructure-as-code definitions             |
| 2   | Is there a model registry with versioning and access controls?                     | **0**: No registry. **1**: Informal list or wiki of models. **2**: Versioned registry with access controls and deprecation policies.                                                             | Scan for model registry configs, catalog files                                |
| 3   | Are MCP servers deployed and managed centrally? How many, how often called?        | **0**: No MCP servers. **1**: Ad-hoc MCP servers in individual repos. **2**: Centrally managed MCP servers with usage tracking.                                                                  | Scan repos for MCP configs (`mcp.json`, `.mcp/`), server definitions          |
| 4   | Is there a context engine (RAG infrastructure, knowledge bases, context assembly)? | **0**: No context engine. **1**: Basic RAG or retrieval setup in one project. **2**: Org-wide context engine with maintained knowledge bases and delivery strategy.                              | Scan for vector DB configs, embedding pipelines, RAG infrastructure           |
| 5   | Is there a prompt/template management system with version control?                 | **0**: Prompts are inline strings in code. **1**: Prompts in separate files but not versioned or reviewed. **2**: Prompt management system with versioning, review process, and testing.         | Git history on prompt files, scan for prompt template directories             |
| 6   | Are AI credentials and API keys managed through a secrets manager (not hardcoded)? | **0**: Keys hardcoded or in `.env` files committed to repos. **1**: Environment variables but no centralized secrets manager. **2**: Centralized secrets manager with rotation and audit trails. | Scan repos for hardcoded keys, `.env` in git history, secrets manager configs |

### D2: Developer Tooling & Adoption (7 questions, max 14 points)

Measures how effectively developers are using AI-powered tools and whether the organization is optimizing tool selection and usage patterns.

| #   | Question                                                                                         | Scoring Rubric                                                                                                                                                                   | Measurable Via                                                                              |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 7   | Are repos configured with AI steering files (Claude.md, agents.md, copilot-instructions)?        | **0**: No AI steering files. **1**: Some repos have basic config files. **2**: Standardized, well-maintained steering files across repos with team-specific instructions.        | GitHub adapter — scan repos for `CLAUDE.md`, `agents.md`, `.github/copilot-instructions.md` |
| 8   | Are devs using rules to guide AI in linting, testing, writing code, and debugging?               | **0**: No AI rules defined. **1**: Basic rules in some repos. **2**: Comprehensive, task-specific rules (linting, testing, debugging) actively maintained and shared.            | Scan for `.cursorrules`, rule definitions in `CLAUDE.md`, custom instructions               |
| 9   | What modalities are devs using — chat, copilot, agents, dev workflows? Is there variety?         | **0**: Single modality (e.g., only chat). **1**: Two modalities in use. **2**: Developers use the right modality for the task — chat, inline completion, agents, and workflows.  | IDE telemetry, agent session logs, LLM inference on workflow patterns                       |
| 10  | What skills are used most frequently? Are devs creating custom skills?                           | **0**: No skills usage. **1**: Using built-in skills only. **2**: Active creation and sharing of custom skills with usage tracking.                                              | Skill execution logs, scan repos for custom skill definitions                               |
| 11  | What plugins/integrations are installed and actively used?                                       | **0**: No AI plugins beyond basic autocomplete. **1**: Some plugins installed but low usage. **2**: Curated plugin ecosystem with tracked installation and execution metrics.    | Plugin configs in repos, usage telemetry                                                    |
| 12  | Are developers selecting appropriate models for task complexity (not always the most expensive)? | **0**: Always using the most expensive model. **1**: Some model selection awareness but no guidelines. **2**: Clear model selection guidelines with cost tracking per task type. | LLM usage logs — model selection patterns vs task complexity                                |
| 13  | What percentage of development tasks are being handled or assisted by AI agents?                 | **0**: < 5% of tasks involve AI. **1**: 5–30% of tasks have AI assistance. **2**: > 30% of tasks involve AI agents with tracked task types and outcomes.                         | Agent session logs, PR metadata, commit attribution                                         |

### D3: CI/CD & Velocity (6 questions, max 12 points)

Assesses whether the development pipeline can handle the increased velocity from AI-assisted development and whether bottlenecks are being identified and addressed.

| #   | Question                                                                                              | Scoring Rubric                                                                                                                                                                                       | Measurable Via                                                         |
| --- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 14  | Is the CI/CD pipeline scaled to handle increased PR volume from AI-assisted development?              | **0**: Pipeline is a bottleneck (long queues, frequent timeouts). **1**: Pipeline handles current load but no scaling plan. **2**: Auto-scaling CI with monitored queue times and capacity planning. | GitHub Actions — queue times, failure rates, pipeline duration trends  |
| 15  | Where are the current SDLC bottlenecks? Has faster coding shifted the bottleneck to review/CI/deploy? | **0**: No bottleneck analysis. **1**: Aware of bottlenecks but no measurement. **2**: Measured bottleneck analysis with data-driven improvements (e.g., reduced review wait times).                  | PR review time, CI wait time, deploy frequency (DORA-adjacent metrics) |
| 16  | How many bugs are caught by AI-powered code reviews or bug bash agents?                               | **0**: No AI-assisted code review. **1**: AI review tools in place but not tracked. **2**: Tracked AI review findings with measured catch rate and severity breakdown.                               | PR review comments from bots, automated issue creation patterns        |
| 17  | Are AI-written tests effective or noisy? What's the flaky test rate trend?                            | **0**: No tracking of AI-written test quality. **1**: Some awareness of test noise but no metrics. **2**: Tracked test effectiveness — flaky rate, coverage delta, and test-to-code quality ratios.  | Test suite metrics, flaky test dashboards, coverage trends             |
| 18  | What's the PR cycle time (open → merge) and how has it trended since AI adoption?                     | **0**: Not measured. **1**: Measured but no correlation with AI adoption. **2**: Tracked with clear before/after AI adoption comparison and ongoing trend analysis.                                  | GitHub PR data — timestamps, merge times, review durations             |
| 19  | What percentage of tasks have moved from deterministic → probabilistic → back to deterministic?       | **0**: No tracking of this pattern. **1**: Anecdotal awareness. **2**: Tracked pipeline maturity — LLM calls that have been replaced by deterministic code after validation.                         | Architectural analysis, LLM call patterns over time                    |

### D4: Governance & Security (5 questions, max 10 points)

Evaluates whether AI adoption is happening safely with proper controls, policies, and lifecycle management for AI artifacts.

| #   | Question                                                                                                         | Scoring Rubric                                                                                                                                                                           | Measurable Via                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 20  | Are AI artifacts (prompts, configs, agent definitions) governed with proper SDLC — versioned, reviewed, tested?  | **0**: AI artifacts are unmanaged. **1**: Versioned but not reviewed or tested. **2**: Full SDLC — versioned, peer-reviewed, tested, with rollback capabilities.                         | Git history on AI config files — commit frequency, PR review patterns           |
| 21  | Are prompts secured against exposure and tampering (no hardcoded prompts in client code, injection protections)? | **0**: Prompts exposed in client-side code. **1**: Server-side prompts but no injection protection. **2**: Secured prompts with injection detection, access controls, and audit logging. | Repo scan for prompts in frontend code, security config analysis                |
| 22  | Is there a formal AI usage policy that developers know and follow?                                               | **0**: No policy. **1**: Policy exists but not enforced or widely known. **2**: Living policy document, referenced in onboarding, with compliance tracking.                              | LLM inference — scan for policy docs, onboarding references, compliance configs |
| 23  | Are AI-generated code contributions tracked and attributable in the git history?                                 | **0**: No attribution. **1**: Informal conventions (e.g., commit message tags). **2**: Systematic attribution — AI-generated code is tagged, measurable, and reportable.                 | Git commit metadata, Co-authored-by tags, bot commit patterns                   |
| 24  | Is there a review process specifically for AI-generated code (beyond standard code review)?                      | **0**: No differentiated review. **1**: Informal extra scrutiny for AI code. **2**: Defined review checklist or process for AI-generated code with tracked outcomes.                     | PR labels, review checklists, workflow configs                                  |

### D5: Observability & Cost (6 questions, max 12 points)

Measures whether the organization has visibility into AI usage, costs, and operational health — both for AI-assisted development and AI-powered products.

| #   | Question                                                                                        | Scoring Rubric                                                                                                                                                                          | Measurable Via                                                           |
| --- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 25  | For AI-powered products, is tracing implemented (OpenTelemetry, Langfuse, etc.)?                | **0**: No tracing. **1**: Basic logging but no structured tracing. **2**: Full distributed tracing with correlation IDs, latency tracking, and trace visualization.                     | Scan for OpenTelemetry, Langfuse, Langsmith, or similar configs in repos |
| 26  | Is there observability into AI development workflows (agent sessions, tool usage, error rates)? | **0**: No visibility into AI dev workflows. **1**: Some logging but no dashboards. **2**: Dashboards tracking agent sessions, tool calls, success/error rates, and trends.              | Agent telemetry configs, dashboard definitions                           |
| 27  | Are model costs tracked per team/project/use-case?                                              | **0**: No cost tracking. **1**: Aggregate cost known but not broken down. **2**: Per-team/project cost attribution with budgets and alerts.                                             | Cost management configs, billing API integrations                        |
| 28  | What are the measured dollar savings from RAG and optimized prompting vs naive approaches?      | **0**: No measurement. **1**: Anecdotal savings estimates. **2**: A/B tested cost comparisons with documented savings from RAG, caching, and prompt optimization.                       | Cost analysis reports, A/B test configs                                  |
| 29  | Are there dashboards showing AI SRE metrics (latency, error rates, token usage, cost)?          | **0**: No AI-specific SRE dashboards. **1**: Basic metrics collected but not visualized. **2**: Real-time dashboards with alerting on latency, errors, token usage, and cost anomalies. | Dashboard configs (Grafana, Datadog), alert definitions                  |
| 30  | What productivity metrics are being tracked (cycle time, throughput, developer satisfaction)?   | **0**: No productivity metrics. **1**: Some metrics but not correlated with AI adoption. **2**: Comprehensive metrics suite with before/after AI baselines and ongoing tracking.        | DORA metrics, survey configs, analytics dashboards                       |

### D6: Documentation & Context Engineering (5 questions, max 10 points)

Evaluates the organization's strategy for making knowledge accessible to both humans and AI agents, and the maturity of context delivery to AI systems.

| #   | Question                                                                                              | Scoring Rubric                                                                                                                                                                                                                         | Measurable Via                                                                 |
| --- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 31  | Is documentation AI-friendly (structured, machine-readable, not just prose for humans)?               | **0**: Documentation is unstructured prose only. **1**: Mix of prose and some structured formats. **2**: Documentation strategy that includes machine-readable formats (OpenAPI, structured markdown, typed schemas).                  | Scan for OpenAPI specs, JSDoc, TypeScript declarations, structured doc formats |
| 32  | Are API schemas, type definitions, and specs kept accurate and up-to-date as the source of truth?     | **0**: Specs are outdated or missing. **1**: Specs exist but drift from implementation. **2**: Specs are the source of truth — auto-generated or CI-validated against implementation.                                                  | Compare spec files vs implementation, check for spec validation in CI          |
| 33  | Is there a context delivery strategy — how is relevant context assembled and delivered to agents?     | **0**: No context strategy — agents get whatever is in the prompt. **1**: Some context curation (e.g., selected files). **2**: Engineered context delivery — dynamic context assembly, relevance ranking, and token budget management. | Scan for context configs, RAG pipelines, agent instruction files               |
| 34  | Are knowledge bases and RAG sources maintained with the same rigor as production code?                | **0**: Knowledge bases are stale or unmaintained. **1**: Periodically updated but no formal process. **2**: Knowledge bases have CI/CD — automated ingestion, freshness checks, and quality validation.                                | RAG pipeline configs, ingestion schedules, freshness monitoring                |
| 35  | Is there a strategy to reduce dependency on human-written docs by using verified, structured sources? | **0**: Fully dependent on human-written prose. **1**: Some auto-generated docs (e.g., from code). **2**: Strategy to derive documentation from code, tests, and types — with accuracy guarantees.                                      | Auto-doc tooling configs (TypeDoc, Swagger), doc generation in CI              |

### D7: Agent Maturity (6 questions, max 12 points)

Assesses how mature the organization's AI agent development, deployment, and oversight practices are — from scoping and structured outputs to human oversight and lifecycle management.

| #   | Question                                                                                   | Scoring Rubric                                                                                                                                                                                                                                                           | Measurable Via                                                                        |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 36  | Are AI agents deployed with clearly defined scopes, permissions, and execution boundaries? | **0**: No formal scoping — agents run with broad or undefined permissions. **1**: Some scope definitions exist but are not enforced or reviewed. **2**: All agents have formally defined scopes, least-privilege permissions, and documented boundaries.                 | Scan agent configs for permission scopes, RBAC definitions, sandbox configs           |
| 37  | Do agents produce structured outputs with validation schemas rather than free-form text?   | **0**: Agents return free-form text with no output validation. **1**: Some structured outputs but validation is inconsistent. **2**: All agent outputs have formal schemas with runtime validation and error handling.                                                   | Scan for output schema definitions, Zod/JSON Schema validators in agent code          |
| 38  | Is there a composable framework for building multi-step agent workflows?                   | **0**: Agents are one-off scripts with no reuse. **1**: Some ad-hoc composition but no formal framework. **2**: Shared framework for composing multi-step workflows with standardized interfaces and error recovery.                                                     | Scan for workflow orchestration configs, shared agent libraries, workflow definitions |
| 39  | Are agent sessions logged with reproducible traces for debugging and auditing?             | **0**: No agent logging beyond basic stdout. **1**: Logs exist but are not structured or queryable. **2**: Structured session traces with correlation IDs, step-by-step logs, and replay capability.                                                                     | Scan for trace configs, structured logging patterns, observability integrations       |
| 40  | Is there a human-in-the-loop approval step for high-risk agent actions?                    | **0**: No human oversight — agents act autonomously on all tasks. **1**: Informal reviews for some high-risk tasks. **2**: Formal approval workflows for high-risk actions with clear escalation paths and audit trails.                                                 | Scan for approval workflow configs, review gates in agent pipelines                   |
| 41  | Are agent system prompts and instructions versioned and reviewed like production code?     | **0**: Agent instructions are informal or embedded in code without version control. **1**: Instructions are tracked in version control but without a review process. **2**: Agent instructions follow full SDLC — versioned, peer-reviewed, tested, with change history. | Git history on agent instruction files, PR review patterns for prompt changes         |

### D8: Eval Quality (6 questions, max 12 points)

Measures the maturity of the organization's AI evaluation practices — from automated frameworks and CI integration to dataset governance, regression detection, and business-outcome alignment.

| #   | Question                                                                                      | Scoring Rubric                                                                                                                                                                                                                                                        | Measurable Via                                                                        |
| --- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 42  | Is there an automated evaluation framework to measure AI output quality?                      | **0**: No structured evaluation — quality is assessed informally. **1**: Manual spot-checks or basic automated tests exist. **2**: Automated eval framework with quantitative metrics covering accuracy, relevance, and safety.                                       | Scan for eval framework configs (Promptfoo, RAGAS, custom harnesses), test datasets   |
| 43  | Are evals executed in CI on every change to prompts, models, or agent definitions?            | **0**: Evals are not tied to the development lifecycle. **1**: Evals are run manually or on a schedule. **2**: Evals are a required CI gate — any change to AI components triggers the eval suite automatically.                                                      | CI/CD configs for eval runs, GitHub Actions eval workflows                            |
| 44  | Are evaluation datasets maintained in version control with clear ownership?                   | **0**: No dedicated eval datasets — testing uses ad-hoc examples. **1**: Datasets exist but are not versioned or regularly updated. **2**: Curated, versioned eval datasets with ownership, refresh schedules, and bias review.                                       | Scan repos for dataset files, versioning history, ownership metadata                  |
| 45  | Is there a benchmark suite used to compare model versions before promotion?                   | **0**: No benchmarking — models are promoted without comparison. **1**: Ad-hoc comparisons made informally. **2**: Formal benchmark suite with pass/fail criteria and automated comparison on model updates.                                                          | Benchmark config files, model comparison scripts, promotion gate definitions          |
| 46  | Do evals measure business-relevant outcomes alongside technical metrics?                      | **0**: Evals only measure technical metrics (e.g., BLEU, perplexity). **1**: Some business-relevant metrics tracked but not standardized. **2**: Evals include business KPIs (task completion rate, user satisfaction, cost per outcome) alongside technical metrics. | Eval metric definitions, dashboards with business KPIs, outcome tracking configs      |
| 47  | Is there a regression detection process to catch quality degradation in AI outputs over time? | **0**: No regression detection — quality issues are discovered in production. **1**: Periodic manual checks for quality regression. **2**: Automated regression detection with alerts, quality gates, and historical trend analysis.                                  | Regression test configs, monitoring dashboards, alert definitions for quality metrics |

## Adapter Interface

Each adapter connects to a data source and produces scored signals:

```typescript
interface Adapter {
  name: string;
  signals: Signal[];
  connect(config: AdapterConfig): Promise<void>;
  collect(): Promise<SignalResult[]>;
}

interface SignalResult {
  questionId: string; // maps to one of the 47 questions
  score: 0 | 1 | 2;
  evidence: Evidence; // raw data backing the score
  confidence: number; // 0-1, how reliable the signal is
}

interface Evidence {
  source: string; // e.g., "github:repos", "github:actions"
  data: unknown; // raw data from the adapter
  summary: string; // human-readable explanation
}
```

## V1.1 Scope

- **GitHub adapter** as the first and only data source
- **AI inference** (LLM analysis) for questions that can't be directly measured
- **CLI** for running one-off assessments
- **Results output**: on-page summary, PDF report, shareable link
- **No database** — stateless in V1, optional persistent storage in V2

## Future Roadmap (Out of Scope for V1)

- GitLab, Jira, Slack adapters
- Anonymous benchmarking across organizations
- Trend tracking (retake and compare over time)
- Server mode with scheduled assessments
- Integration with CI/CD for continuous scoring
