"use client";

const BADGE_STYLES = {
  Recommended: {
    pill: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-700",
    bar: "bg-green-500",
    dot: "bg-green-500",
  },
  Borderline: {
    pill: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700",
    bar: "bg-yellow-500",
    dot: "bg-yellow-500",
  },
  "Not Recommended": {
    pill: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-700",
    bar: "bg-red-500",
    dot: "bg-red-500",
  },
  Pending: {
    pill: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-600",
    bar: "bg-gray-300 dark:bg-gray-600",
    dot: "bg-gray-400",
  },
};

/**
 * Compact pill badge — use in tables.
 */
export function BadgePill({ badge }) {
  const styles = BADGE_STYLES[badge] ?? BADGE_STYLES.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${styles.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
      {badge}
    </span>
  );
}

/**
 * Full score display card — use inside profile detail/card.
 */
export function ScoreCard({ badge, score, confidence, latencyMs }) {
  const styles = BADGE_STYLES[badge] ?? BADGE_STYLES.Pending;
  const scorePercent = score !== null ? Math.round(score * 100) : null;
  const confidencePercent = confidence !== null ? Math.round(confidence * 100) : null;

  return (
    <div className="flex flex-col gap-2">
      <BadgePill badge={badge} />

      {scorePercent !== null && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Match Score</span>
            <span className="font-semibold text-foreground">{scorePercent}%</span>
          </div>
          <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${styles.bar}`}
              style={{ width: `${scorePercent}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {confidencePercent !== null && (
          <span>
            Confidence: <span className="font-medium text-foreground">{confidencePercent}%</span>
          </span>
        )}
        {latencyMs !== null && (
          <span>
            Processed in: <span className="font-medium text-foreground">{latencyMs}ms</span>
          </span>
        )}
      </div>
    </div>
  );
}
