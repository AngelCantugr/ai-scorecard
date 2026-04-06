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
 * working directory. CWD file takes precedence over the home-directory file.
 * Returns an empty object if no config file is found or the file is invalid.
 */
export function loadConfig(): CliConfig {
  const candidates = [
    join(process.cwd(), ".ai-scorecard.json"),
    join(homedir(), ".ai-scorecard.json"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        const raw = readFileSync(candidate, "utf-8");
        return JSON.parse(raw) as CliConfig;
      } catch {
        // Ignore malformed config files — proceed with defaults
      }
    }
  }

  return {};
}
