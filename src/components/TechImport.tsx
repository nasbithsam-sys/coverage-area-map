import { useState, useRef } from "react";
import { getSafeErrorMessage } from "@/lib/safeError";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, FileText } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

// Common US city coordinates for geocoding imports
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
  const key = `${city.toLowerCase().trim()},${state.toLowerCase().trim()}`;
  return CITY_COORDS[key] || null;
}

interface Props {
  onImported: () => void;
  technicians: Tables<"technicians">[];
  role?: string;
}

const CSV_HEADERS = ["name", "phone", "email", "city", "state", "zip", "latitude", "longitude", "service_radius_miles", "specialty", "priority", "notes"];

export default function TechImport({ onImported, technicians, role }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportCSV = () => {
    const rows = [CSV_HEADERS.join(",")];
    technicians.forEach((t) => {
      rows.push([
        `"${t.name}"`,
        `"${t.phone || ""}"`,
        `"${t.email || ""}"`,
        `"${t.city}"`,
        `"${t.state}"`,
        `"${t.zip}"`,
        t.latitude,
        t.longitude,
        t.service_radius_miles,
        `"${(t.specialty || []).join(";")}"`,
        `"${(t as any).priority || "normal"}"`,
        `"${(t.notes || "").replace(/"/g, '""')}"`,
      ].join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "technicians.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      
      // Detect delimiter
      const firstLine = lines[0].toLowerCase();
      const isCSV = firstLine.includes(",");
      const isTSV = firstLine.includes("\t");
      const delimiter = isTSV ? "\t" : ",";

      // Check if first line is a header
      const hasHeader = firstLine.includes("name") && (firstLine.includes("city") || firstLine.includes("state"));
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const records: any[] = [];
      for (const line of dataLines) {
        const cols = parseCSVLine(line, delimiter);
        if (cols.length < 5) continue; // need at least name, city, state, zip + something

        const name = cols[0]?.trim();
        const phone = cols[1]?.trim() || null;
        const email = cols[2]?.trim() || null;
        const city = cols[3]?.trim();
        const state = cols[4]?.trim().toUpperCase();
        const zip = cols[5]?.trim() || "00000";
        const geocoded = guessCoords(city, state);
        const lat = geocoded?.lat ?? (parseFloat(cols[6]) || 0);
        const lng = geocoded?.lng ?? (parseFloat(cols[7]) || 0);
        const radius = parseInt(cols[8]) || 25;
        const specialty = cols[9] ? cols[9].split(";").map((s: string) => s.trim()).filter(Boolean) : [];
        const priority = ["best", "normal", "last"].includes(cols[10]?.trim()?.toLowerCase()) ? cols[10].trim().toLowerCase() : "normal";
        const notes = cols[11]?.trim() || null;

        if (!name || !city || !state) continue;

        records.push({
          name, phone, email, city, state, zip,
          latitude: lat, longitude: lng,
          service_radius_miles: radius,
          specialty: specialty.length ? specialty : null,
          priority,
          notes,
          created_by: user?.id,
        });
      }

      if (records.length === 0) {
        toast({ title: "No valid records found", description: "Check your file format.", variant: "destructive" });
        setImporting(false);
        return;
      }

      const { error } = await supabase.from("technicians").insert(records);
      if (error) {
        toast({ title: "Import error", description: getSafeErrorMessage(error), variant: "destructive" });
      } else {
        toast({ title: `Imported ${records.length} technicians` });
        onImported();
      }
    } catch (err: any) {
      toast({ title: "File error", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex gap-2">
      <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleFile} />
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
        <Upload className="h-4 w-4 mr-1.5" />
        {importing ? "Importing..." : "Import"}
      </Button>
      {role === "admin" && (
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1.5" />
          Export
        </Button>
      )}
    </div>
  );
}

// Simple CSV line parser handling quoted fields
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
