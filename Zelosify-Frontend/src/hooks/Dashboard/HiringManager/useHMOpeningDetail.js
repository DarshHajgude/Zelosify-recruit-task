import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  loadHMProfiles,
  doShortlist,
  doReject,
  clearProfiles,
  clearActionError,
} from "@/redux/features/hiringManager/profileSlice";

const useHMOpeningDetail = (openingId) => {
  const dispatch = useDispatch();
  const { profiles, loading, error, actionState } = useSelector(
    (state) => state.hmProfiles
  );

  useEffect(() => {
    if (openingId) {
      dispatch(loadHMProfiles(openingId));
    }
    return () => {
      dispatch(clearProfiles());
    };
  }, [openingId, dispatch]);

  const handleShortlist = (profileId) => dispatch(doShortlist(profileId));
  const handleReject = (profileId) => dispatch(doReject(profileId));
  const dismissActionError = (profileId) => dispatch(clearActionError(profileId));

  return {
    profiles,
    loading,
    error,
    actionState,
    handleShortlist,
    handleReject,
    dismissActionError,
  };
};

export default useHMOpeningDetail;
