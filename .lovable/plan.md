

# Fix All Issues: Performance, Radius, New Tech Badge

## Issues Found

### 1. 6000+ Technicians Will Break the App (Critical)
Both Dashboard and Technicians pages fetch data with `supabase.from("technicians").select("*").order("name")` -- the database has a **default limit of 1000 rows**. With 6000+ techs, only the first 1000 will load. The table also renders all rows at once, which will cause UI lag.

**Fix:**
- Add `.limit(10000)` to both fetch queries in `Dashboard.tsx` and `Technicians.tsx` to bypass the 1000-row default.
- Add client-side pagination (50 rows per page) to the Technicians table to prevent DOM overload.

### 2. Tech Radius Not Showing on Map
The radius circles are drawn with `fillOpacity: 0.06` and `weight: 0.5` -- they are nearly invisible at most zoom levels.

**Fix:**
- Increase `fillOpacity` from `0.06` to `0.12` and `weight` from `0.5` to `1` in `USMap.tsx` (line 352-359) so radius circles are actually visible.

### 3. Editable "New Tech" Badge
Currently `is_new` is set automatically to `true` for manually added techs and cannot be changed. The user wants a dropdown in the form.

**Fix:**
- Add an "is_new" dropdown to `TechForm.tsx` with two options: "New Tech" (true, default for new records) and "-" (false).
- Include `is_new` in the form payload so it gets saved on create and update.

### 4. New Tech Priority in Search Results
This is **already implemented** in `filterTechsBySearch()` (USMap.tsx lines 138-143). Techs with `is_new=true` are sorted to the top before distance sorting. No changes needed here.

---

## Technical Details

### File: `src/pages/Dashboard.tsx` (line 26)
```typescript
// Before
const { data } = await supabase.from("technicians").select("*").order("name");

// After
const { data } = await supabase.from("technicians").select("*").order("name").limit(10000);
```

### File: `src/pages/Technicians.tsx` (line 42)
```typescript
// Before
const { data } = await supabase.from("technicians").select("*").order("name");

// After
const { data } = await supabase.from("technicians").select("*").order("name").limit(10000);
```

Also add pagination state and controls:
- `page` state starting at 1, `PAGE_SIZE = 50`
- Slice `filtered` array to show only current page
- Add Previous/Next buttons and page indicator below the table
- Reset page to 1 when search or specialty filter changes

### File: `src/components/USMap.tsx` (lines 352-359)
```typescript
// Before
fillOpacity: 0.06,
weight: 0.5,

// After
fillOpacity: 0.12,
weight: 1,
```

### File: `src/components/TechForm.tsx`
Add `isNew` state and dropdown:
```typescript
const [isNew, setIsNew] = useState<string>(tech ? (tech.is_new ? "yes" : "no") : "yes");
```

Add to the form grid (next to the Priority dropdown):
```typescript
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
```

Include in payload:
```typescript
is_new: isNew === "yes",
```

Remove the hardcoded `payload.is_new = true` for new records since the dropdown handles it.

