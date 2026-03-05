import prisma from "../../config/prisma/prisma.js";
import { FilePresignService } from "../upload/filePresignService.js";
import { FileUploadService } from "../upload/fileUploadService.js";
import { createStorageService } from "../storage/storageFactory.js";
import { sanitizeFilename } from "../../helpers/vendorRequestValidation.js";
import { UploadToken } from "../../types/typeIndex.js";
import { processRecommendation } from "../ai/recommendationService.js";
import { extractPdfText, extractPptxText } from "../ai/tools/resumeParsingTool.js";
import { sanitizeResumeContent } from "../../utils/ai/promptInjectionSanitizer.js";
import { logger } from "../../utils/observability/logger.js";

const presignService = new FilePresignService();
const uploadService = new FileUploadService();

export interface PresignResult {
  tokens: UploadToken[];
}

export interface SubmittedProfile {
  id: number;
  s3Key: string;
  filename: string;
  submittedAt: Date;
  status: string;
}

export interface SubmitProfilesResult {
  profiles: SubmittedProfile[];
}

/**
 * Generate S3 presigned upload tokens for a batch of files.
 *
 * S3 key pattern: <tenantId>/<openingId>/<timestamp>_<sanitized-filename>
 * Tokens are encrypted — the frontend passes them back on /upload.
 */
export async function presignProfileUploads(
  openingId: string,
  tenantId: string,
  filenames: string[],
  uploadEndpointBase: string
): Promise<PresignResult> {
  if (!filenames.length) {
    throw new Error("At least one filename is required");
  }

  const tokens = await presignService.generateUploadTokens(filenames, {
    tenantId,
    s3KeyConfig: {
      pathSegments: [tenantId, openingId],
      includeTimestamp: true,
    },
    uploadEndpoint: `${uploadEndpointBase}/openings/${openingId}/profiles/upload`,
    customMetadata: { openingId, tenantId },
  });

  return { tokens };
}

/**
 * Upload files to S3 (via presigned URLs) and persist hiringProfile records.
 * All DB writes happen inside a single Prisma transaction — atomic.
 *
 * @param openingId   - The opening these profiles are submitted against
 * @param tenantId    - Must match the opening's tenant (validated upstream)
 * @param vendorId    - The vendor submitting the profiles
 * @param files       - Array of { uploadToken, fileBuffer, mimeType } from multer
 */
export async function submitProfiles(
  openingId: string,
  tenantId: string,
  vendorId: string,
  files: Array<{ uploadToken: string; fileBuffer: Buffer; mimeType: string; originalName: string }>
): Promise<SubmitProfilesResult> {
  // 1. Verify the opening exists and belongs to the tenant
  const opening = await prisma.opening.findFirst({
    where: { id: openingId, tenantId },
    select: { id: true, status: true },
  });
  if (!opening) throw new Error("Opening not found");
  if (opening.status !== "OPEN") throw new Error("Opening is not accepting profiles");

  // 2. Upload each file to S3 (outside transaction — S3 is not transactional)
  const uploadResults = await Promise.all(
    files.map((f) =>
      uploadService.uploadFile({
        fileBuffer: f.fileBuffer,
        mimeType: f.mimeType,
        uploadToken: f.uploadToken,
      })
    )
  );

  const failedUploads = uploadResults.filter((r) => !r.success);
  if (failedUploads.length > 0) {
    throw new Error(
      `S3 upload failed for: ${failedUploads.map((r) => r.filename).join(", ")}`
    );
  }

  // 3. Parse resume text from in-memory buffers (already uploaded — no S3 re-download needed).
  //    Stored in DB so the AI agent skips S3 entirely, reducing pipeline latency by ~500ms.
  const parsedTexts = await Promise.all(
    files.map(async (f, i) => {
      const ext = (uploadResults[i].filename ?? "").split(".").pop()?.toLowerCase() ?? "";
      try {
        let raw = "";
        if (ext === "pdf") raw = await extractPdfText(f.fileBuffer);
        else if (ext === "pptx" || ext === "ppt") raw = await extractPptxText(f.fileBuffer);
        return raw ? sanitizeResumeContent(raw) : null;
      } catch (err) {
        logger.warn("profileService", "Resume text extraction failed, AI will use S3 fallback", {
          filename: uploadResults[i].filename,
          error: (err as Error).message,
        });
        return null;
      }
    })
  );

  // 4. Persist all profile records in a single Prisma transaction
  const profiles = await prisma.$transaction(
    uploadResults.map((result, i) =>
      prisma.hiringProfile.create({
        data: {
          openingId,
          s3Key: result.key,
          uploadedBy: vendorId,
          status: "SUBMITTED",
          resumeText: parsedTexts[i] ?? null,
        },
        select: {
          id: true,
          s3Key: true,
          submittedAt: true,
          status: true,
        },
      })
    )
  );

  const result = {
    profiles: profiles.map((p, i) => ({
      ...p,
      filename: uploadResults[i].filename,
    })),
  };

  // 5. Trigger AI recommendation asynchronously — does NOT block the API response.
  //    Fire-and-forget: errors are caught and logged inside processRecommendation.
  for (const profile of profiles) {
    processRecommendation(profile.id, openingId).catch((err) => {
      logger.error("profileService", "Async recommendation trigger failed", {
        profileId: profile.id,
        openingId,
        error: (err as Error).message,
      });
    });
  }

  return result;
}

/**
 * Soft-delete a profile. Checks that:
 *  - Profile exists, is not already deleted
 *  - uploadedBy === vendorId (ownership)
 *  - Opening is in the vendor's tenant
 */
export async function softDeleteProfile(
  profileId: number,
  vendorId: string,
  tenantId: string
): Promise<void> {
  const profile = await prisma.hiringProfile.findFirst({
    where: {
      id: profileId,
      isDeleted: false,
      uploadedBy: vendorId,
      opening: { tenantId },
    },
    select: { id: true, status: true },
  });

  if (!profile) throw new Error("Profile not found or already deleted");
  if (profile.status === "SHORTLISTED") {
    throw new Error("Cannot delete a shortlisted profile");
  }

  await prisma.hiringProfile.update({
    where: { id: profileId },
    data: { isDeleted: true },
  });
}

/**
 * Generate a short-lived presigned GET URL so the frontend can preview a file.
 * Validates that the profile belongs to the vendor's tenant.
 */
export async function getProfilePreviewUrl(
  profileId: number,
  vendorId: string,
  tenantId: string
): Promise<string> {
  const profile = await prisma.hiringProfile.findFirst({
    where: {
      id: profileId,
      isDeleted: false,
      opening: { tenantId },
    },
    select: { id: true, s3Key: true, uploadedBy: true },
  });

  if (!profile) throw new Error("Profile not found");
  if (profile.uploadedBy !== vendorId) {
    throw new Error("Access denied: you did not upload this profile");
  }

  const storageService = createStorageService();
  return storageService.getObjectURL(profile.s3Key);
}
