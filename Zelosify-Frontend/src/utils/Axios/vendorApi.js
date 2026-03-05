import axiosInstance from "@/utils/Axios/AxiosInstance";

const BASE = "/vendor";

/**
 * Fetch paginated list of OPEN openings for the vendor's tenant.
 * @param {number} page - 1-based page number
 * @param {number} pageSize
 */
export async function fetchVendorOpenings(page = 1, pageSize = 10) {
  const res = await axiosInstance.get(`${BASE}/openings`, {
    params: { page, pageSize },
  });
  return res.data; // { data, total, totalPages, currentPage }
}

/**
 * Fetch a single opening's details along with vendor's own profiles.
 * @param {string} id - Opening ID
 */
export async function fetchVendorOpeningDetail(id) {
  const res = await axiosInstance.get(`${BASE}/openings/${id}`);
  return res.data; // { data: { opening, profiles } }
}

/**
 * Request presigned upload tokens for the given filenames.
 * @param {string} openingId
 * @param {string[]} filenames
 * @returns {Promise<Array<{token, filename}>>}
 */
export async function presignProfiles(openingId, filenames) {
  const res = await axiosInstance.post(
    `${BASE}/openings/${openingId}/profiles/presign`,
    { filenames }
  );
  return res.data.data; // array of { token, filename, s3Key }
}

/**
 * Upload files to S3 via the backend (multipart).
 * @param {string} openingId
 * @param {File[]} files - File objects from the browser
 * @param {string[]} uploadTokens - Encrypted tokens matching file order
 */
export async function uploadProfiles(openingId, files, uploadTokens) {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  form.append("uploadTokens", JSON.stringify(uploadTokens));

  const res = await axiosInstance.post(
    `${BASE}/openings/${openingId}/profiles/upload`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return res.data; // { data: profiles[] }
}

/**
 * Soft-delete a profile.
 * @param {number} profileId
 */
export async function deleteVendorProfile(profileId) {
  const res = await axiosInstance.delete(`${BASE}/openings/profiles/${profileId}`);
  return res.data;
}

/**
 * Get a short-lived presigned URL to preview a profile file.
 * @param {number} profileId
 * @returns {Promise<string>} preview URL
 */
export async function previewVendorProfile(profileId) {
  const res = await axiosInstance.get(`${BASE}/openings/profiles/${profileId}/preview`);
  return res.data.data.url;
}
