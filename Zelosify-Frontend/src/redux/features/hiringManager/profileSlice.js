import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchHMProfiles, shortlistProfile, rejectProfile } from "@/utils/Axios/hmApi";

export const loadHMProfiles = createAsyncThunk(
  "hmProfiles/load",
  async (openingId, { rejectWithValue }) => {
    try {
      const res = await fetchHMProfiles(openingId);
      return res.data ?? [];
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to load profiles"
      );
    }
  }
);

export const doShortlist = createAsyncThunk(
  "hmProfiles/shortlist",
  async (profileId, { rejectWithValue }) => {
    try {
      await shortlistProfile(profileId);
      return profileId;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Shortlist failed"
      );
    }
  }
);

export const doReject = createAsyncThunk(
  "hmProfiles/reject",
  async (profileId, { rejectWithValue }) => {
    try {
      await rejectProfile(profileId);
      return profileId;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Reject failed"
      );
    }
  }
);

const hmProfileSlice = createSlice({
  name: "hmProfiles",
  initialState: {
    profiles: [],
    loading: false,
    error: null,
    // per-profile action state: { [profileId]: { loading, error } }
    actionState: {},
  },
  reducers: {
    clearProfiles: (state) => {
      state.profiles = [];
      state.error = null;
      state.actionState = {};
    },
    clearActionError: (state, action) => {
      const id = action.payload;
      if (state.actionState[id]) {
        state.actionState[id].error = null;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // loadHMProfiles
      .addCase(loadHMProfiles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadHMProfiles.fulfilled, (state, action) => {
        state.loading = false;
        state.profiles = action.payload;
      })
      .addCase(loadHMProfiles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // doShortlist
      .addCase(doShortlist.pending, (state, action) => {
        state.actionState[action.meta.arg] = { loading: true, error: null };
      })
      .addCase(doShortlist.fulfilled, (state, action) => {
        const id = action.payload;
        state.actionState[id] = { loading: false, error: null };
        const profile = state.profiles.find((p) => p.id === id);
        if (profile) profile.status = "SHORTLISTED";
      })
      .addCase(doShortlist.rejected, (state, action) => {
        state.actionState[action.meta.arg] = {
          loading: false,
          error: action.payload,
        };
      })

      // doReject
      .addCase(doReject.pending, (state, action) => {
        state.actionState[action.meta.arg] = { loading: true, error: null };
      })
      .addCase(doReject.fulfilled, (state, action) => {
        const id = action.payload;
        state.actionState[id] = { loading: false, error: null };
        const profile = state.profiles.find((p) => p.id === id);
        if (profile) profile.status = "REJECTED";
      })
      .addCase(doReject.rejected, (state, action) => {
        state.actionState[action.meta.arg] = {
          loading: false,
          error: action.payload,
        };
      });
  },
});

export const { clearProfiles, clearActionError } = hmProfileSlice.actions;
export default hmProfileSlice.reducer;
