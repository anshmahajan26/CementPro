import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { Loader2 } from "lucide-react";
// ✅ FIX: Static import (not React.lazy) — react-leaflet's MapContext crashes
// when Suspense unmounts/remounts the tree. Leaflet is still vendor-split by Vite.
import MapLocationPicker from "@/components/ui/MapLocationPicker";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import SavedForecastsManager from "@/components/ui/SavedForecastsManager";

const DEFAULT_CENTER = { lat: 28.7041, lng: 77.1025 };

const INITIAL_FEATURES = {
  project_size: "",
  day_in_project: "",
  latitude: "",
  longitude: "",
  cement_kg_m3: "",
  aggregate_10mm_pct: "",
  aggregate_20mm_pct: "",
  agg_moisture_content_pct: "",
  water_binder_ratio: "",
  slump_mm: "",
  batching_time_min: "",
  transport_time_min: "",
  truck_capacity_m3: ""
};

const MapFallback = () => (
  <div className="flex h-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
    Loading map…
  </div>
);

const getCached = (key, fallback) => {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
};

const ForecastPage = () => {
  const [days, setDays] = useState(() => getCached("fc_days", 7));
  const [useWeather, setUseWeather] = useState(() => getCached("fc_weather", true));
  const [inputFeatures, setInputFeatures] = useState(() => getCached("fc_inputs", INITIAL_FEATURES));
  const [result, setResult] = useState(() => getCached("fc_result", null));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showManager, setShowManager] = useState(false);

  const handleLoadConfig = (savedFeatures, savedDays, savedRealtime, savedResults, savedName) => {
    try {
      localStorage.setItem("fc_inputs", JSON.stringify(savedFeatures));
      localStorage.setItem("fc_days", JSON.stringify(savedDays));
      localStorage.setItem("fc_weather", JSON.stringify(savedRealtime));
      if (savedName) localStorage.setItem("fc_location_name", savedName);
      if (savedResults) localStorage.setItem("fc_result", JSON.stringify(savedResults));
    } catch(e) {}
    
    setInputFeatures(savedFeatures);
    setDays(savedDays);
    setUseWeather(savedRealtime);
    if (savedResults) {
      setResult(savedResults);
    }
  };

  const toNumericOverrides = useCallback(() => {
    const payload = {};
    Object.entries(inputFeatures).forEach(([key, value]) => {
      if (value === "") return;
      if (key === "project_size") { payload[key] = value; return; }
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) payload[key] = parsed;
    });
    return payload;
  }, [inputFeatures]);

  const fetchForecast = useCallback(async (targetDays) => {
    try {
      setError("");
      setLoading(true);
      const overrides = toNumericOverrides();
      const { data } = await api.post("/forecast", {
        days: Number(targetDays ?? days),
        useWeather,
        inputFeatures: overrides
      });
      setResult(data);
      
      // Persist to local storage to survive page refreshes instantly
      try {
        localStorage.setItem("fc_result", JSON.stringify(data));
        localStorage.setItem("fc_inputs", JSON.stringify(overrides));
        localStorage.setItem("fc_days", JSON.stringify(targetDays ?? days));
        localStorage.setItem("fc_weather", JSON.stringify(useWeather));
      } catch (e) {
        console.warn("Could not cache to localStorage");
      }

      // Auto-save trace history behind the scenes
      if (overrides.latitude && overrides.longitude) {
         // Fire-and-forget
         api.post("/forecast/saved", {
           name: `Prediction Trace (${formatNumber(overrides.latitude, 3)}, ${formatNumber(overrides.longitude, 3)})`,
           latitude: overrides.latitude,
           longitude: overrides.longitude,
           forecast_days: Number(targetDays ?? days),
           realtime_mode: useWeather,
           feature_overrides: overrides,
           results: data
         }).catch(err => console.warn("Failed to auto-save trace", err));
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to get forecast");
    } finally {
      setLoading(false);
    }
  }, [days, useWeather, toNumericOverrides]);



  const resetFeatures = () => setInputFeatures(INITIAL_FEATURES);

  return (
    <div className="space-y-5">
      <SavedForecastsManager 
        isOpen={showManager}
        onClose={() => setShowManager(false)}
        currentFeatures={inputFeatures}
        currentDays={days}
        currentRealtime={useWeather}
        currentResults={result}
        onLoadConfig={handleLoadConfig}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Smart Demand Forecasting Studio</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowManager(true)}>
            ⭐ Saved Results
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Forecast Days</p>
              <Input type="number" min={1} max={60} value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
            <div className="xl:col-span-3">
              <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Real-time Mode</p>
              <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm cursor-pointer">
                <input type="checkbox" checked={useWeather} onChange={(e) => setUseWeather(e.target.checked)} />
                Enable weather-adjusted predictions (Open-Meteo)
              </label>
            </div>
          </div>

          {/* Map section */}
          <div>
            <p className="mb-2 text-sm font-semibold">RMC Plant Location (Click to drop pin)</p>
            {/* ✅ Map wrapped in ErrorBoundary — if react-leaflet fails it degrades gracefully */}
            <div className="mb-3" style={{ height: "340px" }}>
              <ErrorBoundary
                fallback={
                  <div className="flex h-full items-center justify-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">
                    Map unavailable — location can be entered manually below
                  </div>
                }
              >
                <MapLocationPicker
                  inputFeatures={inputFeatures}
                  setInputFeatures={setInputFeatures}
                  defaultCenter={DEFAULT_CENTER}
                />
              </ErrorBoundary>
            </div>

            {inputFeatures.latitude && inputFeatures.longitude ? (
              <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="flex items-center gap-1.5 text-xs font-medium text-foreground px-3 py-1">
                  <span className="text-primary">📍</span>
                  {inputFeatures.locationName || `${Number(inputFeatures.latitude).toFixed(4)}, ${Number(inputFeatures.longitude).toFixed(4)}`}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-3 text-[10px]"
                  onClick={() => setInputFeatures((p) => ({ ...p, latitude: "", longitude: "", locationName: "" }))}
                >
                  Clear Location
                </Button>
              </div>
            ) : null}


            <p className="mb-2 text-sm font-semibold">Custom Feature Overrides (optional)</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Object.keys(INITIAL_FEATURES)
                .filter((k) => k !== "latitude" && k !== "longitude")
                .map((key) => (
                  <div key={key}>
                    <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{key}</p>
                    <Input
                      type={key === "project_size" ? "text" : "number"}
                      value={inputFeatures[key]}
                      onChange={(e) => setInputFeatures((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={key === "project_size" ? "auto / Small / Large" : "auto"}
                    />
                  </div>
                ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => fetchForecast(days)} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Forecast"
              )}
            </Button>
            <Button variant="outline" onClick={resetFeatures} disabled={loading}>
              Reset Overrides
            </Button>
          </div>

          {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        </CardContent>
      </Card>

      {result?.predictions ? (
        <>
          {/* KPI mini-cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Model Strategy</p>
                <p className="mt-2 font-heading text-2xl text-primary">{result.best_model}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg Forecast (m3)</p>
                <p className="mt-2 font-heading text-2xl text-primary">
                  {formatNumber(
                    result.predictions.reduce(
                      (sum, item) => sum + (item.adjusted_predicted_demand_m3 ?? item.predicted_demand_m3),
                      0
                    ) / Math.max(result.predictions.length, 1)
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Hybrid Weight (XGB)</p>
                <p className="mt-2 font-heading text-2xl text-primary">
                  {formatNumber((result.hybrid_weights?.xgb || 0) * 100)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Hybrid Weight (RF)</p>
                <p className="mt-2 font-heading text-2xl text-primary">
                  {formatNumber((result.hybrid_weights?.rf || 0) * 100)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Stakeholder summary */}
          <Card>
            <CardHeader>
              <CardTitle>Stakeholder Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {result.stakeholder_note || "Hybrid forecast is ready for planning decisions."}
              </p>
              <p className="text-sm text-muted-foreground">
                Use final demand column for procurement and dispatch planning. XGBoost and RandomForest lines are shown for transparency.
              </p>
            </CardContent>
          </Card>

          {/* Main forecast chart */}
          <Card>
            <CardHeader>
              <CardTitle>Forecast Curve ({result.best_model})</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge>Model: {result.best_model}</Badge>
                <Badge className="bg-primary/10 text-primary">
                  Weather mode: {result.realtime_mode ? "ON" : "OFF"}
                </Badge>
              </div>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart
                  data={result.predictions.map((item) => ({
                    ...item,
                    display_prediction: item.adjusted_predicted_demand_m3 ?? item.predicted_demand_m3
                  }))}
                  margin={{ top: 20, right: 30, left: 30, bottom: 25 }}
                >
                  <defs>
                    <linearGradient id="colorPredicted" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={1} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} label={{ value: "Date", position: "insideBottom", offset: -18, fill: "hsl(var(--muted-foreground))", fontSize: 13 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} label={{ value: "Demand of Cement (m³)", angle: -90, position: "insideLeft", style: {textAnchor: 'middle'}, offset: -15, fill: "hsl(var(--muted-foreground))", fontSize: 13 }} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="display_prediction"
                    name="Predicted demand"
                    stroke="url(#colorPredicted)"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                  <Line type="monotone" dataKey="xgboost_predicted_m3" name="XGBoost" stroke="#06b6d4" strokeWidth={2} strokeOpacity={0.6} dot={false} />
                  <Line type="monotone" dataKey="random_forest_predicted_m3" name="RandomForest" stroke="#f43f5e" strokeWidth={2} strokeOpacity={0.6} dot={false} />
                  {result.realtime_mode ? (
                    <Line type="monotone" dataKey="base_predicted_demand_m3" name="Base model" stroke="hsl(var(--accent))" strokeWidth={1.8} strokeDasharray="6 4" />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>


          {/* Final demand area trend */}
          <Card>
            <CardHeader>
              <CardTitle>Final Demand Area Trend</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={result.predictions.map((item) => ({
                    ...item,
                    final_prediction: item.adjusted_predicted_demand_m3 ?? item.predicted_demand_m3
                  }))}
                  margin={{ top: 20, right: 30, left: 30, bottom: 25 }}
                >
                  <defs>
                    <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} label={{ value: "Date", position: "insideBottom", offset: -18, fill: "hsl(var(--muted-foreground))", fontSize: 13 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} label={{ value: "Demand of Cement (m³)", angle: -90, position: "insideLeft", style: {textAnchor: 'middle'}, offset: -15, fill: "hsl(var(--muted-foreground))", fontSize: 13 }} />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }} />
                  <Area type="monotone" dataKey="final_prediction" name="Final Demand" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorArea)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Weather signal */}
          {result.weather?.daily?.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Weather Signal</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <p className="text-sm text-muted-foreground">Source: {result.weather.source}</p>
                <p className="text-sm text-muted-foreground">Lat: {formatNumber(result.weather.latitude, 4)}</p>
                <p className="text-sm text-muted-foreground">Lon: {formatNumber(result.weather.longitude, 4)}</p>
                <p className="text-sm text-muted-foreground">Days fetched: {result.weather.daily.length}</p>
              </CardContent>
            </Card>
          ) : null}

          {/* Prediction table */}
          <Card>
            <CardHeader>
              <CardTitle>Prediction Table</CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2">Date</th>
                    <th className="py-2">Base Demand (m3)</th>
                    <th className="py-2">Weather Condition</th>
                    <th className="py-2">Factor</th>
                    <th className="py-2">Final Demand (m3)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.predictions.map((item) => {
                    const condition = item.weather_condition;
                    const temp = item.avg_temp_c !== undefined && item.avg_temp_c !== 0 ? `${item.avg_temp_c}°C` : "";
                    const conditionDisplay = condition ? `${condition} ${temp}`.trim() : "Normal";
                    return (
                      <tr key={item.date} className="border-b border-border/70">
                        <td className="py-2">{item.date}</td>
                        <td className="py-2 font-medium">
                          {formatNumber(item.base_predicted_demand_m3 ?? item.predicted_demand_m3)}
                        </td>
                        <td className="py-2 text-muted-foreground">{conditionDisplay}</td>
                        <td className="py-2 text-muted-foreground">{formatNumber(item.weather_factor ?? 1, 3)}x</td>
                        <td className="py-2 font-bold text-primary">
                          {formatNumber(item.adjusted_predicted_demand_m3 ?? item.predicted_demand_m3)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default ForecastPage;
