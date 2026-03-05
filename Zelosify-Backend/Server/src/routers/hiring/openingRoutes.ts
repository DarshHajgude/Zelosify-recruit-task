import { Router, type RequestHandler } from "express";
import { authenticateUser } from "../../middlewares/auth/authenticateMiddleware.js";
import { authorizeRole } from "../../middlewares/auth/authorizeMiddleware.js";
import { requireTenant } from "../../middlewares/auth/tenantMiddleware.js";
import { requireOpeningOwnership } from "../../middlewares/auth/ownershipMiddleware.js";
import { asyncHandler } from "../../utils/handler/asyncHandler.js";
import { getMyOpenings } from "../../controllers/hiring/openings/openingController.js";
import {
  getProfilesForOpening,
  shortlist,
  reject,
} from "../../controllers/hiring/openings/profileController.js";

const router = Router();

// ─── Shared guard stack ───────────────────────────────────────────────────────
const hmGuard = [
  authenticateUser as RequestHandler,
  authorizeRole("HIRING_MANAGER") as RequestHandler,
  requireTenant as RequestHandler,
];

// ─── Opening routes ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/hiring-manager/openings
 * List all openings owned by this hiring manager (hiringManagerId === userId).
 */
router.get("/", ...hmGuard, asyncHandler(getMyOpenings as any));

// ─── Profile routes nested under opening ─────────────────────────────────────

/**
 * GET /api/v1/hiring-manager/openings/:openingId/profiles
 * Fetch all profiles for an opening including AI recommendation data.
 * requireOpeningOwnership enforces: opening.hiringManagerId === req.user.id
 */
router.get(
  "/:openingId/profiles",
  ...hmGuard,
  requireOpeningOwnership as RequestHandler,
  asyncHandler(getProfilesForOpening as any)
);

// ─── Profile action routes (standalone) ──────────────────────────────────────

/**
 * POST /api/v1/hiring-manager/profiles/:profileId/shortlist
 * Mark a profile as SHORTLISTED.
 * Service layer verifies ownership via opening.hiringManagerId.
 */
router.post(
  "/profiles/:profileId/shortlist",
  ...hmGuard,
  asyncHandler(shortlist as any)
);

/**
 * POST /api/v1/hiring-manager/profiles/:profileId/reject
 * Mark a profile as REJECTED.
 * Service layer verifies ownership via opening.hiringManagerId.
 */
router.post(
  "/profiles/:profileId/reject",
  ...hmGuard,
  asyncHandler(reject as any)
);

export default router;
