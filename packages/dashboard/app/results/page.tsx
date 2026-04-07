"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ScorecardResult } from "@ai-scorecard/core";
import { ScoreCard } from "@/components/ScoreCard";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<ScorecardResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadPdf = useCallback(async () => {
    if (!result) return;
    setPdfLoading(true);
    try {
      // Dynamic import keeps @react-pdf/renderer out of the initial bundle
      // and avoids SSR issues with Next.js
      const { downloadPdf } = await import("@/lib/pdf");
      await downloadPdf(result);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setPdfLoading(false);
    }
  }, [result]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("scorecard_result");
      if (!raw) {
        setError("No scorecard data found. Please run an assessment first.");
        return;
      }
      const parsed = JSON.parse(raw) as ScorecardResult;
      setResult(parsed);
    } catch {
      setError("Failed to parse scorecard data.");
    }
  }, []);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="text-slate-300">{error}</p>
        <Button onClick={() => router.push("/assess")}>
          ← Run Assessment
        </Button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner label="Loading results…" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Assessment Results</h1>
          <p className="mt-1 text-slate-400">
            AI maturity scorecard for{" "}
            <span className="font-medium text-white">
              {result.metadata.target}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            size="sm"
            loading={pdfLoading}
            onClick={() => { void handleDownloadPdf(); }}
            title="Download PDF report"
          >
            📄 {pdfLoading ? "Generating…" : "Download PDF"}
          </Button>
          {/* Share button placeholder — implemented in issue #13 */}
          <Button
            variant="secondary"
            size="sm"
            disabled
            title="Share link coming soon (issue #13)"
          >
            🔗 Share
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/assess")}
          >
            ← New Assessment
          </Button>
        </div>
      </div>

      {/* ScoreCard — full visualization implemented in issue #11 */}
      <ScoreCard result={result} />
    </div>
  );
}
