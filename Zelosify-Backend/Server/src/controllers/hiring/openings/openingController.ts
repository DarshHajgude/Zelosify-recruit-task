import type { Response } from "express";
import { AuthenticatedRequest } from "../../../types/typeIndex.js";
import { getTenantId, getUserId } from "../../../middlewares/auth/tenantMiddleware.js";
import { fetchMyOpenings } from "../../../services/hiring/openingService.js";

/**
 * GET /api/v1/hiring-manager/openings
 * Returns paginated openings where hiringManagerId === req.user.id
 */
export async function getMyOpenings(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const tenantId = getTenantId(req);
  const userId = getUserId(req);
  const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
  const pageSize = Math.max(parseInt(String(req.query.pageSize ?? "10"), 10) || 10, 1);

  const result = await fetchMyOpenings(userId, tenantId, page, pageSize);

  res.status(200).json({
    message: "Openings fetched successfully",
    ...result,
  });
}
