import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import USMap from "@/components/USMap";
import TechSidebar from "@/components/TechSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { Tables } from "@/integrations/supabase/types";
import { MapPin, Users, Globe, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const { role } = useAuth();
  const isMobile = useIsMobile();
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

  const handleTechSelect = (tech: Tables<"technicians">) => {
    setSelectedTech(tech);
  };

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row h-[calc(100vh-56px)] md:h-screen">
        <div className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
            {/* Header */}
            <div className="animate-fade-in">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Coverage Map</h1>
              <p className="text-muted-foreground mt-1 text-sm md:text-base">
                {role === "marketing"
                  ? "View technician coverage density across the US"
                  : "Search locations and click markers to see technician details"}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 animate-fade-in stagger-1">
              {stats.map((stat, i) => (
                <div key={stat.label} className={`stat-card stagger-${i + 1}`}>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2 md:mb-3">
                      <div className={`flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-lg bg-muted ${stat.color}`}>
                        <stat.icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      </div>
                    </div>
                    <p className="text-2xl md:text-3xl font-extrabold tracking-tight">{stat.value}</p>
                    <p className="text-[10px] md:text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wider">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Map */}
            <div className="animate-fade-in stagger-3">
              {loading ? (
                <div className="flex items-center justify-center h-48 md:h-64 map-container bg-card">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
                    <p className="text-sm text-muted-foreground">Loading map data...</p>
                  </div>
                </div>
              ) : (
                <div className="map-container h-[350px] md:h-[500px] lg:h-[600px]">
                  <USMap
                    technicians={technicians}
                    showPins={showPins}
                    onTechClick={showPins ? handleTechSelect : undefined}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tech sidebar - sheet on mobile, fixed on desktop */}
        {showPins && !isMobile && (
          <TechSidebar
            technicians={technicians}
            selectedTech={selectedTech}
            onSelect={handleTechSelect}
            onClose={() => setSelectedTech(null)}
          />
        )}

        {showPins && isMobile && (
          <Sheet open={!!selectedTech} onOpenChange={(o) => !o && setSelectedTech(null)}>
            <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl p-0">
              <TechSidebar
                technicians={technicians}
                selectedTech={selectedTech}
                onSelect={handleTechSelect}
                onClose={() => setSelectedTech(null)}
              />
            </SheetContent>
          </Sheet>
        )}
      </div>
    </AppLayout>
  );
}
