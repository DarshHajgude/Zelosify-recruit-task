import type { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../types/typeIndex.js";

/**
 * Middleware: requireTenant
 *
 * Enforces that the authenticated user belongs to a tenant.
 * Must be used AFTER authenticateUser so req.user is populated.
 *
 * Failure modes:
 *  - No user attached (auth bug)  → 401
 *  - User has no tenant           → 403
 */
export const requireTenant = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const tenantId = req.user.tenant?.tenantId;
  if (!tenantId) {
    res.status(403).json({
      message: "Access denied: user is not associated with any tenant",
    });
    return;
  }

  next();
};

/**
 * Helper: extract tenantId from an authenticated request.
 * Throws if missing — use only after requireTenant has run.
 */
export const getTenantId = (req: AuthenticatedRequest): string => {
  const tenantId = req.user?.tenant?.tenantId;
  if (!tenantId) {
    throw new Error("tenantId missing from request — requireTenant not applied");
  }
  return tenantId;
};

/**
 * Helper: extract the calling user's DB id from an authenticated request.
 */
export const getUserId = (req: AuthenticatedRequest): string => {
  const userId = req.user?.id;
  if (!userId) {
    throw new Error("userId missing from request — authenticateUser not applied");
  }
  return userId;
};
