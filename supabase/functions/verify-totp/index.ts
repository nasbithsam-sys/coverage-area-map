import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TOTP } from "https://esm.sh/otpauth@9.3.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limiter: max 5 attempts per user per 5 minutes
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attemptMap = new Map<string, { count: number; firstAttempt: number }>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = attemptMap.get(userId);
  if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    attemptMap.set(userId, { count: 1, firstAttempt: now });
    return false;
  }
  entry.count++;
  if (entry.count > MAX_ATTEMPTS) {
    return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, totp_code, action } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Action: generate - create a new TOTP secret for a user
    if (action === "generate") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify caller is admin
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: userData } = await supabaseUser.auth.getUser();
      if (!userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: isAdmin } = await supabaseUser.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get user email for the TOTP label
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("user_id", user_id)
        .single();

      const totp = new TOTP({
        issuer: "TechMap",
        label: profile?.email || "admin",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
      });

      const secret = totp.secret.base32;

      // Save secret to profile
      await supabaseAdmin
        .from("profiles")
        .update({ totp_secret: secret })
        .eq("user_id", user_id);

      const uri = totp.toString();

      return new Response(
        JSON.stringify({ secret, uri }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: verify - verify a TOTP code
    if (action === "verify") {
      if (!user_id || !totp_code) {
        return new Response(
          JSON.stringify({ error: "user_id and totp_code required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Rate limit: max 5 attempts per user per 5 minutes
      if (isRateLimited(user_id)) {
        return new Response(
          JSON.stringify({ error: "Too many attempts. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("totp_secret, email")
        .eq("user_id", user_id)
        .single();

      if (!profile?.totp_secret) {
        return new Response(
          JSON.stringify({ valid: false, error: "TOTP not set up" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const totp = new TOTP({
        issuer: "TechMap",
        label: profile.email || "admin",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: profile.totp_secret,
      });

      const delta = totp.validate({ token: totp_code, window: 1 });
      const valid = delta !== null;

      return new Response(
        JSON.stringify({ valid }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'generate' or 'verify'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
