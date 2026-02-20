

## Plan: New Tech Filter, Specialty-Grouped Sidebar, and New Tech Priority

### 1. Add "New Tech" Tag Filter on the Technicians Page

On `src/pages/Technicians.tsx`, add a toggle filter badge for "New Tech" alongside the existing specialty filters.

- Add a `newTechFilter` state (`boolean | null` -- null = no filter, true = only new, false = only non-new)
- Render a "New Tech" badge in the filter bar that toggles on/off
- Pass the filter to the Supabase query: `.eq("is_new", true)` when active
- Reset page to 1 when toggled

### 2. Group Search Results by Specialty in the Sidebar

On `src/components/TechSidebar.tsx`, restructure the search results mode to display technicians grouped by specialty:

- Sort results so **New Tech** tagged technicians always appear first (in a dedicated "New Technicians" group at the top)
- Then group remaining technicians by their specialties (e.g., "Handyman", "Plumber", etc.)
- Each group gets a heading with the specialty name and count
- Techs with multiple specialties appear under each relevant group
- Techs with no specialty go into an "Other" group at the bottom
- Within each group, techs are sorted by distance (nearest first)

The layout will look like:

```text
+----------------------------------+
| NEW TECHNICIANS (2)              |
|   Tech A - 45.2 mi              |
|   Tech B - 120.0 mi             |
+----------------------------------+
| HANDYMAN (3)                     |
|   Tech C - 5.1 mi               |
|   Tech D - 12.3 mi              |
|   Tech E - 30.0 mi              |
+----------------------------------+
| PLUMBER (2)                      |
|   Tech F - 8.4 mi               |
|   Tech G - 22.1 mi              |
+----------------------------------+
| OTHER (1)                        |
|   Tech H - 15.0 mi              |
+----------------------------------+
```

Each tech entry retains the existing accordion expand for contact details, distance badge, and locate-on-map button.

### 3. New Techs Always Show on Top (Regardless of Distance)

The search sorting in `src/components/USMap.tsx` (`filterTechsBySearch`) already prioritizes `is_new` techs first (lines 144-149). This is working correctly. The improvement here is in the **sidebar display** (point 2 above) -- by having a dedicated "New Technicians" group at the very top, these techs will always be visually prominent even if they are 1000+ miles away.

No change needed in the search/sort logic itself since `is_new` already sorts first.

---

### Technical Details

**Files to modify:**

1. **`src/pages/Technicians.tsx`**
   - Add `newTechFilter` state (boolean or null)
   - Add filter badge in the filter bar section (line ~276)
   - Add `.eq("is_new", true)` to query when filter is active (line ~96)

2. **`src/components/TechSidebar.tsx`**
   - In the search results mode (lines 124-244), replace the flat list with grouped sections
   - Add a `useMemo` to compute groups: first "New Technicians", then each specialty alphabetically, then "Other"
   - Render each group with a section heading and its techs using the existing accordion pattern
