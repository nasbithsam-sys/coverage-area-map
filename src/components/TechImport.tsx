import { useState, useRef } from "react";
import { getSafeErrorMessage } from "@/lib/safeError";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Database } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

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
  const [seeding, setSeeding] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Seed ZIP centroids table from static dataset
  const seedZipCentroids = async () => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("geocode-zips", {
        body: {},
      });
      if (error) {
        toast({ title: "Seed error", description: getSafeErrorMessage(error), variant: "destructive" });
      } else {
        toast({ title: "ZIP centroids loaded", description: `${data?.count ?? 0} ZIP codes ready` });
      }
    } catch (err: any) {
      toast({ title: "Seed error", description: err.message, variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

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
        `"${t.priority || "normal"}"`,
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
    setImportStatus("Parsing file...");

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());

      const firstLine = lines[0].toLowerCase();
      const isTSV = firstLine.includes("\t");
      const delimiter = isTSV ? "\t" : ",";
      const hasHeader = firstLine.includes("name") && (firstLine.includes("city") || firstLine.includes("state"));
      const dataLines = hasHeader ? lines.slice(1) : lines;

      // Parse all rows
      const parsed: {
        name: string; phone: string | null; email: string | null;
        city: string; state: string; zip: string;
        rawLat: string; rawLng: string;
        radius: number; specialty: string[] | null;
        priority: string; notes: string | null;
      }[] = [];

      for (const line of dataLines) {
        const cols = parseCSVLine(line, delimiter);
        if (cols.length < 5) continue;
        const name = cols[0]?.trim();
        const city = cols[3]?.trim();
        const state = cols[4]?.trim().toUpperCase();
        if (!name || !city || !state) continue;

        parsed.push({
          name,
          phone: cols[1]?.trim() || null,
          email: cols[2]?.trim() || null,
          city, state,
          zip: cols[5]?.trim() || "00000",
          rawLat: cols[6]?.trim() || "",
          rawLng: cols[7]?.trim() || "",
          radius: parseInt(cols[8]) || 25,
          specialty: cols[9] ? cols[9].split(";").map((s) => s.trim()).filter(Boolean) : null,
          priority: ["best", "normal", "last"].includes(cols[10]?.trim()?.toLowerCase()) ? cols[10].trim().toLowerCase() : "normal",
          notes: cols[11]?.trim() || null,
        });
      }

      if (parsed.length === 0) {
        toast({ title: "No valid records found", description: "Check your file format.", variant: "destructive" });
        setImporting(false);
        setImportStatus("");
        return;
      }

      // Collect ZIPs that need centroid lookup
      const zipsNeeded: Set<string> = new Set();
      for (const row of parsed) {
        const lat = parseFloat(row.rawLat);
        const lng = parseFloat(row.rawLng);
        const hasValid = !isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0) &&
          lat >= 18 && lat <= 72 && lng >= -180 && lng <= -65;
        if (!hasValid && row.zip && row.zip !== "00000") {
          zipsNeeded.add(row.zip.padStart(5, "0"));
        }
      }

      // Query zip_centroids table directly (no Nominatim, instant)
      let centroidMap: Record<string, { latitude: number; longitude: number }> = {};
      const uniqueZips = [...zipsNeeded];

      if (uniqueZips.length > 0) {
        setImportStatus(`Looking up ${uniqueZips.length} ZIP centroids...`);

        // Query in batches of 500 (Supabase IN clause limit)
        for (let i = 0; i < uniqueZips.length; i += 500) {
          const batch = uniqueZips.slice(i, i + 500);
          const { data } = await supabase
            .from("zip_centroids")
            .select("zip, latitude, longitude")
            .in("zip", batch);

          if (data) {
            for (const row of data) {
              centroidMap[row.zip] = { latitude: row.latitude, longitude: row.longitude };
            }
          }
        }

        const resolved = Object.keys(centroidMap).length;
        const unresolved = uniqueZips.length - resolved;
        if (unresolved > 0) {
          console.warn(`${unresolved} ZIP codes not found in centroids table. Seed the table first.`);
        }
      }

      // Build final records
      setImportStatus(`Inserting ${parsed.length} technicians...`);
      const records: any[] = [];

      for (const row of parsed) {
        let lat = parseFloat(row.rawLat);
        let lng = parseFloat(row.rawLng);
        const hasValid = !isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0) &&
          lat >= 18 && lat <= 72 && lng >= -180 && lng <= -65;

        if (!hasValid) {
          const centroid = centroidMap[row.zip.padStart(5, "0")];
          if (centroid) {
            lat = centroid.latitude;
            lng = centroid.longitude;
          } else {
            lat = 0;
            lng = 0;
          }
        }

        records.push({
          name: row.name, phone: row.phone, email: row.email,
          city: row.city, state: row.state, zip: row.zip,
          latitude: lat, longitude: lng,
          service_radius_miles: row.radius,
          specialty: row.specialty,
          priority: row.priority,
          notes: row.notes,
          created_by: user?.id,
        });
      }

      // Insert in batches of 500
      let inserted = 0;
      for (let i = 0; i < records.length; i += 500) {
        const batch = records.slice(i, i + 500);
        const { error } = await supabase.from("technicians").insert(batch);
        if (error) {
          toast({ title: "Import error", description: getSafeErrorMessage(error), variant: "destructive" });
          setImporting(false);
          setImportStatus("");
          return;
        }
        inserted += batch.length;
        setImportStatus(`Inserted ${inserted} of ${records.length}...`);
      }

      const geocoded = records.filter(r => r.latitude !== 0).length;
      const failed = records.length - geocoded;
      toast({
        title: `Imported ${records.length} technicians`,
        description: `${geocoded} with coordinates${failed > 0 ? `, ${failed} without (seed ZIP table first)` : ""}`,
      });
      onImported();
    } catch (err: any) {
      toast({ title: "File error", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      setImportStatus("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleFile} />
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
        <Upload className="h-4 w-4 mr-1.5" />
        {importing ? "Importing..." : "Import"}
      </Button>
      {importing && importStatus && (
        <span className="text-xs text-muted-foreground animate-pulse">{importStatus}</span>
      )}
      {role === "admin" && (
        <>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={seedZipCentroids} disabled={seeding}>
            <Database className="h-4 w-4 mr-1.5" />
            {seeding ? "Loading ZIPs..." : "Seed ZIPs"}
          </Button>
        </>
      )}
    </div>
  );
}

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
