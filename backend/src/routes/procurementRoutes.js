import { Router } from "express";
import { getProcurementPlan, saveProcurementPlan, getSavedProcurements, deleteSavedProcurement } from "../controllers/procurementController.js";
import { protect } from "../middlewares/auth.js";

const router = Router();

router.post("/", getProcurementPlan);
router.post("/saved", protect, saveProcurementPlan);
router.get("/saved", protect, getSavedProcurements);
router.delete("/saved/:id", protect, deleteSavedProcurement);

export default router;
