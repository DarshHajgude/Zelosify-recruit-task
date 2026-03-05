import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loadHMOpenings, setPage } from "@/redux/features/hiringManager/openingSlice";

const useHMOpenings = (pageSize = 10) => {
  const dispatch = useDispatch();
  const { openings, total, totalPages, currentPage, loading, error } =
    useSelector((state) => state.hmOpenings);

  useEffect(() => {
    dispatch(loadHMOpenings({ page: currentPage, pageSize }));
  }, [currentPage, pageSize, dispatch]);

  const goToPage = (page) => dispatch(setPage(page));

  return { openings, total, totalPages, currentPage, loading, error, goToPage };
};

export default useHMOpenings;
