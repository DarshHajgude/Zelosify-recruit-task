import axiosInstance from "@/utils/Axios/AxiosInstance";

const BASE = "/hiring-manager";

/**
 * Fetch paginated list of openings owned by this hiring manager.
 */
export async function fetchHMOpenings(page = 1, pageSize = 10) {
  const res = await axiosInstance.get(`${BASE}/openings`, {
    params: { page, pageSize },
  });
  return res.data; // { data, total, page, pageSize, totalPages }
}

/**
 * Fetch all profiles for an opening (includes AI recommendation data).
 * @param {string} openingId
 */
export async function fetchHMProfiles(openingId) {
  const res = await axiosInstance.get(`${BASE}/openings/${openingId}/profiles`);
  return res.data; // { data: profiles[], total }
}

/**
 * Shortlist a profile.
 * @param {number} profileId
 */
export async function shortlistProfile(profileId) {
  const res = await axiosInstance.post(
    `${BASE}/openings/profiles/${profileId}/shortlist`
  );
  return res.data;
}

/**
 * Reject a profile.
 * @param {number} profileId
 */
export async function rejectProfile(profileId) {
  const res = await axiosInstance.post(
    `${BASE}/openings/profiles/${profileId}/reject`
  );
  return res.data;
}
