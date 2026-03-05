import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/redux/features/Auth/authSlice";
import vendorOpeningReducer from "@/redux/features/vendor/openingSlice";
import vendorProfileReducer from "@/redux/features/vendor/profileSlice";
import hmOpeningReducer from "@/redux/features/hiringManager/openingSlice";
import hmProfileReducer from "@/redux/features/hiringManager/profileSlice";

const store = configureStore({
  reducer: {
    auth: authReducer,
    vendorOpenings: vendorOpeningReducer,
    vendorProfile: vendorProfileReducer,
    hmOpenings: hmOpeningReducer,
    hmProfiles: hmProfileReducer,
  },
});

export default store;
