import express from "express";
import vendorRequestRoutes from "./vendorRequestRoutes.js";
import openingRoutes from "./openingRoutes.js";

const router = express.Router();

/**
 * @route /api/v1/vendor/requests  (existing)
 */
router.use("/requests", vendorRequestRoutes);

/**
 * @route /api/v1/vendor/openings  (new — Phase 3)
 * @route /api/v1/vendor/profiles  (new — nested inside openingRoutes)
 */
router.use("/openings", openingRoutes);

export default router;
