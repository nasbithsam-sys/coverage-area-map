import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { supabase } from "@/integrations/supabase/client";
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

export default function USMap({ technicians, showPins = false, onTechClick }: USMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const zonesRef = useRef<L.LayerGroup | null>(null);
  const radiusRef = useRef<L.LayerGroup | null>(null);
  const [zones, setZones] = useState<CoverageZone[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

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

    // Create cluster group with custom styling
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

  // Draw coverage zones (admin-defined)
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

    // Service radius circles (visible to all)
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

    // Pins (CSR/Admin only)
    if (showPins) {
      activeTechs.forEach((tech) => {
        const marker = L.circleMarker([tech.latitude, tech.longitude], {
          radius: 7,
          fillColor: "hsl(217, 71%, 45%)",
          color: "#fff",
          weight: 2,
          fillOpacity: 0.9,
        });

        marker.bindTooltip(
          `<strong>${tech.name}</strong><br/>${tech.city}, ${tech.state}`,
          { direction: "top" }
        );

        marker.on("click", () => {
          onTechClick?.(tech);
        });

        clusterRef.current!.addLayer(marker);
      });
    }
  }, [technicians, showPins, onTechClick]);

  // Priority sort helper: best first, normal middle, last at end
  const priorityOrder = (p: string) => p === "best" ? 0 : p === "last" ? 2 : 1;

  // Search handler using Nominatim
  const handleSearch = async () => {
    if (!searchQuery.trim() || !leafletMap.current) return;
    setSearching(true);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ", USA")}&limit=1`
      );
      const results = await res.json();

      if (results.length > 0) {
        const { lat, lon } = results[0];
        const searchLat = parseFloat(lat);
        const searchLon = parseFloat(lon);

        leafletMap.current.setView([searchLat, searchLon], 12, { animate: true });

        const activeTechs = technicians.filter((t) => t.is_active);
        const withDist = activeTechs.map((t) => ({
          tech: t,
          dist: getDistanceMiles(searchLat, searchLon, t.latitude, t.longitude),
          priority: (t as any).priority || "normal",
        }));

        // Sort by priority first, then distance
        withDist.sort((a, b) => {
          const pa = priorityOrder(a.priority);
          const pb = priorityOrder(b.priority);
          if (pa !== pb) return pa - pb;
          return a.dist - b.dist;
        });

        // Find techs in radius first, if none found show top 10 nearest regardless of radius
        let nearest = withDist.filter((d) => d.dist <= d.tech.service_radius_miles);
        if (nearest.length === 0) {
          nearest = withDist.slice(0, 10);
        }

        if (nearest.length > 0 && showPins) {
          const bounds = L.latLngBounds(
            nearest.map((n) => [n.tech.latitude, n.tech.longitude] as [number, number])
          );
          bounds.extend([searchLat, searchLon]);
          leafletMap.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 11 });

          if (onTechClick) {
            onTechClick(nearest[0].tech);
          }
        }
      }
    } catch {
      // Silently handle search errors
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Search bar */}
      {showPins && (
        <div className="absolute top-3 left-3 z-[1000] flex gap-2">
          <input
            type="text"
            placeholder="Search city, neighborhood..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-md ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium shadow-md hover:bg-primary/90 disabled:opacity-50"
          >
            {searching ? "..." : "Search"}
          </button>
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
