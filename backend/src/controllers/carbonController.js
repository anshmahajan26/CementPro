import { getActiveDataset } from "../services/datasetService.js";
import { calculateCarbon, calculateProcurement } from "../services/analyticsService.js";
import { predictDemand } from "../services/mlService.js";
import { applyWeatherAdjustment, fetchWeatherForecast } from "../services/weatherService.js";
import { SavedCarbon } from "../models/SavedCarbon.js";

export const getCarbonEstimation = async (req, res) => {
  try {
    console.log("[API] POST /api/carbon - Start", { body: req.body });
    const days = Number(req.body.days || 7);
    const blendFactor = Number(req.body.blendFactor || 0.92);
    const useWeather = Boolean(req.body.useWeather);
    const featureOverrides = req.body.inputFeatures || {};

    let rows = await getActiveDataset();

    if (!rows || !rows.length) {
      console.warn("[API] POST /api/carbon - No dataset available");
      return res.status(400).json({ success: false, message: "No dataset available. Upload CSV first." });
    }

    const latest = rows[rows.length - 1];
    if (latest) {
      if (featureOverrides.latitude === undefined) featureOverrides.latitude = Number(latest.latitude);
      if (featureOverrides.longitude === undefined) featureOverrides.longitude = Number(latest.longitude);
    }

    const forecast = await predictDemand(days, featureOverrides);
    let predictions = forecast.predictions;

    // Isolate site-specific matrix for completely dynamic carbon profile
    if (featureOverrides.latitude !== undefined && featureOverrides.longitude !== undefined) {
      const localRows = rows.filter(r => 
        Math.abs(Number(r.latitude) - Number(featureOverrides.latitude)) < 0.05 && 
        Math.abs(Number(r.longitude) - Number(featureOverrides.longitude)) < 0.05
      );
      if (localRows.length > 0) {
        rows = localRows;
      } else {
         const globalAvgDem = rows.reduce((s, r) => s + r.daily_rmc_volume_m3, 0) / Math.max(rows.length, 1);
         rows = [{
             daily_rmc_volume_m3: forecast.predictions?.[0]?.predicted_demand_m3 || globalAvgDem,
             project_size: Number(featureOverrides?.project_size) || 2,
             day_in_project: Number(featureOverrides?.day_in_project) || 1,
             cement_kg_m3: Number(featureOverrides?.cement_kg_m3) || 350,
             aggregate_10mm_pct: Number(featureOverrides?.aggregate_10mm_pct) || 45,
             aggregate_20mm_pct: Number(featureOverrides?.aggregate_20mm_pct) || 55,
             agg_moisture_content_pct: Number(featureOverrides?.agg_moisture_content_pct) || 2.5,
             water_binder_ratio: Number(featureOverrides?.water_binder_ratio) || 0.45,
             transport_time_min: Number(featureOverrides?.transport_time_min) || 45,
             truck_capacity_m3: Number(featureOverrides?.truck_capacity_m3) || 8
         }];
      }
    }

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
        console.warn(`[API Warning] Carbon Weather adjustment failed:`, err.message);
      }
    }

    // We use a base procurement generation (0 inventory) to map max footprint
    const procurement = calculateProcurement(predictions, rows, 0);
    const carbon = calculateCarbon(predictions, rows, procurement, blendFactor);

    console.log("[API] POST /api/carbon - Success");
    return res.json({
      success: true,
      forecast_horizon_days: days,
      ...carbon
    });
  } catch (error) {
    console.error(`[API Error] POST /api/carbon failed:`, error.stack || error.message);
    return res.status(500).json({ 
      success: false, 
      message: error.response?.data?.detail || error.message || "Internal Server Error"
    });
  }
};

export const saveCarbonPlan = async (req, res) => {
  try {
    const { name, latitude, longitude, forecast_days, blend_factor, realtime_mode, feature_overrides, results } = req.body;

    if (!name || latitude === undefined || longitude === undefined || !results) {
      return res.status(400).json({ success: false, message: "Name, latitude, longitude, and results are required." });
    }

    const saved = await SavedCarbon.create({
      user: req.user._id,
      name,
      latitude: Number(latitude),
      longitude: Number(longitude),
      forecast_days: forecast_days || 7,
      blend_factor: blend_factor || 0.92,
      realtime_mode: realtime_mode ?? true,
      features: feature_overrides || {},
      results
    });

    return res.status(201).json({ success: true, data: saved });
  } catch (error) {
    console.error(`[API Error] saveCarbonPlan failed:`, error);
    return res.status(500).json({ success: false, message: error.message || "Failed to save carbon profile" });
  }
};

export const getSavedCarbons = async (req, res) => {
  try {
    const saved = await SavedCarbon.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, count: saved.length, data: saved });
  } catch (error) {
    console.error(`[API Error] getSavedCarbons failed:`, error);
    return res.status(500).json({ success: false, message: "Failed to retrieve saved carbon profiles" });
  }
};

export const deleteSavedCarbon = async (req, res) => {
  try {
    const saved = await SavedCarbon.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!saved) return res.status(404).json({ success: false, message: "Saved carbon profile not found" });
    return res.json({ success: true, data: {} });
  } catch (error) {
    console.error(`[API Error] deleteSavedCarbon failed:`, error);
    return res.status(500).json({ success: false, message: "Failed to delete saved carbon profile" });
  }
};
