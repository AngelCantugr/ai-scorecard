import type { AdapterConfig } from "@ai-scorecard/core";

/**
 * Configuration for the GitHub adapter.
 */
export interface GitHubAdapterConfig extends AdapterConfig {
  /** GitHub personal access token or app token */
  token: string;
  /** Organization name to assess */
  org: string;
  /** Optional: specific repos to assess (default: all repos in org) */
  repos?: string[];
  /** Optional: max repos to scan (default: 50, for rate limiting) */
  maxRepos?: number;
}
