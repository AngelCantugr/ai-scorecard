#!/usr/bin/env node
/**
 * @ai-scorecard/cli
 * CLI tool for running AI scorecard assessments
 */

import { VERSION } from "@ai-scorecard/core";

export function run(): void {
  console.log(`AI Scorecard CLI v${VERSION}`);
  console.log("Run `ai-scorecard --help` for usage information.");
}

run();
