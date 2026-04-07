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
    provider?: string;
    apiKey?: string;
    model?: string;
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

  // Strip credential fields from CWD config before merging
  const safeCwdConfig: CliConfig = {
    ...cwdConfig,
    github: cwdConfig.github
      ? { org: cwdConfig.github.org, maxRepos: cwdConfig.github.maxRepos }
      : undefined,
    ai: cwdConfig.ai
      ? { provider: cwdConfig.ai.provider, model: cwdConfig.ai.model }
      : undefined,
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
