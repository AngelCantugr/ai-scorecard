import type { Octokit } from "@octokit/rest";
import type { SignalResult, Evidence } from "@ai-scorecard/core";
import type { RepoInfo } from "./repo-scan.js";

/** Regex patterns for common API key formats */
const API_KEY_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g, // OpenAI-style keys
  /AKIA[0-9A-Z]{16}/g, // AWS access keys
  /(?:api[_-]?key|token|secret|password)\s*[:=]\s*["']?[a-zA-Z0-9_\-./]{16,}/gi,
  /ghp_[a-zA-Z0-9]{36}/g, // GitHub personal access tokens
  /xoxb-[0-9-a-zA-Z]{50,}/g, // Slack bot tokens
];

/** Secrets manager config indicators */
const SECRETS_MANAGER_FILES = [
  ".vault",
  "vault.hcl",
  ".aws/credentials",
  "infra/secrets",
  "terraform/secrets",
  ".sops.yaml",
  "sops.yaml",
  ".age",
];

/**
 * Q6 — Secrets management
 * Checks for .env in git, hardcoded API keys, secrets manager configs.
 */
export async function collectSecretsManagementSignal(
  octokit: Octokit,
  repos: RepoInfo[]
): Promise<SignalResult> {
  const envInGitRepos: string[] = [];
  const hardcodedKeyRepos: string[] = [];
  const secretsManagerRepos: string[] = [];

  for (const repo of repos.slice(0, 15)) {
    const owner = repo.fullName.split("/")[0] ?? "";

    // Check if .env is tracked (not gitignored)
    try {
      await octokit.repos.getContent({
        owner,
        repo: repo.name,
        path: ".env",
      });
      // If this succeeds, .env is committed
      envInGitRepos.push(repo.fullName);
    } catch {
      // .env not found (good)
    }

    // Check for secrets manager config files
    try {
      const { data: tree } = await octokit.git.getTree({
        owner,
        repo: repo.name,
        tree_sha: repo.defaultBranch,
        recursive: "1",
      });
      const paths = tree.tree
        .filter((item) => item.type === "blob")
        .map((item) => item.path ?? "");

      const hasSecretsManager = SECRETS_MANAGER_FILES.some((smf) =>
        paths.some((p) => p === smf || p.endsWith(`/${smf}`))
      );
      if (hasSecretsManager) {
        secretsManagerRepos.push(repo.fullName);
      }

      // Check a sample of files for hardcoded keys
      const sampleFiles = paths
        .filter(
          (p) =>
            (p.endsWith(".ts") || p.endsWith(".js") || p.endsWith(".py") || p.endsWith(".env.example")) &&
            !p.includes("node_modules") &&
            !p.includes("dist")
        )
        .slice(0, 5);

      for (const filePath of sampleFiles) {
        try {
          const { data: fileData } = await octokit.repos.getContent({
            owner,
            repo: repo.name,
            path: filePath,
          });
          if (!Array.isArray(fileData) && "content" in fileData && fileData.content) {
            const content = Buffer.from(fileData.content, "base64").toString("utf-8");
            const hasHardcodedKey = API_KEY_PATTERNS.some((pattern) => {
              // Reset lastIndex for global patterns
              pattern.lastIndex = 0;
              return pattern.test(content);
            });
            if (hasHardcodedKey && !hardcodedKeyRepos.includes(repo.fullName)) {
              hardcodedKeyRepos.push(repo.fullName);
            }
          }
        } catch {
          // ignore file read errors
        }
      }
    } catch {
      // ignore
    }
  }

  const evidence: Evidence[] = [
    {
      source: "github:repos",
      data: {
        envInGitRepos,
        hardcodedKeyRepos,
        secretsManagerRepos,
        totalRepos: repos.length,
      },
      summary: [
        envInGitRepos.length > 0 ? `⚠ .env committed in: ${envInGitRepos.join(", ")}` : null,
        hardcodedKeyRepos.length > 0
          ? `⚠ Potential hardcoded keys in: ${hardcodedKeyRepos.join(", ")}`
          : null,
        secretsManagerRepos.length > 0
          ? `✓ Secrets manager configs in: ${secretsManagerRepos.join(", ")}`
          : "No secrets manager configs found.",
      ]
        .filter(Boolean)
        .join(". "),
    },
  ];

  let score: 0 | 1 | 2 = 0;
  if (envInGitRepos.length > 0 || hardcodedKeyRepos.length > 0) {
    score = 0;
  } else if (secretsManagerRepos.length >= 1) {
    score = 2;
  } else {
    // No .env in git, no hardcoded keys — but no explicit secrets manager either
    score = 1;
  }

  return {
    signalId: "github:security:q6-secrets-management",
    questionId: "D1-Q6",
    score,
    evidence,
    confidence: 0.5,
  };
}
