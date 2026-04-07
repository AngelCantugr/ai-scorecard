/**
 * Client-side PDF generation for the AI Adoption Scorecard.
 * Uses @react-pdf/renderer to produce a professional multi-page PDF report.
 */
import { createElement } from "react";
import { Document, pdf } from "@react-pdf/renderer";
import type { ScorecardResult } from "@ai-scorecard/core";
import { questions, getUnaddressedQuestions, getLowConfidenceQuestions } from "@ai-scorecard/core";

import { CoverPage } from "./pdf-templates/cover";
import { SummaryPage } from "./pdf-templates/summary";
import { DimensionsPage } from "./pdf-templates/dimensions";
import { GapsPage } from "./pdf-templates/gaps";
import { MethodologyPage } from "./pdf-templates/methodology";

/**
 * Builds the React element tree for the full scorecard PDF.
 */
function buildDocument(result: ScorecardResult) {
  const unaddressed = getUnaddressedQuestions(result);
  const lowConfidence = getLowConfidenceQuestions(result, 0.5);

  return createElement(Document, { title: "AI Adoption Scorecard" },
    createElement(CoverPage, { result }),
    createElement(SummaryPage, { result }),
    createElement(DimensionsPage, { result, questions }),
    createElement(GapsPage, { result, questions, unaddressed, lowConfidence }),
    createElement(MethodologyPage, { result }),
  );
}

/**
 * Generates and downloads a PDF report for the given scorecard result.
 * Runs entirely client-side — no data leaves the browser.
 *
 * @param result - The ScorecardResult from the scoring engine
 */
export async function downloadPdf(result: ScorecardResult): Promise<void> {
  const doc = buildDocument(result);
  const blob = await pdf(doc).toBlob();

  // Build filename: ai-scorecard-{org}-{date}.pdf
  const orgSlug = result.metadata.target
    .replace(/[^a-z0-9]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const dateStr = new Date(result.assessedAt)
    .toISOString()
    .slice(0, 10); // YYYY-MM-DD
  const filename = `ai-scorecard-${orgSlug}-${dateStr}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
