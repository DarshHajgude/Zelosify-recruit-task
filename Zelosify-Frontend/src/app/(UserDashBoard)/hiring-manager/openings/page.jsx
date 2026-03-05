"use client";
import useHMOpenings from "@/hooks/Dashboard/HiringManager/useHMOpenings";
import HMOpeningTable from "@/components/UserDashboardPage/HIRING_MANAGER/Openings/OpeningTable";
import HMOpeningsSkeleton from "@/components/UserDashboardPage/HIRING_MANAGER/Openings/OpeningsSkeleton";
import ErrorBoundary from "@/components/UI/ErrorBoundary";

export default function HMOpeningsPage() {
  const {
    openings,
    total,
    totalPages,
    currentPage,
    loading,
    error,
    goToPage,
  } = useHMOpenings(10);

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto bg-background">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Openings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review candidate profiles and AI recommendations.
          </p>
        </div>
        {!loading && total > 0 && (
          <span className="text-xs text-muted-foreground">
            {total} opening{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Content */}
      <ErrorBoundary
        title="Failed to load openings"
        description="An error occurred while rendering the openings list."
      >
        {loading ? (
          <HMOpeningsSkeleton rows={8} />
        ) : (
          <HMOpeningTable
            openings={openings}
            currentPage={currentPage}
            totalPages={totalPages}
            total={total}
            onPageChange={goToPage}
          />
        )}
      </ErrorBoundary>
    </div>
  );
}
