import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assignBalancedTeacherToStudent } from "../_shared/teacherAssignment.ts";

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

const addDaysFrom = (baseDateIso: string | null | undefined, days: number) => {
  const baseDate = baseDateIso && new Date(baseDateIso) > new Date() ? new Date(baseDateIso) : new Date();
  baseDate.setDate(baseDate.getDate() + days);
  return baseDate.toISOString();
};

Deno.serve(async (req: Request) => {
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
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user?.id) {
    return errorResponse("Invalid user session.", 401);
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role, email, premium_until")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return errorResponse("User profile not found.", 404);
  }

  if (profile.role === "admin" || profile.role === "teacher") {
    return errorResponse("Premium pass is only available for student accounts.", 403);
  }

  if (profile.premium_until && new Date(profile.premium_until) > new Date()) {
    return errorResponse("Premium pass is only available when premium is inactive.", 400);
  }

  const { data: existingClaim } = await adminClient
    .from("premium_pass_claims")
    .select("id, premium_until_after")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingClaim?.id) {
    return errorResponse("Premium pass has already been claimed for this account.", 409);
  }

  const now = new Date().toISOString();
  const premiumUntil = addDaysFrom(profile.premium_until, 3);

  const { error: profileUpdateError } = await adminClient
    .from("profiles")
    .update({ premium_until: premiumUntil })
    .eq("id", user.id);

  if (profileUpdateError) {
    return errorResponse("Failed to activate premium pass.", 500);
  }

  await assignBalancedTeacherToStudent(adminClient, user.id);

  const { error: claimError } = await adminClient
    .from("premium_pass_claims")
    .insert({
      user_id: user.id,
      email: profile.email || user.email || null,
      pass_days: 3,
      status: "claimed",
      claimed_at: now,
      premium_until_after: premiumUntil,
      updated_at: now,
    });

  if (claimError) {
    return errorResponse("Premium pass was activated but could not be recorded.", 500);
  }

  await adminClient.from("premium_event_logs").insert({
    user_id: user.id,
    event_name: "premium_pass_claimed",
    source: "claim_premium_pass_function",
    metadata: {
      pass_days: 3,
      premium_until_after: premiumUntil,
    },
  });

  return jsonResponse({
    status: "success",
    premium_until: premiumUntil,
    pass_days: 3,
  });
});
