"use client";
import { use, useEffect } from "react";
import { useDispatch } from "react-redux";
import useVendorOpeningDetail from "@/hooks/Dashboard/Vendor/useVendorOpeningDetail";
import OpeningDetailLayout from "@/components/UserDashboardPage/IT_VENDOR/OpeningDetail/OpeningDetailLayout";
import { fetchPreviewUrl } from "@/redux/features/vendor/profileSlice";
import ErrorBoundary from "@/components/UI/ErrorBoundary";

export default function VendorOpeningDetailPage({ params }) {
  const { id } = use(params);
  const dispatch = useDispatch();

  const {
    opening,
    profiles,
    loading,
    error,
    uploading,
    uploadError,
    previewUrls,
    previewLoading,
    handleUpload,
    handleDelete,
    handlePreview,
    dismissUploadError,
  } = useVendorOpeningDetail(id);

  // Auto-open preview tab once the URL loads
  useEffect(() => {
    Object.entries(previewUrls).forEach(([profileId, url]) => {
      if (url && previewLoading[profileId] === false) {
        // Mark as "shown" to avoid re-opening on re-render
        // We use a sessionStorage key so we don't re-open on hot-reload
        const key = `preview_opened_${profileId}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          window.open(url, "_blank", "noopener");
        }
      }
    });
  }, [previewUrls, previewLoading]);

  const handlePreviewClick = (profileId) => {
    // If URL already loaded, open immediately
    if (previewUrls[profileId]) {
      window.open(previewUrls[profileId], "_blank", "noopener");
    } else {
      // Dispatch fetch; useEffect above will auto-open when it resolves
      dispatch(fetchPreviewUrl(profileId));
    }
  };

  return (
    <ErrorBoundary
      title="Failed to load opening detail"
      description="An error occurred while rendering this page. Try refreshing."
    >
      <OpeningDetailLayout
        opening={opening}
        profiles={profiles}
        loading={loading}
        error={error}
        uploading={uploading}
        uploadError={uploadError}
        previewUrls={previewUrls}
        previewLoading={previewLoading}
        onUpload={handleUpload}
        onDelete={handleDelete}
        onPreview={handlePreviewClick}
        onDismissError={dismissUploadError}
      />
    </ErrorBoundary>
  );
}
