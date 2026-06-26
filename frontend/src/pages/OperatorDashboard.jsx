import { useEffect, useState } from "react";
import api from "@/lib/api";
import { CheckCircle, Truck, Package } from "lucide-react";

const OperatorDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status: newStatus });
      fetchOrders(); // Refresh the list
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Error updating order status.");
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading orders...</div>;

  return (
    <div className="p-8">
      <h1 className="mb-6 font-heading text-3xl text-primary flex items-center gap-2">
        <Truck /> Active Deliveries
      </h1>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          No active orders assigned.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <div key={order._id} className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
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
                  "bg-green-500/20 text-green-500"
                }`}>
                  {order.status}
                </span>
              </div>
              
              <div className="mb-4 text-sm text-muted-foreground">
                <p><strong>Destination:</strong> {order.destination}</p>
                <p><strong>Manager:</strong> {order.managerId?.name || "N/A"}</p>
              </div>

              <div className="mt-auto flex gap-2">
                {order.status === "PENDING" && (
                  <button
                    onClick={() => updateStatus(order._id, "IN_TRANSIT")}
                    className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
                  >
                    Start Transit
                  </button>
                )}
                {order.status === "IN_TRANSIT" && (
                  <button
                    onClick={() => updateStatus(order._id, "DELIVERED")}
                    className="w-full flex items-center justify-center gap-2 rounded bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 transition"
                  >
                    <CheckCircle size={16} /> Mark Delivered
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OperatorDashboard;
