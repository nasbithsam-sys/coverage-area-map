

# Improve Search Resilience and Map Performance

## Two Problems to Fix

### 1. Full address searches fail (e.g. "4662 S Badger Court, Littleton, CO 80127")

The current retry logic tries:
1. Query + ", USA" (fails for this address)
2. Query with `countrycodes=us` (also fails)
3. Falls back to nearest techs from map center (not useful)

From the network logs, "4662 S Badger Court, USA" (without city/state/zip) actually succeeds. The issue is Nominatim's handling of comma-separated full addresses.

**Fix:** Add a multi-step retry cascade in `handleSearch`:
1. Try original query + ", USA" (current)
2. Try original query with `countrycodes=us` (current)
3. NEW: Try a "structured" Nominatim query using `street=`, `city=`, `state=`, `postalcode=` parameters by parsing the comma-separated parts
4. NEW: Try just the raw query without any suffix (no ", USA", no countrycodes filter)
5. NEW: Try progressively shorter versions - strip the street number, then strip the street entirely
6. Only after all retries fail, fall back to nearest techs from map center

This ensures virtually any address format resolves to a location.

### 2. Map sluggish with 6000+ technicians

Currently every active tech gets:
- An `L.circle` for service radius (added to `radiusRef` layer group - NOT clustered)
- An `L.circleMarker` for the pin (added to cluster group)

With 6000 techs, that means ~6000 unclustered radius circles always rendering, which is extremely heavy.

**Fix:** Only render service radius circles for techs visible at the current zoom/bounds:
- Remove the bulk radius rendering from the main `useEffect`
- Add a `moveend`/`zoomend` event listener on the map that renders radius circles only for techs currently in the viewport AND only when zoom level >= 10 (when radii are actually meaningful to see)
- Cap visible radius circles to a reasonable limit (e.g. 200 max) to prevent lag when panned over dense areas
- This keeps the clustered markers performant while still showing radii when zoomed in

## Files to Change

**`src/components/USMap.tsx`** - both fixes in this single file

## Technical Details

### Search retry cascade (handleSearch)

```text
Attempt 1: query + ", USA"
Attempt 2: query + countrycodes=us  
Attempt 3: structured query (parse commas into street/city/state/zip params)
Attempt 4: raw query (no modifications)
Attempt 5: remove street number, retry
Attempt 6: fall back to nearest techs from map center
```

The structured query parsing will handle inputs like "4662 S Badger Court, Littleton, CO 80127" by splitting on commas and mapping parts to Nominatim's `street`, `city`, `state`, `postalcode` parameters.

### Performance: viewport-based radius rendering

```text
Current flow:
  technicians change -> draw ALL 6000 radius circles + ALL 6000 markers

New flow:  
  technicians change -> draw ALL markers into cluster group (clusters handle perf)
  map moveend/zoomend -> if zoom >= 10, draw radius circles for visible techs only (max 200)
  map zoom < 10 -> clear all radius circles (too small to see anyway)
```

This reduces the number of rendered radius circles from 6000 to typically 10-50 at any given time, dramatically improving pan/zoom performance.

