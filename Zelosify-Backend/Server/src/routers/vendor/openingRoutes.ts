import { Router, type RequestHandler } from "express";
import { authenticateUser } from "../../middlewares/auth/authenticateMiddleware.js";
import { authorizeRole } from "../../middlewares/auth/authorizeMiddleware.js";
import { requireTenant } from "../../middlewares/auth/tenantMiddleware.js";
import { requireProfileUploader } from "../../middlewares/auth/ownershipMiddleware.js";
import { uploadConfig } from "../../config/multer/multerConfig.js";
import { asyncHandler } from "../../utils/handler/asyncHandler.js";
import {
  getOpenings,
  getOpeningById,
} from "../../controllers/vendor/openings/openingController.js";
import {
  presignProfiles,
  uploadProfiles,
  deleteProfile,
  previewProfile,
} from "../../controllers/vendor/openings/profileController.js";

const router = Router();

// ─── Shared guard stack ───────────────────────────────────────────────────────
const vendorGuard = [
  authenticateUser as RequestHandler,
  authorizeRole("IT_VENDOR") as RequestHandler,
  requireTenant as RequestHandler,
];

// ─── Opening routes ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/vendor/openings
 * List paginated OPEN openings for the vendor's tenant.
 */
router.get("/", ...vendorGuard, asyncHandler(getOpenings as any));

/**
 * GET /api/v1/vendor/openings/:id
 * Full opening detail + vendor's own uploaded profiles.
 */
router.get("/:id", ...vendorGuard, asyncHandler(getOpeningById as any));

// ─── Profile routes (nested under opening) ───────────────────────────────────

/**
 * POST /api/v1/vendor/openings/:openingId/profiles/presign
 * Generate encrypted S3 upload tokens for the provided filenames.
 * Body: { filenames: string[] }
 */
router.post(
  "/:openingId/profiles/presign",
  ...vendorGuard,
  asyncHandler(presignProfiles as any)
);

/**
 * POST /api/v1/vendor/openings/:openingId/profiles/upload
 * Upload files to S3 and persist hiringProfile records in one transaction.
 * Multipart: files[] + uploadTokens (JSON array)
 */
router.post(
  "/:openingId/profiles/upload",
  ...vendorGuard,
  uploadConfig.array("files", 10) as RequestHandler,
  asyncHandler(uploadProfiles as any)
);

// ─── Profile routes (standalone) ─────────────────────────────────────────────

/**
 * DELETE /api/v1/vendor/profiles/:profileId
 * Soft-delete a profile the vendor uploaded.
 */
router.delete(
  "/profiles/:profileId",
  ...vendorGuard,
  requireProfileUploader as RequestHandler,
  asyncHandler(deleteProfile as any)
);

/**
 * GET /api/v1/vendor/profiles/:profileId/preview
 * Get a short-lived presigned URL to preview the file.
 */
router.get(
  "/profiles/:profileId/preview",
  ...vendorGuard,
  requireProfileUploader as RequestHandler,
  asyncHandler(previewProfile as any)
);

export default router;
