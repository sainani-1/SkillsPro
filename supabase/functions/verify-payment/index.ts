import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assignBalancedTeacherToStudent } from "../_shared/teacherAssignment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const PREMIUM_MONTHS = 6;
const LIFETIME_PREMIUM_DATE = "9999-12-31T23:59:59.000Z";
const PREMIUM_PLAN_TYPES_KEY = "premium_plan_types";

type VerifyPaymentPayload = {
  payment_id?: string;
  status?: "success" | "failed";
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  failure_reason?: string;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const errorResponse = (message: string, status = 400) =>
  jsonResponse({ error: message }, status);

const addMonthsFrom = (baseDateIso: string | null | undefined, months: number) => {
  const baseDate = baseDateIso && new Date(baseDateIso) > new Date() ? new Date(baseDateIso) : new Date();
  baseDate.setMonth(baseDate.getMonth() + months);
  return baseDate.toISOString();
};

const addDaysFrom = (baseDateIso: string | null | undefined, days: number) => {
  const baseDate = baseDateIso && new Date(baseDateIso) > new Date() ? new Date(baseDateIso) : new Date();
  baseDate.setDate(baseDate.getDate() + days);
  return baseDate.toISOString();
};

const normalizePlanTier = (value: string | null | undefined) => (value === "premium_plus" ? "premium_plus" : "premium");

const parsePlanTypeMap = (rawValue: string | null | undefined) => {
  if (!rawValue) return {} as Record<string, string>;
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {} as Record<string, string>;
    return Object.entries(parsed).reduce((acc, [userId, planType]) => {
      const normalizedUserId = String(userId || "").trim();
      if (!normalizedUserId) return acc;
      acc[normalizedUserId] = normalizePlanTier(String(planType || ""));
      return acc;
    }, {} as Record<string, string>);
  } catch {
    return {} as Record<string, string>;
  }
};

const savePlanTypeForUser = async (
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  planTier: string,
) => {
  const { data: existingSetting } = await adminClient
    .from("settings")
    .select("value")
    .eq("key", PREMIUM_PLAN_TYPES_KEY)
    .maybeSingle();

  const planTypeMap = parsePlanTypeMap(existingSetting?.value);
  planTypeMap[userId] = normalizePlanTier(planTier);

  const { error } = await adminClient
    .from("settings")
    .upsert(
      {
        key: PREMIUM_PLAN_TYPES_KEY,
        value: JSON.stringify(planTypeMap),
      },
      { onConflict: "key" },
    );

  if (error) throw error;
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const createAuthorizedClient = (supabaseUrl: string, anonKey: string, jwt: string) =>
  createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });

const verifyRazorpaySignature = async (orderId: string, paymentId: string, signature: string, secret: string) => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(`${orderId}|${paymentId}`));
  return toHex(signed) === signature.toLowerCase();
};

const rewardReferralIfEligible = async (adminClient: ReturnType<typeof createClient>, referredUserId: string, paymentId: string, now: string) => {
  const { data: referral } = await adminClient
    .from("referrals")
    .select("id, referrer_user_id, reward_days, status")
    .eq("referred_user_id", referredUserId)
    .in("status", ["joined", "qualified"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!referral?.referrer_user_id) return;

  const { data: referrerProfile } = await adminClient
    .from("profiles")
    .select("premium_until")
    .eq("id", referral.referrer_user_id)
    .maybeSingle();

  const rewardDays = Number(referral.reward_days || 7);
  const rewardedPremiumUntil = addDaysFrom(referrerProfile?.premium_until, rewardDays);

  await adminClient
    .from("profiles")
    .update({ premium_until: rewardedPremiumUntil })
    .eq("id", referral.referrer_user_id);

  await adminClient
    .from("referrals")
    .update({
      status: "rewarded",
      qualified_payment_id: paymentId,
      rewarded_at: now,
      updated_at: now,
    })
    .eq("id", referral.id);
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
  const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

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

  let payload: VerifyPaymentPayload;
  try {
    payload = (await req.json()) as VerifyPaymentPayload;
  } catch {
    return errorResponse("Invalid request body.", 400);
  }

  if (!payload.payment_id || !payload.status) {
    return errorResponse("payment_id and status are required.", 400);
  }

  const { data: payment, error: paymentError } = await adminClient
    .from("payments")
    .select("id, user_id, gateway, gateway_order_id, coupon_offer_id, status, metadata, valid_until")
    .eq("id", payload.payment_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (paymentError || !payment) {
    return errorResponse("Payment record not found.", 404);
  }

  if (payment.status === "success") {
    return jsonResponse({ status: "success", payment_id: payment.id, valid_until: payment.valid_until });
  }

  const now = new Date().toISOString();

  if (payload.status === "failed") {
    await adminClient
      .from("payments")
      .update({
        status: "failed",
        gateway_payment_id: payload.razorpay_payment_id ?? null,
        gateway_ref: payload.razorpay_payment_id ?? null,
        failure_reason: payload.failure_reason || "Payment failed or was cancelled.",
        updated_at: now,
      })
      .eq("id", payment.id);

    return jsonResponse({ status: "failed", payment_id: payment.id });
  }

  if (payment.gateway === "razorpay") {
    if (!payload.razorpay_order_id || !payload.razorpay_payment_id || !payload.razorpay_signature) {
      return errorResponse("Missing Razorpay verification fields.", 400);
    }
    if (!payment.gateway_order_id || payment.gateway_order_id !== payload.razorpay_order_id) {
      await adminClient
        .from("payments")
        .update({
          status: "failed",
          failure_reason: "Razorpay order mismatch.",
          updated_at: now,
        })
        .eq("id", payment.id);
      return errorResponse("Order verification failed.", 400);
    }
    if (!razorpayKeySecret) {
      return errorResponse("Razorpay secret is not configured.", 500);
    }

    const verified = await verifyRazorpaySignature(
      payload.razorpay_order_id,
      payload.razorpay_payment_id,
      payload.razorpay_signature,
      razorpayKeySecret,
    );

    if (!verified) {
      await adminClient
        .from("payments")
        .update({
          status: "failed",
          gateway_payment_id: payload.razorpay_payment_id,
          gateway_signature: payload.razorpay_signature,
          failure_reason: "Invalid Razorpay signature.",
          updated_at: now,
        })
        .eq("id", payment.id);
      return errorResponse("Payment signature verification failed.", 400);
    }
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("premium_until")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return errorResponse("User profile not found.", 404);
  }

  const isLifetimeFree = Boolean(payment.metadata?.is_lifetime_free);
  const planTier = normalizePlanTier(String(payment.metadata?.plan_tier || ""));
  const planMonths = Number(payment.metadata?.plan_months || PREMIUM_MONTHS) || PREMIUM_MONTHS;
  const validUntil = isLifetimeFree
    ? LIFETIME_PREMIUM_DATE
    : addMonthsFrom(profile.premium_until, planMonths);

  const { error: activationError } = await adminClient
    .from("profiles")
    .update({ premium_until: validUntil })
    .eq("id", user.id);

  if (activationError) {
    await adminClient
      .from("payments")
      .update({
        status: "failed",
        failure_reason: activationError.message,
        updated_at: now,
      })
      .eq("id", payment.id);
    return errorResponse("Premium activation failed.", 500);
  }

  await savePlanTypeForUser(adminClient, user.id, planTier);

  await assignBalancedTeacherToStudent(adminClient, user.id);

  await adminClient
    .from("payments")
    .update({
      status: "success",
      gateway_payment_id: payload.razorpay_payment_id ?? null,
      gateway_signature: payload.razorpay_signature ?? null,
      gateway_ref: payload.razorpay_payment_id ?? null,
      valid_until: validUntil,
      paid_at: now,
      failure_reason: null,
      updated_at: now,
    })
    .eq("id", payment.id);

  if (payment.coupon_offer_id) {
    await adminClient.from("offer_redemptions").upsert(
      {
        offer_id: payment.coupon_offer_id,
        user_id: user.id,
        payment_id: payment.id,
        status: "redeemed",
        redeemed_at: now,
        updated_at: now,
      },
      { onConflict: "offer_id,user_id" },
    );
  }

  await rewardReferralIfEligible(adminClient, user.id, payment.id, now);

  return jsonResponse({
    status: "success",
    payment_id: payment.id,
    valid_until: validUntil,
    is_lifetime_free: isLifetimeFree,
    plan_tier: planTier,
  });
});
