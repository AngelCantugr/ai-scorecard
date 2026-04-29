import type { Question } from "./types/index.js";

export const questions: Question[] = [
  // D1: Platform & Infrastructure
  {
    id: "D1-Q1",
    dimensionId: "platform-infrastructure",
    text: "Is there a centralized AI gateway/proxy with logging and rate limiting?",
    rubric: {
      0: "Teams call model APIs directly.",
      1: "Shared wrapper but no centralized routing.",
      2: "Centralized gateway with logging, rate limiting, and model abstraction.",
    },
    measurementStrategy: "Repo scan for gateway configs, infrastructure-as-code definitions",
  },
  {
    id: "D1-Q2",
    dimensionId: "platform-infrastructure",
    text: "Is there a model registry with versioning and access controls?",
    rubric: {
      0: "No registry.",
      1: "Informal list or wiki of models.",
      2: "Versioned registry with access controls and deprecation policies.",
    },
    measurementStrategy: "Scan for model registry configs, catalog files",
  },
  {
    id: "D1-Q3",
    dimensionId: "platform-infrastructure",
    text: "Are MCP servers deployed and managed centrally? How many, how often called?",
    rubric: {
      0: "No MCP servers.",
      1: "Ad-hoc MCP servers in individual repos.",
      2: "Centrally managed MCP servers with usage tracking.",
    },
    measurementStrategy: "Scan repos for MCP configs (`mcp.json`, `.mcp/`), server definitions",
  },
  {
    id: "D1-Q4",
    dimensionId: "platform-infrastructure",
    text: "Is there a context engine (RAG infrastructure, knowledge bases, context assembly)?",
    rubric: {
      0: "No context engine.",
      1: "Basic RAG or retrieval setup in one project.",
      2: "Org-wide context engine with maintained knowledge bases and delivery strategy.",
    },
    measurementStrategy: "Scan for vector DB configs, embedding pipelines, RAG infrastructure",
  },
  {
    id: "D1-Q5",
    dimensionId: "platform-infrastructure",
    text: "Is there a prompt/template management system with version control?",
    rubric: {
      0: "Prompts are inline strings in code.",
      1: "Prompts in separate files but not versioned or reviewed.",
      2: "Prompt management system with versioning, review process, and testing.",
    },
    measurementStrategy: "Git history on prompt files, scan for prompt template directories",
  },
  {
    id: "D1-Q6",
    dimensionId: "platform-infrastructure",
    text: "Are AI credentials and API keys managed through a secrets manager (not hardcoded)?",
    rubric: {
      0: "Keys hardcoded or in `.env` files committed to repos.",
      1: "Environment variables but no centralized secrets manager.",
      2: "Centralized secrets manager with rotation and audit trails.",
    },
    measurementStrategy:
      "Scan repos for hardcoded keys, `.env` in git history, secrets manager configs",
  },

  // D2: Developer Tooling & Adoption
  {
    id: "D2-Q7",
    dimensionId: "developer-tooling",
    text: "Are repos configured with AI steering files (Claude.md, agents.md, copilot-instructions)?",
    rubric: {
      0: "No AI steering files.",
      1: "Some repos have basic config files.",
      2: "Standardized, well-maintained steering files across repos with team-specific instructions.",
    },
    measurementStrategy:
      "GitHub adapter — scan repos for `CLAUDE.md`, `agents.md`, `.github/copilot-instructions.md`",
  },
  {
    id: "D2-Q8",
    dimensionId: "developer-tooling",
    text: "Are devs using rules to guide AI in linting, testing, writing code, and debugging?",
    rubric: {
      0: "No AI rules defined.",
      1: "Basic rules in some repos.",
      2: "Comprehensive, task-specific rules (linting, testing, debugging) actively maintained and shared.",
    },
    measurementStrategy:
      "Scan for `.cursorrules`, rule definitions in `CLAUDE.md`, custom instructions",
  },
  {
    id: "D2-Q9",
    dimensionId: "developer-tooling",
    text: "What modalities are devs using — chat, copilot, agents, dev workflows? Is there variety?",
    rubric: {
      0: "Single modality (e.g., only chat).",
      1: "Two modalities in use.",
      2: "Developers use the right modality for the task — chat, inline completion, agents, and workflows.",
    },
    measurementStrategy: "IDE telemetry, agent session logs, LLM inference on workflow patterns",
  },
  {
    id: "D2-Q10",
    dimensionId: "developer-tooling",
    text: "What skills are used most frequently? Are devs creating custom skills?",
    rubric: {
      0: "No skills usage.",
      1: "Using built-in skills only.",
      2: "Active creation and sharing of custom skills with usage tracking.",
    },
    measurementStrategy: "Skill execution logs, scan repos for custom skill definitions",
  },
  {
    id: "D2-Q11",
    dimensionId: "developer-tooling",
    text: "What plugins/integrations are installed and actively used?",
    rubric: {
      0: "No AI plugins beyond basic autocomplete.",
      1: "Some plugins installed but low usage.",
      2: "Curated plugin ecosystem with tracked installation and execution metrics.",
    },
    measurementStrategy: "Plugin configs in repos, usage telemetry",
  },
  {
    id: "D2-Q12",
    dimensionId: "developer-tooling",
    text: "Are developers selecting appropriate models for task complexity (not always the most expensive)?",
    rubric: {
      0: "Always using the most expensive model.",
      1: "Some model selection awareness but no guidelines.",
      2: "Clear model selection guidelines with cost tracking per task type.",
    },
    measurementStrategy: "LLM usage logs — model selection patterns vs task complexity",
  },
  {
    id: "D2-Q13",
    dimensionId: "developer-tooling",
    text: "What percentage of development tasks are being handled or assisted by AI agents?",
    rubric: {
      0: "< 5% of tasks involve AI.",
      1: "5–30% of tasks have AI assistance.",
      2: "> 30% of tasks involve AI agents with tracked task types and outcomes.",
    },
    measurementStrategy: "Agent session logs, PR metadata, commit attribution",
  },

  // D3: CI/CD & Velocity
  {
    id: "D3-Q14",
    dimensionId: "cicd-velocity",
    text: "Is the CI/CD pipeline scaled to handle increased PR volume from AI-assisted development?",
    rubric: {
      0: "Pipeline is a bottleneck (long queues, frequent timeouts).",
      1: "Pipeline handles current load but no scaling plan.",
      2: "Auto-scaling CI with monitored queue times and capacity planning.",
    },
    measurementStrategy: "GitHub Actions — queue times, failure rates, pipeline duration trends",
  },
  {
    id: "D3-Q15",
    dimensionId: "cicd-velocity",
    text: "Where are the current SDLC bottlenecks? Has faster coding shifted the bottleneck to review/CI/deploy?",
    rubric: {
      0: "No bottleneck analysis.",
      1: "Aware of bottlenecks but no measurement.",
      2: "Measured bottleneck analysis with data-driven improvements (e.g., reduced review wait times).",
    },
    measurementStrategy: "PR review time, CI wait time, deploy frequency (DORA-adjacent metrics)",
  },
  {
    id: "D3-Q16",
    dimensionId: "cicd-velocity",
    text: "How many bugs are caught by AI-powered code reviews or bug bash agents?",
    rubric: {
      0: "No AI-assisted code review.",
      1: "AI review tools in place but not tracked.",
      2: "Tracked AI review findings with measured catch rate and severity breakdown.",
    },
    measurementStrategy: "PR review comments from bots, automated issue creation patterns",
  },
  {
    id: "D3-Q17",
    dimensionId: "cicd-velocity",
    text: "Are AI-written tests effective or noisy? What's the flaky test rate trend?",
    rubric: {
      0: "No tracking of AI-written test quality.",
      1: "Some awareness of test noise but no metrics.",
      2: "Tracked test effectiveness — flaky rate, coverage delta, and test-to-code quality ratios.",
    },
    measurementStrategy: "Test suite metrics, flaky test dashboards, coverage trends",
  },
  {
    id: "D3-Q18",
    dimensionId: "cicd-velocity",
    text: "What's the PR cycle time (open → merge) and how has it trended since AI adoption?",
    rubric: {
      0: "Not measured.",
      1: "Measured but no correlation with AI adoption.",
      2: "Tracked with clear before/after AI adoption comparison and ongoing trend analysis.",
    },
    measurementStrategy: "GitHub PR data — timestamps, merge times, review durations",
  },
  {
    id: "D3-Q19",
    dimensionId: "cicd-velocity",
    text: "What percentage of tasks have moved from deterministic → probabilistic → back to deterministic?",
    rubric: {
      0: "No tracking of this pattern.",
      1: "Anecdotal awareness.",
      2: "Tracked pipeline maturity — LLM calls that have been replaced by deterministic code after validation.",
    },
    measurementStrategy: "Architectural analysis, LLM call patterns over time",
  },

  // D4: Governance & Security
  {
    id: "D4-Q20",
    dimensionId: "governance-security",
    text: "Are AI artifacts (prompts, configs, agent definitions) governed with proper SDLC — versioned, reviewed, tested?",
    rubric: {
      0: "AI artifacts are unmanaged.",
      1: "Versioned but not reviewed or tested.",
      2: "Full SDLC — versioned, peer-reviewed, tested, with rollback capabilities.",
    },
    measurementStrategy: "Git history on AI config files — commit frequency, PR review patterns",
  },
  {
    id: "D4-Q21",
    dimensionId: "governance-security",
    text: "Are prompts secured against exposure and tampering (no hardcoded prompts in client code, injection protections)?",
    rubric: {
      0: "Prompts exposed in client-side code.",
      1: "Server-side prompts but no injection protection.",
      2: "Secured prompts with injection detection, access controls, and audit logging.",
    },
    measurementStrategy: "Repo scan for prompts in frontend code, security config analysis",
  },
  {
    id: "D4-Q22",
    dimensionId: "governance-security",
    text: "Is there a formal AI usage policy that developers know and follow?",
    rubric: {
      0: "No policy.",
      1: "Policy exists but not enforced or widely known.",
      2: "Living policy document, referenced in onboarding, with compliance tracking.",
    },
    measurementStrategy:
      "LLM inference — scan for policy docs, onboarding references, compliance configs",
  },
  {
    id: "D4-Q23",
    dimensionId: "governance-security",
    text: "Are AI-generated code contributions tracked and attributable in the git history?",
    rubric: {
      0: "No attribution.",
      1: "Informal conventions (e.g., commit message tags).",
      2: "Systematic attribution — AI-generated code is tagged, measurable, and reportable.",
    },
    measurementStrategy: "Git commit metadata, Co-authored-by tags, bot commit patterns",
  },
  {
    id: "D4-Q24",
    dimensionId: "governance-security",
    text: "Is there a review process specifically for AI-generated code (beyond standard code review)?",
    rubric: {
      0: "No differentiated review.",
      1: "Informal extra scrutiny for AI code.",
      2: "Defined review checklist or process for AI-generated code with tracked outcomes.",
    },
    measurementStrategy: "PR labels, review checklists, workflow configs",
  },

  // D5: Observability & Cost
  {
    id: "D5-Q25",
    dimensionId: "observability-cost",
    text: "For AI-powered products, is tracing implemented (OpenTelemetry, Langfuse, etc.)?",
    rubric: {
      0: "No tracing.",
      1: "Basic logging but no structured tracing.",
      2: "Full distributed tracing with correlation IDs, latency tracking, and trace visualization.",
    },
    measurementStrategy: "Scan for OpenTelemetry, Langfuse, Langsmith, or similar configs in repos",
  },
  {
    id: "D5-Q26",
    dimensionId: "observability-cost",
    text: "Is there observability into AI development workflows (agent sessions, tool usage, error rates)?",
    rubric: {
      0: "No visibility into AI dev workflows.",
      1: "Some logging but no dashboards.",
      2: "Dashboards tracking agent sessions, tool calls, success/error rates, and trends.",
    },
    measurementStrategy: "Agent telemetry configs, dashboard definitions",
  },
  {
    id: "D5-Q27",
    dimensionId: "observability-cost",
    text: "Are model costs tracked per team/project/use-case?",
    rubric: {
      0: "No cost tracking.",
      1: "Aggregate cost known but not broken down.",
      2: "Per-team/project cost attribution with budgets and alerts.",
    },
    measurementStrategy: "Cost management configs, billing API integrations",
  },
  {
    id: "D5-Q28",
    dimensionId: "observability-cost",
    text: "What are the measured dollar savings from RAG and optimized prompting vs naive approaches?",
    rubric: {
      0: "No measurement.",
      1: "Anecdotal savings estimates.",
      2: "A/B tested cost comparisons with documented savings from RAG, caching, and prompt optimization.",
    },
    measurementStrategy: "Cost analysis reports, A/B test configs",
  },
  {
    id: "D5-Q29",
    dimensionId: "observability-cost",
    text: "Are there dashboards showing AI SRE metrics (latency, error rates, token usage, cost)?",
    rubric: {
      0: "No AI-specific SRE dashboards.",
      1: "Basic metrics collected but not visualized.",
      2: "Real-time dashboards with alerting on latency, errors, token usage, and cost anomalies.",
    },
    measurementStrategy: "Dashboard configs (Grafana, Datadog), alert definitions",
  },
  {
    id: "D5-Q30",
    dimensionId: "observability-cost",
    text: "What productivity metrics are being tracked (cycle time, throughput, developer satisfaction)?",
    rubric: {
      0: "No productivity metrics.",
      1: "Some metrics but not correlated with AI adoption.",
      2: "Comprehensive metrics suite with before/after AI baselines and ongoing tracking.",
    },
    measurementStrategy: "DORA metrics, survey configs, analytics dashboards",
  },

  // D6: Documentation & Context Engineering
  {
    id: "D6-Q31",
    dimensionId: "documentation-context",
    text: "Is documentation AI-friendly (structured, machine-readable, not just prose for humans)?",
    rubric: {
      0: "Documentation is unstructured prose only.",
      1: "Mix of prose and some structured formats.",
      2: "Documentation strategy that includes machine-readable formats (OpenAPI, structured markdown, typed schemas).",
    },
    measurementStrategy:
      "Scan for OpenAPI specs, JSDoc, TypeScript declarations, structured doc formats",
  },
  {
    id: "D6-Q32",
    dimensionId: "documentation-context",
    text: "Are API schemas, type definitions, and specs kept accurate and up-to-date as the source of truth?",
    rubric: {
      0: "Specs are outdated or missing.",
      1: "Specs exist but drift from implementation.",
      2: "Specs are the source of truth — auto-generated or CI-validated against implementation.",
    },
    measurementStrategy: "Compare spec files vs implementation, check for spec validation in CI",
  },
  {
    id: "D6-Q33",
    dimensionId: "documentation-context",
    text: "Is there a context delivery strategy — how is relevant context assembled and delivered to agents?",
    rubric: {
      0: "No context strategy — agents get whatever is in the prompt.",
      1: "Some context curation (e.g., selected files).",
      2: "Engineered context delivery — dynamic context assembly, relevance ranking, and token budget management.",
    },
    measurementStrategy: "Scan for context configs, RAG pipelines, agent instruction files",
  },
  {
    id: "D6-Q34",
    dimensionId: "documentation-context",
    text: "Are knowledge bases and RAG sources maintained with the same rigor as production code?",
    rubric: {
      0: "Knowledge bases are stale or unmaintained.",
      1: "Periodically updated but no formal process.",
      2: "Knowledge bases have CI/CD — automated ingestion, freshness checks, and quality validation.",
    },
    measurementStrategy: "RAG pipeline configs, ingestion schedules, freshness monitoring",
  },
  {
    id: "D6-Q35",
    dimensionId: "documentation-context",
    text: "Is there a strategy to reduce dependency on human-written docs by using verified, structured sources?",
    rubric: {
      0: "Fully dependent on human-written prose.",
      1: "Some auto-generated docs (e.g., from code).",
      2: "Strategy to derive documentation from code, tests, and types — with accuracy guarantees.",
    },
    measurementStrategy: "Auto-doc tooling configs (TypeDoc, Swagger), doc generation in CI",
  },

  // D7: Agent Maturity
  {
    id: "D7-Q36",
    dimensionId: "agent-maturity",
    text: "Are AI agents deployed with clearly defined scopes, permissions, and execution boundaries?",
    rubric: {
      0: "No formal scoping — agents run with broad or undefined permissions.",
      1: "Some scope definitions exist but are not enforced or reviewed.",
      2: "All agents have formally defined scopes, least-privilege permissions, and documented boundaries.",
    },
    measurementStrategy:
      "Scan agent configs for permission scopes, RBAC definitions, sandbox configs",
  },
  {
    id: "D7-Q37",
    dimensionId: "agent-maturity",
    text: "Do agents produce structured outputs with validation schemas rather than free-form text?",
    rubric: {
      0: "Agents return free-form text with no output validation.",
      1: "Some structured outputs but validation is inconsistent.",
      2: "All agent outputs have formal schemas with runtime validation and error handling.",
    },
    measurementStrategy:
      "Scan for output schema definitions, Zod/JSON Schema validators in agent code",
  },
  {
    id: "D7-Q38",
    dimensionId: "agent-maturity",
    text: "Is there a composable framework for building multi-step agent workflows?",
    rubric: {
      0: "Agents are one-off scripts with no reuse.",
      1: "Some ad-hoc composition but no formal framework.",
      2: "Shared framework for composing multi-step workflows with standardized interfaces and error recovery.",
    },
    measurementStrategy:
      "Scan for workflow orchestration configs, shared agent libraries, workflow definitions",
  },
  {
    id: "D7-Q39",
    dimensionId: "agent-maturity",
    text: "Are agent sessions logged with reproducible traces for debugging and auditing?",
    rubric: {
      0: "No agent logging beyond basic stdout.",
      1: "Logs exist but are not structured or queryable.",
      2: "Structured session traces with correlation IDs, step-by-step logs, and replay capability.",
    },
    measurementStrategy:
      "Scan for trace configs, structured logging patterns, observability integrations",
  },
  {
    id: "D7-Q40",
    dimensionId: "agent-maturity",
    text: "Is there a human-in-the-loop approval step for high-risk agent actions?",
    rubric: {
      0: "No human oversight — agents act autonomously on all tasks.",
      1: "Informal reviews for some high-risk tasks.",
      2: "Formal approval workflows for high-risk actions with clear escalation paths and audit trails.",
    },
    measurementStrategy: "Scan for approval workflow configs, review gates in agent pipelines",
  },
  {
    id: "D7-Q41",
    dimensionId: "agent-maturity",
    text: "Are agent system prompts and instructions versioned and reviewed like production code?",
    rubric: {
      0: "Agent instructions are informal or embedded in code without version control.",
      1: "Instructions are tracked in version control but without a review process.",
      2: "Agent instructions follow full SDLC — versioned, peer-reviewed, tested, with change history.",
    },
    measurementStrategy:
      "Git history on agent instruction files, PR review patterns for prompt changes",
  },

  // D8: Eval Quality
  {
    id: "D8-Q42",
    dimensionId: "eval-quality",
    text: "Is there an automated evaluation framework to measure AI output quality?",
    rubric: {
      0: "No structured evaluation — quality is assessed informally.",
      1: "Manual spot-checks or basic automated tests exist.",
      2: "Automated eval framework with quantitative metrics covering accuracy, relevance, and safety.",
    },
    measurementStrategy:
      "Scan for eval framework configs (Promptfoo, RAGAS, custom harnesses), test datasets",
  },
  {
    id: "D8-Q43",
    dimensionId: "eval-quality",
    text: "Are evals executed in CI on every change to prompts, models, or agent definitions?",
    rubric: {
      0: "Evals are not tied to the development lifecycle.",
      1: "Evals are run manually or on a schedule.",
      2: "Evals are a required CI gate — any change to AI components triggers the eval suite automatically.",
    },
    measurementStrategy: "CI/CD configs for eval runs, GitHub Actions eval workflows",
  },
  {
    id: "D8-Q44",
    dimensionId: "eval-quality",
    text: "Are evaluation datasets maintained in version control with clear ownership?",
    rubric: {
      0: "No dedicated eval datasets — testing uses ad-hoc examples.",
      1: "Datasets exist but are not versioned or regularly updated.",
      2: "Curated, versioned eval datasets with ownership, refresh schedules, and bias review.",
    },
    measurementStrategy: "Scan repos for dataset files, versioning history, ownership metadata",
  },
  {
    id: "D8-Q45",
    dimensionId: "eval-quality",
    text: "Is there a benchmark suite used to compare model versions before promotion?",
    rubric: {
      0: "No benchmarking — models are promoted without comparison.",
      1: "Ad-hoc comparisons made informally.",
      2: "Formal benchmark suite with pass/fail criteria and automated comparison on model updates.",
    },
    measurementStrategy:
      "Benchmark config files, model comparison scripts, promotion gate definitions",
  },
  {
    id: "D8-Q46",
    dimensionId: "eval-quality",
    text: "Do evals measure business-relevant outcomes alongside technical metrics?",
    rubric: {
      0: "Evals only measure technical metrics (e.g., BLEU, perplexity).",
      1: "Some business-relevant metrics tracked but not standardized.",
      2: "Evals include business KPIs (task completion rate, user satisfaction, cost per outcome) alongside technical metrics.",
    },
    measurementStrategy:
      "Eval metric definitions, dashboards with business KPIs, outcome tracking configs",
  },
  {
    id: "D8-Q47",
    dimensionId: "eval-quality",
    text: "Is there a regression detection process to catch quality degradation in AI outputs over time?",
    rubric: {
      0: "No regression detection — quality issues are discovered in production.",
      1: "Periodic manual checks for quality regression.",
      2: "Automated regression detection with alerts, quality gates, and historical trend analysis.",
    },
    measurementStrategy:
      "Regression test configs, monitoring dashboards, alert definitions for quality metrics",
  },
];
