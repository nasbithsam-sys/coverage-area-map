import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface SkippedRow {
  row: number;
  name: string;
  phone: string;
  cityState: string;
  reason: string;
}

interface ImportReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalRows: number;
  importedCount: number;
  skipped: SkippedRow[];
}

export default function ImportReport({
  open,
  onOpenChange,
  totalRows,
  importedCount,
  skipped,
}: ImportReportProps) {
  const downloadSkipped = () => {
    const headers = ["Row #", "Name", "Phone", "City/State", "Reason"];
    const csvRows = [headers.join(",")];
    for (const s of skipped) {
      csvRows.push(
        [s.row, `"${s.name}"`, `"${s.phone}"`, `"${s.cityState}"`, `"${s.reason}"`].join(",")
      );
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skipped-technicians.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group reasons for summary
  const reasonCounts: Record<string, number> = {};
  for (const s of skipped) {
    reasonCounts[s.reason] = (reasonCounts[s.reason] || 0) + 1;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Report</DialogTitle>
          <DialogDescription>
            Summary of your technician import results
          </DialogDescription>
        </DialogHeader>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 py-3">
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <div className="text-muted-foreground text-sm">Total Rows</div>
            <div className="ml-auto text-2xl font-bold">{totalRows}</div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-3">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <div className="text-sm text-green-700 dark:text-green-400">Imported</div>
            <div className="ml-auto text-2xl font-bold text-green-700 dark:text-green-400">
              {importedCount}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3">
            <XCircle className="h-4 w-4 text-red-600" />
            <div className="text-sm text-red-700 dark:text-red-400">Skipped</div>
            <div className="ml-auto text-2xl font-bold text-red-700 dark:text-red-400">
              {skipped.length}
            </div>
          </div>
        </div>

        {/* Reason breakdown */}
        {skipped.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2">
            {Object.entries(reasonCounts).map(([reason, count]) => (
              <Badge key={reason} variant="outline" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />
                {reason}: {count}
              </Badge>
            ))}
          </div>
        )}

        {/* Skipped rows table */}
        {skipped.length > 0 ? (
          <>
            <ScrollArea className="flex-1 min-h-0 max-h-[40vh] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>City/State</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skipped.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{s.row}</TableCell>
                      <TableCell className="text-sm">{s.name || "—"}</TableCell>
                      <TableCell className="text-sm font-mono">{s.phone || "—"}</TableCell>
                      <TableCell className="text-sm">{s.cityState || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-xs whitespace-nowrap">
                          {s.reason}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <Button variant="outline" size="sm" onClick={downloadSkipped} className="self-start">
              <Download className="h-4 w-4 mr-1.5" />
              Download Skipped ({skipped.length})
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            🎉 All rows imported successfully — no issues found!
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
