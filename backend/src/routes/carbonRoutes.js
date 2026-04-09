import { Router } from "express";
import { getCarbonEstimation, saveCarbonPlan, getSavedCarbons, deleteSavedCarbon } from "../controllers/carbonController.js";
import { protect } from "../middlewares/auth.js";

const router = Router();

router.post("/", protect, getCarbonEstimation);
router.post("/saved", protect, saveCarbonPlan);
router.get("/saved", protect, getSavedCarbons);
router.delete("/saved/:id", protect, deleteSavedCarbon);

export default router;
