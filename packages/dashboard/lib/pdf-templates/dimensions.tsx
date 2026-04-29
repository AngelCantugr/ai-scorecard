import { Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ScorecardResult, DimensionScore, Question } from "@ai-scorecard/core";

const DIM_COLORS = [
  "#6366f1", // D1
  "#8b5cf6", // D2
  "#ec4899", // D3
  "#f59e0b", // D4
  "#10b981", // D5
  "#06b6d4", // D6
  "#f97316", // D7 (Agent Maturity)
  "#e11d48", // D8 (Eval & Quality)
];

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#0f172a",
    padding: 48,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#f8fafc",
    marginBottom: 4,
  },
  pageSub: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    paddingBottom: 14,
  },
  dimCard: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  dimHeader: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  dimName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#f1f5f9",
    flex: 1,
  },
  dimScore: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  dimScoreSub: {
    fontSize: 10,
    color: "#64748b",
  },
  barTrack: {
    height: 6,
    backgroundColor: "#0f172a",
    borderRadius: 3,
    marginBottom: 8,
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  questionRow: {
    display: "flex",
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#0f172a",
  },
  qId: {
    fontSize: 8,
    color: "#475569",
    width: 36,
    paddingTop: 1,
  },
  qScore: {
    fontSize: 9,
    fontWeight: "bold",
    width: 14,
    paddingTop: 1,
  },
  qRubric: {
    fontSize: 9,
    color: "#94a3b8",
    flex: 1,
    lineHeight: 1.4,
  },
  qConf: {
    fontSize: 8,
    color: "#475569",
    width: 28,
    textAlign: "right",
    paddingTop: 1,
  },
  evidenceText: {
    fontSize: 8,
    color: "#475569",
    marginLeft: 56,
    marginTop: 2,
    marginBottom: 2,
    fontStyle: "italic",
  },
});

function scoreColor(score: 0 | 1 | 2): string {
  if (score === 2) return "#4ade80";
  if (score === 1) return "#facc15";
  return "#f87171";
}

function DimensionCard({
  dim,
  color,
  questions,
}: {
  dim: DimensionScore;
  color: string;
  questions: Question[];
}) {
  return (
    <View style={styles.dimCard}>
      {/* Header */}
      <View style={styles.dimHeader}>
        <Text style={styles.dimName}>{dim.name}</Text>
        <View>
          <Text style={styles.dimScore}>
            {dim.score}/{dim.maxScore}
          </Text>
          <Text style={styles.dimScoreSub}>{dim.percentage}%</Text>
        </View>
      </View>

      {/* Bar */}
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${dim.percentage}%`, backgroundColor: color }]} />
      </View>

      {/* Questions */}
      {dim.questionScores.map((qs) => {
        const q = questions.find((x) => x.id === qs.questionId);
        const rubricText = q?.rubric[qs.score] ?? "";
        const evidenceSummaries = qs.evidence.filter((e) => e.summary).slice(0, 2);

        return (
          <View key={qs.questionId}>
            <View style={styles.questionRow}>
              <Text style={styles.qId}>{qs.questionId}</Text>
              <Text style={[styles.qScore, { color: scoreColor(qs.score) }]}>{qs.score}/2</Text>
              <Text style={styles.qRubric}>{rubricText}</Text>
              <Text style={styles.qConf}>{Math.round(qs.confidence * 100)}%</Text>
            </View>
            {evidenceSummaries.map((e, i) => (
              <Text key={i} style={styles.evidenceText}>
                • {e.summary}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

interface DimensionsPageProps {
  result: ScorecardResult;
  questions: Question[];
}

export function DimensionsPage({ result, questions }: DimensionsPageProps) {
  // Split into two pages — first 4 dims on page 1, last 4 on page 2
  const firstHalf = result.dimensions.slice(0, 4);
  const secondHalf = result.dimensions.slice(4);

  function renderDims(dims: DimensionScore[], startIdx: number) {
    return dims.map((dim, i) => (
      <DimensionCard
        key={dim.dimensionId}
        dim={dim}
        color={DIM_COLORS[(startIdx + i) % DIM_COLORS.length] ?? "#6366f1"}
        questions={questions}
      />
    ));
  }

  return (
    <>
      <Page size="A4" style={styles.page}>
        <Text style={styles.pageTitle}>Dimension Breakdown</Text>
        <Text style={styles.pageSub}>
          Per-dimension scores, question-level details, and evidence (1 of 2)
        </Text>
        {renderDims(firstHalf, 0)}
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.pageTitle}>Dimension Breakdown (cont.)</Text>
        <Text style={styles.pageSub}>
          Per-dimension scores, question-level details, and evidence (2 of 2)
        </Text>
        {renderDims(secondHalf, 4)}
      </Page>
    </>
  );
}
