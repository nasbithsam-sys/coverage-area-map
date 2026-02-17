

## Show House Numbers + Use Real Boundaries Instead of Circles

### What Changes

**1. Deeper zoom to show house numbers**
- Increase `maxZoom` to 20 on the map and tile layers
- OpenStreetMap tiles go up to zoom 19, so we enable Leaflet's `maxNativeZoom: 19` with `maxZoom: 20` -- Leaflet will upscale tiles at zoom 20, which still shows house-level detail
- For Satellite (Esri), same approach

**2. Always request boundary polygons from Nominatim**
- Add `polygon_threshold=0.005` to the geocoding URL to ensure Nominatim returns simplified boundary polygons for cities, neighborhoods, ZIP codes, and states
- The current URL already has `polygon_geojson=1` which is correct

**3. Remove dashed circle fallback -- use only real boundaries**
- When GeoJSON polygon is returned (city, neighborhood, ZIP, state): draw the boundary polygon with a dashed stroke and semi-transparent fill
- When no polygon is available but a bounding box exists: draw a rectangle from the bounding box (this is the final fallback, no more circles)
- Remove the `getRadiusForType` function and the `L.circle` fallback entirely
- Keep the center pin marker for area searches so users can see the exact center point

### Technical Details

**Files to modify:** `src/components/USMap.tsx` only

**Specific changes:**
- `TILE_LAYERS`: set `maxZoom: 20` and add `maxNativeZoom: 19` for both street and satellite
- Map init: change `maxZoom` from 19 to 20
- `handleSearch`: no logic changes needed for the GeoJSON path (already prioritizes polygons)
- `drawBboxOrCircleFallback`: remove the dashed circle else-branch; if no bounding box either, just zoom to the center point at a reasonable zoom level
- Delete `getRadiusForType` function (no longer needed)
- Tile layer initialization: pass `maxNativeZoom` option so Leaflet upscales beyond native zoom

