import { useEffect, useState } from "react";
import api from "@/lib/api";
import { CheckCircle, Truck, Package, AlertTriangle, Activity } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

const OperatorDashboard = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forecastLoading, setForecastLoading] = useState(true);
  const [basicForecast, setBasicForecast] = useState(null);

  const fetchOrders = async () => {
    try {
      const { data } = await api.get("/orders");
      setOrders(data);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBasicForecast = async () => {
    try {
      const { data } = await api.post("/forecast", { days: 7, useWeather: false, inputFeatures: {} });
      setBasicForecast(data);
    } catch (error) {
      console.error("Failed to fetch mini forecast:", error);
    } finally {
      setForecastLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchBasicForecast();
  }, []);

  const updateStatus = async (orderId, newStatus, emergencyNote = "") => {
    try {
      await api.put(`/orders/${orderId}/status`, { 
        status: newStatus,
        emergencyAlert: emergencyNote
      });
      fetchOrders(); // Refresh the list
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Error updating order status.");
    }
  };

  const handleEmergency = (orderId) => {
    const note = window.prompt("Enter emergency details to send to Manager:");
    if (note) {
      updateStatus(orderId, "EMERGENCY", note);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="font-heading text-3xl text-primary flex items-center gap-2">
          <Truck /> Operator Station
        </h1>
        <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg font-semibold border border-primary/20">
          Plant: {user?.plantName || "Unknown Plant"}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">Active Deliveries</h2>
          
          {orders.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              No active orders assigned.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {orders.map((order) => (
                <div key={order._id} className={`flex flex-col rounded-xl border p-5 shadow-sm ${order.status === 'EMERGENCY' ? 'border-red-500/50 bg-red-500/5' : 'border-border bg-card'}`}>
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground flex items-center gap-1">
                        <Package size={16}/> {order.cementType}
                      </h3>
                      <p className="text-sm text-muted-foreground">Qty: {order.quantity} tons</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      order.status === "PENDING" ? "bg-yellow-500/20 text-yellow-500" :
                      order.status === "IN_TRANSIT" ? "bg-blue-500/20 text-blue-500" :
                      order.status === "EMERGENCY" ? "bg-red-500/20 text-red-500" :
                      "bg-green-500/20 text-green-500"
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  
                  <div className="mb-4 text-sm text-muted-foreground">
                    <p><strong>Destination:</strong> {order.destination}</p>
                    <p><strong>Manager:</strong> {order.managerId?.name || "N/A"}</p>
                    {order.emergencyAlert && (
                      <p className="mt-2 text-red-500 font-medium">🚨 Alert: {order.emergencyAlert}</p>
                    )}
                  </div>

                  <div className="mt-auto flex flex-col gap-2">
                    {order.status === "PENDING" && (
                      <button
                        onClick={() => updateStatus(order._id, "IN_TRANSIT")}
                        className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
                      >
                        Start Transit
                      </button>
                    )}
                    {(order.status === "IN_TRANSIT" || order.status === "EMERGENCY") && (
                      <>
                        <button
                          onClick={() => updateStatus(order._id, "DELIVERED")}
                          className="w-full flex items-center justify-center gap-2 rounded bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 transition"
                        >
                          <CheckCircle size={16} /> Mark Delivered
                        </button>
                        {order.status !== "EMERGENCY" && (
                          <button
                            onClick={() => handleEmergency(order._id)}
                            className="w-full flex items-center justify-center gap-2 rounded bg-red-600/10 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-600 hover:text-white transition"
                          >
                            <AlertTriangle size={16} /> Report Emergency
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2"><Activity size={20} /> Mini Forecast</h2>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Next 7 Days ({user?.plantName})</CardTitle>
            </CardHeader>
            <CardContent>
              {forecastLoading ? (
                <p className="text-sm text-muted-foreground">Generating forecast...</p>
              ) : basicForecast?.predictions ? (
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-primary mb-3">Model: {basicForecast.best_model}</p>
                  {basicForecast.predictions.map((p, i) => (
                    <div key={i} className="flex justify-between border-b border-border/50 pb-1">
                      <span className="text-muted-foreground">{p.date}</span>
                      <span className="font-semibold">{formatNumber(p.adjusted_predicted_demand_m3 ?? p.predicted_demand_m3)} m³</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-red-500">Could not load forecast.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OperatorDashboard;
