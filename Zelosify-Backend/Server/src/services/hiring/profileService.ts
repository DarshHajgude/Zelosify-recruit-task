import prisma from "../../config/prisma/prisma.js";
import { getDecision } from "../ai/tools/matchingEngineTool.js";

export type RecommendationBadge = "Recommended" | "Borderline" | "Not Recommended" | "Pending";

export interface ProfileWithRecommendation {
  id: number;
  s3Key: string;
  filename: string;          // derived from s3Key
  submittedAt: Date;
  status: string;
  uploadedBy: string;
  // AI fields
  badge: RecommendationBadge;
  recommended: boolean | null;
  recommendationScore: number | null;
  recommendationConfidence: number | null;
  recommendationReason: string | null;
  recommendationLatencyMs: number | null;
  recommendationVersion: string | null;
  recommendedAt: Date | null;
}

function extractFilename(s3Key: string): string {
  // s3Key format: <tenantId>/<openingId>/<timestamp>_<filename>
  const parts = s3Key.split("/");
  const raw = parts[parts.length - 1] ?? s3Key;
  // Strip leading timestamp_ prefix if present
  return raw.replace(/^\d+_/, "");
}

function getBadge(profile: {
  recommended: boolean | null;
  recommendationScore: number | null;
}): RecommendationBadge {
  if (profile.recommended === null || profile.recommendationScore === null) return "Pending";
  return getDecision(profile.recommendationScore) as RecommendationBadge;
}

/**
 * Fetch all non-deleted profiles for an opening.
 * Ownership is verified by requireOpeningOwnership middleware before this runs.
 * Returns AI recommendation data alongside profile info.
 */
export async function fetchProfilesForOpening(
  openingId: string,
  tenantId: string
): Promise<ProfileWithRecommendation[]> {
  // Verify the opening belongs to the tenant (belt-and-suspenders)
  const opening = await prisma.opening.findFirst({
    where: { id: openingId, tenantId },
    select: { id: true },
  });
  if (!opening) throw new Error("Opening not found");

  const profiles = await prisma.hiringProfile.findMany({
    where: { openingId, isDeleted: false },
    orderBy: [
      // Recommended first, then by score desc, then newest first
      { recommended: "desc" },
      { recommendationScore: "desc" },
      { submittedAt: "desc" },
    ],
    select: {
      id: true,
      s3Key: true,
      submittedAt: true,
      status: true,
      uploadedBy: true,
      recommended: true,
      recommendationScore: true,
      recommendationConfidence: true,
      recommendationReason: true,
      recommendationLatencyMs: true,
      recommendationVersion: true,
      recommendedAt: true,
    },
  });

  return profiles.map((p) => ({
    ...p,
    filename: extractFilename(p.s3Key),
    badge: getBadge(p),
  }));
}

/**
 * Shortlist a profile. Verifies:
 *  - Profile exists and is not deleted
 *  - Profile belongs to an opening in the HM's tenant
 * All writes in a Prisma transaction.
 */
export async function shortlistProfile(
  profileId: number,
  managerId: string,
  tenantId: string
): Promise<void> {
  const profile = await prisma.hiringProfile.findFirst({
    where: {
      id: profileId,
      isDeleted: false,
      opening: { tenantId, hiringManagerId: managerId },
    },
    select: { id: true, status: true },
  });

  if (!profile) throw new Error("Profile not found");
  if (profile.status === "SHORTLISTED") throw new Error("Profile is already shortlisted");
  if (profile.status === "REJECTED") throw new Error("Cannot shortlist a rejected profile");

  await prisma.$transaction([
    prisma.hiringProfile.update({
      where: { id: profileId },
      data: {
        status: "SHORTLISTED",
        shortlistedBy: managerId,
        shortlistedAt: new Date(),
        // Clear any previous rejection
        rejectedBy: null,
        rejectedAt: null,
      },
    }),
  ]);
}

/**
 * Reject a profile. Verifies ownership via opening.hiringManagerId.
 * All writes in a Prisma transaction.
 */
export async function rejectProfile(
  profileId: number,
  managerId: string,
  tenantId: string
): Promise<void> {
  const profile = await prisma.hiringProfile.findFirst({
    where: {
      id: profileId,
      isDeleted: false,
      opening: { tenantId, hiringManagerId: managerId },
    },
    select: { id: true, status: true },
  });

  if (!profile) throw new Error("Profile not found");
  if (profile.status === "REJECTED") throw new Error("Profile is already rejected");

  await prisma.$transaction([
    prisma.hiringProfile.update({
      where: { id: profileId },
      data: {
        status: "REJECTED",
        rejectedBy: managerId,
        rejectedAt: new Date(),
        // Clear any previous shortlist
        shortlistedBy: null,
        shortlistedAt: null,
      },
    }),
  ]);
}
