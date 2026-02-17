

## Enhance Coverage Map Search with Sidebar Filtering

### Overview
Wire the map search results into the sidebar so that every search (zip, city, state, address) filters technicians and displays them in a scrollable list with distance, expandable details, and map interaction.

### Architecture Changes

**1. Lift search state out of USMap into Dashboard**

Currently `USMap` owns the search input, geocoding, and result filtering internally. To share search results with the sidebar, we need to lift the search result data up to `Dashboard.tsx`.

- Add a new callback prop to `USMap`: `onSearchResults` that passes up an array of `{ tech, distanceMiles, isFallback }` plus the result type and geocoded coordinates.
- `USMap` will continue to own the map visuals (overlays, pins, circles, polygons) but will emit filtered technician results to the parent.
- `Dashboard` will store `searchResults` state and pass it to `TechSidebar`.

**2. Technician filtering logic inside USMap's handleSearch**

After geocoding, compute results based on result type:

| Result Type | Primary Match | Fallback |
|---|---|---|
| ZIP | `tech.zip === searchedZip` (exact) | Nearest 10 by Haversine |
| Neighborhood / City | `tech.city` case-insensitive match | Nearest 10 by Haversine |
| State | `tech.state` matches (full name or abbreviation) | Nearest 10 by Haversine |
| Address / POI | N/A (always distance) | Nearest 10 by Haversine |

All results include computed `distanceMiles` from the geocoded center. A `isFallback` boolean flag indicates if the fallback path was used (to show the "No exact matches, showing nearest" message).

**3. Update map markers to show only filtered techs during search**

When search results are active, the cluster layer will only render markers for the filtered technicians (not all techs). When search is cleared, restore all tech markers.

- Add a `filteredTechIds` state derived from search results.
- In the marker-drawing `useEffect`, if `filteredTechIds` is set, only render those techs.

**4. Redesign TechSidebar to support search results mode**

The sidebar will operate in three modes:
- **Default**: Shows the existing searchable tech list (current behavior).
- **Search Results**: Shows filtered techs from the map search, with distance and expand/collapse details.
- **Selected Tech**: Shows full details for a single technician (current behavior).

New props for TechSidebar:
```
searchResults: { tech, distanceMiles, isFallback }[] | null
searchResultType: string | null
onLocateTech: (tech) => void   // pan map to tech
onClearSearch: () => void
```

**Search Results UI**:
- Header: "Search Results" with result count and a "Clear" button.
- If fallback: info banner "No exact matches found. Showing nearest technicians."
- Each item shows: name, city/state/zip, active/inactive badge, distance in miles.
- A "Show" button on each item expands an accordion panel inline with full details (phone, email, radius, specialties, notes).
- A "Locate" icon button pans/zooms the map to that tech's marker and briefly highlights it.

**5. Map highlight on "Locate" click**

Add a new prop/callback `onLocateTech` from Dashboard to USMap. When called with a tech:
- Pan/zoom map to tech's coordinates (zoom 13).
- Briefly flash the tech's marker (pulse animation via temporary circle overlay that fades out after 1.5s).

**6. Clear search flow**

When the user clicks "Clear" (on map or sidebar):
- Remove map overlays (existing behavior).
- Clear `searchResults` state in Dashboard.
- Restore full tech marker set on map.
- Sidebar returns to default mode.

### Files to Modify

| File | Changes |
|---|---|
| `src/components/USMap.tsx` | Add `onSearchResults` callback prop; extract filtered tech logic from `handleSearch`; add `filteredTechIds` prop to control which markers render; add `locateTech` method via ref or prop; add `onClearSearch` callback. |
| `src/components/TechSidebar.tsx` | Add search results mode with accordion details, distance display, locate button, fallback banner, and clear button. Add new props. |
| `src/pages/Dashboard.tsx` | Hold `searchResults` state; wire `onSearchResults` from USMap to TechSidebar; handle `onLocateTech` and `onClearSearch`; show sidebar for all roles when search results are active. |

### Technical Details

**State abbreviation matching**: Use a US state name-to-abbreviation lookup map so searching "Texas" matches techs with `state: "TX"` and vice versa.

**Accordion for tech details**: Use the existing `@radix-ui/react-accordion` (already installed) for the expand/collapse detail panels in the sidebar.

**Marker highlight effect**: Create a temporary `L.circleMarker` with a larger radius and opacity animation at the tech's coordinates, remove it after 1.5 seconds using `setTimeout`.

**Performance**: Only filtered techs (typically 10-50) get rendered as markers during search, so clustering is not a concern. The Haversine computation over thousands of techs is O(n) and fast in JS.

