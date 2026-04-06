#!/usr/bin/env node
/**
 * @ai-scorecard/cli
 * CLI entry point — parses arguments and dispatches to commands.
 */

import { program } from "commander";
import { loadConfig } from "./utils/config.js";
import { runAssess } from "./commands/assess.js";

const config = loadConfig();

program
  .name("ai-scorecard")
  .description("Run AI adoption assessments against a GitHub organization")
  .version("0.0.0");

program
  .command("assess")
  .description("Run a full AI adoption assessment")
  .option(
    "--github-org <org>",
    "GitHub organization to assess",
    config.github?.org,
  )
  .option(
    "--github-token <token>",
    "GitHub personal access token",
    process.env["GITHUB_TOKEN"] ?? config.github?.token,
  )
  .option("--ai-inference", "Enable AI inference analysis (requires Anthropic key)")
  .option(
    "--anthropic-key <key>",
    "Anthropic API key for AI inference",
    process.env["ANTHROPIC_API_KEY"] ?? config.ai?.apiKey,
  )
  .option(
    "--model <model>",
    "AI model to use for inference",
    config.ai?.model,
  )
  .option(
    "--output <format>",
    "Output format: table (default), json, or markdown",
    config.output ?? "table",
  )
  .option("--repos <repos>", "Comma-separated list of repo names to assess")
  .option(
    "--max-repos <n>",
    "Maximum number of repos to scan",
    (v) => parseInt(v, 10),
    config.github?.maxRepos ?? 50,
  )
  .option("--dry-run", "Show what would be analyzed without making API calls")
  .action(
    (opts: {
      githubOrg?: string;
      githubToken?: string;
      aiInference?: boolean;
      anthropicKey?: string;
      model?: string;
      output?: string;
      repos?: string;
      maxRepos?: number;
      dryRun?: boolean;
    }) => {
      const outputFormat = (opts.output ?? "table") as
        | "table"
        | "json"
        | "markdown";

      runAssess({
        ...(opts.githubOrg !== undefined ? { githubOrg: opts.githubOrg } : {}),
        ...(opts.githubToken !== undefined ? { githubToken: opts.githubToken } : {}),
        ...(opts.aiInference !== undefined ? { aiInference: opts.aiInference } : {}),
        ...(opts.anthropicKey !== undefined ? { anthropicKey: opts.anthropicKey } : {}),
        ...(opts.model !== undefined ? { model: opts.model } : {}),
        output: outputFormat,
        ...(opts.repos !== undefined ? { repos: opts.repos } : {}),
        ...(opts.maxRepos !== undefined ? { maxRepos: opts.maxRepos } : {}),
        ...(opts.dryRun !== undefined ? { dryRun: opts.dryRun } : {}),
      }).catch((err: unknown) => {
        console.error(String(err));
        process.exit(1);
      });
    },
  );

program.parse();

