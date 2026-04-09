import { getActiveDataset } from "../services/datasetService.js";
import { calculateProcurement } from "../services/analyticsService.js";
import { predictDemand } from "../services/mlService.js";
import { applyWeatherAdjustment, fetchWeatherForecast } from "../services/weatherService.js";
import { SavedProcurement } from "../models/SavedProcurement.js";

export const getProcurementPlan = async (req, res) => {
  try {
    console.log("[API] POST /api/procurement - Start", { body: req.body });
    const days = Number(req.body.days || 7);
    const inventory = Number(req.body.inventory || 0);
    const useWeather = Boolean(req.body.useWeather);
    const featureOverrides = req.body.inputFeatures || {};

    const rows = await getActiveDataset();

    if (!rows || !rows.length) {
      console.warn("[API] POST /api/procurement - No dataset available");
      return res.status(400).json({ success: false, message: "No dataset available. Upload CSV first." });
    }

    const latest = rows[rows.length - 1];
    if (latest) {
      if (featureOverrides.latitude === undefined) featureOverrides.latitude = Number(latest.latitude);
      if (featureOverrides.longitude === undefined) featureOverrides.longitude = Number(latest.longitude);
    }

    const result = await predictDemand(days, featureOverrides);
    let predictions = result.predictions;

    if (useWeather && featureOverrides.latitude && featureOverrides.longitude) {
      try {
        const weather = await fetchWeatherForecast({
          latitude: featureOverrides.latitude,
          longitude: featureOverrides.longitude,
          days
        });
        if (weather.daily?.length) {
          predictions = applyWeatherAdjustment(predictions, weather.daily);
        }
      } catch (err) {
        console.warn(`[API Warning] Procurement Weather adjustment failed:`, err.message);
      }
    }

    const procurement = calculateProcurement(predictions, rows, inventory);

    console.log("[API] POST /api/procurement - Success");
    return res.json({
      success: true,
      forecast_horizon_days: days,
      ...procurement
    });
  } catch (error) {
    console.error(`[API Error] GET /api/procurement failed:`, error.stack || error.message);
    return res.status(500).json({
      success: false,
      message: error.response?.data?.detail || error.message || "Internal Server Error"
    });
  }
};

export const saveProcurementPlan = async (req, res) => {
  try {
    const { name, latitude, longitude, forecast_days, inventory, realtime_mode, feature_overrides, results } = req.body;

    if (!name || latitude === undefined || longitude === undefined || !results) {
      return res.status(400).json({ success: false, message: "Name, latitude, longitude, and results are required." });
    }

    const saved = await SavedProcurement.create({
      user: req.user._id,
      name,
      latitude: Number(latitude),
      longitude: Number(longitude),
      forecast_days: forecast_days || 7,
      inventory: inventory || 0,
      realtime_mode: realtime_mode ?? true,
      features: feature_overrides || {},
      results
    });

    return res.status(201).json({ success: true, data: saved });
  } catch (error) {
    console.error(`[API Error] saveProcurementPlan failed:`, error);
    return res.status(500).json({ success: false, message: error.message || "Failed to save procurement plan" });
  }
};

export const getSavedProcurements = async (req, res) => {
  try {
    const saved = await SavedProcurement.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, count: saved.length, data: saved });
  } catch (error) {
    console.error(`[API Error] getSavedProcurements failed:`, error);
    return res.status(500).json({ success: false, message: "Failed to retrieve saved procurements" });
  }
};

export const deleteSavedProcurement = async (req, res) => {
  try {
    const saved = await SavedProcurement.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!saved) return res.status(404).json({ success: false, message: "Saved procurement not found" });
    return res.json({ success: true, data: {} });
  } catch (error) {
    console.error(`[API Error] deleteSavedProcurement failed:`, error);
    return res.status(500).json({ success: false, message: "Failed to delete saved procurement" });
  }
};
