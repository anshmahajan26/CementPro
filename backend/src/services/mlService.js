import axios from "axios";

const mlApi = axios.create({
  baseURL: process.env.ML_API_URL || "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json"
  }
});

export const trainModel = async (records, downloadUrl = null) => {
  try {
    console.log(`[ML API] Calling /train-model ${downloadUrl ? 'with download URL' : `with ${records?.length} records`}`);
    const payload = downloadUrl ? { records: records || [], download_url: downloadUrl } : { records: records || [] };
    // ✅ FIX: Use 120s timeout for training — it's CPU-intensive and can take 30-90s
    const response = await mlApi.post("/train-model", payload, { timeout: 120000 });
    console.log(`[ML API] /train-model success`);
    return response.data;
  } catch (error) {
    console.error(`[ML API Error] /train-model failed:`, error.response?.data || error.message);
    throw new Error(error.response?.data?.detail || "ML model training failed");
  }
};

export const predictDemand = async (days = 7, featureOverrides = {}) => {
  try {
    console.log(`[ML API] Calling /predict-demand for ${days} days with overrides:`, featureOverrides);
    const response = await mlApi.post("/predict-demand", { days, feature_overrides: featureOverrides }, { timeout: 30000 });
    console.log(`[ML API] /predict-demand response received`);
    return response.data;
  } catch (error) {
    console.error(`[ML API Error] /predict-demand failed:`, error.response?.data || error.message);
    console.log(`[ML API Fallback] Generating safe dummy values for ${days} days to prevent crash`);

    // Fallback logic for ML failure
    const predictions = Array.from({ length: days }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i); // Future dates starting today
      return {
        date: date.toISOString().split("T")[0],
        predicted_demand_m3: 1500 + Math.random() * 500, // Safe dummy value between 1500 and 2000
        confidence_interval_lower: 1400,
        confidence_interval_upper: 2100
      };
    });

    return { predictions, is_fallback: true };
  }
};

export const getMetrics = async () => {
  try {
    console.log(`[ML API] Calling /get-metrics`);
    const response = await mlApi.get("/get-metrics", { timeout: 10000 });
    console.log(`[ML API] /get-metrics success`);
    return response.data;
  } catch (error) {
    console.error(`[ML API Error] /get-metrics failed:`, error.response?.data || error.message);
    return {
      metrics: { rmse: 0, mae: 0, r2: 0 },
      best_model: "Fallback Model",
      feature_importance: {},
      is_fallback: true
    };
  }
};
