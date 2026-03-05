import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  fetchVendorOpeningDetail,
  presignProfiles,
  uploadProfiles,
  deleteVendorProfile,
  previewVendorProfile,
} from "@/utils/Axios/vendorApi";

// ── Thunks ────────────────────────────────────────────────────────────────────

export const loadOpeningDetail = createAsyncThunk(
  "vendorProfile/loadDetail",
  async (openingId, { rejectWithValue }) => {
    try {
      const res = await fetchVendorOpeningDetail(openingId);
      return res.data; // { opening, profiles }
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to load opening"
      );
    }
  }
);

/**
 * Full upload flow:
 *  1. presign → get tokens
 *  2. upload files + tokens to backend
 *  3. backend stores in S3 + DB, triggers AI async
 */
export const submitProfileFiles = createAsyncThunk(
  "vendorProfile/submit",
  async ({ openingId, files }, { rejectWithValue }) => {
    try {
      const filenames = files.map((f) => f.name);
      const tokens = await presignProfiles(openingId, filenames);
      const uploadTokens = tokens.map((t) => t.uploadToken);
      const result = await uploadProfiles(openingId, files, uploadTokens);
      return result.data; // array of new profiles
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Upload failed"
      );
    }
  }
);

export const removeProfile = createAsyncThunk(
  "vendorProfile/remove",
  async (profileId, { rejectWithValue }) => {
    try {
      await deleteVendorProfile(profileId);
      return profileId;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Delete failed"
      );
    }
  }
);

export const fetchPreviewUrl = createAsyncThunk(
  "vendorProfile/preview",
  async (profileId, { rejectWithValue }) => {
    try {
      const url = await previewVendorProfile(profileId);
      return { profileId, url };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Preview failed"
      );
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const profileSlice = createSlice({
  name: "vendorProfile",
  initialState: {
    opening: null,
    profiles: [],
    loading: false,
    error: null,
    uploading: false,
    uploadError: null,
    // map of profileId → presigned preview URL
    previewUrls: {},
    previewLoading: {},
  },
  reducers: {
    clearUploadError: (state) => {
      state.uploadError = null;
    },
    clearDetail: (state) => {
      state.opening = null;
      state.profiles = [];
      state.error = null;
      state.previewUrls = {};
    },
  },
  extraReducers: (builder) => {
    builder
      // loadOpeningDetail
      .addCase(loadOpeningDetail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadOpeningDetail.fulfilled, (state, action) => {
        state.loading = false;
        const { profiles, ...openingData } = action.payload;
        state.opening = openingData;
        state.profiles = profiles ?? [];
      })
      .addCase(loadOpeningDetail.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // submitProfileFiles
      .addCase(submitProfileFiles.pending, (state) => {
        state.uploading = true;
        state.uploadError = null;
      })
      .addCase(submitProfileFiles.fulfilled, (state, action) => {
        state.uploading = false;
        state.profiles = [...state.profiles, ...(action.payload ?? [])];
      })
      .addCase(submitProfileFiles.rejected, (state, action) => {
        state.uploading = false;
        state.uploadError = action.payload;
      })

      // removeProfile
      .addCase(removeProfile.fulfilled, (state, action) => {
        state.profiles = state.profiles.filter(
          (p) => p.id !== action.payload
        );
      })

      // fetchPreviewUrl
      .addCase(fetchPreviewUrl.pending, (state, action) => {
        state.previewLoading[action.meta.arg] = true;
      })
      .addCase(fetchPreviewUrl.fulfilled, (state, action) => {
        const { profileId, url } = action.payload;
        state.previewLoading[profileId] = false;
        state.previewUrls[profileId] = url;
      })
      .addCase(fetchPreviewUrl.rejected, (state, action) => {
        state.previewLoading[action.meta.arg] = false;
      });
  },
});

export const { clearUploadError, clearDetail } = profileSlice.actions;
export default profileSlice.reducer;
