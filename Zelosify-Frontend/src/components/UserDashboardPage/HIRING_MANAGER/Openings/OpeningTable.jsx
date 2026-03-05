"use client";
import { useRouter } from "next/navigation";
import { MapPin, Clock, Briefcase, ChevronLeft, ChevronRight, Users, AlertCircle } from "lucide-react";

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
    OPEN: "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/40",
    CLOSED: "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/40",
    ON_HOLD: "text-yellow-700 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/40",
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${map[status] ?? ""}`}>
      {status?.replace("_", " ")}
    </span>
  );
}

function PendingChip({ count }) {
  if (count === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
      <AlertCircle className="w-3 h-3" />
      {count} pending
    </span>
  );
}

export default function HMOpeningTable({
  openings,
  currentPage,
  totalPages,
  total,
  onPageChange,
}) {
  const router = useRouter();

  if (openings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Briefcase className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-base font-medium">No openings assigned to you</p>
        <p className="text-sm mt-1">Openings will appear here once assigned.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-tableHeader">
            <tr className="border-b border-border">
              {["Title", "Location", "Contract Type", "Experience", "Posted", "Profiles", "Pending Review", "Status", ""].map(
                (h) => (
                  <th key={h} className="px-4 py-3 text-left text-sm font-medium text-primary">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {openings.map((opening) => (
              <tr
                key={opening.id}
                className="border-b border-border hover:bg-tableHeader cursor-pointer transition-colors"
                onClick={() => router.push(`/hiring-manager/openings/${opening.id}`)}
              >
                <td className="px-4 py-4">
                  <div className="text-sm font-medium text-foreground">{opening.title}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1 text-xs text-foreground">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {opening.location ?? "—"}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1 text-xs text-foreground">
                    <Clock className="w-3 h-3 shrink-0" />
                    {opening.contractType ?? "—"}
                  </div>
                </td>
                <td className="px-4 py-4 text-xs text-foreground">
                  {opening.experienceMin}
                  {opening.experienceMax ? `–${opening.experienceMax}` : "+"}
                  {" "}yrs
                </td>
                <td className="px-4 py-4 text-xs text-foreground">
                  {formatDate(opening.postedDate)}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-1 text-xs text-foreground">
                    <Users className="w-3 h-3" />
                    {opening.totalProfiles ?? 0}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <PendingChip count={opening.pendingReview ?? 0} />
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={opening.status} />
                </td>
                <td
                  className="px-4 py-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/hiring-manager/openings/${opening.id}`);
                  }}
                >
                  <button className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-80 transition-opacity">
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {currentPage} of {totalPages} ({total} openings)
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="p-1.5 rounded border border-border disabled:opacity-40 hover:bg-tableHeader"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`px-2.5 py-1 rounded border text-xs transition-colors ${
                  p === currentPage
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:bg-tableHeader"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="p-1.5 rounded border border-border disabled:opacity-40 hover:bg-tableHeader"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
