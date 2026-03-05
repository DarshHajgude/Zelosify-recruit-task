import type { Response } from "express";
import { AuthenticatedRequest } from "../../../types/typeIndex.js";
import { getTenantId, getUserId } from "../../../middlewares/auth/tenantMiddleware.js";
import { fetchOpenings, fetchOpeningDetail } from "../../../services/vendor/openingService.js";

/**
 * GET /api/v1/vendor/openings
 * Returns paginated OPEN openings for the vendor's tenant.
 *
 * Query params:
 *   page     - page number (default 1)
 *   pageSize - items per page (default 10, max 50)
 */
export async function getOpenings(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
  const pageSize = Math.max(parseInt(String(req.query.pageSize ?? "10"), 10) || 10, 1);

  const result = await fetchOpenings(tenantId, page, pageSize);

  res.status(200).json({
    message: "Openings fetched successfully",
    ...result,
  });
}

/**
 * GET /api/v1/vendor/openings/:id
 * Returns full opening detail plus the calling vendor's own uploaded profiles.
 */
export async function getOpeningById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const vendorId = getUserId(req);
  const { id } = req.params;

  const detail = await fetchOpeningDetail(id, tenantId, vendorId);

  if (!detail) {
    res.status(404).json({ message: "Opening not found" });
    return;
  }

  res.status(200).json({
    message: "Opening fetched successfully",
    data: detail,
  });
}
