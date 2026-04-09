import { Router } from "express";
import { getDashboard } from "../controllers/dashboardController.js";
import { handleDashboardChat } from "../controllers/chatController.js";
import { protect } from "../middlewares/auth.js";

const router = Router();

router.get("/", protect, getDashboard);
router.post("/chat", protect, handleDashboardChat);

export default router;
