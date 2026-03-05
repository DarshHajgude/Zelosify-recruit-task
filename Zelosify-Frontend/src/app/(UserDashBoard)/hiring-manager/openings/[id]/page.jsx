"use client";
import { use } from "react";
import { useSelector } from "react-redux";
import useHMOpeningDetail from "@/hooks/Dashboard/HiringManager/useHMOpeningDetail";
import OpeningDetailLayout from "@/components/UserDashboardPage/HIRING_MANAGER/OpeningDetail/OpeningDetailLayout";
import ErrorBoundary from "@/components/UI/ErrorBoundary";

export default function HMOpeningDetailPage({ params }) {
  const { id } = use(params);

  // Look up opening info from already-loaded list (if available)
  const opening = useSelector((state) =>
    state.hmOpenings.openings.find((o) => o.id === id)
  );

  const {
    profiles,
    loading,
    error,
    actionState,
    handleShortlist,
    handleReject,
    dismissActionError,
  } = useHMOpeningDetail(id);

  return (
    <div className="h-full bg-background">
      <ErrorBoundary
        title="Failed to load opening detail"
        description="An error occurred while rendering the profile list. Try refreshing the page."
      >
        <OpeningDetailLayout
          opening={opening}
          profiles={profiles}
          loading={loading}
          error={error}
          actionState={actionState}
          onShortlist={handleShortlist}
          onReject={handleReject}
          onDismissError={dismissActionError}
        />
      </ErrorBoundary>
    </div>
  );
}
