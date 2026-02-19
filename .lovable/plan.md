
# Fix Radius Circles Appearing in Wrong/Random Locations

## Root Cause

The current code only filters out technicians with exactly `(0, 0)` coordinates:
```typescript
techs = technicians.filter((t) => t.is_active && (t.latitude !== 0 || t.longitude !== 0));
```

But technicians with other invalid coordinates -- such as coordinates outside the US, swapped lat/lng values, or other garbage data -- still pass through and get markers and radius circles drawn in random locations (other countries, middle of oceans, etc.).

## Fix

Add a `isValidUSCoordinate` helper function that validates coordinates are within the continental US bounding box (plus Alaska and Hawaii). Use it everywhere technicians are filtered for rendering.

US bounds (generous):
- Latitude: 18 to 72 (covers Hawaii ~20 and Alaska ~72)
- Longitude: -180 to -65 (covers Alaska's Aleutian Islands crossing -180 and eastern US)

Also validate that `service_radius_miles` is a positive, reasonable number (e.g., > 0 and < 500) before drawing a radius circle, to prevent absurdly large circles.

## Changes (single file: `src/components/USMap.tsx`)

1. **Add helper function** `isValidUSCoordinate(lat, lng)` that returns true only if coordinates fall within valid US bounds.

2. **Update tech filtering** (around line 349): Replace the `(t.latitude !== 0 || t.longitude !== 0)` check with `isValidUSCoordinate(t.latitude, t.longitude)`.

3. **Update radius rendering** (around line 400): Add a guard so radius circles are only drawn when `tech.service_radius_miles > 0 && tech.service_radius_miles < 500`.

4. **Update `filterTechsBySearch`** (line 132): Use the same `isValidUSCoordinate` check instead of the `!== 0` check.

## Technical Details

```typescript
function isValidUSCoordinate(lat: number, lng: number): boolean {
  if (lat === 0 && lng === 0) return false;
  // Continental US + Hawaii + Alaska (generous bounds)
  return lat >= 18 && lat <= 72 && lng >= -180 && lng <= -65;
}
```

This single validation function applied in 3 places will eliminate all radius circles and markers appearing outside the US.
