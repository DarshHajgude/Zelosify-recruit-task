"use client";
import { useState } from "react";
import { FileText, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { BadgePill, ScoreCard } from "./RecommendationBadge";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }) {
  const map = {
    SUBMITTED: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700",
    SHORTLISTED: "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/40 border border-green-200 dark:border-green-700",
    REJECTED: "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/40 border border-red-200 dark:border-red-700",
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${map[status] ?? ""}`}>
      {status}
    </span>
  );
}

export default function ProfileCard({
  profile,
  actionState,
  onShortlist,
  onReject,
  onDismissError,
}) {
  const [expanded, setExpanded] = useState(false);

  const state = actionState?.[profile.id] ?? { loading: false, error: null };
  const isActioning = state.loading;
  const actionError = state.error;
  const isFinalized = profile.status === "SHORTLISTED" || profile.status === "REJECTED";

  return (
    <div className="border border-border rounded-lg p-4 flex flex-col gap-3 bg-background hover:border-foreground/20 transition-colors">
      {/* Top row: filename + status + date */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground truncate">
            {profile.filename}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={profile.status} />
        </div>
      </div>

      {/* Submitted date + uploader */}
      <div className="text-xs text-muted-foreground">
        Submitted {formatDate(profile.submittedAt)}
        {profile.uploadedBy && (
          <span className="ml-2 text-foreground/60">by {profile.uploadedBy.slice(0, 8)}…</span>
        )}
      </div>

      {/* AI Score section */}
      <div className="border-t border-border pt-3">
        <ScoreCard
          badge={profile.badge}
          score={profile.recommendationScore}
          confidence={profile.recommendationConfidence}
          latencyMs={profile.recommendationLatencyMs}
        />
      </div>

      {/* Reason — expandable */}
      {profile.recommendationReason && (
        <div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Hide" : "Show"} AI reasoning
          </button>
          {expanded && (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed p-2 bg-tableHeader rounded-md">
              {profile.recommendationReason}
            </p>
          )}
        </div>
      )}

      {/* Action error */}
      {actionError && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <span className="text-xs text-red-700 dark:text-red-400 flex-1">{actionError}</span>
          <button
            onClick={() => onDismissError(profile.id)}
            className="text-xs text-red-400 hover:text-red-600 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Shortlist / Reject buttons */}
      {!isFinalized && (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onShortlist(profile.id)}
            disabled={isActioning}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50"
          >
            {isActioning ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCircle className="w-3 h-3" />
            )}
            Shortlist
          </button>
          <button
            onClick={() => onReject(profile.id)}
            disabled={isActioning}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
          >
            {isActioning ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <XCircle className="w-3 h-3" />
            )}
            Reject
          </button>
        </div>
      )}

      {/* Finalized state chip */}
      {isFinalized && (
        <div className={`text-center text-xs py-1.5 rounded-md ${
          profile.status === "SHORTLISTED"
            ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
            : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
        }`}>
          {profile.status === "SHORTLISTED" ? "Shortlisted" : "Rejected"}
        </div>
      )}
    </div>
  );
}
