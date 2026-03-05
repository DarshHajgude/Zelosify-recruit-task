import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchHMOpenings } from "@/utils/Axios/hmApi";

export const loadHMOpenings = createAsyncThunk(
  "hmOpenings/load",
  async ({ page = 1, pageSize = 10 } = {}, { rejectWithValue }) => {
    try {
      return await fetchHMOpenings(page, pageSize);
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to load openings"
      );
    }
  }
);

const hmOpeningSlice = createSlice({
  name: "hmOpenings",
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
      .addCase(loadHMOpenings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadHMOpenings.fulfilled, (state, action) => {
        state.loading = false;
        state.openings = action.payload.data ?? [];
        state.total = action.payload.total ?? 0;
        state.totalPages = action.payload.totalPages ?? 0;
        state.currentPage = action.payload.page ?? 1;
      })
      .addCase(loadHMOpenings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setPage } = hmOpeningSlice.actions;
export default hmOpeningSlice.reducer;
