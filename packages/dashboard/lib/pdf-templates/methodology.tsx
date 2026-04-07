import { Page, Text, View, StyleSheet, Link } from "@react-pdf/renderer";
import type { ScorecardResult } from "@ai-scorecard/core";

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
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#e2e8f0",
    marginBottom: 6,
  },
  cardText: {
    fontSize: 10,
    color: "#94a3b8",
    lineHeight: 1.6,
  },
  grid: {
    display: "flex",
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  gridItem: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 12,
    flex: 1,
    minWidth: 100,
  },
  gridLabel: {
    fontSize: 9,
    color: "#475569",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#f1f5f9",
  },
  link: {
    fontSize: 10,
    color: "#6366f1",
    textDecoration: "underline",
  },
  footer: {
    marginTop: "auto",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 9,
    color: "#475569",
  },
});

interface MethodologyPageProps {
  result: ScorecardResult;
}

export function MethodologyPage({ result }: MethodologyPageProps) {
  const totalQuestions = result.dimensions.reduce(
    (sum, d) => sum + d.questionScores.length,
    0,
  );

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.pageTitle}>Methodology</Text>
      <Text style={styles.pageSub}>
        How this scorecard is calculated and what it measures
      </Text>

      {/* Scoring model */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scoring Model</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>0–1–2 Rubric per Question</Text>
          <Text style={styles.cardText}>
            Each of the {totalQuestions} questions is scored on a 0–1–2 scale:{"\n"}
            {"  "}
            <Text style={{ color: "#f87171" }}>0 — Not adopted.</Text> The
            practice is absent or negligible.{"\n"}
            {"  "}
            <Text style={{ color: "#facc15" }}>1 — Partially adopted.</Text>{" "}
            Inconsistent or limited rollout.{"\n"}
            {"  "}
            <Text style={{ color: "#4ade80" }}>2 — Fully adopted.</Text> Mature,
            consistent, and measurable practice.
          </Text>
        </View>
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Questions</Text>
            <Text style={styles.gridValue}>{totalQuestions}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Dimensions</Text>
            <Text style={styles.gridValue}>{result.dimensions.length}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Max Score</Text>
            <Text style={styles.gridValue}>{result.maxScore}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Tiers</Text>
            <Text style={styles.gridValue}>4</Text>
          </View>
        </View>
      </View>

      {/* Data sources */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Sources</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Adapter: {result.metadata.adapterName}
          </Text>
          <Text style={styles.cardText}>
            Target: {result.metadata.target}
            {"\n"}
            Assessment signals were gathered by the{" "}
            {result.metadata.adapterName} adapter, which scanned repositories,
            configuration files, and workflow definitions to produce evidence for
            each question. Signals are normalized to a 0–1 confidence score
            reflecting measurement reliability.
          </Text>
        </View>
      </View>

      {/* Confidence */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Confidence Score</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>
            Each signal carries a confidence value (0–1). Direct file scans
            return high confidence (0.9–1.0). AI-inferred signals return lower
            confidence (0.4–0.6). The overall confidence is the mean across all
            signals and reflects the reliability of this assessment.
            {"\n\n"}
            This report has an overall confidence of{" "}
            <Text style={{ color: "#f8fafc", fontWeight: "bold" }}>
              {Math.round(result.overallConfidence * 100)}%
            </Text>
            . Areas below 50% confidence should be manually verified.
          </Text>
        </View>
      </View>

      {/* Link */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Open-source project · MIT License
        </Text>
        <Link
          src="https://github.com/AngelCantugr/ai-scorecard"
          style={styles.link}
        >
          github.com/AngelCantugr/ai-scorecard
        </Link>
      </View>
    </Page>
  );
}
