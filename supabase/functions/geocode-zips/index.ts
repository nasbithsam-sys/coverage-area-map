import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { zips } = await req.json();
    if (!Array.isArray(zips) || zips.length === 0) {
      return new Response(JSON.stringify({ error: "zips array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate and clean
    const uniqueZips = [...new Set(zips.map((z: string) => String(z).trim().padStart(5, "0")))];

    // Check which ZIPs are already cached
    const { data: cached } = await supabase
      .from("zip_centroids")
      .select("zip, latitude, longitude")
      .in("zip", uniqueZips);

    const cachedMap: Record<string, { latitude: number; longitude: number }> = {};
    (cached || []).forEach((c: any) => {
      cachedMap[c.zip] = { latitude: c.latitude, longitude: c.longitude };
    });

    const missing = uniqueZips.filter((z) => !cachedMap[z]);

    // Geocode missing ZIPs via Nominatim (rate-limited, batch in small groups)
    const newEntries: { zip: string; latitude: number; longitude: number }[] = [];

    for (const zip of missing) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=US&format=json&limit=1`,
          {
            headers: {
              "User-Agent": "CoverageMapApp/1.0",
            },
          }
        );
        const results = await res.json();
        if (results.length > 0) {
          const lat = parseFloat(results[0].lat);
          const lon = parseFloat(results[0].lon);
          if (lat >= 18 && lat <= 72 && lon >= -180 && lon <= -65) {
            newEntries.push({ zip, latitude: lat, longitude: lon });
            cachedMap[zip] = { latitude: lat, longitude: lon };
          }
        }
        // Small delay to respect Nominatim rate limits (1 req/sec)
        await new Promise((r) => setTimeout(r, 1100));
      } catch {
        // Skip failed lookups
      }
    }

    // Cache new entries
    if (newEntries.length > 0) {
      // Use service role to insert into cache (bypasses RLS)
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await adminClient.from("zip_centroids").upsert(newEntries, { onConflict: "zip" });
    }

    return new Response(JSON.stringify({ centroids: cachedMap }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
