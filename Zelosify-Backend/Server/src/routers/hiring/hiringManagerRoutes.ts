import { Router } from "express";
import openingRoutes from "./openingRoutes.js";

const router = Router();

/**
 * @route /api/v1/hiring-manager/openings
 */
router.use("/openings", openingRoutes);

export default router;
