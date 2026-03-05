import type { Response } from "express";
import { AuthenticatedRequest } from "../../../types/typeIndex.js";
import { getTenantId, getUserId } from "../../../middlewares/auth/tenantMiddleware.js";
import {
  presignProfileUploads,
  submitProfiles,
  softDeleteProfile,
  getProfilePreviewUrl,
} from "../../../services/vendor/profileService.js";

/**
 * POST /api/v1/vendor/openings/:openingId/profiles/presign
 *
 * Body: { filenames: string[] }
 * Returns encrypted upload tokens for each file.
 * Files must be PDF or PPTX only (validated here).
 */
export async function presignProfiles(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const { openingId } = req.params;
  const { filenames } = req.body as { filenames?: string[] };

  if (!Array.isArray(filenames) || filenames.length === 0) {
    res.status(400).json({ message: "filenames array is required" });
    return;
  }

  const ALLOWED_EXTENSIONS = /\.(pdf|pptx|ppt)$/i;
  const invalid = filenames.filter((f) => !ALLOWED_EXTENSIONS.test(f));
  if (invalid.length > 0) {
    res.status(400).json({
      message: `Only PDF and PPTX files are allowed. Invalid: ${invalid.join(", ")}`,
    });
    return;
  }

  const baseUrl = `${req.protocol}://${req.get("host")}/api/v1/vendor`;
  const result = await presignProfileUploads(openingId, tenantId, filenames, baseUrl);

  res.status(200).json({
    message: "Presigned upload tokens generated",
    data: result.tokens,
  });
}

/**
 * POST /api/v1/vendor/openings/:openingId/profiles/upload
 *
 * Multipart form-data:
 *   files[]       - the actual file buffers (via multer)
 *   uploadTokens  - JSON array of encrypted tokens (one per file, same order)
 *
 * Uploads files to S3 and records all profiles in a single DB transaction.
 */
export async function uploadProfiles(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const vendorId = getUserId(req);
  const { openingId } = req.params;

  const multerFiles = (req.files as Express.Multer.File[]) ?? [];
  if (multerFiles.length === 0) {
    res.status(400).json({ message: "No files uploaded" });
    return;
  }

  let uploadTokens: string[];
  try {
    const raw = req.body.uploadTokens;
    uploadTokens = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(uploadTokens) || uploadTokens.length !== multerFiles.length) {
      throw new Error("uploadTokens count must match files count");
    }
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }

  const files = multerFiles.map((f, i) => ({
    uploadToken: uploadTokens[i],
    fileBuffer: f.buffer,
    mimeType: f.mimetype,
    originalName: f.originalname,
  }));

  const result = await submitProfiles(openingId, tenantId, vendorId, files);

  res.status(201).json({
    message: `${result.profiles.length} profile(s) submitted successfully`,
    data: result.profiles,
  });
}

/**
 * DELETE /api/v1/vendor/profiles/:profileId
 *
 * Soft-deletes a profile.
 * Ownership check is enforced by requireProfileUploader middleware on the route.
 */
export async function deleteProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const vendorId = getUserId(req);
  const profileId = Number(req.params.profileId);

  await softDeleteProfile(profileId, vendorId, tenantId);

  res.status(200).json({ message: "Profile deleted successfully" });
}

/**
 * GET /api/v1/vendor/profiles/:profileId/preview
 *
 * Returns a short-lived presigned GET URL for file preview.
 */
export async function previewProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const vendorId = getUserId(req);
  const profileId = Number(req.params.profileId);

  const url = await getProfilePreviewUrl(profileId, vendorId, tenantId);

  res.status(200).json({ message: "Preview URL generated", data: { url } });
}
