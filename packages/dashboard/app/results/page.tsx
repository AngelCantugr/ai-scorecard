"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ScorecardResult } from "@ai-scorecard/core";
import { encodeResults, decodeResults } from "@ai-scorecard/core";
import { ScoreCard } from "@/components/ScoreCard";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ShareButton } from "@/components/Share/ShareButton";
import { SharedBanner } from "@/components/Share/SharedBanner";

export default function ResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [result, setResult] = useState<ScorecardResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isShared, setIsShared] = useState(false);
  const [encodedQuery, setEncodedQuery] = useState<string | null>(null);

  const handleDownloadPdf = useCallback(async () => {
    if (!result) return;
    setPdfError(null);
    setPdfLoading(true);
    try {
      // Dynamic import keeps @react-pdf/renderer out of the initial bundle
      // and avoids SSR issues with Next.js
      const { downloadPdf } = await import("@/lib/pdf");
      await downloadPdf(result);
    } catch (err) {
      console.error("PDF generation failed:", err);
      setPdfError("PDF generation failed. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  }, [result]);

  useEffect(() => {
    // Check for shared URL params first
    const scoresParam = searchParams.get("s");
    if (scoresParam) {
      try {
        const decoded = decodeResults(searchParams.toString());
        setResult(decoded);
        setIsShared(true);
        setEncodedQuery(searchParams.toString());
      } catch (err) {
        setError(
          `Invalid shared link: ${err instanceof Error ? err.message : "Unknown error"}. Please run a new assessment.`
        );
      }
      return;
    }

    // Fall back to sessionStorage for normal assessment flow
    try {
      const raw = sessionStorage.getItem("scorecard_result");
      if (!raw) {
        setError("No scorecard data found. Please run an assessment first.");
        return;
      }
      const parsed = JSON.parse(raw) as ScorecardResult;
      setResult(parsed);
      setEncodedQuery(encodeResults(parsed));
    } catch {
      setError("Failed to parse scorecard data.");
    }
  }, [searchParams]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="text-slate-300">{error}</p>
        <Button onClick={() => router.push("/assess")}>← Run Assessment</Button>
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
      {isShared && (
        <SharedBanner
          org={result.metadata.target}
          date={result.assessedAt}
        />
      )}

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Assessment Results</h1>
          <p className="mt-1 text-slate-400">
            AI maturity scorecard for{" "}
            <span className="font-medium text-white">{result.metadata.target}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            size="sm"
            loading={pdfLoading}
            onClick={() => {
              void handleDownloadPdf();
            }}
            title="Download PDF report"
          >
            📄 {pdfLoading ? "Generating…" : "Download PDF"}
          </Button>
          {encodedQuery ? (
            <ShareButton encodedQuery={encodedQuery} />
          ) : (
            <Button variant="secondary" size="sm" disabled>
              🔗 Share
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => router.push("/assess")}>
            ← New Assessment
          </Button>
        </div>
        {pdfError && <p className="text-sm text-red-400">{pdfError}</p>}
      </div>

      <ScoreCard result={result} />
    </div>
  );
}
