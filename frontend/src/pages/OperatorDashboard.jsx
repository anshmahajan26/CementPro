import { useEffect, useState } from "react";
import api from "@/lib/api";
import { CheckCircle, Truck, Package, AlertTriangle, Activity, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";

const OperatorDashboard = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forecastLoading, setForecastLoading] = useState(true);
  const [basicForecast, setBasicForecast] = useState(null);
  const [processingOrderId, setProcessingOrderId] = useState(null);

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
      setProcessingOrderId(orderId);
      await api.put(`/orders/${orderId}/status`, {
        status: newStatus,
        emergencyAlert: emergencyNote
      });
      fetchOrders(); // Refresh the list
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Error updating order status.");
    } finally {
      setProcessingOrderId(null);
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
    <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="font-heading text-2xl sm:text-3xl text-primary flex items-center gap-2">
          <Truck size={24} /> Operator Station
        </h1>
        <div className="bg-primary/10 text-primary px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm font-semibold border border-primary/20 self-start sm:self-auto">
          Plant: {user?.plantName || "Unknown Plant"}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base sm:text-xl font-semibold flex items-center gap-2">Active Deliveries</h2>

          {orders.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 sm:p-8 text-center text-muted-foreground text-sm">
              No active orders assigned.
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
              {orders.map((order) => (
                <div key={order._id} className={`flex flex-col rounded-xl border p-4 sm:p-5 shadow-sm ${order.status === 'EMERGENCY' ? 'border-red-500/50 bg-red-500/5' : 'border-border bg-card'}`}>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-foreground flex items-center gap-1 text-sm sm:text-base">
                        <Package size={14} /> {order.cementType}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">Qty: {order.quantity} tons</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] sm:text-xs font-semibold shrink-0 ${
                      order.status === "PENDING" ? "bg-yellow-500/20 text-yellow-600" :
                      order.status === "IN_TRANSIT" ? "bg-blue-500/20 text-blue-600" :
                      order.status === "EMERGENCY" ? "bg-red-500/20 text-red-500" :
                      "bg-green-500/20 text-green-600"
                    }`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="mb-3 text-xs sm:text-sm text-muted-foreground space-y-0.5">
                    <p><strong>Destination:</strong> {order.destination}</p>
                    <p><strong>Manager:</strong> {order.managerId?.name || "N/A"}</p>
                    {order.emergencyAlert && (
                      <p className="mt-1.5 text-red-500 font-medium text-xs">🚨 Alert: {order.emergencyAlert}</p>
                    )}
                  </div>

                  <div className="mt-auto flex flex-col gap-2">
                    {order.status === "PENDING" && (
                      <Button
                        onClick={() => updateStatus(order._id, "IN_TRANSIT")}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm h-9"
                        disabled={processingOrderId === order._id}
                      >
                        {processingOrderId === order._id ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting...</> : "Start Transit"}
                      </Button>
                    )}
                    {(order.status === "IN_TRANSIT" || order.status === "EMERGENCY") && (
                      <>
                        <Button
                          onClick={() => updateStatus(order._id, "DELIVERED")}
                          className="w-full bg-green-600 hover:bg-green-700 text-white text-sm h-9"
                          disabled={processingOrderId === order._id}
                        >
                          {processingOrderId === order._id
                            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Marking...</>
                            : <><CheckCircle size={14} className="mr-1.5" /> Mark Delivered</>}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to mark this order as Not Delivered?")) {
                              updateStatus(order._id, "CANCELLED");
                            }
                          }}
                          className="w-full text-sm h-9"
                          disabled={processingOrderId === order._id}
                        >
                          Mark Not Delivered
                        </Button>
                        {order.status !== "EMERGENCY" && (
                          <Button
                            variant="outline"
                            onClick={() => handleEmergency(order._id)}
                            className="w-full flex items-center justify-center gap-1.5 rounded bg-red-600/10 px-3 py-2 text-xs sm:text-sm font-semibold text-red-600 hover:bg-red-600 hover:text-white transition h-9"
                          >
                            <AlertTriangle size={14} /> Report Emergency
                          </Button>
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
          <h2 className="text-base sm:text-xl font-semibold flex items-center gap-2"><Activity size={18} /> Mini Forecast</h2>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-lg">Next 7 Days ({user?.plantName})</CardTitle>
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
