"use client";
import useVendorOpenings from "@/hooks/Dashboard/Vendor/useVendorOpenings";
import OpeningTable from "@/components/UserDashboardPage/IT_VENDOR/Openings/OpeningTable";
import OpeningsSkeleton from "@/components/UserDashboardPage/IT_VENDOR/Openings/OpeningsSkeleton";

export default function VendorOpeningsPage() {
  const {
    openings,
    total,
    totalPages,
    currentPage,
    loading,
    error,
    goToPage,
  } = useVendorOpenings(10);

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto bg-background">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Job Openings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Browse available positions and submit candidate profiles.
          </p>
        </div>
        {!loading && total > 0 && (
          <span className="text-xs text-muted-foreground">
            {total} opening{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <OpeningsSkeleton rows={8} />
      ) : (
        <OpeningTable
          openings={openings}
          currentPage={currentPage}
          totalPages={totalPages}
          total={total}
          onPageChange={goToPage}
        />
      )}
    </div>
  );
}
