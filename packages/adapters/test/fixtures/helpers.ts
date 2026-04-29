import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import type { RepoInfo } from "../../src/github/collectors/repo-scan.js";

const FIXTURES_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Load a JSON fixture by filename (relative to test/fixtures/).
 * Returned shape mirrors the raw GitHub API response wrapped in `{ data, ... }`
 * because Octokit clients return responses in that shape.
 */
export function loadFixture<T = unknown>(filename: string): T {
  const path = resolve(FIXTURES_DIR, filename);
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

/** Convenience builder for RepoInfo so each test doesn't reinvent it. */
export function makeRepo(name = "test-repo", org = "test-org"): RepoInfo {
  return { name, fullName: `${org}/${name}`, defaultBranch: "main" };
}

/**
 * Throwable that mimics Octokit's HttpError shape (status + message).
 * Use when a test needs to simulate the adapter receiving an error from the GitHub API.
 */
export function makeOctokitError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

/**
 * Build a base64 content payload in the shape Octokit returns from
 * `repos.getContent` for a single file.
 */
export function makeContentResponse(decodedText: string): {
  data: { content: string; encoding: "base64" };
} {
  return {
    data: {
      content: Buffer.from(decodedText, "utf-8").toString("base64"),
      encoding: "base64",
    },
  };
}
