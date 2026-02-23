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

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if already seeded
    const { count } = await adminClient
      .from("city_centroids")
      .select("*", { count: "exact", head: true });

    if (count && count > 20000) {
      return new Response(
        JSON.stringify({ message: "Already seeded", count }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the same USCities.json dataset (has city, state, lat, lng)
    const res = await fetch(
      "https://raw.githubusercontent.com/millbj92/US-Zip-Codes-JSON/master/USCities.json"
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch dataset: ${res.status}`);
    }

    const data: { city: string; state: string; latitude: any; longitude: any }[] = await res.json();

    // Build unique city+state rows, picking first valid coordinate per city
    const seen = new Set<string>();
    const rows: { city: string; state: string; latitude: number; longitude: number }[] = [];

    for (const entry of data) {
      const lat = Number(entry.latitude);
      const lng = Number(entry.longitude);
      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) continue;
      if (!entry.city || !entry.state) continue;

      const city = entry.city.trim();
      const state = entry.state.trim().toUpperCase();
      const key = `${city.toLowerCase()}|${state}`;

      if (seen.has(key)) continue;
      seen.add(key);

      rows.push({ city, state, latitude: lat, longitude: lng });
    }

    // Insert in batches of 1000
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 1000) {
      const batch = rows.slice(i, i + 1000);
      const { error } = await adminClient
        .from("city_centroids")
        .upsert(batch, { onConflict: "city,state" });
      if (error) {
        throw new Error(`Insert error at batch ${i}: ${error.message}`);
      }
      inserted += batch.length;
    }

    return new Response(
      JSON.stringify({ message: "Seeded successfully", count: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
