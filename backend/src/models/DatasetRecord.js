import mongoose from "mongoose";

const datasetRecordSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true, index: true },
    date: { type: Date, required: true },
    daily_rmc_volume_m3: { type: Number, required: true },
    project_size: { type: Number, required: true },
    day_in_project: { type: Number, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    cement_kg_m3: { type: Number, required: true },
    aggregate_10mm_pct: { type: Number, required: true },
    aggregate_20mm_pct: { type: Number, required: true },
    agg_moisture_content_pct: { type: Number, required: true },
    water_binder_ratio: { type: Number, required: true },
    slump_mm: { type: Number, required: true },
    batching_time_min: { type: Number, required: true },
    transport_time_min: { type: Number, required: true },
    truck_capacity_m3: { type: Number, required: true }
  },
  { timestamps: true }
);

datasetRecordSchema.index({ batchId: 1, date: 1 });

export const DatasetRecord = mongoose.model("DatasetRecord", datasetRecordSchema);
