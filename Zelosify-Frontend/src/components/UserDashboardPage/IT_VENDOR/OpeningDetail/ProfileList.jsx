"use client";
import { Trash2, Eye, FileText, Loader2 } from "lucide-react";

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
    SUBMITTED: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/40",
    SHORTLISTED: "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/40",
    REJECTED: "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/40",
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${map[status] ?? ""}`}>
      {status}
    </span>
  );
}

export default function ProfileList({
  profiles,
  previewUrls,
  previewLoading,
  onDelete,
  onPreview,
}) {
  if (!profiles || profiles.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-muted-foreground">
        <FileText className="w-8 h-8 mb-3 opacity-30" />
        <p className="text-sm">No profiles submitted yet.</p>
      </div>
    );
  }

  const handlePreviewClick = (e, profile) => {
    e.stopPropagation();
    const existingUrl = previewUrls[profile.id];
    if (existingUrl) {
      window.open(existingUrl, "_blank", "noopener");
    } else {
      // Trigger fetch; hook will update previewUrls
      onPreview(profile.id);
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-tableHeader">
          <tr className="border-b border-border">
            {["File", "Submitted", "Status", "Actions"].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-sm font-medium text-primary"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile) => {
            const isPreviewing = previewLoading?.[profile.id];
            const previewUrl = previewUrls?.[profile.id];

            // Auto-open once URL is loaded
            if (previewUrl && isPreviewing === false) {
              // URL just became available — handled via effect in parent
            }

            return (
              <tr
                key={profile.id}
                className="border-b border-border hover:bg-tableHeader transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground">
                      {profile.filename ?? profile.s3Key?.split("/").pop() ?? "Resume"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-foreground">
                  {formatDate(profile.submittedAt)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={profile.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {/* Preview */}
                    <button
                      onClick={(e) => handlePreviewClick(e, profile)}
                      disabled={isPreviewing}
                      className="p-1.5 rounded hover:bg-border transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                      title={previewUrl ? "Open preview" : "Load preview"}
                    >
                      {isPreviewing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Delete — only for SUBMITTED */}
                    {profile.status === "SUBMITTED" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(profile.id);
                        }}
                        className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-muted-foreground hover:text-red-600"
                        title="Delete profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
