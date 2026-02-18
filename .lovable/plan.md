

## Google Maps-Style Boundary Polygons and UI Polish

### Problem
Currently, when searching for a city/ZIP/neighborhood, the map falls back to drawing rectangles from bounding boxes when GeoJSON polygons aren't available. The user wants actual boundary outlines like Google Maps shows (see reference: red dashed boundary around ZIP 90027 in Los Angeles).

### Changes

**1. Improve polygon reliability from Nominatim**
- Lower `polygon_threshold` from `0.005` to `0.001` for more detailed, accurate boundaries
- This gives finer-grained polygons that look closer to real boundaries

**2. Style polygons to match Google Maps aesthetic**
- Change from dashed red to a subtle, solid red-pink boundary line (weight ~2.5, slight transparency)
- Use a very light semi-transparent fill (fillOpacity ~0.04) so the map underneath remains readable
- Remove `dashArray` -- Google Maps uses solid boundary lines, not dashed

**3. Remove rectangle fallback entirely**
- When no GeoJSON polygon is returned, just fit the map to the bounding box coordinates without drawing any rectangle overlay
- This avoids the ugly box shape that doesn't represent real boundaries
- A small center pin marker is still placed for reference

**4. Upgrade search bar UI to be more Google Maps-like**
- Rounded pill-shaped search input with a search icon on the left
- An "X" clear button inside the input when text is present
- Integrated search button (icon-only) on the right side of the input
- Slightly larger, with a subtle shadow and glass-morphism background
- Loading spinner replaces search icon while searching

**5. Upgrade layer switcher UI**
- Make it a small thumbnail-based toggle (like Google Maps' "Layers" button in bottom-left)
- Show a mini preview label for Street vs Satellite

**6. Polish legend card**
- Make the coverage zones legend more compact and translucent
- Collapsible on click to save space

### Files to Modify

| File | Changes |
|---|---|
| `src/components/USMap.tsx` | Lower polygon_threshold; update polygon styling to solid lines with subtle fill; remove rectangle drawing in fallback (keep fitBounds only); redesign search bar HTML/CSS to Google Maps style; update layer switcher UI |
| `src/index.css` | Add any new utility classes for the search bar glass effect |

### Technical Details

**Polygon styling (Google Maps-like):**
```
color: "#ea4335" (Google Maps red)
fillColor: "#ea4335"
fillOpacity: 0.04
weight: 2.5
dashArray: none (solid line)
```

**Search bar redesign:**
- Single container with `rounded-full` shape, backdrop-blur, shadow
- `Search` icon (lucide) on the left, input in the middle, `X` button to clear, search trigger on right
- Pressing Enter or clicking search icon triggers geocoding

**Fallback behavior when no polygon:**
- `drawBboxOrCircleFallback` will only place a center pin and call `fitBounds` on the bounding box
- No rectangle or circle overlay drawn -- just the map zooms to the right area
- If no bounding box either, zoom to center at level 12

