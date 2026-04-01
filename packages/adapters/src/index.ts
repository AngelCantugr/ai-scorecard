/**
 * @ai-scorecard/adapters
 * Plugin system for data sources (GitHub, GitLab, etc.)
 */

export interface Adapter {
  name: string;
  fetch(): Promise<Record<string, unknown>>;
}
