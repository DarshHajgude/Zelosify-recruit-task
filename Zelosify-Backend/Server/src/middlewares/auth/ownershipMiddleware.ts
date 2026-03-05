import type { Response, NextFunction } from "express";
import prisma from "../../config/prisma/prisma.js";
import { AuthenticatedRequest } from "../../types/typeIndex.js";
import { getTenantId, getUserId } from "./tenantMiddleware.js";

/**
 * Middleware: requireOpeningOwnership
 *
 * Guards hiring-manager routes that operate on a specific opening.
 * Verifies two conditions before passing to the controller:
 *   1. The opening belongs to the user's tenant  (tenant isolation)
 *   2. The opening's hiringManagerId === req.user.id  (ownership)
 *
 * Expects :openingId or :id in req.params.
 * Must run AFTER authenticateUser + authorizeRole("HIRING_MANAGER") + requireTenant.
 */
export const requireOpeningOwnership = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const openingId = req.params.openingId ?? req.params.id;
    if (!openingId) {
      res.status(400).json({ message: "Opening ID is required" });
      return;
    }

    const tenantId = getTenantId(req);
    const userId = getUserId(req);

    const opening = await prisma.opening.findFirst({
      where: { id: openingId, tenantId },
      select: { id: true, hiringManagerId: true },
    });

    if (!opening) {
      // Opening not found OR not in user's tenant — same response to avoid info leakage
      res.status(404).json({ message: "Opening not found" });
      return;
    }

    if (opening.hiringManagerId !== userId) {
      res.status(403).json({
        message: "Access denied: you are not the hiring manager for this opening",
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware: requireProfileUploader
 *
 * Guards vendor routes that operate on a specific profile.
 * Verifies:
 *   1. The profile exists and is not deleted
 *   2. The profile was uploaded by the requesting vendor (uploadedBy === req.user.id)
 *   3. The parent opening belongs to the user's tenant
 *
 * Expects :profileId in req.params.
 * Must run AFTER authenticateUser + authorizeRole("IT_VENDOR") + requireTenant.
 */
export const requireProfileUploader = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const profileId = Number(req.params.profileId ?? req.params.id);
    if (isNaN(profileId)) {
      res.status(400).json({ message: "Profile ID must be a number" });
      return;
    }

    const tenantId = getTenantId(req);
    const userId = getUserId(req);

    const profile = await prisma.hiringProfile.findFirst({
      where: {
        id: profileId,
        isDeleted: false,
        opening: { tenantId },   // tenant isolation via join
      },
      select: { id: true, uploadedBy: true },
    });

    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    if (profile.uploadedBy !== userId) {
      res.status(403).json({
        message: "Access denied: you did not upload this profile",
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
