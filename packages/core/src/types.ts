export type DimensionId =
  | "platform-infrastructure"
  | "developer-tooling"
  | "cicd-velocity"
  | "governance-security"
  | "observability-cost"
  | "documentation-context";

export interface Question {
  id: string;
  dimensionId: DimensionId;
  text: string;
  rubric: {
    0: string;
    1: string;
    2: string;
  };
  measurementStrategy: string;
}

export interface Dimension {
  id: DimensionId;
  name: string;
  questionCount: number;
  maxScore: number;
}

export interface Tier {
  level: 1 | 2 | 3 | 4;
  label: string;
  minScore: number;
  maxScore: number;
}
