import type { Tier } from "./types/index.js";

export const tiers: Tier[] = [
  { level: 1, label: "AI-Curious", minScore: 0, maxScore: 17 },
  { level: 2, label: "AI-Experimenting", minScore: 18, maxScore: 35 },
  { level: 3, label: "AI-Scaling", minScore: 36, maxScore: 52 },
  { level: 4, label: "AI-Native", minScore: 53, maxScore: 70 },
];
