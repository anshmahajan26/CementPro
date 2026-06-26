import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import SavedForecastsManager from "@/components/ui/SavedForecastsManager";
import SavedProcurementsManager from "@/components/ui/SavedProcurementsManager";
const ProcurementPage = () => {
  const [days, setDays] = useState(7);
  const [inventory, setInventory] = useState(500);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [isSavedManagerOpen, setIsSavedManagerOpen] = useState(false);
  const [isForecastManagerOpen, setIsForecastManagerOpen] = useState(false);
  const [activeLocation, setActiveLocation] = useState(null);

  const loadData = async (targetDays = days, targetInv = inventory, customInputs = null, customWeather = null) => {
    try {
      setError("");

      let inputs = customInputs;
      if (!inputs) {
        try { inputs = JSON.parse(localStorage.getItem("fc_inputs")) || {}; } catch(e) { inputs = {}; }
      }
      
      let useWeather = customWeather;
      if (useWeather === null) {
        try { useWeather = JSON.parse(localStorage.getItem("fc_weather")) || false; } catch(e) { useWeather = false; }
      }
      
      let locName = "Active Site";
      try { locName = localStorage.getItem("fc_location_name") || "Active Site"; } catch(e) {}

      if (inputs.latitude && inputs.longitude) {
         setActiveLocation({ lat: inputs.latitude, lon: inputs.longitude, name: locName });
      } else {
         setActiveLocation(null);
         return; // Enforce missing location rule
      }

      const response = await api.post(`/procurement`, {
        days: Number(targetDays),
        inventory: Number(targetInv),
        useWeather,
        inputFeatures: inputs
      });

      setData(response.data);

      try {
        localStorage.setItem("fc_days", JSON.stringify(Number(targetDays)));
        localStorage.setItem("fc_inputs", JSON.stringify(inputs));
        localStorage.setItem("fc_weather", JSON.stringify(useWeather));
        localStorage.setItem("fc_proc_result", JSON.stringify(response.data));
      } catch(e) { /* ignore */ }

      if (inputs.latitude && inputs.longitude) {
         api.post("/procurement/saved", {
           name: `${locName} - Procurement Plan`,
           latitude: inputs.latitude,
           longitude: inputs.longitude,
           forecast_days: Number(targetDays),
           inventory: Number(targetInv),
           realtime_mode: useWeather,
           feature_overrides: inputs,
           results: response.data
         }).catch(err => console.warn("Failed to auto-save procurement trace", err));
      }

    } catch (err) {
      setError(err.response?.data?.message || "Failed to load procurement");
    }
  };

  const handleLoadConfig = (savedFeatures, savedDays, savedRealtime, savedResults, savedName) => {
    try {
      localStorage.setItem("fc_inputs", JSON.stringify(savedFeatures));
      localStorage.setItem("fc_days", JSON.stringify(savedDays));
      localStorage.setItem("fc_weather", JSON.stringify(savedRealtime));
      if (savedName) localStorage.setItem("fc_location_name", savedName);
    } catch(e) {}
    
    setDays(savedDays);
    
    if (savedFeatures.latitude && savedFeatures.longitude) {
       setActiveLocation({ lat: savedFeatures.latitude, lon: savedFeatures.longitude, name: savedName || "Active Site" });
    }
    
    // Explicitly halt chart output until user provides cement input
    setData(null);
  };

  const handleLoadProcurement = (savedFeatures, savedDays, savedInv, savedRealtime, savedResults, savedName) => {
    try {
      localStorage.setItem("fc_inputs", JSON.stringify(savedFeatures));
      localStorage.setItem("fc_days", JSON.stringify(savedDays));
      localStorage.setItem("fc_weather", JSON.stringify(savedRealtime));
      if (savedName) localStorage.setItem("fc_location_name", savedName);
      if (savedResults) localStorage.setItem("fc_proc_result", JSON.stringify(savedResults));
    } catch(e) {}
    
    setDays(savedDays);
    setInventory(savedInv || 0);
    
    if (savedFeatures.latitude && savedFeatures.longitude) {
       setActiveLocation({ lat: savedFeatures.latitude, lon: savedFeatures.longitude, name: savedName || "Active Site" });
    }
    
    if (savedResults) {
      setData(savedResults);
    }
  };

  useEffect(() => {
    let initialDays = 7;
    try { initialDays = JSON.parse(localStorage.getItem("fc_days")) || 7; } catch(e) {}
    setDays(initialDays);

    let cachedResult = null;
    try { cachedResult = JSON.parse(localStorage.getItem("fc_proc_result")); } catch(e){}
    
    let inputs = {};
    try { inputs = JSON.parse(localStorage.getItem("fc_inputs")) || {}; } catch(e) {}
    
    let savedLocName = "Active Site";
    try { savedLocName = localStorage.getItem("fc_location_name") || "Active Site"; } catch(e) {}

    if (inputs.latitude && inputs.longitude) {
       setActiveLocation({ lat: inputs.latitude, lon: inputs.longitude, name: savedLocName });
    }

    if (cachedResult) {
      setData(cachedResult);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <SavedForecastsManager 
        isOpen={isForecastManagerOpen}
        onClose={() => setIsForecastManagerOpen(false)}
        currentFeatures={{}}
        currentDays={days}
        currentRealtime={false}
        currentResults={null}
        onLoadConfig={(features, d, rt, res, name) => {
          handleLoadConfig(features, d, rt, null, name);
          setIsForecastManagerOpen(false);
        }}
      />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cement Procurement Planning</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsForecastManagerOpen(true)}>
                ⭐ Load Forecast Profile
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsSavedManagerOpen(true)}>
                ⭐ Saved Procurements
              </Button>
            </div>
            {activeLocation ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">
                📍 {activeLocation.name}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Forecast Days:</span>
                <Input type="number" min={1} max={60} value={days} onChange={(e) => setDays(e.target.value)} className="w-24" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Current Silo (t):</span>
                <Input type="number" min={0} value={inventory} onChange={(e) => setInventory(e.target.value)} className="w-32 border-primary/50 bg-primary/5 font-semibold text-primary" />
              </div>
              <Button className="whitespace-nowrap shrink-0" onClick={() => loadData(days, inventory)}>Simulate Burn-Down</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
              <Button variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 whitespace-nowrap shrink-0" onClick={() => setIsSavedManagerOpen(true)}>
                Bind Forecast Site
              </Button>
              <Button variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 whitespace-nowrap shrink-0" onClick={() => setIsProcurementManagerOpen(true)}>
                Saved Procurement Plans
              </Button>
            </div>
          </div>
          {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        </CardContent>
      </Card>

      <SavedForecastsManager 
        isOpen={isSavedManagerOpen} 
        onClose={() => setIsSavedManagerOpen(false)} 
        onLoadConfig={handleLoadConfig}
      />
      <SavedProcurementsManager 
        isOpen={isProcurementManagerOpen} 
        onClose={() => setIsProcurementManagerOpen(false)} 
        onLoadProcurement={handleLoadProcurement}
      />

      {activeLocation === null ? (
        <Card className="border-amber-200 bg-amber-50 shadow-sm mt-4">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="rounded-full bg-amber-100 p-4 mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-amber-900 mb-2">Location Context Required</h2>
            <p className="text-amber-700 max-w-md mb-6">You must select an actively forecasted location to simulate a supply chain burn-down. This mathematically links the procurement output to the explicit geometry and weather characteristics of your physical project.</p>
            <Button onClick={() => setIsSavedManagerOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white shadow-md">
              Open Saved Profiles
            </Button>
          </CardContent>
        </Card>
      ) : data === null ? (
        <Card className="border-blue-200 bg-blue-50 shadow-sm mt-4">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="rounded-full bg-blue-100 p-4 mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-blue-900 mb-2">Simulation Ready</h2>
            <p className="text-blue-700 max-w-md mb-6">Location <strong>{activeLocation.name}</strong> securely loaded. Please input your precise starting Silo Cement in Tonnes, and hit Simulate Burn-Down to generate your logistics tracking board.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Total Cement Required</p>
                <p className="font-heading text-3xl text-primary">{formatNumber(data.total_cement_required_tonnes)} t</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Average Cement Ratio</p>
                <p className="font-heading text-3xl text-primary">{formatNumber(data.averages.cement_kg_m3)} kg/m3</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Avg Daily Cement</p>
                <p className="font-heading text-3xl text-primary">{formatNumber(data.avg_daily_cement_tonnes)} t/day</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Procurement Risk</p>
                <p className="font-heading text-3xl text-primary">{data.procurement_risk_level}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Stakeholder Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Badge className="bg-primary/10 text-primary">
                {data.procurement_risk_level === "SURPLUS" ? "SURPLUS capacity holding" : `${data.procurement_risk_level} procurement pressure`}
              </Badge>
              <p className="text-sm text-muted-foreground">{data.stakeholder_summary}</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Demand vs Cement Trend</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.recommendation} margin={{ top: 20, right: 30, left: 30, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" label={{ value: "Date", position: "insideBottom", offset: -18, fill: "hsl(var(--muted-foreground))", fontSize: 13 }} />
                    <YAxis yAxisId="left" tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" label={{ value: "RMC Demand (m³)", angle: -90, position: "insideLeft", style: {textAnchor: 'middle'}, offset: -15, fill: "hsl(var(--muted-foreground))", fontSize: 13 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" label={{ value: "Cement Load (t)", angle: 90, position: "insideRight", style: {textAnchor: 'middle'}, offset: -15, fill: "hsl(var(--muted-foreground))", fontSize: 13 }} />
                    <Tooltip contentStyle={{ borderRadius: "10px", backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Legend verticalAlign="top" height={36} />
                    <Line yAxisId="left" type="monotone" dataKey="predicted_demand_m3" name="RMC Demand (m³)" stroke="#0284c7" strokeWidth={3} dot={{r: 3}} activeDot={{r: 6}} />
                    <Line yAxisId="right" type="monotone" dataKey="cement_required_tonnes" name="Cement Load (Tonnes)" stroke="#f97316" strokeWidth={3} dot={{r: 3}} activeDot={{r: 6}} />
                    <Line yAxisId="right" type="stepAfter" dataKey="inventory_remaining_tonnes" name="Silo Inventory (t)" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Aggregate Mix Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "10mm Aggregate", value: data.averages.aggregate_10mm_pct },
                        { name: "20mm Aggregate", value: data.averages.aggregate_20mm_pct }
                      ]}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={90}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      <Cell fill="#06b6d4" />
                      <Cell fill="#f43f5e" />
                    </Pie>
                    <Tooltip formatter={(val) => `${formatNumber(val, 1)}%`} contentStyle={{ borderRadius: "10px", backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Daily Cement Requirement Bars</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.recommendation} margin={{ top: 20, right: 30, left: 30, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" label={{ value: "Date", position: "insideBottom", offset: -18, fill: "hsl(var(--muted-foreground))", fontSize: 13 }} />
                  <YAxis tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" label={{ value: "Cement Load (Tonnes)", angle: -90, position: "insideLeft", style: {textAnchor: 'middle'}, offset: -15, fill: "hsl(var(--muted-foreground))", fontSize: 13 }} />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} contentStyle={{ borderRadius: "10px", backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="cement_required_tonnes" name="Daily Cement Required (Tonnes)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {data.purchase_alerts && data.purchase_alerts.length > 0 ? (
            <Card className="border-red-500/50 shadow-md">
              <CardHeader className="bg-red-500/5 pb-4">
                <CardTitle className="text-red-600 flex items-center gap-2">
                  <span>Actionable Purchase Alerts</span>
                  <Badge variant="destructive">{data.purchase_alerts.length} Critical</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.purchase_alerts.map((alert, idx) => (
                  <div key={idx} className="flex flex-col gap-2 p-4 border border-red-200 bg-red-50/50 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                    <span className="font-bold text-red-600 uppercase tracking-wider text-[10px]">Pending Order — {alert.date}</span>
                    <span className="font-heading text-xl text-slate-800">{alert.shortfall_tonnes} Tonnes</span>
                    <span className="text-sm text-slate-600">{alert.message}</span>
                    <Button size="sm" variant="outline" className="mt-2 w-full bg-white hover:bg-red-50 border-red-200 text-red-600">Dispatch Order</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-green-500/50 shadow-sm">
               <CardHeader className="bg-green-500/5">
                 <CardTitle className="text-green-600">Inventory Status Healthy</CardTitle>
               </CardHeader>
               <CardContent className="pt-5 pb-5">
                 <p className="text-sm text-muted-foreground">Current silo inventory is sufficient to cover the entire forecasted horizon. No active purchasing intervention is required at this time.</p>
               </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Material Planning Insight</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">{data.insight}</p>
              <p className="text-sm">Aggregate 10mm: {formatNumber(data.averages.aggregate_10mm_pct)}%</p>
              <p className="text-sm">Aggregate 20mm: {formatNumber(data.averages.aggregate_20mm_pct)}%</p>
              <p className="text-sm">Moisture: {formatNumber(data.averages.agg_moisture_content_pct)}%</p>
              <p className="text-sm">Water/Binder Ratio: {formatNumber(data.averages.water_binder_ratio, 3)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Procurement Recommendation</CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2">Expected Date</th>
                    <th className="py-2">RMC Demand (m³)</th>
                    <th className="py-2">Cement Base (kg)</th>
                    <th className="py-2">Cement Required (t)</th>
                    <th className="py-2">Silo Remaining (t)</th>
                    <th className="py-2">Shortfall (t)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recommendation.map((row) => (
                    <tr key={row.date} className="border-b border-border/70">
                      <td className="py-2">{row.date}</td>
                      <td className="py-2">{formatNumber(row.predicted_demand_m3)}</td>
                      <td className="py-2">{formatNumber(row.cement_required_kg)}</td>
                      <td className="py-2">{formatNumber(row.cement_required_tonnes)}</td>
                      <td className="py-2 font-semibold text-emerald-600">{formatNumber(row.inventory_remaining_tonnes)}</td>
                      <td className="py-2 font-bold text-red-500">{row.shortfall_tonnes > 0 ? formatNumber(row.shortfall_tonnes) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ProcurementPage;
