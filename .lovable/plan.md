
# Plan: Sidebar Animation + Technicians Page Enhancements

## 1. Smooth Slide Transition for Map Sidebar

Add a CSS transition-based slide animation to the `TechSidebar` on the Dashboard map page. Instead of toggling with `display: none`, the sidebar will always render but use `transform: translateX()` and `width` transitions to smoothly slide in/out.

**Files:** `src/pages/Dashboard.tsx`

- Always render the sidebar when `canShowSidebar` is true (not just when `sidebarOpen`)
- Apply CSS transition classes: `transition-all duration-300` with `translate-x-0` (open) vs `translate-x-full` (closed) + `w-0 overflow-hidden` when closed
- Keep the `invalidateSize` call on toggle

## 2. Bulk Delete Technicians

Add checkbox-based multi-select to the Technicians table with a bulk delete action bar.

**Files:** `src/pages/Technicians.tsx`

- Add `selectedIds` state (`Set<string>`)
- Add a checkbox column in the table header (select all visible) and each row
- When 1+ rows selected, show a floating action bar with "Delete X selected" button
- Confirmation dialog before bulk delete
- Execute delete via `supabase.from("technicians").delete().in("id", [...selectedIds])`
- Log activity for each deleted tech
- Clear selection after delete

## 3. Search by Specialties

Add a specialty filter dropdown/badges to the Technicians page search area.

**Files:** `src/pages/Technicians.tsx`

- Add `specialtyFilter` state (`string[]`)
- Extract all unique specialties from the technicians list
- Render clickable filter badges (or a multi-select popover) next to the search input
- Update the `filtered` logic to also check if `tech.specialty` includes any of the selected specialties (if any are selected)

## 4. Search by Address (City/State/ZIP)

Enhance the existing search input to also match against ZIP codes and full address text.

**Files:** `src/pages/Technicians.tsx`

- The current search already matches `name`, `city`, `state`
- Extend to also match `zip` field
- Add placeholder text update to indicate searchable fields: "Search by name, city, state, ZIP..."

---

## Technical Details

### Dashboard Sidebar Animation (`Dashboard.tsx`)
- Replace conditional render `{showSidebar && !isMobile && <TechSidebar ... />}` with always-rendered sidebar wrapped in a div with transition classes
- Use `overflow-hidden` + `w-0`/`w-80` + `translate-x` pattern for smooth animation
- Sidebar content uses `min-w-[320px]` to prevent content squishing during transition

### Bulk Delete (`Technicians.tsx`)
- New state: `selectedIds: Set<string>`
- Checkbox in header toggles all filtered rows
- Checkbox in each row toggles individual selection
- Sticky bottom bar appears when selection is active with count + delete button
- AlertDialog confirms bulk deletion
- Batch delete with `.in("id", ids)` query

### Specialty Filter (`Technicians.tsx`)
- Derive unique specialties: `useMemo` over `technicians` array, flatten + deduplicate `specialty` arrays
- Render as a row of toggleable Badge components below the search input
- Active filters highlighted with primary color variant
- Filter logic: if `specialtyFilter.length > 0`, only show techs whose `specialty` array contains at least one match

### ZIP Search (`Technicians.tsx`)
- Add `t.zip.toLowerCase().includes(search.toLowerCase())` to the filter predicate
- Update placeholder text
