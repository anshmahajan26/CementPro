import {
  buildAlerts,
  buildDemandTrend,
  buildLocationInsights,
  buildProjectProgress,
  calculateCarbon,
  calculateProcurement,
  getLatestRecord
} from "../services/analyticsService.js";
import { getActiveDataset } from "../services/datasetService.js";
import { predictDemand } from "../services/mlService.js";
import { SavedForecast } from "../models/SavedForecast.js";

export const getDashboard = async (req, res) => {
  try {
    console.log("[API] GET /api/dashboard - Start");
    let rows = await getActiveDataset();
    if (!rows || !rows.length) {
      console.warn("[API] GET /api/dashboard - No dataset available");
      return res.status(400).json({ success: false, message: "No dataset available. Upload CSV first." });
    }

    const { forecastId } = req.query;
    let forecast;
    let activeLat = null;
    let activeLon = null;
    let locationName = null;

    if (forecastId) {
      const saved = await SavedForecast.findOne({ _id: forecastId, user: req.user._id });
      if (saved) {
        activeLat = saved.latitude;
        activeLon = saved.longitude;
        locationName = saved.name;
        
        // DYNAMIC PREDICTION HOOK: Instead of using the static saved array (which is often just a clone of the aggregate),
        // we force the ML Pipeline to re-run LIVE using the exact coordinates and features of the selected location.
        // This guarantees that the graphs reshape themselves uniquely!
        const liveForecast = await predictDemand(saved.forecast_days || 7, {
           latitude: activeLat,
           longitude: activeLon,
           ...(saved.features || {})
        });
        forecast = { predictions: liveForecast.predictions };
        
        // If realtime mode is on, we apply localized weather to force massive graph variance
        if (saved.realtime_mode !== false) {
           try {
             const { fetchWeatherForecast, applyWeatherAdjustment } = await import("../services/weatherService.js");
             const weather = await fetchWeatherForecast({ latitude: activeLat, longitude: activeLon, days: saved.forecast_days || 7 });
             if (weather && weather.daily) {
                forecast.predictions = applyWeatherAdjustment(forecast.predictions, weather.daily);
             }
           } catch (e) {
             console.warn("Weather adjustment skipped for dashboard.", e.message);
           }
        }

        // Make ALL dashboard metrics (KPIs, Carbon, Procurement) highly specific and dynamic to this location
        // Expanded geospatial tolerance from 0.001 to 0.05 degrees (approx 5km regional bound)
        const localRows = rows.filter(r =>
          Math.abs(Number(r.latitude) - Number(activeLat)) < 0.05 &&
          Math.abs(Number(r.longitude) - Number(activeLon)) < 0.05
        );
        if (localRows.length > 0) {
          rows = localRows;
        } else {
          // FATAL FIX: If the user bound a completely custom coordinate with no history, 
          // we synthesize a localized row from their saved parameters to prevent identical global metrics
          const globalAvgDem = rows.reduce((s, r) => s + r.daily_rmc_volume_m3, 0) / Math.max(rows.length, 1);
          rows = [{
            daily_rmc_volume_m3: forecast.predictions?.[0]?.predicted_demand_m3 || globalAvgDem,
            project_size: Number(saved.features?.project_size) || 2,
            day_in_project: Number(saved.features?.day_in_project) || 1,
            cement_kg_m3: Number(saved.features?.cement_kg_m3) || 350,
            aggregate_10mm_pct: Number(saved.features?.aggregate_10mm_pct) || 45,
            aggregate_20mm_pct: Number(saved.features?.aggregate_20mm_pct) || 55,
            agg_moisture_content_pct: Number(saved.features?.agg_moisture_content_pct) || 2.5,
            water_binder_ratio: Number(saved.features?.water_binder_ratio) || 0.45,
            transport_time_min: Number(saved.features?.transport_time_min) || 45,
            truck_capacity_m3: Number(saved.features?.truck_capacity_m3) || 8,
            latitude: Number(activeLat),
            longitude: Number(activeLon)
          }];
        }
      } else {
        return res.status(404).json({ success: false, message: "Saved forecast not found or invalid." });
      }
    } else {
      forecast = await predictDemand(7);
      const latest = getLatestRecord(rows);
      if (latest) {
        activeLat = latest.latitude;
        activeLon = latest.longitude;
      }
    }

    const procurement = calculateProcurement(forecast.predictions, rows);
    const carbon = calculateCarbon(forecast.predictions, rows, procurement);

    const currentDemand = rows[rows.length - 1]?.daily_rmc_volume_m3 || 0;
    const predictedDemand = forecast.predictions?.[0]?.predicted_demand_m3 || currentDemand;
    const cementNeeded = procurement.recommendation?.[0]?.cement_required_tonnes || 0;
    const emission = carbon.daily?.[0]?.total_emission_kgco2 || 0;

    const alerts = buildAlerts({ predictions: forecast.predictions, carbon, rows, procurement });

    const executiveSummary = `Next-day forecast is ${predictedDemand.toFixed(2)} m3. Cement need is ${cementNeeded.toFixed(2)} tonnes with ${carbon.sustainability_score.toFixed(1)} sustainability score.`;

    console.log("[API] GET /api/dashboard - Success");
    return res.json({
      success: true,
      active_location: activeLat && activeLon ? { lat: activeLat, lon: activeLon, name: locationName } : null,
      averages: procurement.averages,
      kpis: {
        current_demand_m3: currentDemand,
        predicted_demand_next_day_m3: predictedDemand,
        cement_needed_next_day_tonnes: cementNeeded,
        emission_next_day_kgco2: emission,
        sustainability_score: carbon.sustainability_score
      },
      charts: {
        // ✅ FIX: Cap chart datasets at 90 rows to prevent sending full dataset to client
        demand_trend: buildDemandTrend(forecast.predictions),
        project_progress_vs_demand: buildProjectProgress(rows),
        procurement_trend: procurement.recommendation,
        carbon_trend: carbon.daily
      },
      insights: {
        location_based: buildLocationInsights(rows)
      },
      stakeholder_summary: executiveSummary,
      alerts
    });
  } catch (error) {
    console.error(`[API Error] GET /api/dashboard failed:`, error.stack || error.message);
    return res.status(500).json({
      success: false,
      message: error.response?.data?.detail || error.message || "Internal Server Error"
    });
  }
};
