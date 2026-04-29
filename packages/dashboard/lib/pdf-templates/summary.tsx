import { Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ScorecardResult } from "@ai-scorecard/core";

const TIER_COLORS: Record<number, string> = {
  1: "#94a3b8",
  2: "#facc15",
  3: "#60a5fa",
  4: "#4ade80",
};

const TIER_DESCRIPTIONS: Record<number, string> = {
  1: "Early-stage AI adoption. Individual experiments but no coordinated strategy or shared infrastructure.",
  2: "Active experimentation underway. Some tooling exists but adoption is inconsistent across teams.",
  3: "AI is embedded in core workflows. Governance, tooling, and observability are maturing.",
  4: "AI-first engineering culture. Deep integration, strong governance, measurable productivity gains.",
};

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
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    paddingBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#94a3b8",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  scoreRow: {
    display: "flex",
    flexDirection: "row",
    gap: 24,
    marginBottom: 8,
  },
  metricBox: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 12,
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    color: "#64748b",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  metricSub: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 2,
  },
  tierBox: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 12,
    flex: 2,
  },
  tierLabel: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  tierDesc: {
    fontSize: 10,
    color: "#94a3b8",
    lineHeight: 1.5,
  },
  listItem: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  bullet: {
    fontSize: 11,
    color: "#6366f1",
    width: 12,
  },
  listText: {
    fontSize: 11,
    color: "#cbd5e1",
    flex: 1,
    lineHeight: 1.4,
  },
  strengthBullet: {
    fontSize: 11,
    color: "#4ade80",
    width: 12,
  },
  gapBullet: {
    fontSize: 11,
    color: "#f87171",
    width: 12,
  },
  strengthText: {
    fontSize: 11,
    color: "#cbd5e1",
    flex: 1,
    lineHeight: 1.4,
  },
  gapText: {
    fontSize: 11,
    color: "#cbd5e1",
    flex: 1,
    lineHeight: 1.4,
  },
  confidenceRow: {
    display: "flex",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 10,
  },
  confidenceLabel: {
    fontSize: 10,
    color: "#94a3b8",
    flex: 1,
  },
  confidenceValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#f8fafc",
  },
});

interface SummaryPageProps {
  result: ScorecardResult;
}

export function SummaryPage({ result }: SummaryPageProps) {
  const tierColor = TIER_COLORS[result.tier.level] ?? "#f8fafc";
  const tierDesc =
    TIER_DESCRIPTIONS[result.tier.level] ??
    "Maturity assessment based on 47 questions across 8 dimensions.";

  const sortedDims = [...result.dimensions].sort((a, b) => b.percentage - a.percentage);
  const strengths = sortedDims.slice(0, 3);
  const gaps = sortedDims.slice(-3).reverse();

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.pageTitle}>Executive Summary</Text>
      <Text style={styles.pageSub}>High-level view of AI adoption maturity and key findings</Text>

      {/* Score overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overall Performance</Text>
        <View style={styles.scoreRow}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Total Score</Text>
            <Text style={styles.metricValue}>
              {result.totalScore}/{result.maxScore}
            </Text>
            <Text style={styles.metricSub}>{result.percentage}% of maximum</Text>
          </View>
          <View style={styles.tierBox}>
            <Text style={styles.metricLabel}>Maturity Tier</Text>
            <Text style={[styles.tierLabel, { color: tierColor }]}>
              Tier {result.tier.level}: {result.tier.label}
            </Text>
            <Text style={styles.tierDesc}>{tierDesc}</Text>
          </View>
        </View>
      </View>

      {/* Strengths */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top 3 Strengths</Text>
        {strengths.map((dim) => (
          <View key={dim.dimensionId} style={styles.listItem}>
            <Text style={styles.strengthBullet}>▲</Text>
            <Text style={styles.strengthText}>
              {dim.name} — {dim.score}/{dim.maxScore} ({dim.percentage}%)
            </Text>
          </View>
        ))}
      </View>

      {/* Gaps */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top 3 Gaps</Text>
        {gaps.map((dim) => (
          <View key={dim.dimensionId} style={styles.listItem}>
            <Text style={styles.gapBullet}>▼</Text>
            <Text style={styles.gapText}>
              {dim.name} — {dim.score}/{dim.maxScore} ({dim.percentage}%)
            </Text>
          </View>
        ))}
      </View>

      {/* Confidence */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Assessment Confidence</Text>
        <View style={styles.confidenceRow}>
          <Text style={styles.confidenceLabel}>
            Overall confidence is a weighted average of per-signal confidence scores. Higher
            confidence means the assessment relied on direct measurements rather than inference.
          </Text>
          <Text style={styles.confidenceValue}>{Math.round(result.overallConfidence * 100)}%</Text>
        </View>
      </View>
    </Page>
  );
}
