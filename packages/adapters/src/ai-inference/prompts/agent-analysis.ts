/**
 * Agent maturity analysis prompts — covers Q36, Q41.
 *
 * Q36: Catalog quality / completeness inference — evaluates whether agent definitions
 *      contain formal scope and permission definitions, not just their presence.
 * Q41: Iteration loop signal — detects whether commit history on agent instruction files
 *      shows the team learning from agent failures and iterating on instructions.
 */

import type { ContentBundle } from "../types.js";
import { buildFileList } from "./utils.js";

/** Question rubrics for agent maturity questions */
const RUBRICS = {
  "D7-Q36": {
    text: "Are AI agents deployed with clearly defined scopes, permissions, and execution boundaries?",
    0: "No formal scoping — agents run with broad or undefined permissions.",
    1: "Some scope definitions exist but are not enforced or reviewed.",
    2: "All agents have formally defined scopes, least-privilege permissions, and documented boundaries.",
  },
  "D7-Q41": {
    text: "Are agent system prompts and instructions versioned and reviewed like production code?",
    0: "Agent instructions are informal or embedded in code without version control.",
    1: "Instructions are tracked in version control but without a review process.",
    2: "Agent instructions follow full SDLC — versioned, peer-reviewed, tested, with change history.",
  },
} as const;

/**
 * Build a prompt for agent maturity analysis.
 * Analyzes Q36 (catalog quality/completeness) and Q41 (instruction versioning & iteration loop).
 */
export function buildAgentAnalysisPrompt(bundle: ContentBundle): string {
  // Agent analysis focuses on agent config/instruction files and steering documents.
  const fileList = buildFileList(bundle, (path) => {
    const lowerPath = path.toLowerCase();
    // Agent instruction/config files in agent directories
    if (
      /^(\.github\/agents?|\.claude\/agents?|agents?)\//i.test(path) &&
      /\.(md|txt|yaml|yml|json)$/i.test(path)
    ) {
      return true;
    }
    // Top-level steering files
    if (/^(claude|agents?|copilot-instructions)\.(md|txt)$/i.test(path)) {
      return true;
    }
    // GitHub Copilot instruction file
    if (path === ".github/copilot-instructions.md") {
      return true;
    }
    // AGENTS.md or CLAUDE.md at any directory level
    if (/\/(claude|agents?)\.md$/i.test(lowerPath)) {
      return true;
    }
    return false;
  });

  const commitHistoryContext = buildCommitHistoryContext(bundle);

  return `You are an AI maturity analyst. Analyze the following repository files and commit history to score the organization's AI agent maturity practices.

## Repository: ${bundle.source}

## Agent Files to Analyze
${fileList}
${commitHistoryContext}
## Questions to Score

For each question below, analyze the provided files and output a JSON score.

### D7-Q36: ${RUBRICS["D7-Q36"].text}
Rubric:
- Score 0: ${RUBRICS["D7-Q36"][0]}
- Score 1: ${RUBRICS["D7-Q36"][1]}
- Score 2: ${RUBRICS["D7-Q36"][2]}
Look for: explicit allowedTools lists, permission blocks, scope definitions, sandboxing configs, RBAC definitions, least-privilege settings, and documented execution boundaries in agent instruction or config files. A score of 2 requires that ALL agents have comprehensive scope definitions — partial or inconsistent coverage warrants a 1.
Confidence guidance: Use confidence 0.6–0.7 when agent files are present and the content clearly shows scope definitions or their absence. Use 0.4–0.5 when files are sparse or the definitions are ambiguous.

### D7-Q41: ${RUBRICS["D7-Q41"].text}
Rubric:
- Score 0: ${RUBRICS["D7-Q41"][0]}
- Score 1: ${RUBRICS["D7-Q41"][1]}
- Score 2: ${RUBRICS["D7-Q41"][2]}
Look for: commit history patterns showing iterative refinement of agent instructions (e.g., commit messages referencing fixes, improvements, or agent failure follow-ups), PR review evidence on instruction files, changelog or change-log entries for agent instruction updates, test files for agent behavior, and any documented review or approval process for prompt changes.
Confidence guidance: Use confidence 0.4–0.6 for this question — detecting an iteration loop from commit history is pattern-inference and inherently uncertain. Use 0.4 when evidence is sparse or ambiguous, 0.5–0.6 when commit messages clearly show iterative improvement patterns.

## Output Format

Respond ONLY with a valid JSON array. Each element must match this structure:
{
  "questionId": "<question-id>",
  "score": <0|1|2>,
  "confidence": <0.3-0.7>,
  "reasoning": "<explanation of the score>",
  "evidence_summary": "<summary of evidence found or not found>"
}

Output the JSON array now:`;
}

/**
 * Build a commit history context section from bundle metadata.
 * The GitHub adapter can populate bundle.metadata.agentInstructionCommits with
 * recent commits touching agent instruction files.
 * Returns an empty string when no commit history is available.
 */
function buildCommitHistoryContext(bundle: ContentBundle): string {
  const commits = bundle.metadata?.["agentInstructionCommits"];
  if (!Array.isArray(commits) || commits.length === 0) return "";

  const lines: string[] = ["## Recent Commit History (Agent Instruction Files)"];
  for (const commit of commits.slice(0, 20)) {
    if (typeof commit === "object" && commit !== null) {
      const c = commit as Record<string, unknown>;
      const sha = typeof c["sha"] === "string" ? c["sha"].slice(0, 7) : "unknown";
      const message = typeof c["message"] === "string" ? c["message"].split("\n")[0] ?? "" : "";
      const author = typeof c["author"] === "string" ? c["author"] : "";
      const date = typeof c["date"] === "string" ? c["date"].slice(0, 10) : "";
      lines.push(`- ${sha} (${date}) [${author}]: ${message}`);
    }
  }
  lines.push("");
  return "\n" + lines.join("\n") + "\n";
}
