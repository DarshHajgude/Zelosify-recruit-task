import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  loadOpeningDetail,
  submitProfileFiles,
  removeProfile,
  fetchPreviewUrl,
  clearUploadError,
  clearDetail,
} from "@/redux/features/vendor/profileSlice";

const useVendorOpeningDetail = (openingId) => {
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
  } = useSelector((state) => state.vendorProfile);

  useEffect(() => {
    if (openingId) {
      dispatch(loadOpeningDetail(openingId));
    }
    return () => {
      dispatch(clearDetail());
    };
  }, [openingId, dispatch]);

  const handleUpload = (files) => {
    dispatch(submitProfileFiles({ openingId, files }));
  };

  const handleDelete = (profileId) => {
    dispatch(removeProfile(profileId));
  };

  const handlePreview = (profileId) => {
    if (!previewUrls[profileId]) {
      dispatch(fetchPreviewUrl(profileId));
    }
    return previewUrls[profileId];
  };

  const dismissUploadError = () => {
    dispatch(clearUploadError());
  };

  return {
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
  };
};

export default useVendorOpeningDetail;
