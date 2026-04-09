import { Router } from "express";
import { generateForecast, saveForecastParameters, getSavedForecasts, deleteSavedForecast } from "../controllers/forecastController.js";
import { protect } from "../middlewares/auth.js";

const router = Router();

router.post("/", protect, generateForecast);
router.post("/saved", protect, saveForecastParameters);
router.get("/saved", protect, getSavedForecasts);
router.delete("/saved/:id", protect, deleteSavedForecast);

export default router;
