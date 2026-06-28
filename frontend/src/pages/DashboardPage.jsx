import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line,
  Label
} from "recharts";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import DashboardChatbot from "@/components/ui/DashboardChatbot";

// Loading skeleton for KPI cards
const KpiSkeleton = () => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {[1, 2, 3, 4].map((i) => (
      <Card key={i}>
        <CardContent className="pt-5">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-8 w-32 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    ))}
  </div>
);

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Emergency Orders State
  const [emergencyOrders, setEmergencyOrders] = useState([]);
  const [loadingEmergencies, setLoadingEmergencies] = useState(false);
  const [resolvingOrderId, setResolvingOrderId] = useState(null);
  const [resolvedOrderIds, setResolvedOrderIds] = useState(new Set());

  // Load available forecast locations
  const loadLocations = useCallback(async () => {
    try {
      const response = await api.get("/forecast/saved");
      setLocations(response.data.data || []);
    } catch (err) {
      console.error("Failed to load locations:", err);
    }
  }, []);

  // Load dashboard data based on selected location
  const loadDashboard = useCallback(async (forecastId = "") => {
    try {
      setLoading(true);
      setError("");
      const endpoint = forecastId ? `/dashboard?forecastId=${forecastId}` : "/dashboard";
      const response = await api.get(endpoint);
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Emergency Orders — filters strictly to EMERGENCY status only
  const loadEmergencies = useCallback(async () => {
    try {
      setLoadingEmergencies(true);
      const response = await api.get("/orders");
      // Exclude RESOLVED and DELIVERED — only show active emergencies
      const emergencies = (response.data || []).filter(
        o => o.status === "EMERGENCY"
      );
      setEmergencyOrders(emergencies);
    } catch (err) {
      console.error("Failed to load emergency orders:", err);
    } finally {
      setLoadingEmergencies(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadLocations();
    loadDashboard();
    loadEmergencies();
  }, [loadLocations, loadDashboard, loadEmergencies]);

  // Handle location change
  const handleLocationChange = (e) => {
    const val = e.target.value;
    setSelectedLocationId(val);
    loadDashboard(val);
  };

  const handleResolveEmergency = async (orderId) => {
    try {
      setResolvingOrderId(orderId);
      await api.put(`/orders/${orderId}/status`, { status: "RESOLVED" });

      // Step 1: show the "😊 Issue Resolved!" card immediately
      setResolvedOrderIds(prev => new Set([...prev, orderId]));

      // Step 2: after 2.5s, re-fetch orders FIRST (order is now RESOLVED → filtered out),
      // THEN clean up resolvedOrderIds — prevents the card flashing back to "Mark as Resolved"
      setTimeout(async () => {
        await loadEmergencies(); // list updates, resolved order is gone
        setResolvedOrderIds(prev => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      }, 2500);
    } catch (err) {
      console.error("Failed to resolve emergency:", err);
    } finally {
      setResolvingOrderId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-5 flex items-center justify-between">
            <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
            <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
        <KpiSkeleton />
        <div className="grid gap-4 xl:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="h-72 pt-5">
                <div className="h-full animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="pt-5">
          <p className="text-sm font-medium text-destructive">⚠ {error}</p>
          <button
            onClick={() => loadDashboard(selectedLocationId)}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const kpiCards = [
    { label: "Current Demand (m³)", value: formatNumber(data.kpis.current_demand_m3) },
    { label: "Next Day Forecast (m³)", value: formatNumber(data.kpis.predicted_demand_next_day_m3) },
    { label: "Cement Needed (t)", value: formatNumber(data.kpis.cement_needed_next_day_tonnes) },
    { label: "Emission (kgCO₂)", value: formatNumber(data.kpis.emission_next_day_kgco2) }
  ];

  return (
    <div className="space-y-4 sm:space-y-6 relative px-1 sm:px-0">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 rounded-lg">
           <div className="text-primary font-medium animate-pulse text-sm">Loading Map Context...</div>
        </div>
      )}

      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3 border-b px-4 sm:px-6">
          <CardTitle className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <span className="text-base sm:text-lg font-heading">Executive Command Center</span>
            <div className="flex items-center gap-2 bg-secondary/30 p-1.5 rounded-lg border w-full sm:w-auto">
              <label className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap pl-1">Site:</label>
              <select
                value={selectedLocationId}
                onChange={handleLocationChange}
                className="bg-background border-none rounded-md text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary h-8 px-2 flex-1 sm:min-w-[200px]"
              >
                <option value="">(All Sites) Global Average</option>
                {locations.map(loc => (
                  <option key={loc._id} value={loc._id}>
                    {loc.name} ({loc.forecast_days}d)
                  </option>
                ))}
              </select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{data.stakeholder_summary}</p>
            {data.active_location && (
              <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px] sm:text-xs shrink-0 self-start sm:self-auto">
                📍 {data.active_location.name || 'Site'}: {data.active_location.lat.toFixed(3)}, {data.active_location.lon.toFixed(3)}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Emergency Notifications */}
      {emergencyOrders.length > 0 && (
        <Card className="border-red-200 bg-red-50 shadow-sm">
          <CardHeader className="pb-3 border-b border-red-100 px-4 sm:px-6">
            <CardTitle className="text-red-800 flex items-center gap-2 text-base sm:text-lg">
              🚨 Emergency Notifications ({emergencyOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 px-4 sm:px-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {emergencyOrders.map(order => (
              resolvedOrderIds.has(order._id) ? (
                /* Resolved feedback card */
                <div key={order._id} className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 min-h-[120px] text-center shadow-sm">
                  <span className="text-3xl">😊</span>
                  <p className="font-semibold text-emerald-700 text-sm">Issue Resolved!</p>
                  <p className="text-xs text-emerald-600">{order.destination}</p>
                </div>
              ) : (
                <div key={order._id} className="bg-white p-4 rounded-xl shadow-sm border border-red-100 flex flex-col justify-between gap-3">
                  <div>
                    <p className="font-semibold text-red-900 text-sm sm:text-base">{order.destination}</p>
                    <p className="text-xs sm:text-sm text-red-700 mt-1">Issue: <strong>{order.emergencyAlert}</strong></p>
                    <p className="text-xs text-muted-foreground mt-1">{order.quantity}t of {order.cementType}</p>
                  </div>
                  <button
                    onClick={() => handleResolveEmergency(order._id)}
                    disabled={resolvingOrderId === order._id}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium px-3 py-2 rounded-lg text-sm transition flex items-center justify-center gap-2 w-full"
                  >
                    {resolvingOrderId === order._id
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Resolving...</>
                      : "Mark as Resolved"}
                  </button>
                </div>
              )
            ))}
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {kpiCards.map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4 px-3 sm:px-5 sm:pt-5">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground leading-tight">{item.label}</p>
              <p className="mt-1 sm:mt-2 font-heading text-xl sm:text-3xl text-primary">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Smart Alerts */}
      <Card>
        <CardHeader className="pb-2 px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg">Smart Alerts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 px-4 sm:px-6 pb-4">
          {data.alerts.length ? (
            data.alerts.map((alert) => (
              <Badge key={alert.type} className="border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300 text-[10px] sm:text-xs whitespace-normal text-left">
                {alert.message}
              </Badge>
            ))
          ) : (
            <Badge className="text-xs">No critical alerts</Badge>
          )}
        </CardContent>
      </Card>

      {/* Charts Row 1 - Main Timeline Comparison */}
      <Card>
        <CardHeader className="px-4 sm:px-6 pb-2">
          <CardTitle className="text-sm sm:text-base">Procurement vs Demand</CardTitle>
        </CardHeader>
        <CardContent className="h-64 sm:h-80 md:h-[360px] px-2 sm:px-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.charts.procurement_trend} margin={{ bottom: 15, right: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5)} minTickGap={20}>
                <Label value="Date" offset={-10} position="insideBottom" style={{ fontSize: 11 }} />
              </XAxis>
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={45}>
                <Label value="Demand (m³)" angle={-90} position="insideLeft" style={{ textAnchor: "middle", fontSize: 11 }} />
              </YAxis>
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} width={40}>
                <Label value="Cement (t)" angle={90} position="insideRight" style={{ textAnchor: "middle", fontSize: 11 }} />
              </YAxis>
              <Tooltip labelFormatter={(label) => `Date: ${label}`} />
              <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="left" type="monotone" name="RMC Demand" dataKey="predicted_demand_m3" stroke="#0284c7" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="right" type="stepAfter" name="Cement Needed" dataKey="cement_required_tonnes" stroke="#f59e0b" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Charts Row 2 */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="px-4 sm:px-6 pb-2">
            <CardTitle className="text-sm sm:text-base">Project Progress vs Demand</CardTitle>
          </CardHeader>
          <CardContent className="h-56 sm:h-72 px-2 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.project_progress_vs_demand} margin={{ bottom: 15, left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day_in_project" tick={{ fontSize: 10 }} minTickGap={15}>
                  <Label value="Day of Project" offset={-10} position="insideBottom" style={{ fontSize: 11 }} />
                </XAxis>
                <YAxis tick={{ fontSize: 10 }} width={52}>
                  <Label value="Volume (m³)" angle={-90} position="insideLeft" style={{ textAnchor: "middle", fontSize: 11 }} />
                </YAxis>
                <Tooltip labelFormatter={(label) => `Project Day: ${label}`} cursor={{ fill: 'transparent' }} />
                <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: 11 }} />
                <Bar name="Demand Volume (m³)" dataKey="demand" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 sm:px-6 pb-2">
            <CardTitle className="text-sm sm:text-base">Carbon Output Metrics</CardTitle>
          </CardHeader>
          <CardContent className="h-56 sm:h-72 px-2 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.charts.carbon_trend} margin={{ bottom: 15, left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5)} minTickGap={20}>
                  <Label value="Date" offset={-10} position="insideBottom" style={{ fontSize: 11 }} />
                </XAxis>
                <YAxis tick={{ fontSize: 10 }} width={55}>
                  <Label value="Emission (kgCO₂)" angle={-90} position="insideLeft" style={{ textAnchor: "middle", fontSize: 11 }} />
                </YAxis>
                <Tooltip />
                <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" stackId="1" name="Cement Emission" dataKey="cement_emission_kgco2" fill="#0ea5e9" stroke="#0284c7" />
                <Area type="monotone" stackId="1" name="Transport Emission" dataKey="transport_emission_kgco2" fill="#f59e0b" stroke="#d97706" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <DashboardChatbot dashboardData={data} />
    </div>
  );
};

export default DashboardPage;
