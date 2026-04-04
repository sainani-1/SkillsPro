import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PREMIUM_MONTHS,
  activatePaidPremium,
  normalizePlanTier,
  notifyAdminOfPaymentEvent,
} from "../_shared/paymentHelpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type ReviewPayload = {
  payment_id?: string;
  action?: "approve" | "reject";
  note?: string;
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

  let payload: ReviewPayload;
  try {
    payload = (await req.json()) as ReviewPayload;
  } catch {
    return errorResponse("Invalid request body.", 400);
  }

  if (!payload.payment_id || !payload.action) {
    return errorResponse("payment_id and action are required.", 400);
  }

  const { data: payment, error: paymentError } = await adminClient
    .from("payments")
    .select("id, user_id, gateway, status, metadata, amount, valid_until")
    .eq("id", payload.payment_id)
    .maybeSingle();

  if (paymentError || !payment) {
    return errorResponse("Payment record not found.", 404);
  }

  if (String(payment.metadata?.payment_method || "") !== "skillpro_upi") {
    return errorResponse("Only SkillPro UPI payments can be reviewed here.", 400);
  }

  const now = new Date().toISOString();

  if (payload.action === "reject") {
    await adminClient
      .from("payments")
      .update({
        status: "failed",
        failure_reason: String(payload.note || "Payment request rejected by admin."),
        updated_at: now,
      })
      .eq("id", payment.id);

    return jsonResponse({ status: "failed", payment_id: payment.id });
  }

  if (payment.status === "success") {
    return jsonResponse({ status: "success", payment_id: payment.id, valid_until: payment.valid_until });
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("premium_until, full_name, email, phone")
    .eq("id", payment.user_id)
    .maybeSingle();

  if (profileError || !profile) {
    return errorResponse("User profile not found.", 404);
  }

  const planTier = normalizePlanTier(String(payment.metadata?.plan_tier || ""));
  const planMonths = Number(payment.metadata?.plan_months || PREMIUM_MONTHS) || PREMIUM_MONTHS;

  let activated;
  try {
    activated = await activatePaidPremium(adminClient, {
      userId: payment.user_id,
      paymentId: payment.id,
      profilePremiumUntil: profile.premium_until,
      planTier,
      planMonths,
      isLifetimeFree: false,
    });
  } catch (error) {
    await adminClient
      .from("payments")
      .update({
        status: "failed",
        failure_reason: error instanceof Error ? error.message : "Premium activation failed.",
        updated_at: now,
      })
      .eq("id", payment.id);
    return errorResponse("Premium activation failed.", 500);
  }

  await adminClient
    .from("payments")
    .update({
      status: "success",
      paid_at: activated.now,
      valid_until: activated.validUntil,
      failure_reason: null,
      gateway_signature: String(payload.note || ""),
      updated_at: activated.now,
    })
    .eq("id", payment.id);

  await notifyAdminOfPaymentEvent(adminClient, {
    userId: payment.user_id,
    paymentId: payment.id,
    eventType: "payment_success",
    planName: String(payment.metadata?.plan_label || (planTier === "premium_plus" ? "Premium Plus" : "Premium")),
    amount: Number(payment.amount || 0),
    paymentMethod: "skillpro_upi",
    userEmail: profile.email || null,
    userName: profile.full_name || null,
    userPhone: profile.phone || null,
    userUpiId: String(payment.metadata?.user_upi_id || ""),
    note: String(payment.metadata?.payment_note || payload.note || ""),
    status: "success",
  });

  return jsonResponse({
    status: "success",
    payment_id: payment.id,
    valid_until: activated.validUntil,
    plan_tier: planTier,
  });
});
