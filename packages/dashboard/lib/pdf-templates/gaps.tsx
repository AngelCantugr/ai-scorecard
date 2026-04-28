import { Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ScorecardResult, QuestionScore, Question } from "@ai-scorecard/core";

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
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#94a3b8",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  section: {
    marginBottom: 20,
  },
  gapItem: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    display: "flex",
    flexDirection: "row",
    gap: 10,
  },
  gapId: {
    fontSize: 9,
    color: "#475569",
    width: 40,
    paddingTop: 2,
  },
  gapContent: {
    flex: 1,
  },
  gapQuestion: {
    fontSize: 10,
    color: "#e2e8f0",
    marginBottom: 4,
    lineHeight: 1.4,
  },
  gapAction: {
    fontSize: 9,
    color: "#94a3b8",
    lineHeight: 1.4,
    fontStyle: "italic",
  },
  lowConfItem: {
    backgroundColor: "#1e293b",
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
    display: "flex",
    flexDirection: "row",
    gap: 8,
  },
  lowConfId: {
    fontSize: 9,
    color: "#475569",
    width: 40,
  },
  lowConfText: {
    fontSize: 10,
    color: "#94a3b8",
    flex: 1,
    lineHeight: 1.4,
  },
  lowConfPct: {
    fontSize: 10,
    color: "#facc15",
    width: 32,
    textAlign: "right",
  },
  nextStepItem: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  nextStepDim: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#6366f1",
    marginBottom: 4,
  },
  nextStepText: {
    fontSize: 10,
    color: "#94a3b8",
    lineHeight: 1.5,
  },
  emptyNote: {
    fontSize: 11,
    color: "#475569",
    fontStyle: "italic",
  },
});

function generateNextStep(dimName: string, percentage: number, unaddressedCount: number): string {
  if (percentage >= 75) {
    return `${dimName} is performing well. Focus on sustaining gains and sharing practices across teams.`;
  }
  if (percentage >= 50) {
    return `${dimName} is progressing. Prioritize the ${unaddressedCount} unanswered question(s) and improve consistency.`;
  }
  return `${dimName} needs significant investment. Start with foundational tooling and governance before optimizing.`;
}

interface GapsPageProps {
  result: ScorecardResult;
  questions: Question[];
  unaddressed: QuestionScore[];
  lowConfidence: QuestionScore[];
}

export function GapsPage({ result, questions, unaddressed, lowConfidence }: GapsPageProps) {
  // Build a O(1) lookup from questionId → dimensionId to avoid nested iteration
  const questionToDimension = new Map<string, string>();
  for (const dim of result.dimensions) {
    for (const qs of dim.questionScores) {
      questionToDimension.set(qs.questionId, dim.dimensionId);
    }
  }

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.pageTitle}>Gap Analysis &amp; Recommendations</Text>
      <Text style={styles.pageSub}>
        Areas requiring attention, confidence gaps, and suggested next steps
      </Text>

      {/* Unaddressed questions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Unaddressed Questions ({unaddressed.length})</Text>
        {unaddressed.length === 0 && (
          <Text style={styles.emptyNote}>
            No questions scored 0 with confirmed measurement. Great coverage!
          </Text>
        )}
        {unaddressed.slice(0, 8).map((qs) => {
          const q = questions.find((x) => x.id === qs.questionId);
          return (
            <View key={qs.questionId} style={styles.gapItem}>
              <Text style={styles.gapId}>{qs.questionId}</Text>
              <View style={styles.gapContent}>
                <Text style={styles.gapQuestion}>{q?.text ?? qs.questionId}</Text>
                <Text style={styles.gapAction}>
                  Recommended:{" "}
                  {q?.measurementStrategy ?? "Review and implement the relevant practice."}
                </Text>
              </View>
            </View>
          );
        })}
        {unaddressed.length > 8 && (
          <Text style={styles.emptyNote}>
            … and {unaddressed.length - 8} more. Full list in dimension pages.
          </Text>
        )}
      </View>

      {/* Low confidence areas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Low-Confidence Areas to Verify ({lowConfidence.length})
        </Text>
        {lowConfidence.length === 0 && (
          <Text style={styles.emptyNote}>
            All measurements have acceptable confidence. No manual verification required.
          </Text>
        )}
        {lowConfidence.slice(0, 6).map((qs) => {
          const q = questions.find((x) => x.id === qs.questionId);
          return (
            <View key={qs.questionId} style={styles.lowConfItem}>
              <Text style={styles.lowConfId}>{qs.questionId}</Text>
              <Text style={styles.lowConfText}>{q?.text ?? qs.questionId}</Text>
              <Text style={styles.lowConfPct}>{Math.round(qs.confidence * 100)}%</Text>
            </View>
          );
        })}
      </View>

      {/* Suggested next steps per dimension */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Suggested Next Steps by Dimension</Text>
        {result.dimensions.map((dim) => {
          const dimUnaddressed = unaddressed.filter(
            (qs) => questionToDimension.get(qs.questionId) === dim.dimensionId
          ).length;
          return (
            <View key={dim.dimensionId} style={styles.nextStepItem}>
              <Text style={styles.nextStepDim}>
                {dim.name} · {dim.percentage}%
              </Text>
              <Text style={styles.nextStepText}>
                {generateNextStep(dim.name, dim.percentage, dimUnaddressed)}
              </Text>
            </View>
          );
        })}
      </View>
    </Page>
  );
}
