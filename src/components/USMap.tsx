import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface CoverageZone {
  id: string;
  name: string;
  zone_type: string;
  latitude: number;
  longitude: number;
  radius_miles: number;
  color_level: string;
}

interface USMapProps {
  technicians: Tables<"technicians">[];
  showPins?: boolean;
  showSearch?: boolean;
  onTechClick?: (tech: Tables<"technicians">) => void;
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
  // fallback: if bounding box is very small, likely an address
  if (result.boundingbox) {
    const south = parseFloat(result.boundingbox[0]);
    const north = parseFloat(result.boundingbox[1]);
    const span = Math.abs(north - south);
    if (span < 0.01) return "address";
    if (span > 2) return "state";
  }
  return "city"; // safe default
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
    // Rough conversion: 1 degree ≈ 111km
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

export default function USMap({ technicians, showPins = false, showSearch = false, onTechClick }: USMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const zonesRef = useRef<L.LayerGroup | null>(null);
  const radiusRef = useRef<L.LayerGroup | null>(null);
  const searchLayerRef = useRef<L.LayerGroup | null>(null);
  const [zones, setZones] = useState<CoverageZone[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hasSearchOverlay, setHasSearchOverlay] = useState(false);

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
      maxZoom: 18,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    zonesRef.current = L.layerGroup().addTo(map);
    radiusRef.current = L.layerGroup().addTo(map);
    searchLayerRef.current = L.layerGroup().addTo(map);

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

  // Draw tech markers & service radius
  useEffect(() => {
    if (!clusterRef.current || !radiusRef.current) return;
    clusterRef.current.clearLayers();
    radiusRef.current.clearLayers();

    const activeTechs = technicians.filter((t) => t.is_active);

    if (showPins) {
      activeTechs.forEach((tech) => {
        L.circle([tech.latitude, tech.longitude], {
          radius: milesToMeters(tech.service_radius_miles),
          color: "hsl(217, 71%, 45%)",
          fillColor: "hsl(217, 71%, 45%)",
          fillOpacity: 0.06,
          weight: 0.5,
          interactive: false,
        }).addTo(radiusRef.current!);
      });
    }

    if (showPins) {
      activeTechs.forEach((tech) => {
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
  }, [technicians, showPins, onTechClick]);

  const priorityOrder = (p: string) => p === "best" ? 0 : p === "last" ? 2 : 1;

  const clearSearchOverlay = () => {
    searchLayerRef.current?.clearLayers();
    setHasSearchOverlay(false);
  };

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
      clearSearchOverlay();

      if (resultType === "address") {
        // Drop pin + popup at exact location
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

      } else if (resultType === "state" && result.geojson) {
        // Draw GeoJSON polygon for state
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
          // Fallback: use bounding box
          if (result.boundingbox) {
            const south = parseFloat(result.boundingbox[0]);
            const north = parseFloat(result.boundingbox[1]);
            const west = parseFloat(result.boundingbox[2]);
            const east = parseFloat(result.boundingbox[3]);
            leafletMap.current.fitBounds([[south, west], [north, east]], { padding: [40, 40], animate: true });
            const radius = getRadiusForType("state", result.boundingbox);
            const circle = L.circle([searchLat, searchLon], {
              radius,
              color: "hsl(0, 72%, 51%)",
              fillColor: "hsl(0, 72%, 51%)",
              fillOpacity: 0.06,
              weight: 2,
              dashArray: "10 6",
              interactive: false,
            });
            searchLayerRef.current?.addLayer(circle);
          }
        }
      } else {
        // zip / neighborhood / city — draw dashed circle
        const radius = getRadiusForType(resultType, result.boundingbox);

        const pin = L.marker([searchLat, searchLon], {
          icon: L.divIcon({
            html: `<div style="width:22px;height:22px;background:hsl(0,72%,51%);border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
            className: "",
            iconSize: L.point(22, 22),
            iconAnchor: L.point(11, 11),
          }),
        });
        pin.bindTooltip(result.display_name || searchQuery, { direction: "top" });
        searchLayerRef.current?.addLayer(pin);

        const circle = L.circle([searchLat, searchLon], {
          radius: Math.max(radius, 1000),
          color: "hsl(0, 72%, 51%)",
          fillColor: "hsl(0, 72%, 51%)",
          fillOpacity: 0.06,
          weight: 2,
          dashArray: "8 6",
          interactive: false,
        });
        searchLayerRef.current?.addLayer(circle);

        // Fit to circle bounds
        leafletMap.current.fitBounds(circle.getBounds(), { padding: [50, 50], maxZoom: 14, animate: true });
      }

      setHasSearchOverlay(true);

      // Tech proximity logic (for processor/admin)
      if (showPins) {
        const activeTechs = technicians.filter((t) => t.is_active);
        const withDist = activeTechs.map((t) => ({
          tech: t,
          dist: getDistanceMiles(searchLat, searchLon, t.latitude, t.longitude),
          priority: t.priority || "normal",
        }));

        withDist.sort((a, b) => {
          const aNew = a.tech.is_new ? 0 : 1;
          const bNew = b.tech.is_new ? 0 : 1;
          if (aNew !== bNew) return aNew - bNew;
          const pa = priorityOrder(a.priority);
          const pb = priorityOrder(b.priority);
          if (pa !== pb) return pa - pb;
          return a.dist - b.dist;
        });

        let nearest = withDist.filter((d) => d.dist <= d.tech.service_radius_miles);
        if (nearest.length === 0) {
          nearest = withDist.slice(0, 10);
        }

        if (nearest.length > 0 && onTechClick) {
          onTechClick(nearest[0].tech);
        }
      }
    } catch {
      toast.error("Search failed", { description: "Please try again." });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Search bar */}
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

      {/* Map container */}
      <div ref={mapRef} className="w-full h-full rounded-lg" style={{ minHeight: "500px" }} />

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-[1000] bg-card/95 backdrop-blur-sm rounded-lg shadow-lg p-3 text-xs space-y-1.5">
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
}

// Haversine distance in miles
function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
