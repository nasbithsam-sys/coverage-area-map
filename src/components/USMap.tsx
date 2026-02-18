import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { Search, X, ChevronDown } from "lucide-react";

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
  invalidateSize: () => void;
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
    maxZoom: 20,
    maxNativeZoom: 19,
    label: "Street",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 20,
    maxNativeZoom: 19,
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
  const [legendOpen, setLegendOpen] = useState(false);

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
    invalidateSize: () => {
      setTimeout(() => leafletMap.current?.invalidateSize(), 50);
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
      maxZoom: 20,
      zoomControl: true,
    });

    const initialTile = L.tileLayer(TILE_LAYERS.street.url, {
      attribution: TILE_LAYERS.street.attribution,
      maxZoom: TILE_LAYERS.street.maxZoom,
      maxNativeZoom: TILE_LAYERS.street.maxNativeZoom,
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
    leafletMap.current.removeLayer(tileLayerRef.current);
    const newTile = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      maxNativeZoom: cfg.maxNativeZoom,
    }).addTo(leafletMap.current);
    tileLayerRef.current = newTile;
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
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ", USA")}&limit=1&addressdetails=1&polygon_geojson=1&polygon_threshold=0.001`
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
            html: `<div style="width:28px;height:28px;background:#ea4335;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
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
                color: "#ea4335",
                fillColor: "#ea4335",
                fillOpacity: 0.04,
                weight: 2.5,
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
                color: "#ea4335",
                fillColor: "#ea4335",
                fillOpacity: 0.04,
                weight: 2.5,
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
  function drawBboxOrCircleFallback(result: any, lat: number, lon: number, _rType: SearchResultType) {
    if (!leafletMap.current || !searchLayerRef.current) return;

    // Add a small center pin for reference
    const pin = L.marker([lat, lon], {
      icon: L.divIcon({
        html: `<div style="width:22px;height:22px;background:#ea4335;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
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
      leafletMap.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true });
    } else {
      leafletMap.current.setView([lat, lon], 12, { animate: true });
    }
  }

  return (
    <div className="relative w-full h-full">
      {showSearch && (
        <div className="absolute top-3 left-3 z-[1000] flex items-center">
          <div className="flex items-center bg-card/95 backdrop-blur-md rounded-full shadow-lg border border-border/50 px-1 h-11 w-80">
            <div className="flex items-center justify-center w-9 h-9 shrink-0">
              {searching ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
              ) : (
                <Search className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <input
              type="text"
              placeholder="Search zip, city, state, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 h-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {(searchQuery || hasSearchOverlay) && (
              <button
                onClick={clearSearchOverlay}
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors shrink-0"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Layer switcher — bottom-left thumbnail toggle */}
      <div className="absolute bottom-3 right-3 z-[1000]">
        <button
          onClick={() => setActiveLayer(activeLayer === "street" ? "satellite" : "street")}
          className="group relative w-16 h-16 rounded-lg overflow-hidden shadow-lg border-2 border-card hover:border-primary/50 transition-all"
          title={`Switch to ${activeLayer === "street" ? "Satellite" : "Street"}`}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
          <span className="absolute bottom-0.5 left-0 right-0 text-[10px] font-semibold text-white text-center leading-tight">
            {activeLayer === "street" ? "Satellite" : "Street"}
          </span>
          {/* Simple colored preview */}
          <div className={`absolute inset-0 ${activeLayer === "street" ? "bg-emerald-800" : "bg-blue-100"}`} />
        </button>
      </div>

      {/* Coverage legend — compact, collapsible */}
      <div className="absolute bottom-3 left-3 z-[1000]">
        <button
          onClick={() => setLegendOpen(!legendOpen)}
          className="flex items-center gap-1.5 bg-card/90 backdrop-blur-md rounded-lg shadow-md border border-border/50 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-card transition-colors"
        >
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COVERAGE_COLORS.strong }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COVERAGE_COLORS.moderate }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COVERAGE_COLORS.weak }} />
          </div>
          <span>Coverage</span>
          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${legendOpen ? "rotate-180" : ""}`} />
        </button>
        {legendOpen && (
          <div className="mt-1.5 bg-card/90 backdrop-blur-md rounded-lg shadow-lg border border-border/50 p-2.5 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COVERAGE_COLORS.strong }} />
              <span className="text-muted-foreground">Strong</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COVERAGE_COLORS.moderate }} />
              <span className="text-muted-foreground">Moderate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COVERAGE_COLORS.weak }} />
              <span className="text-muted-foreground">Weak</span>
            </div>
          </div>
        )}
      </div>

      <div ref={mapRef} className="w-full h-full rounded-lg" style={{ minHeight: "500px" }} />
    </div>
  );
});

export default USMap;
