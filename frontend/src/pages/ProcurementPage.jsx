import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import SavedForecastsManager from "@/components/ui/SavedForecastsManager";
import SavedProcurementsManager from "@/components/ui/SavedProcurementsManager";
import LocationNameRenderer from "@/components/ui/LocationNameRenderer";
const ProcurementPage = () => {
  const [days, setDays] = useState(7);
  const [inventory, setInventory] = useState(500);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [isSavedManagerOpen, setIsSavedManagerOpen] = useState(false);
  const [isProcurementManagerOpen, setIsProcurementManagerOpen] = useState(false);
  const [isForecastManagerOpen, setIsForecastManagerOpen] = useState(false);
  const [activeLocation, setActiveLocation] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [cementType, setCementType] = useState("OPC 43");

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

      setIsSimulating(true);

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
    } finally {
      setIsSimulating(false);
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

  const getResolvedLocationName = async (lat, lon, name) => {
    const isCoordinateLike = !name || name.includes("Prediction Trace") || name === "Active Site" || /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(name);
    if (isCoordinateLike && lat && lon) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`);
        const data = await res.json();
        const fetchedName = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.county || data?.display_name?.split(",")[0];
        if (fetchedName) return fetchedName;
      } catch (e) {
        console.warn("Failed to reverse geocode", e);
      }
    }
    return name || `${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`;
  };

  const handleCreateOrder = async () => {
    if (!data) {
      alert("Please simulate the burn-down plan first before dispatching orders.");
      return;
    }
    if (!activeLocation) {
      alert("Please bind a location to this plan before dispatching.");
      return;
    }
    if (!data.recommendation) {
      alert("Burn-down plan data is missing or incomplete. Try simulating again.");
      return;
    }
    try {
      setIsDispatching(true);

      const resolvedName = await getResolvedLocationName(activeLocation.lat, activeLocation.lon, activeLocation.name);

      // Create an array of daily orders where requirement > 0
      const ordersToCreate = data.recommendation
        .filter(day => day.cement_required_tonnes > 0)
        .map(day => ({
          cementType: cementType,
          quantity: Math.ceil(day.cement_required_tonnes),
          destination: `${resolvedName} (${day.date})`
        }));

      if (ordersToCreate.length === 0) {
        alert("No deliveries required in the simulated period.");
        return;
      }

      await api.post("/orders/bulk", { orders: ordersToCreate });
      alert(`Successfully dispatched ${ordersToCreate.length} daily orders to the Operator!`);
    } catch (err) {
      alert("Failed to create orders: " + (err.response?.data?.message || err.message));
    } finally {
      setIsDispatching(false);
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
        <CardHeader className="pb-3 px-4 sm:px-6">
          {/* Title row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base sm:text-lg">Cement Procurement Planning</CardTitle>
            {activeLocation ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[10px] sm:text-xs self-start sm:self-auto">
                📍 <LocationNameRenderer name={activeLocation.name} lat={activeLocation.lat} lon={activeLocation.lon} />
              </Badge>
            ) : null}
          </div>
          {/* Action buttons row */}
          <div className="flex flex-wrap gap-2 mt-2">
            <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={() => setIsForecastManagerOpen(true)}>
              ⭐ Load Forecast Profile
            </Button>
            <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={() => setIsProcurementManagerOpen(true)}>
              📋 Saved Procurements
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {/* Inputs + simulate row */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:items-center sm:gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Forecast Days</span>
                <Input type="number" min={1} max={60} value={days} onChange={(e) => setDays(e.target.value)} className="w-full sm:w-24" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Current Silo (t)</span>
                <Input type="number" min={0} value={inventory} onChange={(e) => setInventory(e.target.value)} className="w-full sm:w-32 border-primary/50 bg-primary/5 font-semibold text-primary" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Cement Type</span>
                <select 
                  value={cementType} 
                  onChange={(e) => setCementType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-32 border-primary/50 bg-primary/5 font-semibold text-primary"
                >
                  <option value="OPC 43">OPC 43</option>
                  <option value="OPC 53">OPC 53</option>
                  <option value="PPC">PPC</option>
                  <option value="PSC">PSC</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="flex-1 sm:flex-none whitespace-nowrap" onClick={() => loadData(days, inventory)} disabled={isSimulating}>
                {isSimulating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Simulating...</>
                ) : (
                  "Simulate Burn-Down"
                )}
              </Button>
              <Button variant="outline" className="flex-1 sm:flex-none text-amber-600 border-amber-200 bg-amber-50 whitespace-nowrap" onClick={() => setIsSavedManagerOpen(true)}>
                Bind Forecast Site
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
            <p className="text-blue-700 max-w-md mb-6">Location <strong><LocationNameRenderer name={activeLocation.name} lat={activeLocation.lat} lon={activeLocation.lon} /></strong> securely loaded. Please input your precise starting Silo Cement in Tonnes, and hit Simulate Burn-Down to generate your logistics tracking board.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <Button
              onClick={handleCreateOrder}
              disabled={isDispatching}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white shadow-md font-semibold text-sm"
            >
              {isDispatching ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Dispatching...</>
              ) : (
                "🚚 Dispatch Order to Operator"
              )}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Card>
              <CardContent className="pt-4 px-3 sm:px-5 sm:pt-5">
                <p className="text-[10px] sm:text-sm text-muted-foreground leading-tight">Total Cement Required</p>
                <p className="font-heading text-xl sm:text-3xl text-primary mt-1">{formatNumber(data.total_cement_required_tonnes)} t</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 px-3 sm:px-5 sm:pt-5">
                <p className="text-[10px] sm:text-sm text-muted-foreground leading-tight">Avg Cement Ratio (kg/m³ RMC)</p>
                <p className="font-heading text-xl sm:text-3xl text-primary mt-1">{formatNumber(data.averages.cement_kg_m3)} kg/m³</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 px-3 sm:px-5 sm:pt-5">
                <p className="text-[10px] sm:text-sm text-muted-foreground leading-tight">Avg Daily Cement</p>
                <p className="font-heading text-xl sm:text-3xl text-primary mt-1">{formatNumber(data.avg_daily_cement_tonnes)} t/day</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 px-3 sm:px-5 sm:pt-5">
                <p className="text-[10px] sm:text-sm text-muted-foreground leading-tight">Procurement Risk</p>
                <p className="font-heading text-xl sm:text-3xl text-primary mt-1">{data.procurement_risk_level}</p>
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

          <Card>
            <CardHeader className="px-4 sm:px-6 pb-2">
              <CardTitle className="text-sm sm:text-base">Demand vs Cement Trend</CardTitle>
            </CardHeader>
            <CardContent className="h-64 sm:h-80 md:h-[400px] px-1 sm:px-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.recommendation} margin={{ top: 10, right: 8, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{fontSize: 10}} tickFormatter={v => v?.slice(5)} minTickGap={20} label={{ value: "Date", position: "insideBottom", offset: -12, fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{fontSize: 10}} width={45} label={{ value: "Demand (m³)", angle: -90, position: "insideLeft", style: {textAnchor: 'middle'}, fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{fontSize: 10}} width={40} label={{ value: "Cement (t)", angle: 90, position: "insideRight", style: {textAnchor: 'middle'}, fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "10px", backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="left" type="monotone" dataKey="predicted_demand_m3" name="RMC Demand" stroke="#0284c7" strokeWidth={2} dot={{r: 2}} activeDot={{r: 4}} />
                  <Line yAxisId="right" type="monotone" dataKey="cement_required_tonnes" name="Cement Load" stroke="#f97316" strokeWidth={2} dot={{r: 2}} activeDot={{r: 4}} />
                  <Line yAxisId="right" type="stepAfter" dataKey="inventory_remaining_tonnes" name="Silo" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
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
                    <th className="py-2">RMC Demand (m³/day)</th>
                    <th className="py-2">Daily Cement Base (kg)</th>
                    <th className="py-2">Cement Required (t/day)</th>
                    <th className="py-2">Silo Remaining (t)</th>
                    <th className="py-2">Shortfall (t/day)</th>
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
