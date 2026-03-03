import { useState, useRef } from "react";
import ExcelJS from "exceljs";
import { getSafeErrorMessage } from "@/lib/safeError";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Database, ChevronDown } from "lucide-react";
import { formatPhone, stripPhone } from "@/lib/phoneUtils";
import { correctCitySpelling, correctStateSpelling, correctSpecialty } from "@/lib/locationUtils";
import { fetchAllTechnicians } from "@/lib/fetchAllTechnicians";
import type { Tables } from "@/integrations/supabase/types";
import ImportReport, { type SkippedRow } from "@/components/ImportReport";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [seedingCities, setSeedingCities] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Import report state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportData, setReportData] = useState<{
    totalRows: number;
    importedCount: number;
    skipped: SkippedRow[];
  }>({ totalRows: 0, importedCount: 0, skipped: [] });

  // Seed ZIP centroids table from static dataset
  const seedZipCentroids = async () => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("geocode-zips", { body: {} });
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

  // Seed city centroids table
  const seedCityCentroids = async () => {
    setSeedingCities(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-city-centroids", { body: {} });
      if (error) {
        toast({ title: "Seed error", description: getSafeErrorMessage(error), variant: "destructive" });
      } else {
        toast({ title: "City centroids loaded", description: `${data?.count ?? 0} cities ready` });
      }
    } catch (err: any) {
      toast({ title: "Seed error", description: err.message, variant: "destructive" });
    } finally {
      setSeedingCities(false);
    }
  };

  const buildExportRows = (allTechs: Tables<"technicians">[]) => {
    return allTechs.map((t) => [
      t.name,
      t.phone || "",
      t.email || "",
      t.city,
      t.state,
      t.zip,
      t.latitude,
      t.longitude,
      t.service_radius_miles,
      (t.specialty || []).join(";"),
      t.priority || "normal",
      (t.notes || "").replace(/"/g, '""'),
    ]);
  };

  const exportCSV = async () => {
    setExporting(true);
    toast({ title: "Exporting...", description: "Fetching all technicians" });
    try {
      const allTechs = await fetchAllTechnicians();
      const rows = [CSV_HEADERS.join(",")];
      buildExportRows(allTechs).forEach((cols) => {
        rows.push(cols.map((c) => `"${c}"`).join(","));
      });
      downloadBlob(new Blob([rows.join("\n")], { type: "text/csv" }), "technicians.csv");
      toast({ title: "Exported", description: `${allTechs.length} technicians exported as CSV` });
    } catch (err: any) {
      toast({ title: "Export error", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const exportXLSX = async () => {
    setExporting(true);
    toast({ title: "Exporting...", description: "Fetching all technicians" });
    try {
      const allTechs = await fetchAllTechnicians();
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Technicians");
      ws.addRow(CSV_HEADERS);
      buildExportRows(allTechs).forEach((row) => ws.addRow(row));
      // Style header row
      ws.getRow(1).font = { bold: true };
      ws.columns.forEach((col) => { col.width = 18; });
      const buffer = await wb.xlsx.writeBuffer();
      downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "technicians.xlsx");
      toast({ title: "Exported", description: `${allTechs.length} technicians exported as XLSX` });
    } catch (err: any) {
      toast({ title: "Export error", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const exportTSV = async () => {
    setExporting(true);
    toast({ title: "Exporting...", description: "Fetching all technicians" });
    try {
      const allTechs = await fetchAllTechnicians();
      const rows = [CSV_HEADERS.join("\t")];
      buildExportRows(allTechs).forEach((cols) => {
        rows.push(cols.map((c) => String(c).replace(/\t/g, " ")).join("\t"));
      });
      downloadBlob(new Blob([rows.join("\n")], { type: "text/tab-separated-values" }), "technicians.tsv");
      toast({ title: "Exported", description: `${allTechs.length} technicians exported as TSV` });
    } catch (err: any) {
      toast({ title: "Export error", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportStatus("Parsing file...");

    const skipped: SkippedRow[] = [];

    try {
      // ── Parse file into raw rows ──
      const isExcel = /\.xlsx?$/i.test(file.name);
      let dataLines: string[][] = [];

      if (isExcel) {
        const ab = await file.arrayBuffer();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(ab);
        const ws = wb.worksheets[0];
        const rows: string[][] = [];
        ws.eachRow((row) => {
          rows.push((row.values as any[]).slice(1).map((v) => String(v ?? "")));
        });
        const filtered = rows.filter((r) => r.some((c) => String(c).trim()));
        if (filtered.length === 0) {
          toast({ title: "Empty spreadsheet", variant: "destructive" });
          setImporting(false);
          setImportStatus("");
          return;
        }
        const firstRow = filtered[0].map((c) => String(c).toLowerCase());
        const hasHeader = firstRow.includes("name") && (firstRow.includes("city") || firstRow.includes("state"));
        dataLines = (hasHeader ? filtered.slice(1) : filtered).map((r) => r.map((c) => String(c)));
      } else {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const firstLine = lines[0].toLowerCase();
        const isTSV = firstLine.includes("\t");
        const delimiter = isTSV ? "\t" : ",";
        const hasHeader = firstLine.includes("name") && (firstLine.includes("city") || firstLine.includes("state"));
        const rawLines = hasHeader ? lines.slice(1) : lines;
        dataLines = rawLines.map((line) => parseCSVLine(line, delimiter));
      }

      const totalRows = dataLines.length;

      // ── Pre-validation: parse rows and collect skipped ──
      setImportStatus("Validating rows...");

      type ParsedRow = {
        rowNum: number;
        name: string; phone: string | null; email: string | null;
        city: string; state: string; zip: string;
        rawLat: string; rawLng: string;
        radius: number; specialty: string[] | null;
        priority: string; notes: string | null;
      };

      const parsed: ParsedRow[] = [];
      const phonesSeen = new Map<string, number>();

      for (let idx = 0; idx < dataLines.length; idx++) {
        const cols = dataLines[idx];
        const rowNum = idx + 1;

        if (cols.length < 5) {
          skipped.push({ row: rowNum, name: cols[0]?.trim() || "", phone: cols[1]?.trim() || "", cityState: "", reason: "Row too short" });
          continue;
        }

        const name = cols[0]?.trim();
        const rawCity = cols[3]?.trim() || "";
        const rawState = cols[4]?.trim() || "";

        if (!name) {
          skipped.push({ row: rowNum, name: "", phone: cols[1]?.trim() || "", cityState: `${rawCity}, ${rawState}`, reason: "Missing name" });
          continue;
        }

        if (!rawCity || !rawState) {
          skipped.push({ row: rowNum, name, phone: cols[1]?.trim() || "", cityState: `${rawCity}, ${rawState}`, reason: "Missing city/state" });
          continue;
        }

        const city = correctCitySpelling(rawCity);
        const state = correctStateSpelling(rawState);
        const rawPhone = cols[1]?.trim() || "";
        const phoneDigits = stripPhone(rawPhone);

        if (rawPhone && phoneDigits.length !== 10) {
          skipped.push({ row: rowNum, name, phone: rawPhone, cityState: `${city}, ${state}`, reason: `Invalid phone (${phoneDigits.length} digits)` });
          continue;
        }

        if (phoneDigits.length === 10) {
          const firstSeen = phonesSeen.get(phoneDigits);
          if (firstSeen !== undefined) {
            skipped.push({ row: rowNum, name, phone: rawPhone, cityState: `${city}, ${state}`, reason: `Duplicate phone in file (same as row ${firstSeen})` });
            continue;
          }
          phonesSeen.set(phoneDigits, rowNum);
        }

        const phone = phoneDigits.length === 10 ? formatPhone(rawPhone) : rawPhone || null;

        // Auto-correct specialties
        const rawSpecialty = cols[9] ? cols[9].split(";").map((s) => s.trim()).filter(Boolean) : null;
        const correctedSpecialty: string[] | null = rawSpecialty ? rawSpecialty.map(correctSpecialty) : null;

        parsed.push({
          rowNum,
          name,
          phone,
          email: cols[2]?.trim() || null,
          city, state,
          zip: cols[5]?.trim() || "00000",
          rawLat: cols[6]?.trim() || "",
          rawLng: cols[7]?.trim() || "",
          radius: parseInt(cols[8]) || 25,
          specialty: correctedSpecialty,
          priority: ["best", "normal", "last"].includes(cols[10]?.trim()?.toLowerCase()) ? cols[10].trim().toLowerCase() : "normal",
          notes: cols[11]?.trim() || null,
        });
      }

      // ── Check duplicate phones against database (single batch query) ──
      const validPhones = parsed.filter(r => r.phone).map(r => stripPhone(r.phone!)).filter(d => d.length === 10);
      if (validPhones.length > 0) {
        setImportStatus("Checking for duplicate phone numbers...");
        // Fetch all existing phones in one query using the existing utility
        const { data: existingTechs } = await supabase
          .from("technicians")
          .select("phone")
          .not("phone", "is", null);
        if (existingTechs) {
          const existingPhones = new Set<string>();
          for (const t of existingTechs) {
            if (t.phone) existingPhones.add(stripPhone(t.phone));
          }
          const kept: ParsedRow[] = [];
          for (const row of parsed) {
            if (row.phone && existingPhones.has(stripPhone(row.phone))) {
              skipped.push({ row: row.rowNum, name: row.name, phone: row.phone, cityState: `${row.city}, ${row.state}`, reason: "Duplicate phone in database" });
            } else {
              kept.push(row);
            }
          }
          parsed.length = 0;
          parsed.push(...kept);
        }
      }

      if (parsed.length === 0 && skipped.length === 0) {
        toast({ title: "No valid records found", description: "Check your file format.", variant: "destructive" });
        setImporting(false);
        setImportStatus("");
        return;
      }

      // ── Resolve coordinates (ZIP + city centroid fallback) ──
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

      let centroidMap: Record<string, { latitude: number; longitude: number }> = {};
      const uniqueZips = [...zipsNeeded];
      if (uniqueZips.length > 0) {
        setImportStatus(`Looking up ${uniqueZips.length} ZIP centroids...`);
        // Fetch all ZIP centroids in parallel batches
        const zipBatches = [];
        for (let i = 0; i < uniqueZips.length; i += 500) {
          zipBatches.push(uniqueZips.slice(i, i + 500));
        }
        const zipResults = await Promise.all(
          zipBatches.map(batch =>
            supabase.from("zip_centroids").select("zip, latitude, longitude").in("zip", batch)
          )
        );
        for (const { data } of zipResults) {
          if (data) {
            for (const row of data) {
              centroidMap[row.zip] = { latitude: row.latitude, longitude: row.longitude };
            }
          }
        }
      }

      // City centroid fallback — batch all lookups in parallel
      const needsCityLookup: Set<string> = new Set();
      for (const row of parsed) {
        const lat = parseFloat(row.rawLat);
        const lng = parseFloat(row.rawLng);
        const hasValid = !isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0) &&
          lat >= 18 && lat <= 72 && lng >= -180 && lng <= -65;
        if (!hasValid) {
          const zipCentroid = centroidMap[row.zip.padStart(5, "0")];
          if (!zipCentroid && row.city && row.state) {
            needsCityLookup.add(`${row.city.toLowerCase()}|${row.state.toUpperCase()}`);
          }
        }
      }

      let cityCentroidMap: Record<string, { latitude: number; longitude: number; zip: string | null }> = {};
      if (needsCityLookup.size > 0) {
        setImportStatus(`Looking up ${needsCityLookup.size} city centroids...`);
        const cityPairs = [...needsCityLookup].map(k => { const [c, s] = k.split("|"); return { city: c, state: s }; });
        // Parallel city lookups
        const cityResults = await Promise.all(
          cityPairs.map(pair =>
            supabase
              .from("city_centroids")
              .select("city, state, latitude, longitude, zip")
              .ilike("city", pair.city)
              .eq("state", pair.state)
              .limit(1)
              .then(res => ({ pair, data: res.data }))
          )
        );
        for (const { pair, data } of cityResults) {
          if (data && data.length > 0) {
            cityCentroidMap[`${pair.city}|${pair.state}`] = { latitude: data[0].latitude, longitude: data[0].longitude, zip: data[0].zip };
          }
        }
      }

      // ── Build final records ──
      setImportStatus(`Inserting ${parsed.length} technicians...`);
      const records: { record: any; rowNum: number }[] = [];

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
            const cityKey = `${row.city.toLowerCase()}|${row.state.toUpperCase()}`;
            const cityCentroid = cityCentroidMap[cityKey];
            if (cityCentroid) {
              lat = cityCentroid.latitude;
              lng = cityCentroid.longitude;
              if (cityCentroid.zip && (!row.zip || row.zip === "00000")) {
                row.zip = cityCentroid.zip;
              }
            } else {
              skipped.push({ row: row.rowNum, name: row.name, phone: row.phone || "", cityState: `${row.city}, ${row.state}`, reason: "No coordinates found" });
              continue;
            }
          }
        }

        records.push({
          rowNum: row.rowNum,
          record: {
            name: row.name, phone: row.phone, email: row.email,
            city: row.city, state: row.state, zip: row.zip,
            latitude: lat, longitude: lng,
            service_radius_miles: row.radius,
            specialty: row.specialty,
            priority: row.priority,
            notes: row.notes,
            created_by: user?.id,
          },
        });
      }

      // ── Insert in batches with fallback to one-by-one ──
      let inserted = 0;
      for (let i = 0; i < records.length; i += 500) {
        const batch = records.slice(i, i + 500);
        const { error } = await supabase.from("technicians").insert(batch.map(b => b.record));

        if (error) {
          for (const item of batch) {
            const { error: singleErr } = await supabase.from("technicians").insert(item.record);
            if (singleErr) {
              skipped.push({
                row: item.rowNum,
                name: item.record.name,
                phone: item.record.phone || "",
                cityState: `${item.record.city}, ${item.record.state}`,
                reason: `DB error: ${getSafeErrorMessage(singleErr)}`,
              });
            } else {
              inserted++;
            }
          }
        } else {
          inserted += batch.length;
        }
        setImportStatus(`Inserted ${inserted} of ${records.length}...`);
      }

      // ── Sort skipped by row number and show report ──
      skipped.sort((a, b) => a.row - b.row);
      setReportData({ totalRows, importedCount: inserted, skipped });
      setReportOpen(true);

      if (inserted > 0) {
        onImported();
      }
    } catch (err: any) {
      toast({ title: "File error", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      setImportStatus("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,.xlsx,.xls" className="hidden" onChange={handleFile} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
          <Upload className="h-4 w-4 mr-1.5" />
          {importing ? "Importing..." : "Import"}
        </Button>
        {importing && importStatus && (
          <span className="text-xs text-muted-foreground animate-pulse">{importStatus}</span>
        )}
        {role === "admin" && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exporting}>
                  <Download className="h-4 w-4 mr-1.5" />
                  {exporting ? "Exporting..." : "Export"}
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportCSV}>
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportXLSX}>
                  Export as XLSX (Excel)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportTSV}>
                  Export as TSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={seedZipCentroids} disabled={seeding}>
              <Database className="h-4 w-4 mr-1.5" />
              {seeding ? "Loading ZIPs..." : "Seed ZIPs"}
            </Button>
            <Button variant="outline" size="sm" onClick={seedCityCentroids} disabled={seedingCities}>
              <Database className="h-4 w-4 mr-1.5" />
              {seedingCities ? "Loading..." : "Seed City ZIPs"}
            </Button>
          </>
        )}
      </div>

      <ImportReport
        open={reportOpen}
        onOpenChange={setReportOpen}
        totalRows={reportData.totalRows}
        importedCount={reportData.importedCount}
        skipped={reportData.skipped}
      />
    </>
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
