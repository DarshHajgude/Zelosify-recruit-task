import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchVendorOpenings } from "@/utils/Axios/vendorApi";

export const loadVendorOpenings = createAsyncThunk(
  "vendorOpenings/load",
  async ({ page = 1, pageSize = 10 } = {}, { rejectWithValue }) => {
    try {
      return await fetchVendorOpenings(page, pageSize);
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to load openings"
      );
    }
  }
);

const openingSlice = createSlice({
  name: "vendorOpenings",
  initialState: {
    openings: [],
    total: 0,
    totalPages: 0,
    currentPage: 1,
    loading: false,
    error: null,
  },
  reducers: {
    setPage: (state, action) => {
      state.currentPage = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadVendorOpenings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadVendorOpenings.fulfilled, (state, action) => {
        state.loading = false;
        state.openings = action.payload.data ?? [];
        state.total = action.payload.total ?? 0;
        state.totalPages = action.payload.totalPages ?? 0;
        state.currentPage = action.payload.page ?? 1;
      })
      .addCase(loadVendorOpenings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setPage } = openingSlice.actions;
export default openingSlice.reducer;
