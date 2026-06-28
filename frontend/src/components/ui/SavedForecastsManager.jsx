import React, { useState, useEffect } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { formatNumber } from "@/lib/utils";
import api from "@/lib/api";

import LocationNameRenderer from "./LocationNameRenderer";

const SavedForecastsManager = ({
  isOpen,
  onClose,
  currentFeatures,
  currentDays,
  currentRealtime,
  currentResults,
  onLoadConfig
}) => {
  const [savedData, setSavedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchSaved = async () => {
    try {
      setLoading(true);
      const res = await api.get("/forecast/saved");
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
      await api.delete(`/forecast/saved/${id}`);
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
          <h2 className="text-xl font-bold">Auto-Saved Forecast History</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none px-2 rounded hover:bg-muted">
            &times;
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <h3 className="text-sm font-semibold mb-3">Your Prediction History</h3>
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
                    {item.features?.locationName && item.features.locationName !== item.name && (
                      <p className="text-xs text-muted-foreground mt-1 font-medium">{item.features.locationName}</p>
                    )}
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
                        onLoadConfig(unifiedFeatures, item.forecast_days, item.realtime_mode, item.results, item.name);
                        onClose();
                      }}
                    >
                      Load Results
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

export default SavedForecastsManager;
