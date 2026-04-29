/**
 * `assess` command — orchestrates the full assessment flow.
 */

import chalk from "chalk";
import ora from "ora";
import type { SignalResult, ScorecardResult } from "@ai-scorecard/core";
import { computeScorecard } from "@ai-scorecard/core";
import { GitHubAdapter } from "@ai-scorecard/adapters";
import { AIInferenceEngine } from "@ai-scorecard/adapters";
import type { ContentBundle, CollectorError } from "@ai-scorecard/adapters";
import { outputTable } from "../output/table.js";
import { outputJson } from "../output/json.js";
import { outputMarkdown } from "../output/markdown.js";

/** Options passed to the assess command */
export interface AssessOptions {
  githubOrg?: string;
  githubToken?: string;
  aiInference?: boolean;
  anthropicKey?: string;
  output?: "table" | "json" | "markdown";
  repos?: string;
  dryRun?: boolean;
  maxRepos?: number;
  model?: string;
}

/**
 * Perform a dry-run assessment: print what would be analyzed without making
 * any external API calls.
 */
function dryRun(options: AssessOptions): void {
  console.log(chalk.bold.cyan("\n[DRY RUN] AI Adoption Scorecard Assessment\n"));
  console.log(chalk.bold("Configuration:"));
  console.log(`  GitHub Org:    ${options.githubOrg ?? "(not set)"}`);
  console.log(`  GitHub Token:  ${options.githubToken ? "***" : "(not set)"}`);
  console.log(`  Repos filter:  ${options.repos ?? "(all repos)"}`);
  console.log(`  Max repos:     ${options.maxRepos ?? 50}`);
  console.log(`  AI Inference:  ${options.aiInference ? "enabled" : "disabled"}`);
  if (options.aiInference) {
    console.log(`  Anthropic Key: ${options.anthropicKey ? "***" : "(not set)"}`);
    console.log(`  Model:         ${options.model ?? "claude-sonnet-4-6"}`);
  }
  console.log(`  Output format: ${options.output ?? "table"}`);
  console.log(
    chalk.gray("\nNo API calls will be made. Remove --dry-run to run the full assessment.")
  );
}

/**
 * Run the full assessment flow:
 *   1. Initialize GitHub adapter and validate credentials
 *   2. Collect signals (with progress reporting)
 *   3. Optionally run AI inference
 *   4. Compute scorecard
 *   5. Output results
 *
 * Exit codes:
 *   0 — clean run
 *   1 — unexpected failure (validation error, network down, etc.)
 *   2 — at least one collector reported an auth-classified error; the
 *       reported scores reflect a misconfigured token, not real org
 *       maturity, and should not be trusted.
 */
export async function runAssess(options: AssessOptions): Promise<void> {
  // ── Dry run ────────────────────────────────────────────────────────────────
  if (options.dryRun) {
    dryRun(options);
    return;
  }

  // ── Validate required options ──────────────────────────────────────────────
  if (!options.githubOrg) {
    console.error(chalk.red("Error: --github-org is required."));
    process.exit(1);
  }
  if (!options.githubToken) {
    console.error(chalk.red("Error: --github-token is required (or set GITHUB_TOKEN env var)."));
    process.exit(1);
  }
  if (options.aiInference && !options.anthropicKey) {
    console.error(chalk.red("Error: --anthropic-key is required when --ai-inference is enabled."));
    process.exit(1);
  }

  const startTime = Date.now();
  const outputFormat = options.output ?? "table";
  const org = options.githubOrg;

  // ── Step 1: Initialize GitHub adapter ─────────────────────────────────────
  const adapter = new GitHubAdapter();
  const connectSpinner = ora("Connecting to GitHub…").start();

  try {
    await adapter.connect({
      token: options.githubToken,
      org,
      repos: options.repos
        ? options.repos
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean)
        : undefined,
      maxRepos: options.maxRepos ?? 50,
    });
    connectSpinner.succeed("Connected to GitHub");
  } catch (err) {
    connectSpinner.fail("Failed to connect to GitHub");
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  // ── Step 2: Collect signals ────────────────────────────────────────────────
  const collectSpinner = ora(`Collecting signals from ${org}…`).start();
  let githubSignals: SignalResult[] = [];
  let collectorErrors: readonly CollectorError[] = [];

  try {
    const collectOutcome = await adapter.collectWithDiagnostics();
    githubSignals = collectOutcome.results;
    collectorErrors = collectOutcome.errors;
    collectSpinner.succeed(`Collected ${githubSignals.length} signals from GitHub`);
  } catch (err) {
    collectSpinner.fail("Signal collection failed");
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  // ── Step 3: AI Inference (optional) ───────────────────────────────────────
  let aiSignals: SignalResult[] = [];

  if (options.aiInference && options.anthropicKey) {
    const aiSpinner = ora("Running AI inference analysis…").start();
    try {
      const engine = new AIInferenceEngine({
        provider: "anthropic",
        apiKey: options.anthropicKey,
        ...(options.model !== undefined ? { model: options.model } : {}),
      });

      const bundle: ContentBundle = {
        source: `github:${org}`,
        files: githubSignals
          .flatMap((s) =>
            s.evidence.map((e) => ({
              path: `${s.signalId}`,
              content: typeof e.data === "string" ? e.data : JSON.stringify(e.data),
            }))
          )
          .slice(0, 50),
        metadata: { org },
      };

      aiSignals = await engine.analyze(bundle);
      aiSpinner.succeed(`AI inference complete (${aiSignals.length} additional signals)`);
    } catch (err) {
      aiSpinner.fail("AI inference failed (continuing with GitHub signals only)");
      console.error(chalk.yellow(String(err)));
    }
  }

  // ── Step 4: Compute scorecard ──────────────────────────────────────────────
  const allSignals: SignalResult[] = [...githubSignals, ...aiSignals];
  let result: ScorecardResult;

  try {
    result = computeScorecard(allSignals, {
      adapterName: adapter.name,
      target: `org:${org}`,
    });
  } catch (err) {
    console.error(chalk.red(`Failed to compute scorecard: ${String(err)}`));
    process.exit(1);
  }

  // ── Step 5: Output results ─────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  switch (outputFormat) {
    case "json":
      outputJson(result, collectorErrors);
      break;
    case "markdown":
      outputMarkdown(result, collectorErrors);
      break;
    default:
      outputTable(result, collectorErrors);
  }

  if (outputFormat !== "json") {
    console.log(chalk.gray(`\nCompleted in ${elapsed}s`));
  }

  // ── Exit code ──────────────────────────────────────────────────────────────
  const code = chooseExitCode(collectorErrors);
  if (code !== 0) {
    process.exit(code);
  }
}

/**
 * Decide the post-assess exit code based on adapter diagnostics.
 *
 * Auth-classified errors mean the token can't read what we tried to scan,
 * so the resulting scores reflect a misconfigured run, not real org
 * maturity. Exit 2 (distinct from 1, which we reserve for unexpected
 * crashes) lets CI / wrappers detect this specifically.
 *
 * Other variants (`rate_limit`, `not_found`, `unexpected`) do not force a
 * non-zero exit — they are surfaced in the diagnostics block and are
 * expected to be reviewed by the operator without failing the run.
 *
 * Exported for unit testing.
 */
export function chooseExitCode(errors: readonly CollectorError[]): 0 | 2 {
  return errors.some((e) => e.kind === "auth") ? 2 : 0;
}
