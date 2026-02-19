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
    // Auth check - only admins/processors can seed
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

    // Check if already seeded
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { count } = await adminClient
      .from("zip_centroids")
      .select("*", { count: "exact", head: true });

    if (count && count > 30000) {
      return new Response(
        JSON.stringify({ message: "Already seeded", count }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch ZIP centroid dataset from GitHub (MIT licensed, ~33k entries)
    const res = await fetch(
      "https://raw.githubusercontent.com/millbj92/US-Zip-Codes-JSON/master/USCities.json"
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch dataset: ${res.status}`);
    }

    const data: { zip_code: number; latitude: any; longitude: any }[] = await res.json();

    // Build rows, filter out entries with missing/invalid coordinates
    const rows = data
      .filter((entry) => {
        const lat = Number(entry.latitude);
        const lng = Number(entry.longitude);
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      })
      .map((entry) => ({
        zip: String(entry.zip_code).padStart(5, "0"),
        latitude: Number(entry.latitude),
        longitude: Number(entry.longitude),
      }));

    // Insert in batches of 1000
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 1000) {
      const batch = rows.slice(i, i + 1000);
      const { error } = await adminClient
        .from("zip_centroids")
        .upsert(batch, { onConflict: "zip" });
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
