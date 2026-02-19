import { useState, useEffect } from "react";
import { getSafeErrorMessage } from "@/lib/safeError";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";

interface CoverageZone {
  id: string;
  name: string;
  zone_type: string;
  latitude: number;
  longitude: number;
  radius_miles: number;
  color_level: string;
}

const COLOR_LABELS: Record<string, string> = {
  strong: "Strong (Green)",
  moderate: "Moderate (Yellow)",
  weak: "Weak (Red)",
};

const COLOR_BADGE_VARIANTS: Record<string, string> = {
  strong: "bg-green-500/20 text-green-700",
  moderate: "bg-yellow-500/20 text-yellow-700",
  weak: "bg-red-500/20 text-red-700",
};

export default function CoverageZoneManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [zones, setZones] = useState<CoverageZone[]>([]);
  const [name, setName] = useState("");
  const [zoneType, setZoneType] = useState("city");
  const [location, setLocation] = useState("");
  const [radiusMiles, setRadiusMiles] = useState("5");
  const [colorLevel, setColorLevel] = useState("strong");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    const { data } = await supabase.from("coverage_zones").select("*").order("created_at", { ascending: false });
    setZones((data as CoverageZone[]) || []);
  };

  const handleAdd = async () => {
    if (!name.trim() || !location.trim()) {
      toast({ title: "Error", description: "Name and location are required", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Geocode the location
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location + ", USA")}&limit=1`
      );
      const results = await res.json();

      if (results.length === 0) {
        toast({ title: "Location not found", description: "Try a more specific location", variant: "destructive" });
        setLoading(false);
        return;
      }

      const { lat, lon } = results[0];

      const { error } = await supabase.from("coverage_zones").insert({
        name: name.trim(),
        zone_type: zoneType,
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        radius_miles: parseFloat(radiusMiles) || 5,
        color_level: colorLevel,
        created_by: user?.id,
      });

      if (error) {
        toast({ title: "Error", description: getSafeErrorMessage(error), variant: "destructive" });
      } else {
        toast({ title: "Coverage zone added" });
        setName("");
        setLocation("");
        setRadiusMiles("5");
        fetchZones();
      }
    } catch {
      toast({ title: "Error", description: "Failed to geocode location", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("coverage_zones").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: getSafeErrorMessage(error), variant: "destructive" });
    } else {
      toast({ title: "Zone deleted" });
      fetchZones();
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> Add Coverage Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Zone Name</Label>
              <Input placeholder="e.g. Downtown Fort Worth" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Location (city/neighborhood)</Label>
              <Input placeholder="e.g. Fort Worth, TX" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Zone Type</Label>
              <Select value={zoneType} onValueChange={setZoneType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="neighborhood">Neighborhood</SelectItem>
                  <SelectItem value="city">City</SelectItem>
                  <SelectItem value="region">Region (group of cities)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Radius (miles)</Label>
              <Input type="number" min="1" max="200" value={radiusMiles} onChange={(e) => setRadiusMiles(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Coverage Level</Label>
              <Select value={colorLevel} onValueChange={setColorLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="strong">Strong (Green)</SelectItem>
                  <SelectItem value="moderate">Moderate (Yellow)</SelectItem>
                  <SelectItem value="weak">Weak (Red)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleAdd} disabled={loading} className="w-full">
                {loading ? "Adding..." : "Add Zone"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Zones ({zones.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Radius</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((zone) => (
                <TableRow key={zone.id}>
                  <TableCell className="font-medium">{zone.name}</TableCell>
                  <TableCell className="capitalize">{zone.zone_type}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COLOR_BADGE_VARIANTS[zone.color_level] || ""}`}>
                      {COLOR_LABELS[zone.color_level] || zone.color_level}
                    </span>
                  </TableCell>
                  <TableCell>{zone.radius_miles} mi</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(zone.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {zones.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No coverage zones defined yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
