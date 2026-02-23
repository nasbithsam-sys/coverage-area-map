import { useState, useEffect } from "react";
import { getSafeErrorMessage } from "@/lib/safeError";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { formatPhoneInput, stripPhone, formatPhone } from "@/lib/phoneUtils";
import { correctCitySpelling, correctStateSpelling } from "@/lib/locationUtils";
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
  "fort worth,tx": { lat: 32.7555, lng: -97.3308 },
  "san antonio,tx": { lat: 29.4241, lng: -98.4936 },
  "austin,tx": { lat: 30.2672, lng: -97.7431 },
  "arlington,tx": { lat: 32.7357, lng: -97.1081 },
  "san diego,ca": { lat: 32.7157, lng: -117.1611 },
  "jacksonville,fl": { lat: 30.3322, lng: -81.6557 },
  "indianapolis,in": { lat: 39.7684, lng: -86.1581 },
  "san jose,ca": { lat: 37.3382, lng: -121.8863 },
  "philadelphia,pa": { lat: 39.9526, lng: -75.1652 },
  "washington,dc": { lat: 38.9072, lng: -77.0369 },
  "baltimore,md": { lat: 39.2904, lng: -76.6122 },
  "tampa,fl": { lat: 27.9506, lng: -82.4572 },
  "orlando,fl": { lat: 28.5383, lng: -81.3792 },
  "st. louis,mo": { lat: 38.627, lng: -90.1994 },
  "pittsburgh,pa": { lat: 40.4406, lng: -79.9959 },
  "sacramento,ca": { lat: 38.5816, lng: -121.4944 },
  "raleigh,nc": { lat: 35.7796, lng: -78.6382 },
  "memphis,tn": { lat: 35.1495, lng: -90.049 },
  "oklahoma city,ok": { lat: 35.4676, lng: -97.5164 },
  "louisville,ky": { lat: 38.2527, lng: -85.7585 },
  "milwaukee,wi": { lat: 43.0389, lng: -87.9065 },
  "tucson,az": { lat: 32.2226, lng: -110.9747 },
  "albuquerque,nm": { lat: 35.0844, lng: -106.6504 },
  "salt lake city,ut": { lat: 40.7608, lng: -111.891 },
  "omaha,ne": { lat: 41.2565, lng: -95.9345 },
  "el paso,tx": { lat: 31.7619, lng: -106.485 },
  "waco,tx": { lat: 31.5493, lng: -97.1467 },
};

function guessCoords(city: string, state: string) {
  const key = `${city.toLowerCase()},${state.toLowerCase()}`;
  return CITY_COORDS[key] || null;
}

interface Props {
  tech?: Tables<"technicians"> | null;
  onSaved: () => void;
}

export default function TechForm({ tech, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [priority, setPriority] = useState<string>((tech as any)?.priority || "normal");
  const [isNew, setIsNew] = useState<string>(tech ? (tech.is_new ? "yes" : "no") : "yes");
  const [phoneValue, setPhoneValue] = useState(tech?.phone ? formatPhone(tech.phone) : "");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Check for duplicate phone number
  useEffect(() => {
    const digits = stripPhone(phoneValue);
    if (digits.length !== 10) {
      setDuplicateWarning(null);
      return;
    }
    const formatted = formatPhone(phoneValue);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("technicians")
        .select("id, name, phone")
        .eq("phone", formatted)
        .neq("id", tech?.id ?? "00000000-0000-0000-0000-000000000000")
        .limit(1);
      if (data && data.length > 0) {
        setDuplicateWarning(`Phone number already exists: ${data[0].name} (${formatPhone(data[0].phone!)})`);
      } else {
        setDuplicateWarning(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [phoneValue, tech?.id]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneValue(formatPhoneInput(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (duplicateWarning) {
      toast({ title: "Duplicate phone number", description: "A technician with this phone number already exists. Please use a different number.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const form = new FormData(e.currentTarget);

    let city = (form.get("city") as string).trim();
    let state = (form.get("state") as string).trim().toUpperCase();

    // Auto-correct city and state spelling
    city = correctCitySpelling(city);
    state = correctStateSpelling(state);

    let latitude: number;
    let longitude: number;

    const manualLat = parseFloat(form.get("latitude") as string);
    const manualLng = parseFloat(form.get("longitude") as string);

    if (!isNaN(manualLat) && !isNaN(manualLng) && (manualLat !== 0 || manualLng !== 0)) {
      latitude = manualLat;
      longitude = manualLng;
    } else {
      const coords = guessCoords(city, state);
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lng;
      } else if (tech?.latitude && tech?.longitude) {
        latitude = tech.latitude;
        longitude = tech.longitude;
      } else {
        latitude = 0;
        longitude = 0;
      }
    }

    const specialtyRaw = form.get("specialty") as string;
    const specialty = specialtyRaw ? specialtyRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];

    // Format phone to standard format
    const rawPhone = phoneValue;
    const phoneDigits = stripPhone(rawPhone);
    const formattedPhone = phoneDigits.length === 10 ? formatPhone(rawPhone) : rawPhone || null;

    const payload: any = {
      name: form.get("name") as string,
      phone: formattedPhone,
      email: form.get("email") as string || null,
      specialty,
      city,
      state,
      zip: form.get("zip") as string,
      latitude,
      longitude,
      service_radius_miles: parseInt(form.get("radius") as string) || 25,
      notes: form.get("notes") as string || null,
      priority,
      is_new: isNew === "yes",
    };

    if (!tech) {
      payload.created_by = user?.id;
    }

    if (tech) {
      const { error } = await supabase.from("technicians").update(payload).eq("id", tech.id);
      if (error) {
        const msg = error.code === "23505" ? "A technician with this phone number already exists." : getSafeErrorMessage(error);
        toast({ title: "Duplicate phone number", description: msg, variant: "destructive" });
      } else {
        toast({ title: "Technician updated" });
        onSaved();
      }
    } else {
      const { data, error } = await supabase.from("technicians").insert(payload).select().single();
      if (error) {
        const msg = error.code === "23505" ? "A technician with this phone number already exists." : getSafeErrorMessage(error);
        toast({ title: "Duplicate phone number", description: msg, variant: "destructive" });
      } else {
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
          <Input
            id="phone"
            name="phone"
            value={phoneValue}
            onChange={handlePhoneChange}
            placeholder="(555) 123-4567"
            maxLength={14}
          />
        </div>
      </div>
      {duplicateWarning && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">{duplicateWarning}</AlertDescription>
        </Alert>
      )}
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
          <Input id="latitude" name="latitude" type="number" step="any" placeholder="e.g. 40.7128" defaultValue={tech?.latitude || ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="longitude">Longitude</Label>
          <Input id="longitude" name="longitude" type="number" step="any" placeholder="e.g. -74.006" defaultValue={tech?.longitude || ""} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="specialty">Specialties</Label>
          <Input id="specialty" name="specialty" placeholder="HVAC, Plumbing, ..." defaultValue={tech?.specialty?.join(", ") || ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="radius">Radius (miles)</Label>
          <Input id="radius" name="radius" type="number" defaultValue={tech?.service_radius_miles || 25} />
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="best">⭐ Best</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="last">Last Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>New Tech</Label>
          <Select value={isNew} onValueChange={setIsNew}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">New Tech</SelectItem>
              <SelectItem value="no">-</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={tech?.notes || ""} />
      </div>
      <Button type="submit" className="w-full" disabled={loading || !!duplicateWarning}>
        {loading ? "Saving..." : tech ? "Update Technician" : "Add Technician"}
      </Button>
    </form>
  );
}
