import type { Dimension } from "./types.js";

export const dimensions: Dimension[] = [
  {
    id: "platform-infrastructure",
    name: "Platform & Infrastructure",
    questionCount: 6,
    maxScore: 12,
  },
  {
    id: "developer-tooling",
    name: "Developer Tooling & Adoption",
    questionCount: 7,
    maxScore: 14,
  },
  {
    id: "cicd-velocity",
    name: "CI/CD & Velocity",
    questionCount: 6,
    maxScore: 12,
  },
  {
    id: "governance-security",
    name: "Governance & Security",
    questionCount: 5,
    maxScore: 10,
  },
  {
    id: "observability-cost",
    name: "Observability & Cost",
    questionCount: 6,
    maxScore: 12,
  },
  {
    id: "documentation-context",
    name: "Documentation & Context Engineering",
    questionCount: 5,
    maxScore: 10,
  },
];
