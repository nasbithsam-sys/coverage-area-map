import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import USMap from "@/components/USMap";
import TechSidebar from "@/components/TechSidebar";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <AppLayout>
      <div className="flex h-screen">
        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Coverage Map</h1>
            <p className="text-muted-foreground">
              {role === "marketing"
                ? "View technician coverage density across the US"
                : "Search locations and click markers to see technician details"}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" /> Total Techs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">{activeTechs.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Globe className="h-4 w-4" /> States Covered
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">{states.size}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Active
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">{activeTechs.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Inactive
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-2xl font-bold">{technicians.length - activeTechs.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Map */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-0 h-[600px]">
                <USMap
                  technicians={technicians}
                  showPins={showPins}
                  onTechClick={showPins ? setSelectedTech : undefined}
                />
              </CardContent>
            </Card>
          )}
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
