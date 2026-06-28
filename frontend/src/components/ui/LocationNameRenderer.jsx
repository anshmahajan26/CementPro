import React, { useState, useEffect } from "react";

const LocationNameRenderer = ({ name, lat, lon, fallback = "Unknown Location" }) => {
  const [displayName, setDisplayName] = useState(name || fallback);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If the name is missing, or looks like coordinates, or is "Prediction Trace", let's try to reverse geocode
    const isCoordinateLike = !name || name.includes("Prediction Trace") || /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(name);
    
    if (isCoordinateLike && lat && lon) {
      setLoading(true);
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`)
        .then(res => res.json())
        .then(data => {
          const fetchedName = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.county || data?.display_name?.split(",")[0];
          if (fetchedName) {
            setDisplayName(fetchedName);
          } else if (!name) {
            setDisplayName(`${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`);
          }
        })
        .catch(() => {
           if (!name) {
              setDisplayName(`${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`);
           }
        })
        .finally(() => setLoading(false));
    } else {
      setDisplayName(name || fallback);
    }
  }, [name, lat, lon, fallback]);

  return <>{loading ? "Loading Location..." : displayName}</>;
};

export default LocationNameRenderer;
