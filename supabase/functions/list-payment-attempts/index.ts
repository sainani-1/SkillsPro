import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const errorResponse = (message: string, status = 400) =>
  jsonResponse({ error: message }, status);

const createAuthorizedClient = (supabaseUrl: string, anonKey: string, jwt: string) =>
  createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return errorResponse("Method not allowed.", 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return errorResponse("Missing Supabase environment variables.", 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Missing Authorization bearer token.", 401);
    }

    const jwt = authHeader.replace("Bearer ", "").trim();
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const authClient = createAuthorizedClient(supabaseUrl, anonKey, jwt);

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user?.id) {
      return errorResponse("Invalid user session.", 401);
    }

    const { data: adminProfile } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (adminProfile?.role !== "admin") {
      return errorResponse("Admin access required.", 403);
    }

    const { data: payments, error: paymentsError } = await adminClient
      .from("payments")
      .select("id, user_id, plan_code, gateway, status, amount, final_amount, currency, failure_reason, gateway_ref, paid_at, valid_until, created_at, updated_at, metadata")
      .order("created_at", { ascending: false })
      .limit(300);

    if (paymentsError) {
      return errorResponse(paymentsError.message || "Unable to load payment attempts.", 500);
    }

    const userIds = Array.from(new Set((payments || []).map((row) => row.user_id).filter(Boolean)));
    let profilesById: Record<string, unknown> = {};

    if (userIds.length > 0) {
      const { data: profileRows, error: profileError } = await adminClient
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", userIds);

      if (profileError) {
        return errorResponse(profileError.message || "Unable to load payment profiles.", 500);
      }

      profilesById = Object.fromEntries((profileRows || []).map((row) => [row.id, row]));
    }

    return jsonResponse({
      payments: payments || [],
      profilesById,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unexpected payment list error.", 500);
  }
});
