import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import SavedForecastsManager from "@/components/ui/SavedForecastsManager";
import SavedCarbonsManager from "@/components/ui/SavedCarbonsManager";

const CarbonPage = () => {
  const [days, setDays] = useState(7);
  const [blendFactor, setBlendFactor] = useState("0.92");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [isSavedManagerOpen, setIsSavedManagerOpen] = useState(false);
  const [isCarbonManagerOpen, setIsCarbonManagerOpen] = useState(false);
  const [isForecastManagerOpen, setIsForecastManagerOpen] = useState(false);
  const [activeLocation, setActiveLocation] = useState(null);
  const [isEstimating, setIsEstimating] = useState(false);

  const loadData = async (targetDays = days, targetBlend = blendFactor, customInputs = null, customWeather = null) => {
    try {
      setError("");

      let inputs = customInputs;
      if (!inputs) {
        try { inputs = JSON.parse(localStorage.getItem("fc_inputs")) || {}; } catch (e) { inputs = {}; }
      }

      let useWeather = customWeather;
      if (useWeather === null) {
        try { useWeather = JSON.parse(localStorage.getItem("fc_weather")) || false; } catch (e) { useWeather = false; }
      }

      let locName = "Active Site";
      try { locName = localStorage.getItem("fc_location_name") || "Active Site"; } catch (e) { }

      if (inputs.latitude && inputs.longitude) {
        setActiveLocation({ lat: inputs.latitude, lon: inputs.longitude, name: locName });
      } else {
        setActiveLocation(null);
        return; // Enforce missing location rule
      }

      setIsEstimating(true);

      const response = await api.post(`/carbon`, {
        days: Number(targetDays),
        blendFactor: Number(targetBlend),
        useWeather,
        inputFeatures: inputs
      });

      setData(response.data);

      try {
        localStorage.setItem("fc_days", JSON.stringify(Number(targetDays)));
        localStorage.setItem("fc_inputs", JSON.stringify(inputs));
        localStorage.setItem("fc_weather", JSON.stringify(useWeather));
        localStorage.setItem("fc_carbon_result", JSON.stringify(response.data));
      } catch (e) { /* ignore */ }

      if (inputs.latitude && inputs.longitude) {
        api.post("/carbon/saved", {
          name: `${locName} - Carbon Footprint`,
          latitude: inputs.latitude,
          longitude: inputs.longitude,
          forecast_days: Number(targetDays),
          blend_factor: Number(targetBlend),
          realtime_mode: useWeather,
          feature_overrides: inputs,
          results: response.data
        }).catch(err => console.warn("Failed to auto-save carbon trace", err));
      }

    } catch (err) {
      setError(err.response?.data?.message || "Failed to calculate sustainability footprint");
    } finally {
      setIsEstimating(false);
    }
  };

  const handleLoadConfig = (savedFeatures, savedDays, savedRealtime, savedResults, savedName) => {
    try {
      localStorage.setItem("fc_inputs", JSON.stringify(savedFeatures));
      localStorage.setItem("fc_days", JSON.stringify(savedDays));
      localStorage.setItem("fc_weather", JSON.stringify(savedRealtime));
      if (savedName) localStorage.setItem("fc_location_name", savedName);
    } catch (e) { }

    setDays(savedDays);

    if (savedFeatures.latitude && savedFeatures.longitude) {
      setActiveLocation({ lat: savedFeatures.latitude, lon: savedFeatures.longitude, name: savedName || "Active Site" });
    }

    setData(null);
  };

  const handleLoadCarbon = (savedFeatures, savedDays, savedBlend, savedRealtime, savedResults, savedName) => {
    try {
      localStorage.setItem("fc_inputs", JSON.stringify(savedFeatures));
      localStorage.setItem("fc_days", JSON.stringify(savedDays));
      localStorage.setItem("fc_weather", JSON.stringify(savedRealtime));
      if (savedName) localStorage.setItem("fc_location_name", savedName);
      if (savedResults) localStorage.setItem("fc_carbon_result", JSON.stringify(savedResults));
    } catch (e) { }

    setDays(savedDays);
    setBlendFactor(savedBlend ? String(savedBlend) : "0.92");

    if (savedFeatures.latitude && savedFeatures.longitude) {
      setActiveLocation({ lat: savedFeatures.latitude, lon: savedFeatures.longitude, name: savedName || "Active Site" });
    }

    if (savedResults) {
      setData(savedResults);
    }
  };

  useEffect(() => {
    let initialDays = 7;
    try { initialDays = JSON.parse(localStorage.getItem("fc_days")) || 7; } catch (e) { }
    setDays(initialDays);

    let cachedResult = null;
    try { cachedResult = JSON.parse(localStorage.getItem("fc_carbon_result")); } catch (e) { }

    let inputs = {};
    try { inputs = JSON.parse(localStorage.getItem("fc_inputs")) || {}; } catch (e) { }

    let savedLocName = "Active Site";
    try { savedLocName = localStorage.getItem("fc_location_name") || "Active Site"; } catch (e) { }

    if (inputs.latitude && inputs.longitude) {
      setActiveLocation({ lat: inputs.latitude, lon: inputs.longitude, name: savedLocName });
    }

    if (cachedResult) {
      setData(cachedResult);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2">
      <SavedForecastsManager
        isOpen={isForecastManagerOpen}
        onClose={() => setIsForecastManagerOpen(false)}
        onLoadConfig={handleLoadConfig}
      />
      <SavedCarbonsManager
        isOpen={isCarbonManagerOpen}
        onClose={() => setIsCarbonManagerOpen(false)}
        onLoadCarbon={handleLoadCarbon}
      />

      <Card className="border-emerald-100 shadow-sm">
        <CardHeader className="bg-emerald-50/50 pb-4 border-b border-emerald-100/50">
          <CardTitle className="text-emerald-950 font-bold flex items-center justify-between">
            <span>Sustainability & Carbon Output Simulation</span>
            {!activeLocation && (
              <Badge variant="outline" className="text-emerald-600 border-emerald-200 uppercase tracking-widest text-[10px]">Unbound</Badge>
            )}
            {activeLocation && (
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 py-1.5 px-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                Bound: {activeLocation.name}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Forecast Days:</span>
                <Input type="number" min={1} max={60} value={days} onChange={(e) => setDays(e.target.value)} className="w-24" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Cement Blend:</span>
                <select value={blendFactor} onChange={(e) => setBlendFactor(e.target.value)} className="flex h-10 w-44 items-center justify-between rounded-md border border-emerald-500/50 bg-emerald-500/5 px-3 py-2 text-sm font-semibold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
                  <option value="0.92">OPC (Standard)</option>
                  <option value="0.72">PPC (Fly Ash)</option>
                  <option value="0.65">PSC (Slag)</option>
                  <option value="0.55">LC3 (Limestone)</option>
                </select>
              </div>
              <Button className="whitespace-nowrap shrink-0" onClick={() => loadData(days, blendFactor)} disabled={isEstimating}>
                {isEstimating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Estimating...
                  </>
                ) : (
                  "Estimate Emissions"
                )}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4 sm:mt-0">
              <Button variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 whitespace-nowrap shrink-0" onClick={() => setIsForecastManagerOpen(true)}>
                Load Forecast Profile
              </Button>
              <Button variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 whitespace-nowrap shrink-0" onClick={() => setIsCarbonManagerOpen(true)}>
                Saved Carbon Profiles
              </Button>
            </div>
          </div>
          {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        </CardContent>
      </Card>

      {activeLocation === null ? (
        <Card className="border-amber-200 bg-amber-50 shadow-sm mt-4">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="rounded-full bg-amber-100 p-4 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-amber-900 mb-2">Location Context Required</h2>
            <p className="text-amber-700 max-w-md mb-6">You must physically link a forecasted location to simulate carbon outputs. Transport distance, localized temperature variations, and geometry explicitly determine your environmental footprint.</p>
            <Button onClick={() => setIsSavedManagerOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white shadow-md">
              Load Bounded Topography
            </Button>
          </CardContent>
        </Card>
      ) : data === null ? (
        <Card className="border-blue-200 bg-blue-50 shadow-sm mt-4">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="rounded-full bg-blue-100 p-4 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-blue-900 mb-2">Simulation Ready</h2>
            <p className="text-blue-700 max-w-md mb-6">Site geometry <strong>{activeLocation.name}</strong> securely parsed. Please hit Estimate Emissions to generate your footprint mapping and compliance metrics.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Carbon Footprint</p>
                <p className="font-heading text-3xl text-primary">{formatNumber(data.total_emission_kgco2)} kgCO2</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Emission per m³</p>
                <p className="font-heading text-3xl text-primary">{formatNumber(data.emission_intensity_kgco2_per_m3)} kg/m3</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Sustainability Rank</p>
                <p className="font-heading text-3xl text-primary">{formatNumber(data.sustainability_score)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg. Transport Cycle Time</p>
                <p className="font-heading text-3xl text-primary">{formatNumber(data.avg_transport_time_min)} min</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Environmental Compliance Directives</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge className="bg-primary/10 text-primary">Carbon Band: {data.emission_band}</Badge>
                <Badge className="border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300 px-3 uppercase tracking-wider">{data.warning}</Badge>
              </div>
              <p className="text-sm text-foreground font-medium">{data.stakeholder_summary}</p>
              <p className="text-sm text-muted-foreground border-l-2 border-primary/40 pl-3 italic">{data.optimization_suggestion}</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Supply Chain Carbon Impact Over Time</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.daily} margin={{ top: 10, right: 10, left: 20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} tickMargin={10} minTickGap={30} label={{ value: 'Simulation Timeline (Days)', position: 'insideBottom', offset: -15, style: { fill: '#475569', fontSize: 13, fontWeight: 500 } }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} label={{ value: 'Emissions Generated (kgCO₂)', angle: -90, position: 'insideLeft', offset: -10, style: { fill: '#475569', fontSize: 13, fontWeight: 500 } }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" name="Manufacturing Output (Cement)" dataKey="cement_emission_kgco2" stackId="1" stroke="#0ea5e9" strokeWidth={2} fill="#e0f2fe" fillOpacity={0.8} />
                    <Area type="monotone" name="Logistics & Operations (Transport, Mining, Batching)" dataKey="transport_emission_kgco2" stackId="1" stroke="#f59e0b" strokeWidth={2} fill="#fef3c7" fillOpacity={0.8} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Carbon Output Origin Ratio</CardTitle>
              </CardHeader>
              <CardContent className="h-80 relative">
                <div className="absolute top-0 right-6 text-xs text-muted-foreground max-w-[150px] text-right">Metrics partitioned between core material synthesis and heavy logistics operations.</div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Manufacturing (Cement)", value: data.daily.reduce((s, d) => s + d.cement_emission_kgco2, 0) },
                        { name: "Logistics & Operations", value: data.daily.reduce((s, d) => s + d.transport_emission_kgco2, 0) }
                      ]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                    >
                      <Cell fill="#0ea5e9" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip formatter={(value) => [`${formatNumber(value)} kgCO2`, 'Total Generated']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cumulative Footprint Projection Matrix</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily} margin={{ top: 10, right: 10, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} tickMargin={10} minTickGap={30} label={{ value: 'Simulation Timeline (Days)', position: 'insideBottom', offset: -15, style: { fill: '#475569', fontSize: 13, fontWeight: 500 } }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} label={{ value: 'Net Weight (kgCO₂)', angle: -90, position: 'insideLeft', offset: -5, style: { fill: '#475569', fontSize: 13, fontWeight: 500 } }} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar name="Total Environmental Cost" dataKey="total_emission_kgco2" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default CarbonPage;
