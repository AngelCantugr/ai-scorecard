"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface ShareButtonProps {
  /** The query string (without leading ?) to append to the current URL */
  encodedQuery: string;
}

export function ShareButton({ encodedQuery }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}/results?${encodedQuery}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for non-HTTPS contexts (e.g., HTTP development environments)
      // where the Clipboard API requires a secure context.
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div className="relative inline-flex flex-col items-end gap-1">
      <Button variant="secondary" size="sm" onClick={handleShare}>
        🔗 {copied ? "Copied!" : "Share Results"}
      </Button>
      {copied && (
        <span
          role="status"
          className="absolute top-full mt-1 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs text-green-400 shadow-lg"
        >
          Link copied to clipboard!
        </span>
      )}
    </div>
  );
}
