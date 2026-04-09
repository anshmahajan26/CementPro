// react-leaflet v4
import { useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Search, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Controller to programmatically change map center
 */
const MapController = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center.lat !== undefined && center.lng !== undefined) {
      // Zoom to level 13 if currently zoomed out, otherwise keep current zoom
      const targetZoom = map.getZoom() > 10 ? map.getZoom() : 13;
      map.flyTo([center.lat, center.lng], targetZoom, { animate: true, duration: 1.5 });
    }
  }, [center, map]);
  return null;
};

const LocationMarker = ({ inputFeatures, setInputFeatures }) => {
  useMapEvents({
    click(e) {
      setInputFeatures((prev) => ({
        ...prev,
        latitude: e.latlng.lat,
        longitude: e.latlng.lng
      }));
    }
  });

  const lat = Number(inputFeatures.latitude);
  const lng = Number(inputFeatures.longitude);

  if (!lat || !lng) return null;

  return (
    <CircleMarker
      center={[lat, lng]}
      radius={7}
      color="#ffffff"
      weight={2.5}
      fillColor="#ec4899"
      fillOpacity={1}
    />
  );
};

/**
 * MapLocationPicker — interactive OpenStreetMap that sets lat/lng on click.
 * Includes Nominatim geocoding search and HTML5 Geolocation.
 */
const MapLocationPicker = ({ inputFeatures, setInputFeatures, defaultCenter }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [errorMsg, setErrorMsg] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            searchQuery
          )}&limit=5`
        );
        const data = await response.json();
        if (data && data.length > 0) {
          setSuggestions(data);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (err) {
        console.error("Autosuggest failed", err);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSelectSuggestion = (geo) => {
    const numLat = parseFloat(geo.lat);
    const numLng = parseFloat(geo.lon);
    
    setSearchQuery(geo.display_name.split(",")[0]); // Simplify the input name
    setShowSuggestions(false);
    setMapCenter({ lat: numLat, lng: numLng });
    setInputFeatures((prev) => ({
      ...prev,
      latitude: numLat,
      longitude: numLng
    }));
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setShowSuggestions(false);
    setErrorMsg("");
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const numLat = parseFloat(lat);
        const numLng = parseFloat(lon);
        
        setMapCenter({ lat: numLat, lng: numLng });
        // Automatically drop pin at the top search result
        setInputFeatures((prev) => ({
          ...prev,
          latitude: numLat,
          longitude: numLng
        }));
      } else {
        setErrorMsg("Location not found");
      }
    } catch (err) {
      setErrorMsg("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocateMe = () => {
    setErrorMsg("");
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your browser");
      return;
    }
    
    setIsSearching(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMapCenter({ lat: latitude, lng: longitude });
        // Automatically drop pin at current location
        setInputFeatures((prev) => ({
          ...prev,
          latitude,
          longitude
        }));
        setIsSearching(false);
      },
      (error) => {
        setErrorMsg("Unable to retrieve your location (check browser permissions)");
        setIsSearching(false);
      }
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-wrap gap-2 mb-2 items-center relative">
        <div className="relative flex-1 min-w-[200px]">
          <Input 
            type="text" 
            placeholder="Search location (e.g. city, address)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if(suggestions.length) setShowSuggestions(true); }}
            onBlur={() => setShowSuggestions(false)}
            onKeyDown={handleKeyDown}
            className="w-full text-sm h-9"
          />
          
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute top-full left-0 mt-1 w-full bg-card border border-border rounded-md shadow-xl z-[1000] overflow-hidden max-h-60 overflow-y-auto">
              {suggestions.map((s, idx) => (
                <li 
                  key={idx} 
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-muted truncate transition-colors text-foreground border-b border-border/40 last:border-0"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion(s);
                  }}
                  title={s.display_name} // show full name on hover
                >
                  <span className="font-medium text-primary">{s.display_name.split(",")[0]}</span>
                  <span className="text-muted-foreground ml-1">{s.display_name.substring(s.display_name.indexOf(","))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button 
          type="button" 
          variant="secondary" 
          size="sm" 
          className="h-9 px-3 shrink-0" 
          onClick={handleSearch}
          disabled={isSearching}
        >
          {isSearching ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-1" /> : <Search className="w-4 h-4 mr-1" />}
          Search
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          className="h-9 px-3 shrink-0" 
          onClick={handleLocateMe}
          disabled={isSearching}
          title="Use Auto Detection"
        >
          <Navigation className="w-4 h-4 mr-1 text-primary" />
          Locate Me
        </Button>
      </div>
      
      {errorMsg ? <p className="text-destructive text-xs mb-2">{errorMsg}</p> : null}
      
      <div className="relative flex-1 w-full rounded-xl overflow-hidden border border-border">
        <MapContainer
          center={[defaultCenter.lat, defaultCenter.lng]}
          zoom={5}
          scrollWheelZoom={true}
          style={{ width: "100%", height: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker inputFeatures={inputFeatures} setInputFeatures={setInputFeatures} />
          <MapController center={mapCenter} />
        </MapContainer>
      </div>
    </div>
  );
};

export default MapLocationPicker;
