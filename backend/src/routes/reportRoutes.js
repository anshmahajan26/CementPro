import { Router } from "express";
import { getReport } from "../controllers/reportController.js";
import { protect } from "../middlewares/auth.js";

const router = Router();

router.get("/:type", protect, getReport);

export default router;
