

## Replace `xlsx` with `exceljs` to Fix Security Vulnerability

The `xlsx` (SheetJS) package has two high-severity vulnerabilities and its fixes are behind a paid license. We'll switch to `exceljs`, a fully free and actively maintained alternative.

### What Changes

**1. Swap the dependency**
- Remove `xlsx` from `package.json`
- Add `exceljs` (latest version)

**2. Update `src/components/TechImport.tsx`**
- Replace `import * as XLSX from "xlsx"` with `import ExcelJS from "exceljs"`
- Update the Excel parsing block:
  - Use `new ExcelJS.Workbook()` and `workbook.xlsx.load(arrayBuffer)` to read the file
  - Iterate over the first worksheet's rows using `worksheet.eachRow()` to build the same `string[][]` format
  - The rest of the import logic (CSV parsing, duplicate detection, ZIP lookup, etc.) stays identical

### Technical Detail

```
// Before (xlsx)
const wb = XLSX.read(ab, { type: "array" });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

// After (exceljs)
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(ab);
const ws = wb.worksheets[0];
const rows: string[][] = [];
ws.eachRow((row) => {
  rows.push(row.values.slice(1).map(v => String(v ?? "")));
});
```

### Impact
- Resolves both the Prototype Pollution and ReDoS security findings
- No change to user-facing behavior -- CSV, TSV, XLS, and XLSX imports all continue working identically
- Only one file modified (`TechImport.tsx`) plus the dependency swap

