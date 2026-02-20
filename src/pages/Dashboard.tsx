import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllTechnicians } from "@/lib/fetchAllTechnicians";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import USMap from "@/components/USMap";
import type { USMapHandle, SearchResultsData } from "@/components/USMap";
import TechSidebar from "@/components/TechSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { Tables } from "@/integrations/supabase/types";
import { MapPin, Users, Globe, TrendingUp, PanelRightOpen, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { role } = useAuth();
  const isMobile = useIsMobile();
  const mapRef = useRef<USMapHandle>(null);
  const [technicians, setTechnicians] = useState<Tables<"technicians">[]>([]);
  const [selectedTech, setSelectedTech] = useState<Tables<"technicians"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchData, setSearchData] = useState<SearchResultsData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    async function fetchTechnicians() {
      const data = await fetchAllTechnicians();
      setTechnicians(data);
      setLoading(false);
    }
    fetchTechnicians();
  }, []);

  const activeTechs = technicians.filter((t) => t.is_active);
  const states = new Set(activeTechs.map((t) => t.state));
  const showPins = role === "processor" || role === "admin";

  const stats = [
    { label: "Total Techs", value: activeTechs.length, icon: Users, color: "text-primary" },
    { label: "States Covered", value: states.size, icon: Globe, color: "text-accent" },
    { label: "Active", value: activeTechs.length, icon: TrendingUp, color: "text-coverage-strong" },
    { label: "Inactive", value: technicians.length - activeTechs.length, icon: MapPin, color: "text-coverage-weak" },
  ];

  const handleTechSelect = (tech: Tables<"technicians">) => {
    setSelectedTech(tech);
    setSidebarOpen(true);
  };

  const handleSearchResults = useCallback((data: SearchResultsData | null) => {
    setSearchData(data);
    if (!data) setSelectedTech(null);
    if (data) setSidebarOpen(true);
  }, []);

  const handleLocateTech = useCallback((tech: Tables<"technicians">) => {
    mapRef.current?.locateTech(tech);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchData(null);
    setSelectedTech(null);
  }, []);

  const filteredTechIds = useMemo(() => {
    if (!searchData) return null;
    return new Set(searchData.results.map((r) => r.tech.id));
  }, [searchData]);

  const canShowSidebar = showPins || !!searchData;
  const showSidebar = canShowSidebar && sidebarOpen;

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row h-[calc(100vh-56px)] md:h-screen">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header + Stats */}
          <div className="p-4 md:px-6 md:pt-6 md:pb-4 space-y-4 shrink-0">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Coverage Map</h1>
              <p className="text-muted-foreground mt-1 text-sm md:text-base">
                {role === "marketing"
                  ? "View technician coverage density across the US"
                  : "Search locations and click markers to see technician details"}
              </p>
            </motion.div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  className="stat-card"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 * (i + 1) }}
                >
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2 md:mb-3">
                      <div className={`flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-lg bg-muted ${stat.color}`}>
                        <stat.icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      </div>
                    </div>
                    <p className="text-2xl md:text-3xl font-extrabold tracking-tight">{stat.value}</p>
                    <p className="text-[10px] md:text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wider">{stat.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Map — fills remaining height */}
          <div className="flex-1 px-4 md:px-6 pb-4 md:pb-6 min-h-0 relative">
            {/* Sidebar toggle button — OUTSIDE map, always visible */}
            {canShowSidebar && !isMobile && (
              <Button
                variant="outline"
                size="icon"
                className="absolute top-2 right-8 z-20 h-9 w-9 bg-card shadow-md border border-border hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                onClick={() => {
                  setSidebarOpen((o) => !o);
                  setTimeout(() => mapRef.current?.invalidateSize(), 350);
                }}
                aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              >
                {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </Button>
            )}

            {loading ? (
              <div className="flex items-center justify-center h-full map-container bg-card">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
                  <p className="text-sm text-muted-foreground">Loading map data...</p>
                </div>
              </div>
            ) : (
              <motion.div
                className="map-container h-full"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <USMap
                  ref={mapRef}
                  technicians={technicians}
                  showPins={showPins}
                  showSearch={true}
                  onTechClick={showPins ? handleTechSelect : undefined}
                  onSearchResults={handleSearchResults}
                  filteredTechIds={filteredTechIds}
                />
              </motion.div>
            )}
          </div>
        </div>

        {/* Tech sidebar */}
        {canShowSidebar && !isMobile && (
          <motion.div
            className="border-l border-border/50 h-full overflow-hidden"
            initial={false}
            animate={{
              width: sidebarOpen ? 320 : 0,
              minWidth: sidebarOpen ? 320 : 0,
              opacity: sidebarOpen ? 1 : 0,
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="min-w-[320px] h-full">
              <TechSidebar
                technicians={technicians}
                selectedTech={selectedTech}
                onSelect={handleTechSelect}
                onClose={() => setSelectedTech(null)}
                searchResults={searchData?.results}
                searchResultType={searchData?.resultType}
                searchQuery={searchData?.query}
                onLocateTech={handleLocateTech}
                onClearSearch={handleClearSearch}
              />
            </div>
          </motion.div>
        )}

        {canShowSidebar && isMobile && (
          <Sheet open={!!selectedTech || !!searchData} onOpenChange={(o) => { if (!o) { setSelectedTech(null); setSearchData(null); } }}>
            <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl p-0">
              <TechSidebar
                technicians={technicians}
                selectedTech={selectedTech}
                onSelect={handleTechSelect}
                onClose={() => setSelectedTech(null)}
                searchResults={searchData?.results}
                searchResultType={searchData?.resultType}
                searchQuery={searchData?.query}
                onLocateTech={handleLocateTech}
                onClearSearch={handleClearSearch}
              />
            </SheetContent>
          </Sheet>
        )}
      </div>
    </AppLayout>
  );
}
