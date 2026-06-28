import React, { useState, useEffect } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { formatNumber } from "@/lib/utils";
import api from "@/lib/api";

import LocationNameRenderer from "./LocationNameRenderer";

const SavedProcurementsManager = ({
  isOpen,
  onClose,
  onLoadProcurement
}) => {
  const [savedData, setSavedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchSaved = async () => {
    try {
      setLoading(true);
      const res = await api.get("/procurement/saved");
      setSavedData(res.data.data || []);
    } catch (err) {
      setError("Failed to fetch saved locations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSaved();
      setError("");
    }
  }, [isOpen]);


  const handleDelete = async (id) => {
    try {
      setLoading(true);
      await api.delete(`/procurement/saved/${id}`);
      fetchSaved();
    } catch (err) {
      setError("Failed to delete.");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-2xl rounded-xl shadow-xl border border-border overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
          <h2 className="text-xl font-bold">Saved Procurement Plans</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none px-2 rounded hover:bg-muted">
            &times;
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <h3 className="text-sm font-semibold mb-3">Your Procurement History</h3>
          {error && <p className="text-sm text-destructive font-medium mb-2">{error}</p>}
          {loading && savedData.length === 0 ? (
            <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
          ) : savedData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No saved profiles yet.</p>
          ) : (
            <div className="space-y-3">
              {savedData.map((item) => (
                <div key={item._id} className="group relative flex items-center justify-between gap-4 p-3 rounded-lg border border-border bg-card hover:border-primary transition-colors">
                  <div className="flex-1">
                    <h4 className="font-semibold text-primary">
                      <LocationNameRenderer name={item.name} lat={item.latitude} lon={item.longitude} />
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1 text-emerald-600 font-medium">
                      Days: {item.forecast_days} | Inventory: {item.inventory || 0}t
                    </p>
                    <p className="text-xs text-muted-foreground opacity-60 mt-0.5">
                      Saved On: {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const unifiedFeatures = {
                          ...item.features,
                          latitude: item.latitude,
                          longitude: item.longitude
                        };
                        onLoadProcurement(unifiedFeatures, item.forecast_days, item.inventory, item.realtime_mode, item.results, item.name);
                        onClose();
                      }}
                    >
                      Load Plan
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDelete(item._id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SavedProcurementsManager;
