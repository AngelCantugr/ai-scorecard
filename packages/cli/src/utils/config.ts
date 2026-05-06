/**
 * Config file loading for @ai-scorecard/cli
 *
 * Supports ~/.ai-scorecard.json and .ai-scorecard.json (project root).
 * CLI arguments always override config file values.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

/** Shape of the optional config file */
export interface CliConfig {
  github?: {
    token?: string;
    org?: string;
    maxRepos?: number;
  };
  ai?: {
    /** "anthropic" or "ollama" */
    provider?: string;
    /** Anthropic API key (only meaningful when provider=anthropic) */
    apiKey?: string;
    /** Model name; default depends on provider */
    model?: string;
    /** Ollama base URL (only meaningful when provider=ollama) */
    baseUrl?: string;
  };
  output?: "table" | "json" | "markdown";
}

/**
 * Load config from ~/.ai-scorecard.json or .ai-scorecard.json in the current
 * working directory. The two files are merged: home config is the base, CWD
 * config overrides non-credential fields only. Credential fields (token,
 * apiKey) are intentionally excluded from CWD config to prevent a malicious
 * repo from injecting secrets via a local config file.
 */
export function loadConfig(): CliConfig {
  const homeConfig = readConfigFile(join(homedir(), ".ai-scorecard.json"));
  const cwdConfig = readConfigFile(join(process.cwd(), ".ai-scorecard.json"));

  // Strip credential fields from CWD config before merging.
  // exactOptionalPropertyTypes: true requires properties to be absent (not set to undefined),
  // so all optional fields must use conditional spreading.
  const safeCwdConfig: CliConfig = {
    ...(cwdConfig.output !== undefined && { output: cwdConfig.output }),
    ...(cwdConfig.github && {
      github: {
        ...(cwdConfig.github.org !== undefined && { org: cwdConfig.github.org }),
        ...(cwdConfig.github.maxRepos !== undefined && { maxRepos: cwdConfig.github.maxRepos }),
      },
    }),
    ...(cwdConfig.ai && {
      ai: {
        ...(cwdConfig.ai.provider !== undefined && { provider: cwdConfig.ai.provider }),
        ...(cwdConfig.ai.model !== undefined && { model: cwdConfig.ai.model }),
        ...(cwdConfig.ai.baseUrl !== undefined && { baseUrl: cwdConfig.ai.baseUrl }),
      },
    }),
  };

  return {
    ...homeConfig,
    ...safeCwdConfig,
    github: { ...homeConfig.github, ...safeCwdConfig.github },
    ai: { ...homeConfig.ai, ...safeCwdConfig.ai },
  };
}

function readConfigFile(path: string): CliConfig {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as CliConfig;
  } catch {
    return {};
  }
}
