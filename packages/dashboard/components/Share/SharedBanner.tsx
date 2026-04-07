interface SharedBannerProps {
  /** Organization/target that was assessed */
  org: string;
  /** The date of the assessment */
  date: Date | string;
}

export function SharedBanner({ org, date }: SharedBannerProps) {
  const formattedDate = new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      role="status"
      className="mb-6 rounded-lg border border-indigo-700/50 bg-indigo-900/30 px-4 py-3 text-sm text-indigo-200"
    >
      <span className="mr-1">🔗</span>
      Viewing shared results for{" "}
      <span className="font-semibold text-white">{org}</span> from{" "}
      <span className="font-semibold text-white">{formattedDate}</span>.
      Confidence and evidence are not available in shared view.
    </div>
  );
}
