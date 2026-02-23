

## Add City Centroid Fallback for Missing Coordinates

### Problem
Currently, when importing technicians without coordinates, the system only looks up the ZIP centroid. If the ZIP is missing or not found, the technician gets coordinates (0, 0) and won't appear on the map.

### Solution
Add a **city centroids** table as a second fallback. The lookup order becomes:

1. Use provided lat/lng if valid
2. Look up ZIP centroid from `zip_centroids` table
3. **NEW**: Look up city+state centroid from `city_centroids` table
4. Fall back to (0, 0) only if all above fail

### Changes

**1. New database table: `city_centroids`**
- Columns: `city` (text), `state` (text, 2-letter), `latitude`, `longitude`, `created_at`
- Primary key on `(city, state)` composite
- RLS: authenticated users can read, admin/processor can insert
- Approximately 30,000 US cities

**2. New edge function: `seed-city-centroids`**
- Fetches a public US cities dataset (same source as ZIP seeder — the dataset already contains city/state/lat/lng)
- Upserts into `city_centroids` in batches
- Skips if already seeded (same pattern as `geocode-zips`)

**3. Update `TechImport.tsx`**
- After ZIP centroid lookup, collect any remaining technicians still without coordinates
- Batch-query `city_centroids` by (city, state) pairs
- Apply city centroid as fallback before defaulting to (0, 0)
- Add a "Seed Cities" button next to "Seed ZIPs" (admin only)

**4. Update `TechForm.tsx`**
- When manually adding a technician without coordinates, also check city centroids as fallback after the existing `guessCoords` map

### Technical Details

```text
Coordinate Resolution Order (Import):

  Has lat/lng in file?
       |
      YES --> use it
       |
      NO
       |
  Has ZIP in zip_centroids?
       |
      YES --> use ZIP centroid
       |
      NO
       |
  Has city+state in city_centroids?  <-- NEW
       |
      YES --> use city centroid
       |
      NO --> (0, 0)
```

**Database migration SQL:**
- Creates `city_centroids` table with composite unique constraint on (city, state)
- Adds RLS policies matching the same pattern as `zip_centroids`

**Edge function** reuses the same GitHub dataset (`USCities.json`) which already has city and state fields, so no additional data source is needed.

