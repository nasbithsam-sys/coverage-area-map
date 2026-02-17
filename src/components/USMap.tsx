import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { Layers } from "lucide-react";

interface CoverageZone {
  id: string;
  name: string;
  zone_type: string;
  latitude: number;
  longitude: number;
  radius_miles: number;
  color_level: string;
}

export interface SearchResultItem {
  tech: Tables<"technicians">;
  distanceMiles: number;
  isFallback: boolean;
}

export interface SearchResultsData {
  results: SearchResultItem[];
  resultType: SearchResultType;
  query: string;
}

export interface USMapHandle {
  locateTech: (tech: Tables<"technicians">) => void;
}

interface USMapProps {
  technicians: Tables<"technicians">[];
  showPins?: boolean;
  showSearch?: boolean;
  onTechClick?: (tech: Tables<"technicians">) => void;
  onSearchResults?: (data: SearchResultsData | null) => void;
  filteredTechIds?: Set<string> | null;
}

const COVERAGE_COLORS: Record<string, string> = {
  strong: "#22c55e",
  moderate: "#eab308",
  weak: "#ef4444",
};

function milesToMeters(miles: number) {
  return miles * 1609.34;
}

type SearchResultType = "address" | "neighborhood" | "zip" | "city" | "state" | "unknown";

const STATE_ABBR_TO_NAME: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",
  DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",
  IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",
  MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",
  NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",
  ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",
  SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",
  VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",DC:"District of Columbia",
};
const STATE_NAME_TO_ABBR: Record<string, string> = {};
for (const [abbr, name] of Object.entries(STATE_ABBR_TO_NAME)) {
  STATE_NAME_TO_ABBR[name.toLowerCase()] = abbr;
}

function normalizeState(s: string): string {
  const upper = s.trim().toUpperCase();
  if (STATE_ABBR_TO_NAME[upper]) return upper;
  const abbr = STATE_NAME_TO_ABBR[s.trim().toLowerCase()];
  return abbr || upper;
}

function detectResultType(result: any): SearchResultType {
  const type = (result.type || "").toLowerCase();
  const cls = (result.class || "").toLowerCase();
  const addrType = (result.addresstype || "").toLowerCase();

  if (addrType === "state" || type === "administrative" && result.address?.state && !result.address?.city && !result.address?.town) {
    return "state";
  }
  if (addrType === "city" || addrType === "town" || addrType === "village" || type === "city" || type === "town") {
    return "city";
  }
  if (addrType === "postcode" || type === "postcode" || addrType === "suburb" && cls === "place") {
    return "zip";
  }
  if (addrType === "neighbourhood" || addrType === "suburb" || addrType === "quarter" || type === "neighbourhood" || type === "suburb") {
    return "neighborhood";
  }
  if (type === "house" || type === "building" || cls === "building" || cls === "shop" || cls === "amenity" || cls === "tourism" || cls === "office" || addrType === "road" || addrType === "house_number") {
    return "address";
  }
  if (result.boundingbox) {
    const south = parseFloat(result.boundingbox[0]);
    const north = parseFloat(result.boundingbox[1]);
    const span = Math.abs(north - south);
    if (span < 0.01) return "address";
    if (span > 2) return "state";
  }
  return "city";
}

function getRadiusForType(resultType: SearchResultType, boundingbox?: string[]): number {
  if (boundingbox) {
    const south = parseFloat(boundingbox[0]);
    const north = parseFloat(boundingbox[1]);
    const west = parseFloat(boundingbox[2]);
    const east = parseFloat(boundingbox[3]);
    const latSpan = Math.abs(north - south);
    const lonSpan = Math.abs(east - west);
    const avgSpan = (latSpan + lonSpan) / 2;
    const radiusKm = (avgSpan / 2) * 111;
    const radiusM = radiusKm * 1000;
    if (radiusM > 500) return radiusM;
  }
  switch (resultType) {
    case "neighborhood": return 1500;
    case "zip": return 3000;
    case "city": return 8000;
    case "state": return 100000;
    default: return 5000;
  }
}

function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function filterTechsBySearch(
  technicians: Tables<"technicians">[],
  resultType: SearchResultType,
  searchLat: number,
  searchLon: number,
  geocodeResult: any,
  searchQuery: string
): { results: SearchResultItem[]; isFallback: boolean } {
  const allWithDist = technicians.map((t) => ({
    tech: t,
    distanceMiles: getDistanceMiles(searchLat, searchLon, t.latitude, t.longitude),
  }));

  allWithDist.sort((a, b) => {
    const aNew = a.tech.is_new ? 0 : 1;
    const bNew = b.tech.is_new ? 0 : 1;
    if (aNew !== bNew) return aNew - bNew;
    return a.distanceMiles - b.distanceMiles;
  });

  const nearest10 = () => allWithDist.slice(0, 10).map((d) => ({ ...d, isFallback: true }));

  if (resultType === "address") {
    return { results: nearest10(), isFallback: true };
  }

  if (resultType === "zip") {
    const searchedZip = (geocodeResult.address?.postcode || searchQuery).trim();
    const matched = allWithDist.filter((d) => d.tech.zip === searchedZip);
    if (matched.length > 0) {
      return { results: matched.map((d) => ({ ...d, isFallback: false })), isFallback: false };
    }
    return { results: nearest10(), isFallback: true };
  }

  if (resultType === "neighborhood" || resultType === "city") {
    const searchedCity = (
      geocodeResult.address?.city ||
      geocodeResult.address?.town ||
      geocodeResult.address?.village ||
      geocodeResult.address?.suburb ||
      searchQuery
    ).trim().toLowerCase();
    const matched = allWithDist.filter((d) => d.tech.city.toLowerCase() === searchedCity);
    if (matched.length > 0) {
      return { results: matched.map((d) => ({ ...d, isFallback: false })), isFallback: false };
    }
    return { results: nearest10(), isFallback: true };
  }

  if (resultType === "state") {
    const searchedState = normalizeState(
      geocodeResult.address?.state || searchQuery
    );
    const matched = allWithDist.filter((d) => normalizeState(d.tech.state) === searchedState);
    if (matched.length > 0) {
      return { results: matched.map((d) => ({ ...d, isFallback: false })), isFallback: false };
    }
    return { results: nearest10(), isFallback: true };
  }

  return { results: nearest10(), isFallback: true };
}

// --- Tile layer definitions ---
const TILE_LAYERS = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    label: "Street",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
    label: "Satellite",
  },
};

type TileLayerKey = keyof typeof TILE_LAYERS;

const USMap = forwardRef<USMapHandle, USMapProps>(function USMap(
  { technicians, showPins = false, showSearch = false, onTechClick, onSearchResults, filteredTechIds },
  ref
) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const zonesRef = useRef<L.LayerGroup | null>(null);
  const radiusRef = useRef<L.LayerGroup | null>(null);
  const searchLayerRef = useRef<L.LayerGroup | null>(null);
  const highlightRef = useRef<L.LayerGroup | null>(null);
  const [zones, setZones] = useState<CoverageZone[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hasSearchOverlay, setHasSearchOverlay] = useState(false);
  const [activeLayer, setActiveLayer] = useState<TileLayerKey>("street");
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);

  // Expose locateTech via ref
  useImperativeHandle(ref, () => ({
    locateTech: (tech: Tables<"technicians">) => {
      if (!leafletMap.current) return;
      leafletMap.current.setView([tech.latitude, tech.longitude], 13, { animate: true });
      if (highlightRef.current) highlightRef.current.clearLayers();
      const pulse = L.circleMarker([tech.latitude, tech.longitude], {
        radius: 20,
        color: "hsl(0, 72%, 51%)",
        fillColor: "hsl(0, 72%, 51%)",
        fillOpacity: 0.4,
        weight: 3,
      });
      highlightRef.current?.addLayer(pulse);
      setTimeout(() => highlightRef.current?.removeLayer(pulse), 1500);
    },
  }));

  // Fetch coverage zones
  useEffect(() => {
    supabase.from("coverage_zones").select("*").then(({ data }) => {
      setZones((data as CoverageZone[]) || []);
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const map = L.map(mapRef.current, {
      center: [39.8283, -98.5795],
      zoom: 5,
      minZoom: 4,
      maxZoom: 19,
      zoomControl: true,
    });

    const initialTile = L.tileLayer(TILE_LAYERS.street.url, {
      attribution: TILE_LAYERS.street.attribution,
      maxZoom: TILE_LAYERS.street.maxZoom,
    }).addTo(map);
    tileLayerRef.current = initialTile;

    zonesRef.current = L.layerGroup().addTo(map);
    radiusRef.current = L.layerGroup().addTo(map);
    searchLayerRef.current = L.layerGroup().addTo(map);
    highlightRef.current = L.layerGroup().addTo(map);

    clusterRef.current = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let size = "small";
        let dim = 36;
        if (count >= 100) { size = "large"; dim = 52; }
        else if (count >= 10) { size = "medium"; dim = 44; }
        return L.divIcon({
          html: `<div class="cluster-marker cluster-${size}"><span>${count}</span></div>`,
          className: "",
          iconSize: L.point(dim, dim),
        });
      },
    });
    map.addLayer(clusterRef.current);

    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  // Switch tile layer
  useEffect(() => {
    if (!leafletMap.current || !tileLayerRef.current) return;
    const cfg = TILE_LAYERS[activeLayer];
    tileLayerRef.current.setUrl(cfg.url);
    tileLayerRef.current.options.attribution = cfg.attribution;
    tileLayerRef.current.options.maxZoom = cfg.maxZoom;
  }, [activeLayer]);

  // Draw coverage zones
  useEffect(() => {
    if (!zonesRef.current) return;
    zonesRef.current.clearLayers();
    zones.forEach((zone) => {
      const color = COVERAGE_COLORS[zone.color_level] || COVERAGE_COLORS.moderate;
      L.circle([zone.latitude, zone.longitude], {
        radius: milesToMeters(zone.radius_miles),
        color,
        fillColor: color,
        fillOpacity: 0.18,
        weight: 2,
      })
        .bindTooltip(zone.name, { direction: "top", className: "zone-tooltip" })
        .addTo(zonesRef.current!);
    });
  }, [zones]);

  // Draw tech markers & service radius — respects filteredTechIds
  useEffect(() => {
    if (!clusterRef.current || !radiusRef.current) return;
    clusterRef.current.clearLayers();
    radiusRef.current.clearLayers();

    let techs = technicians.filter((t) => t.is_active);
    if (filteredTechIds) {
      techs = techs.filter((t) => filteredTechIds.has(t.id));
    }

    if (showPins) {
      techs.forEach((tech) => {
        L.circle([tech.latitude, tech.longitude], {
          radius: milesToMeters(tech.service_radius_miles),
          color: "hsl(217, 71%, 45%)",
          fillColor: "hsl(217, 71%, 45%)",
          fillOpacity: 0.06,
          weight: 0.5,
          interactive: false,
        }).addTo(radiusRef.current!);
      });

      techs.forEach((tech) => {
        const marker = L.circleMarker([tech.latitude, tech.longitude], {
          radius: 7,
          fillColor: "hsl(217, 71%, 45%)",
          color: "#fff",
          weight: 2,
          fillOpacity: 0.9,
        });

        const newTag = tech.is_new ? ' <span style="color:#22c55e;font-weight:bold;">★ NEW</span>' : '';
        marker.bindTooltip(
          `<strong>${tech.name}</strong>${newTag}<br/>${tech.city}, ${tech.state}`,
          { direction: "top" }
        );

        marker.on("click", () => {
          onTechClick?.(tech);
        });

        clusterRef.current!.addLayer(marker);
      });
    }
  }, [technicians, showPins, onTechClick, filteredTechIds]);

  const clearSearchOverlay = useCallback(() => {
    searchLayerRef.current?.clearLayers();
    highlightRef.current?.clearLayers();
    setHasSearchOverlay(false);
    setSearchQuery("");
    onSearchResults?.(null);
  }, [onSearchResults]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !leafletMap.current) return;
    setSearching(true);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ", USA")}&limit=1&addressdetails=1&polygon_geojson=1`
      );
      const results = await res.json();

      if (results.length === 0) {
        toast.error("No locations found", { description: `Could not find "${searchQuery}"` });
        setSearching(false);
        return;
      }

      const result = results[0];
      const searchLat = parseFloat(result.lat);
      const searchLon = parseFloat(result.lon);
      const resultType = detectResultType(result);

      // Clear previous search overlay
      searchLayerRef.current?.clearLayers();
      highlightRef.current?.clearLayers();

      if (resultType === "address") {
        // PLACE: pin + popup + street zoom
        const pin = L.marker([searchLat, searchLon], {
          icon: L.divIcon({
            html: `<div style="width:28px;height:28px;background:hsl(0,72%,51%);border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>`,
            className: "",
            iconSize: L.point(28, 28),
            iconAnchor: L.point(14, 14),
          }),
        });
        pin.bindPopup(`<strong>${result.display_name}</strong>`, { closeButton: true, autoClose: false }).openPopup();
        searchLayerRef.current?.addLayer(pin);
        leafletMap.current.setView([searchLat, searchLon], 16, { animate: true });

      } else if (resultType === "state") {
        // AREA (state): prefer GeoJSON polygon → bbox rectangle → dashed circle
        if (result.geojson) {
          try {
            const geoLayer = L.geoJSON(result.geojson, {
              style: {
                color: "hsl(0, 72%, 51%)",
                fillColor: "hsl(0, 72%, 51%)",
                fillOpacity: 0.08,
                weight: 2.5,
                dashArray: "10 6",
              },
            });
            searchLayerRef.current?.addLayer(geoLayer);
            leafletMap.current.fitBounds(geoLayer.getBounds(), { padding: [40, 40], animate: true });
          } catch {
            drawBboxOrCircleFallback(result, searchLat, searchLon, "state");
          }
        } else {
          drawBboxOrCircleFallback(result, searchLat, searchLon, "state");
        }
      } else {
        // AREA (zip / city / neighborhood): prefer GeoJSON polygon → bbox rectangle → dashed circle
        if (result.geojson && result.geojson.type !== "Point") {
          try {
            const geoLayer = L.geoJSON(result.geojson, {
              style: {
                color: "hsl(0, 72%, 51%)",
                fillColor: "hsl(0, 72%, 51%)",
                fillOpacity: 0.06,
                weight: 2,
                dashArray: "8 6",
              },
            });
            searchLayerRef.current?.addLayer(geoLayer);
            leafletMap.current.fitBounds(geoLayer.getBounds(), { padding: [50, 50], maxZoom: 14, animate: true });
          } catch {
            drawBboxOrCircleFallback(result, searchLat, searchLon, resultType);
          }
        } else {
          drawBboxOrCircleFallback(result, searchLat, searchLon, resultType);
        }
      }

      setHasSearchOverlay(true);

      // Compute filtered technician results and emit to parent
      const { results: techResults } = filterTechsBySearch(
        technicians,
        resultType,
        searchLat,
        searchLon,
        result,
        searchQuery
      );

      onSearchResults?.({
        results: techResults,
        resultType,
        query: searchQuery,
      });

      if (showPins && techResults.length > 0 && onTechClick) {
        onTechClick(techResults[0].tech);
      }
    } catch {
      toast.error("Search failed", { description: "Please try again." });
    } finally {
      setSearching(false);
    }
  };

  /** Fallback: try bounding box rectangle, else dashed circle */
  function drawBboxOrCircleFallback(result: any, lat: number, lon: number, rType: SearchResultType) {
    if (!leafletMap.current || !searchLayerRef.current) return;

    // Add a small center pin for non-address area searches
    const pin = L.marker([lat, lon], {
      icon: L.divIcon({
        html: `<div style="width:22px;height:22px;background:hsl(0,72%,51%);border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
        className: "",
        iconSize: L.point(22, 22),
        iconAnchor: L.point(11, 11),
      }),
    });
    pin.bindTooltip(result.display_name || "", { direction: "top" });
    searchLayerRef.current.addLayer(pin);

    if (result.boundingbox) {
      const south = parseFloat(result.boundingbox[0]);
      const north = parseFloat(result.boundingbox[1]);
      const west = parseFloat(result.boundingbox[2]);
      const east = parseFloat(result.boundingbox[3]);
      const bounds: L.LatLngBoundsExpression = [[south, west], [north, east]];

      const rect = L.rectangle(bounds, {
        color: "hsl(0, 72%, 51%)",
        fillColor: "hsl(0, 72%, 51%)",
        fillOpacity: 0.06,
        weight: 2,
        dashArray: "8 6",
        interactive: false,
      });
      searchLayerRef.current.addLayer(rect);
      leafletMap.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true });
    } else {
      // Last fallback: dashed circle
      const radius = getRadiusForType(rType);
      const circle = L.circle([lat, lon], {
        radius: Math.max(radius, 1000),
        color: "hsl(0, 72%, 51%)",
        fillColor: "hsl(0, 72%, 51%)",
        fillOpacity: 0.06,
        weight: 2,
        dashArray: "8 6",
        interactive: false,
      });
      searchLayerRef.current.addLayer(circle);
      leafletMap.current.fitBounds(circle.getBounds(), { padding: [50, 50], maxZoom: 14, animate: true });
    }
  }

  return (
    <div className="relative w-full h-full">
      {showSearch && (
        <div className="absolute top-3 left-3 z-[1000] flex gap-2 items-center">
          <input
            type="text"
            placeholder="Search zip, city, state, address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-md ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium shadow-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 min-w-[80px] justify-center"
          >
            {searching ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            ) : (
              "Search"
            )}
          </button>
          {hasSearchOverlay && (
            <button
              onClick={clearSearchOverlay}
              className="h-10 px-3 rounded-md bg-card text-foreground text-xs font-medium shadow-md border border-input hover:bg-muted transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Base map layer switcher */}
      <div className="absolute top-3 right-3 z-[1000]">
        <div className="relative">
          <button
            onClick={() => setLayerMenuOpen(!layerMenuOpen)}
            className="h-10 w-10 rounded-md bg-card text-foreground shadow-md border border-input hover:bg-muted transition-colors flex items-center justify-center"
            title="Change map style"
          >
            <Layers className="h-4 w-4" />
          </button>
          {layerMenuOpen && (
            <div className="absolute top-12 right-0 bg-card border border-border rounded-lg shadow-xl p-1.5 space-y-0.5 min-w-[140px]">
              {(Object.keys(TILE_LAYERS) as TileLayerKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => { setActiveLayer(key); setLayerMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeLayer === key
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  {TILE_LAYERS[key].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div ref={mapRef} className="w-full h-full rounded-lg" style={{ minHeight: "500px" }} />

      <div className="absolute bottom-3 left-3 z-[1000] bg-card/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-xs space-y-1.5">
        <p className="font-semibold text-foreground mb-1">Coverage Zones</p>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COVERAGE_COLORS.strong }} />
          <span className="text-muted-foreground">Strong</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COVERAGE_COLORS.moderate }} />
          <span className="text-muted-foreground">Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COVERAGE_COLORS.weak }} />
          <span className="text-muted-foreground">Weak</span>
        </div>
      </div>
    </div>
  );
});

export default USMap;
