import mongoose from "mongoose";

const savedCarbonSchema = new mongoose.Schema(
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
    blend_factor: {
      type: Number,
      default: 0.92
    },
    realtime_mode: {
      type: Boolean,
      default: true
    },
    features: {
      type: Object,
      default: {}
    },
    results: {
      type: Object,
      required: true
    }
  },
  {
    timestamps: true
  }
);

export const SavedCarbon = mongoose.model("SavedCarbon", savedCarbonSchema);
