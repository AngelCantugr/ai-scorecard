import type {
  Adapter,
  AdapterConfig,
  DimensionId,
  DimensionScore,
  Evidence,
  Question,
  QuestionScore,
  ScorecardResult,
  Signal,
  SignalResult,
  Tier,
  TierLevel,
} from "@ai-scorecard/core";
import { encodeResults, decodeResults, SHARE_VERSION } from "@ai-scorecard/core";

const config: AdapterConfig = {
  token: "test-token",
};

const signal: Signal = {
  id: "signal-1",
  questionId: "D1-Q1",
  description: "Checks whether the adapter root import resolves correctly.",
};

const evidence: Evidence = {
  source: "unit-test",
  data: { source: "fixture" },
  summary: "Synthetic evidence for the root type export contract.",
};

const signalResult: SignalResult = {
  signalId: signal.id,
  questionId: signal.questionId,
  score: 2,
  evidence: [evidence],
  confidence: 1,
};

const adapter: Adapter = {
  name: "test-adapter",
  signals: [signal],
  async connect(_adapterConfig: AdapterConfig): Promise<void> {
    void _adapterConfig;
  },
  async collect(): Promise<SignalResult[]> {
    return [signalResult];
  },
};

const dimensionId: DimensionId = "platform-infrastructure";

const question: Question = {
  id: signal.questionId,
  dimensionId,
  text: "Is the new public type surface available from the package root?",
  rubric: {
    0: "Not exported",
    1: "Partially exported",
    2: "Exported from the package root",
  },
  measurementStrategy: "Compile a consumer-style type import.",
};

const questionScore: QuestionScore = {
  questionId: question.id,
  score: signalResult.score,
  confidence: signalResult.confidence,
  evidence: signalResult.evidence,
};

const dimensionScore: DimensionScore = {
  dimensionId,
  name: "Platform & Infrastructure",
  score: 2,
  maxScore: 2,
  percentage: 100,
  questionScores: [questionScore],
};

const tierLevel: TierLevel = 1;

const tier: Tier = {
  level: tierLevel,
  label: "AI-Curious",
  minScore: 0,
  maxScore: 10,
};

const scorecardResult: ScorecardResult = {
  totalScore: 2,
  maxScore: 2,
  percentage: 100,
  tier,
  dimensions: [dimensionScore],
  overallConfidence: 1,
  assessedAt: new Date("2026-01-01T00:00:00.000Z"),
  metadata: {
    adapterName: adapter.name,
    target: config.token as string,
  },
};

void scorecardResult;

// Verify share functions are exported and correctly typed
const _encode: (r: ScorecardResult) => string = encodeResults;
const _decode: (s: string) => ScorecardResult = decodeResults;
const _version: string = SHARE_VERSION;
void _encode;
void _decode;
void _version;
