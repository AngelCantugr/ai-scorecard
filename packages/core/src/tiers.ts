import type { Tier } from "./types/index.js";

export const tiers: Tier[] = [
  { level: 1, label: "AI-Curious", minScore: 0, maxScore: 22 },
  { level: 2, label: "AI-Experimenting", minScore: 23, maxScore: 46 },
  { level: 3, label: "AI-Scaling", minScore: 47, maxScore: 69 },
  { level: 4, label: "AI-Native", minScore: 70, maxScore: 94 },
];
