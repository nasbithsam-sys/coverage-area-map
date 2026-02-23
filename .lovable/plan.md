

## Import Report: Track Skipped Technicians and Reasons

### Problem
Currently, when importing technicians, if there are issues (duplicate phone numbers, invalid data, missing cities, etc.), the entire batch fails silently or with a generic error. You have no way to know which specific technicians were skipped and why.

### Solution
Add a **detailed import report** that validates each row individually before inserting, categorizes issues, and shows a downloadable report of all skipped records with reasons.

### How It Will Work

1. **Pre-validation phase** -- Before inserting anything, each row gets validated individually:
   - **Duplicate phone in file**: Two rows in the same file share a phone number
   - **Duplicate phone in database**: Phone already exists in the system
   - **Invalid phone**: Phone has wrong number of digits (not 10)
   - **Missing required fields**: Name, city, or state is blank
   - **No coordinates found**: City/state not in database, no ZIP match
   - **Too few columns**: Row has fewer than 5 columns

2. **Insert one-by-one for problem rows** -- Instead of batch-inserting everything and failing on the first error, records with potential issues (like duplicate phones) will be flagged but valid records will still be inserted.

3. **Import Results Dialog** -- After import, a dialog/modal pops up showing:
   - Total rows in file
   - Successfully imported count
   - Skipped count with breakdown by reason
   - A table listing each skipped technician: row number, name, phone, and the reason

4. **Download Skipped Report** -- A button to download a CSV of just the skipped/failed rows so you can fix and re-import them.

### Technical Details

**File: `src/components/TechImport.tsx`**

- Add a `skipped` array that collects `{ row, name, phone, reason }` for each problematic record
- Validate rows before building the insert batch:
  - Check for duplicate phones within the file itself
  - Check for duplicate phones against existing database records
  - Flag invalid phone formats (not 10 digits after stripping)
  - Flag rows missing name/city/state
  - Flag rows where no coordinates could be resolved
- Insert valid records in batches; for rows that fail due to DB constraints (e.g., unique phone violation), catch the error, insert individually, and log failures
- After import, show an import report dialog

**New file: `src/components/ImportReport.tsx`**

- A dialog component that displays:
  - Summary stats (total, imported, skipped)
  - Scrollable table of skipped rows with columns: Row #, Name, Phone, City/State, Reason
  - "Download Skipped" button that exports the skipped rows as a CSV for easy fixing and re-import

**Validation rules applied per row:**

| Check | Reason shown |
|-------|-------------|
| Fewer than 5 columns | "Row too short" |
| Missing name | "Missing name" |
| Missing city or state | "Missing city/state" |
| Phone not 10 digits | "Invalid phone (X digits)" |
| Same phone as another row in file | "Duplicate phone in file" |
| Same phone as existing tech in DB | "Duplicate phone in database" |
| No coordinates resolved | "No coordinates found" |

**Insert strategy change:**
- Currently: batch insert of 500, entire batch fails if one row has a constraint violation
- New: batch insert, but if a batch fails with a unique constraint error, fall back to inserting rows one-by-one in that batch, catching and logging each individual failure

