

# Fix Search, Table Columns, and Cluster Zoom Behavior

## 3 Issues to Address

### 1. Search should always return results (never "Nothing detected")

**Problem:** When users search for a street address, neighborhood, zip code, city, or state, the search sometimes shows "No locations found" because Nominatim doesn't return a match for the exact query format.

**Fix:** Improve the search to be more resilient:
- Try the original query first, then retry with cleaned-up variations (e.g. strip "USA" suffix, try with just the raw query) if the first attempt returns no results.
- For the `filterTechsBySearch` function: when the result type is "unknown" or no exact matches are found, always fall back to the nearest 10 technicians instead of showing nothing.
- Also handle cases where `detectResultType` returns "unknown" by treating it as an address-style search (nearest 10 techs).

**File:** `src/components/USMap.tsx`
- In `handleSearch`: add a retry with alternative query formats when `results.length === 0`.
- In `filterTechsBySearch`: ensure the `"unknown"` case returns nearest 10 (already does, but make explicit).
- Change the error toast to be softer and still show nearest techs even when geocoding partially fails.

### 2. Technicians table columns should be: Name, Number, Location, Specialties, Priority, Status, Actions

**Problem:** The current column order is: Name, Location, Specialties, Radius, Priority, Status, Actions. The user wants "Number" (phone) shown and "Radius" removed.

**Fix:** In the Technicians page table:
- Remove the "Radius" column.
- Add a "Number" (phone) column after "Name".
- Column order becomes: Checkbox, Name, Number, Location, Specialties, Priority, Status, Actions.

**File:** `src/pages/Technicians.tsx`
- Remove the `SortableHead` for `service_radius_miles` and its corresponding `TableCell`.
- Add a `TableHead` for "Number" after the Name column.
- Add a `TableCell` showing `tech.phone || "-"` in the corresponding position.

### 3. Clusters should split into individual markers with visible radius when zooming in

**Problem:** The marker cluster group uses `maxClusterRadius: 50` which can keep techs clustered even at high zoom levels, preventing users from seeing individual tech radii clearly.

**Fix:** Adjust the `MarkerClusterGroup` settings so clusters break apart at closer zoom levels:
- Set `disableClusteringAtZoom: 12` so that at zoom level 12 and above, all markers are shown individually with their service radius circles visible.
- Keep `spiderfyOnMaxZoom: true` as a safety net.

**File:** `src/components/USMap.tsx`
- Add `disableClusteringAtZoom: 12` to the `L.markerClusterGroup()` config (around line 280).

---

## Technical Details

### USMap.tsx - Search improvements (handleSearch function)

Add retry logic when Nominatim returns 0 results:
```typescript
// If no results with ", USA" suffix, retry without it
if (results.length === 0) {
  const retryRes = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=us&limit=1&addressdetails=1&polygon_geojson=1&polygon_threshold=0.001`
  );
  results = await retryRes.json();
}
```

Also ensure that even when geocoding fails completely, we show nearest techs by distance from map center rather than showing nothing.

### USMap.tsx - Cluster config

```typescript
L.markerClusterGroup({
  maxClusterRadius: 50,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true,
  disableClusteringAtZoom: 12,  // NEW: show individual markers at zoom 12+
  // ... iconCreateFunction stays the same
});
```

### Technicians.tsx - Column changes

Remove the Radius column and add Number column:
```
Header row: [Checkbox] [Name] [Number] [Location] [Specialties] [Priority] [Status] [Actions]
```

The Number cell will display the technician's phone number or a dash if empty.

