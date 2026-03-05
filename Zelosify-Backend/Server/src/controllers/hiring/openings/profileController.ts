import type { Response } from "express";
import { AuthenticatedRequest } from "../../../types/typeIndex.js";
import { getTenantId, getUserId } from "../../../middlewares/auth/tenantMiddleware.js";
import {
  fetchProfilesForOpening,
  shortlistProfile,
  rejectProfile,
} from "../../../services/hiring/profileService.js";

/**
 * GET /api/v1/hiring-manager/openings/:openingId/profiles
 * Returns all profiles for an opening including AI recommendation data.
 * requireOpeningOwnership middleware runs before this.
 */
export async function getProfilesForOpening(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const { openingId } = req.params;

  const profiles = await fetchProfilesForOpening(openingId, tenantId);

  res.status(200).json({
    message: "Profiles fetched successfully",
    data: profiles,
    total: profiles.length,
  });
}

/**
 * POST /api/v1/hiring-manager/profiles/:profileId/shortlist
 * Marks a profile as SHORTLISTED. Verifies HM owns the opening.
 */
export async function shortlist(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const managerId = getUserId(req);
  const profileId = Number(req.params.profileId);

  if (isNaN(profileId)) {
    res.status(400).json({ message: "profileId must be a number" });
    return;
  }

  await shortlistProfile(profileId, managerId, tenantId);

  res.status(200).json({ message: "Profile shortlisted successfully" });
}

/**
 * POST /api/v1/hiring-manager/profiles/:profileId/reject
 * Marks a profile as REJECTED. Verifies HM owns the opening.
 */
export async function reject(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const managerId = getUserId(req);
  const profileId = Number(req.params.profileId);

  if (isNaN(profileId)) {
    res.status(400).json({ message: "profileId must be a number" });
    return;
  }

  await rejectProfile(profileId, managerId, tenantId);

  res.status(200).json({ message: "Profile rejected successfully" });
}
