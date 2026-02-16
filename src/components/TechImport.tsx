import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, FileText } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  onImported: () => void;
  technicians: Tables<"technicians">[];
}

const CSV_HEADERS = ["name", "phone", "email", "city", "state", "zip", "latitude", "longitude", "service_radius_miles", "specialty", "priority", "notes"];

export default function TechImport({ onImported, technicians }: Props) {
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
        const lat = parseFloat(cols[6]) || 0;
        const lng = parseFloat(cols[7]) || 0;
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
        toast({ title: "Import error", description: error.message, variant: "destructive" });
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
      <Button variant="outline" size="sm" onClick={exportCSV}>
        <Download className="h-4 w-4 mr-1.5" />
        Export
      </Button>
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
