import { getActiveDataset, parseProjectSizeValue } from "../services/datasetService.js";
import { predictDemand } from "../services/mlService.js";
import { applyWeatherAdjustment, fetchWeatherForecast } from "../services/weatherService.js";
import { SavedForecast } from "../models/SavedForecast.js";

const allowedFeatureKeys = [
  "project_size",
  "day_in_project",
  "latitude",
  "longitude",
  "cement_kg_m3",
  "aggregate_10mm_pct",
  "aggregate_20mm_pct",
  "agg_moisture_content_pct",
  "water_binder_ratio",
  "slump_mm",
  "batching_time_min",
  "transport_time_min",
  "truck_capacity_m3"
];

const normalizeFeatureOverrides = (payload = {}) => {
  const normalized = {};

  allowedFeatureKeys.forEach((key) => {
    if (payload[key] === undefined || payload[key] === null || payload[key] === "") {
      return;
    }

    if (key === "project_size") {
      try {
        normalized[key] = parseProjectSizeValue(payload[key]);
      } catch (error) {
        // ignore invalid custom project_size and keep dataset default
      }
      return;
    }

    const parsed = Number(payload[key]);
    if (!Number.isNaN(parsed)) {
      normalized[key] = parsed;
    }
  });

  return normalized;
};

export const generateForecast = async (req, res) => {
  try {
    console.log("[API] POST /api/forecast - Start", { body: req.body });
    const days = Number(req.body.days || 7);
    const useWeather = Boolean(req.body.useWeather);
    const featureOverrides = normalizeFeatureOverrides(req.body.inputFeatures || {});

    const rows = await getActiveDataset();
    if (!rows || !rows.length) {
      console.warn("[API] POST /api/forecast - No dataset available");
      // Fallback coordinates if no dataset exists
      if (featureOverrides.latitude === undefined) featureOverrides.latitude = 0;
      if (featureOverrides.longitude === undefined) featureOverrides.longitude = 0;
    } else {
      const latest = rows[rows.length - 1];
      if (latest) {
        if (featureOverrides.latitude === undefined) {
          featureOverrides.latitude = Number(latest.latitude);
        }
        if (featureOverrides.longitude === undefined) {
          featureOverrides.longitude = Number(latest.longitude);
        }
      }
    }

    const result = await predictDemand(days, featureOverrides);

    let weather = null;
    let predictions = result.predictions;

    if (useWeather && featureOverrides.latitude && featureOverrides.longitude) {
      try {
        console.log(`[API] Fetching weather forecast for lat: ${featureOverrides.latitude}, lon: ${featureOverrides.longitude}`);
        weather = await fetchWeatherForecast({
          latitude: featureOverrides.latitude,
          longitude: featureOverrides.longitude,
          days
        });

        if (weather.daily?.length) {
          predictions = applyWeatherAdjustment(result.predictions, weather.daily);
          console.log("[API] Weather adjustment applied successfully");
        }
      } catch (weatherError) {
        console.warn(`[API Warning] Weather adjustment failed:`, weatherError.message);
        weather = {
          source: "open-meteo",
          daily: [],
          message: `Weather adjustment unavailable: ${weatherError.message}`
        };
      }
    }

    console.log("[API] POST /api/forecast - Success");
    return res.json({
      success: true,
      ...result,
      realtime_mode: useWeather,
      feature_overrides_applied: featureOverrides,
      base_predictions: result.predictions,
      predictions,
      weather
    });
  } catch (error) {
    console.error(`[API Error] POST /api/forecast failed:`, error.stack || error.message);
    return res.status(500).json({ 
      success: false, 
      message: error.response?.data?.detail || error.message || "Internal Server Error" 
    });
  }
};

export const saveForecastParameters = async (req, res) => {
  try {
    const { name, latitude, longitude, forecast_days, realtime_mode, feature_overrides, results } = req.body;

    if (!name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: "Name, latitude, and longitude are required." });
    }

    const saved = await SavedForecast.create({
      user: req.user._id,
      name,
      latitude: Number(latitude),
      longitude: Number(longitude),
      forecast_days: forecast_days || 7,
      realtime_mode: realtime_mode ?? true,
      features: feature_overrides || {},
      results: results || null
    });

    return res.status(201).json({ success: true, data: saved });
  } catch (error) {
    console.error(`[API Error] saveForecastParameters failed:`, error);
    return res.status(500).json({ success: false, message: error.message || "Failed to save forecast" });
  }
};

export const getSavedForecasts = async (req, res) => {
  try {
    const saved = await SavedForecast.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, count: saved.length, data: saved });
  } catch (error) {
    console.error(`[API Error] getSavedForecasts failed:`, error);
    return res.status(500).json({ success: false, message: "Failed to retrieve saved forecasts" });
  }
};

export const deleteSavedForecast = async (req, res) => {
  try {
    const saved = await SavedForecast.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!saved) return res.status(404).json({ success: false, message: "Saved forecast not found" });
    return res.json({ success: true, data: {} });
  } catch (error) {
    console.error(`[API Error] deleteSavedForecast failed:`, error);
    return res.status(500).json({ success: false, message: "Failed to delete saved forecast" });
  }
};

