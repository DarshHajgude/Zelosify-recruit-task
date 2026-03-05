import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loadVendorOpenings, setPage } from "@/redux/features/vendor/openingSlice";

const useVendorOpenings = (pageSize = 10) => {
  const dispatch = useDispatch();
  const { openings, total, totalPages, currentPage, loading, error } =
    useSelector((state) => state.vendorOpenings);

  useEffect(() => {
    dispatch(loadVendorOpenings({ page: currentPage, pageSize }));
  }, [currentPage, pageSize, dispatch]);

  const goToPage = (page) => {
    dispatch(setPage(page));
  };

  return { openings, total, totalPages, currentPage, loading, error, goToPage };
};

export default useVendorOpenings;
