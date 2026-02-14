import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

// Common US city coordinates for quick lookup
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "new york,ny": { lat: 40.7128, lng: -74.006 },
  "los angeles,ca": { lat: 34.0522, lng: -118.2437 },
  "chicago,il": { lat: 41.8781, lng: -87.6298 },
  "houston,tx": { lat: 29.7604, lng: -95.3698 },
  "phoenix,az": { lat: 33.4484, lng: -112.074 },
  "dallas,tx": { lat: 32.7767, lng: -96.797 },
  "miami,fl": { lat: 25.7617, lng: -80.1918 },
  "atlanta,ga": { lat: 33.749, lng: -84.388 },
  "seattle,wa": { lat: 47.6062, lng: -122.3321 },
  "denver,co": { lat: 39.7392, lng: -104.9903 },
  "boston,ma": { lat: 42.3601, lng: -71.0589 },
  "san francisco,ca": { lat: 37.7749, lng: -122.4194 },
  "detroit,mi": { lat: 42.3314, lng: -83.0458 },
  "minneapolis,mn": { lat: 44.9778, lng: -93.265 },
  "portland,or": { lat: 45.5152, lng: -122.6784 },
  "nashville,tn": { lat: 36.1627, lng: -86.7816 },
  "charlotte,nc": { lat: 35.2271, lng: -80.8431 },
  "kansas city,mo": { lat: 39.0997, lng: -94.5786 },
  "las vegas,nv": { lat: 36.1699, lng: -115.1398 },
  "columbus,oh": { lat: 39.9612, lng: -82.9988 },
};

function guessCoords(city: string, state: string) {
  const key = `${city.toLowerCase()},${state.toLowerCase()}`;
  return CITY_COORDS[key] || null;
}

interface Props {
  tech?: Tables<"technicians"> | null;
  onSaved: () => void;
  logActivity: (action: string, entity: string, entityId: string, details: Record<string, unknown>) => Promise<void>;
}

export default function TechForm({ tech, onSaved, logActivity }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const city = form.get("city") as string;
    const state = form.get("state") as string;
    const latInput = form.get("latitude") as string;
    const lngInput = form.get("longitude") as string;

    let latitude = latInput ? parseFloat(latInput) : 0;
    let longitude = lngInput ? parseFloat(lngInput) : 0;

    if (!latitude && !longitude) {
      const coords = guessCoords(city, state);
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lng;
      } else {
        toast({ title: "Please enter coordinates", description: "We couldn't auto-detect the location.", variant: "destructive" });
        setLoading(false);
        return;
      }
    }

    const specialtyRaw = form.get("specialty") as string;
    const specialty = specialtyRaw ? specialtyRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];

    const payload = {
      name: form.get("name") as string,
      phone: form.get("phone") as string || null,
      email: form.get("email") as string || null,
      specialty,
      city,
      state: state.toUpperCase(),
      zip: form.get("zip") as string,
      latitude,
      longitude,
      service_radius_miles: parseInt(form.get("radius") as string) || 25,
      notes: form.get("notes") as string || null,
      created_by: tech ? undefined : user?.id,
    };

    if (tech) {
      const { error } = await supabase.from("technicians").update(payload).eq("id", tech.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        await logActivity("edited", "technician", tech.id, { name: payload.name, changes: "updated details" });
        toast({ title: "Technician updated" });
        onSaved();
      }
    } else {
      const { data, error } = await supabase.from("technicians").insert(payload).select().single();
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        await logActivity("added", "technician", data.id, { name: payload.name });
        toast({ title: "Technician added" });
        onSaved();
      }
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" name="name" required defaultValue={tech?.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={tech?.phone || ""} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={tech?.email || ""} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City *</Label>
          <Input id="city" name="city" required defaultValue={tech?.city} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State *</Label>
          <Input id="state" name="state" required maxLength={2} placeholder="TX" defaultValue={tech?.state} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip">ZIP *</Label>
          <Input id="zip" name="zip" required defaultValue={tech?.zip} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="latitude">Latitude</Label>
          <Input id="latitude" name="latitude" type="number" step="any" placeholder="Auto-detect" defaultValue={tech?.latitude || ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="longitude">Longitude</Label>
          <Input id="longitude" name="longitude" type="number" step="any" placeholder="Auto-detect" defaultValue={tech?.longitude || ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="specialty">Specialties</Label>
          <Input id="specialty" name="specialty" placeholder="HVAC, Plumbing, ..." defaultValue={tech?.specialty?.join(", ") || ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="radius">Service Radius (miles)</Label>
          <Input id="radius" name="radius" type="number" defaultValue={tech?.service_radius_miles || 25} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={tech?.notes || ""} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving..." : tech ? "Update Technician" : "Add Technician"}
      </Button>
    </form>
  );
}
