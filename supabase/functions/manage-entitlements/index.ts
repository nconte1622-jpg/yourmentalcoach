import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Admin emails allowed to use test overrides
const ADMIN_EMAILS = [
  "nconte22@icloud.com",
  "conte4@gmail.com",
  // Add more admin emails here
];


console.log("ADMIN_EMAILS:", ADMIN_EMAILS);

const log = (step: string, details?: any) => {
  console.log(`[ENTITLEMENTS] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    log("Authenticated", { userId: user.id, email: user.email });
    console.log("Normalized user email:", (user.email || "").trim().toLowerCase());

    const body = await req.json().catch(() => ({}));
    const action = body.action || "get";

    // Ensure entitlements row exists
    const { data: existing } = await supabaseAdmin
      .from("user_entitlements")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from("user_entitlements").insert({ user_id: user.id });
      log("Created entitlements row");
    }

    if (action === "get") {
      const { data, error } = await supabaseAdmin.from("user_entitlements").select("*").eq("user_id", user.id).single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test_override") {
      // Only admins can use test overrides
      const normalizedEmail = (user.email || "").trim().toLowerCase();
      if (!normalizedEmail || !ADMIN_EMAILS.map(e => e.trim().toLowerCase()).includes(normalizedEmail)) {
        return new Response(JSON.stringify({ error: "Not authorized for test overrides" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }

      const newPlan = body.plan; // "pro" or "free"
      if (!newPlan || !["pro", "free"].includes(newPlan)) {
        throw new Error("Invalid plan value");
      }

      const { data, error } = await supabaseAdmin
        .from("user_entitlements")
        .update({
          plan: newPlan,
          entitlement_source: "test_override",
          apple_entitlement_active: newPlan === "pro",
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      log("Test override applied", { plan: newPlan });

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "apple_purchase") {
      // Called after RevenueCat/StoreKit purchase or restore
      const { isPro, productId, transactionId } = body;

      const { data, error } = await supabaseAdmin
        .from("user_entitlements")
        .update({
          plan: isPro ? "pro" : "free",
          entitlement_source: "apple",
          apple_entitlement_active: !!isPro,
          apple_product_id: productId || null,
          apple_original_transaction_id: transactionId || null,
          expires_at: body.expiresAt || null,
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      log("Apple purchase recorded", { isPro, productId });

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is an admin
    if (action === "check_admin") {
      const normalizedEmail = (user.email || "").trim().toLowerCase();
      const isAdmin = normalizedEmail !== "" && ADMIN_EMAILS.map(e => e.trim().toLowerCase()).includes(normalizedEmail);
      log("Admin check", { email: normalizedEmail, isAdmin });
      return new Response(JSON.stringify({ isAdmin }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
