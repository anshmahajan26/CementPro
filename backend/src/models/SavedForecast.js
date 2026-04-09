import mongoose from "mongoose";

const savedForecastSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    forecast_days: {
      type: Number,
      default: 7
    },
    realtime_mode: {
      type: Boolean,
      default: true
    },
    features: {
      project_size: { type: String, default: "" },
      day_in_project: { type: String, default: "" },
      cement_kg_m3: { type: String, default: "" },
      aggregate_10mm_pct: { type: String, default: "" },
      aggregate_20mm_pct: { type: String, default: "" },
      agg_moisture_content_pct: { type: String, default: "" },
      water_binder_ratio: { type: String, default: "" },
      slump_mm: { type: String, default: "" },
      batching_time_min: { type: String, default: "" },
      transport_time_min: { type: String, default: "" },
      truck_capacity_m3: { type: String, default: "" }
    },
    results: {
      type: Object,
      default: null
    }
  },
  {
    timestamps: true
  }
);

export const SavedForecast = mongoose.model("SavedForecast", savedForecastSchema);
