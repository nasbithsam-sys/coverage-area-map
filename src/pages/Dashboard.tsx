import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import USMap from "@/components/USMap";
import TechSidebar from "@/components/TechSidebar";
import type { Tables } from "@/integrations/supabase/types";
import { MapPin, Users, Globe, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const { role } = useAuth();
  const [technicians, setTechnicians] = useState<Tables<"technicians">[]>([]);
  const [selectedTech, setSelectedTech] = useState<Tables<"technicians"> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTechnicians() {
      const { data } = await supabase.from("technicians").select("*").order("name");
      setTechnicians(data || []);
      setLoading(false);
    }
    fetchTechnicians();
  }, []);

  const activeTechs = technicians.filter((t) => t.is_active);
  const states = new Set(activeTechs.map((t) => t.state));
  const showPins = role === "csr" || role === "admin";

  const stats = [
    { label: "Total Techs", value: activeTechs.length, icon: Users, color: "text-primary" },
    { label: "States Covered", value: states.size, icon: Globe, color: "text-accent" },
    { label: "Active", value: activeTechs.length, icon: TrendingUp, color: "text-coverage-strong" },
    { label: "Inactive", value: technicians.length - activeTechs.length, icon: MapPin, color: "text-coverage-weak" },
  ];

  return (
    <AppLayout>
      <div className="flex h-screen">
        <div className="flex-1 overflow-auto">
          <div className="p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="animate-fade-in">
              <h1 className="text-3xl font-extrabold tracking-tight">Coverage Map</h1>
              <p className="text-muted-foreground mt-1">
                {role === "marketing"
                  ? "View technician coverage density across the US"
                  : "Search locations and click markers to see technician details"}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in stagger-1">
              {stats.map((stat, i) => (
                <div key={stat.label} className={`stat-card stagger-${i + 1}`}>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-muted ${stat.color}`}>
                        <stat.icon className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="text-3xl font-extrabold tracking-tight">{stat.value}</p>
                    <p className="text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wider">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Map */}
            <div className="animate-fade-in stagger-3">
              {loading ? (
                <div className="flex items-center justify-center h-64 map-container bg-card">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
                    <p className="text-sm text-muted-foreground">Loading map data...</p>
                  </div>
                </div>
              ) : (
                <div className="map-container h-[600px]">
                  <USMap
                    technicians={technicians}
                    showPins={showPins}
                    onTechClick={showPins ? setSelectedTech : undefined}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tech sidebar for CSR/Admin */}
        {showPins && (
          <TechSidebar
            technicians={technicians}
            selectedTech={selectedTech}
            onSelect={setSelectedTech}
            onClose={() => setSelectedTech(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
