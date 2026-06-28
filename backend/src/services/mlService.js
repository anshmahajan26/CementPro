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

    // Calculate dynamic fallback scaling factor from overrides
    let fallbackMult = 1.0;
    
    // Default baselines
    const baseCement = 350;
    const baseSize = 2; // Medium
    const baseWbr = 0.45;
    const baseSlump = 120;
    
    if (featureOverrides.cement_kg_m3) {
      fallbackMult += (Number(featureOverrides.cement_kg_m3) - baseCement) / baseCement * 0.45;
    }
    if (featureOverrides.project_size) {
      let sizeVal = 2;
      if (typeof featureOverrides.project_size === "string") {
        if (featureOverrides.project_size.toLowerCase() === "large" || featureOverrides.project_size === "3") sizeVal = 3;
        else if (featureOverrides.project_size.toLowerCase() === "small" || featureOverrides.project_size === "1") sizeVal = 1;
      } else {
        sizeVal = Number(featureOverrides.project_size) || 2;
      }
      fallbackMult += (sizeVal - baseSize) / baseSize * 0.40;
    }
    if (featureOverrides.water_binder_ratio) {
      fallbackMult += (baseWbr - Number(featureOverrides.water_binder_ratio)) / baseWbr * 0.25;
    }
    if (featureOverrides.slump_mm) {
      fallbackMult += (Number(featureOverrides.slump_mm) - baseSlump) / baseSlump * 0.20;
    }
    
    fallbackMult = Math.max(0.2, Math.min(fallbackMult, 3.0));

    // Fallback logic for ML failure
    const predictions = Array.from({ length: days }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i); // Future dates starting today
      
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
      const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.55 : 1.0;
      const baseVal = 1500 + Math.sin(i) * 300; 
      
      const demandVal = Math.round(baseVal * weekendFactor * fallbackMult);

      return {
        date: date.toISOString().split("T")[0],
        predicted_demand_m3: demandVal,
        confidence_interval_lower: Math.round(demandVal * 0.9),
        confidence_interval_upper: Math.round(demandVal * 1.1)
      };
    });

    const hist_actual_vs_pred = Array.from({ length: 15 }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - 15 + i);
      const actual = 1600 + Math.sin(i) * 200;
      return {
        date: date.toISOString().split("T")[0],
        actual_demand_m3: Math.round(actual),
        predicted_demand_m3: Math.round(actual * 0.98)
      };
    });

    return { predictions, hist_actual_vs_pred, is_fallback: true };
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
