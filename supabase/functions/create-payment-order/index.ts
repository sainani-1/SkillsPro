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

type OfferRow = {
  id: string;
  title: string | null;
  coupon_name: string | null;
  discount_type: string | null;
  discount_value: number | string | null;
  is_lifetime_free: boolean | null;
  applies_to_all: boolean | null;
  valid_until: string | null;
  status?: string | null;
};

type CreateOrderPayload = {
  offer_id?: string | null;
  plan_tier?: string | null;
};

const PREMIUM_PLAN_TYPES_KEY = "premium_plan_types";
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

const pickLatestPlanForTier = (plans: any[], tier: string) => {
  return (plans || [])
    .filter((plan) => plan?.isActive && normalizePlanTier(plan?.tier) === tier)
    .sort((a, b) => {
      const aTime = new Date(a?.createdAt || 0).getTime();
      const bTime = new Date(b?.createdAt || 0).getTime();
      return bTime - aTime;
    })[0] ?? null;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const errorResponse = (message: string, status = 400) =>
  jsonResponse({ error: message }, status);

const parseMoney = (value: number) => Math.round(value * 100) / 100;

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

const resolveDiscount = (baseAmount: number, offer: OfferRow | null) => {
  if (!offer) {
    return {
      couponCode: null,
      discountAmount: 0,
      finalAmount: parseMoney(baseAmount),
      isLifetimeFree: false,
    };
  }

  const couponCode = String(offer.title || offer.coupon_name || "").trim() || null;
  if (offer.is_lifetime_free || offer.discount_type === "lifetime_free") {
    return {
      couponCode,
      discountAmount: parseMoney(baseAmount),
      finalAmount: 0,
      isLifetimeFree: true,
    };
  }

  const rawValue = Number(offer.discount_value || 0);
  const discountAmount =
    offer.discount_type === "percent"
      ? parseMoney((baseAmount * Math.max(0, Math.min(rawValue, 100))) / 100)
      : parseMoney(Math.max(0, Math.min(rawValue, baseAmount)));

  return {
    couponCode,
    discountAmount,
    finalAmount: parseMoney(Math.max(0, baseAmount - discountAmount)),
    isLifetimeFree: false,
  };
};

const createAuthorizedClient = (supabaseUrl: string, anonKey: string, jwt: string) =>
  createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });

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
  const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
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

  let payload: CreateOrderPayload = {};
  try {
    payload = (await req.json()) as CreateOrderPayload;
  } catch {
    payload = {};
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, email, phone, premium_until")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return errorResponse("User profile not found.", 404);
  }

  const { data: premiumSetting } = await adminClient
    .from("settings")
    .select("value")
    .eq("key", "premium_cost")
    .maybeSingle();

  const { data: premiumPlusSetting } = await adminClient
    .from("settings")
    .select("value")
    .eq("key", "premium_plus_cost")
    .maybeSingle();

  const fallbackPremiumCost = parseMoney(Number.parseFloat(String(premiumSetting?.value ?? "199")) || 199);
  const fallbackPremiumPlusCost = parseMoney(Number.parseFloat(String(premiumPlusSetting?.value ?? "")) || Math.max(fallbackPremiumCost + 100, 299));
  const selectedPlanTier = normalizePlanTier(payload.plan_tier);
  let selectedPlanLabel = selectedPlanTier === "premium_plus" ? "Premium Plus" : "Premium";
  let selectedPlanCode = selectedPlanTier === "premium_plus" ? "premium_plus_6months" : "premium_6months";
  let selectedPlanMonths = PREMIUM_MONTHS;
  let baseAmount = selectedPlanTier === "premium_plus" ? fallbackPremiumPlusCost : fallbackPremiumCost;

  const { data: publicPlansSetting } = await adminClient
    .from("settings")
    .select("value")
    .eq("key", "public_plans")
    .maybeSingle();

  try {
    const publicPlans = publicPlansSetting?.value ? JSON.parse(publicPlansSetting.value) : [];
    if (Array.isArray(publicPlans)) {
      const selectedPlan = pickLatestPlanForTier(publicPlans, selectedPlanTier);
      if (selectedPlan) {
        baseAmount = selectedPlanTier === "premium_plus" ? fallbackPremiumPlusCost : fallbackPremiumCost;
        selectedPlanLabel = String(selectedPlan.name || selectedPlanLabel);
        selectedPlanCode = String(selectedPlan.id || selectedPlanCode);
        selectedPlanMonths = Number(selectedPlan.periodMonths || PREMIUM_MONTHS) || PREMIUM_MONTHS;
      }
    }
  } catch {
    // Keep fallback premium pricing if public plans cannot be parsed.
  }

  let selectedOffer: OfferRow | null = null;
  if (payload.offer_id) {
    const { data: offer, error: offerError } = await adminClient
      .from("offers")
      .select("id, title, coupon_name, discount_type, discount_value, is_lifetime_free, applies_to_all, valid_until, status")
      .eq("id", payload.offer_id)
      .maybeSingle();

    if (offerError || !offer) {
      return errorResponse("Selected coupon was not found.", 404);
    }

    const isExpired = Boolean(offer.valid_until && new Date(offer.valid_until) < new Date());
    if (offer.status === "expired" || isExpired) {
      return errorResponse("Selected coupon has expired.", 400);
    }

    if (!offer.applies_to_all) {
      const { data: assignment } = await adminClient
        .from("offer_assignments")
        .select("offer_id")
        .eq("offer_id", offer.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!assignment) {
        return errorResponse("This coupon is not assigned to your account.", 403);
      }
    }

    const { data: redemption } = await adminClient
      .from("offer_redemptions")
      .select("id, status")
      .eq("offer_id", offer.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (redemption?.status === "redeemed") {
      return errorResponse("This coupon has already been redeemed.", 409);
    }

    selectedOffer = offer;
  }

  const discount = resolveDiscount(baseAmount, selectedOffer);
  const paymentGateway = discount.finalAmount <= 0 ? "coupon" : "razorpay";
  const validUntil = discount.isLifetimeFree
    ? LIFETIME_PREMIUM_DATE
    : addMonthsFrom(profile.premium_until, selectedPlanMonths);

  const { data: payment, error: paymentError } = await adminClient
    .from("payments")
    .insert({
      user_id: user.id,
      plan_code: selectedPlanCode,
      gateway: paymentGateway,
      status: discount.finalAmount <= 0 ? "success" : "created",
      base_amount: baseAmount,
      discount_amount: discount.discountAmount,
      final_amount: discount.finalAmount,
      amount: discount.finalAmount,
      currency: "INR",
      coupon_offer_id: selectedOffer?.id ?? null,
      coupon_code: discount.couponCode,
      valid_until: validUntil,
      paid_at: discount.finalAmount <= 0 ? new Date().toISOString() : null,
      metadata: {
        plan_label: `${selectedPlanLabel} Access - ${selectedPlanMonths} Months`,
        plan_tier: selectedPlanTier,
        plan_months: selectedPlanMonths,
        coupon_name: selectedOffer?.coupon_name ?? null,
        coupon_type: selectedOffer?.discount_type ?? null,
        is_lifetime_free: discount.isLifetimeFree,
      },
    })
    .select("id, status")
    .single();

  if (paymentError || !payment) {
    return errorResponse(paymentError?.message || "Failed to create payment.", 500);
  }

  if (discount.finalAmount <= 0) {
    const now = new Date().toISOString();
    const { error: profileUpdateError } = await adminClient
      .from("profiles")
      .update({ premium_until: validUntil })
      .eq("id", user.id);

    if (profileUpdateError) {
      await adminClient
        .from("payments")
        .update({ status: "failed", failure_reason: profileUpdateError.message, updated_at: now })
        .eq("id", payment.id);
      return errorResponse("Payment was recorded but premium activation failed.", 500);
    }

    await savePlanTypeForUser(adminClient, user.id, selectedPlanTier);

    await assignBalancedTeacherToStudent(adminClient, user.id);

    if (selectedOffer?.id) {
      await adminClient.from("offer_redemptions").upsert(
        {
          offer_id: selectedOffer.id,
          user_id: user.id,
          payment_id: payment.id,
          status: "redeemed",
          discount_amount: discount.discountAmount,
          final_amount: discount.finalAmount,
          redeemed_at: now,
          updated_at: now,
        },
        { onConflict: "offer_id,user_id" },
      );
    }

    await rewardReferralIfEligible(adminClient, user.id, payment.id, now);

    return jsonResponse({
      mode: "coupon",
      status: "success",
      payment_id: payment.id,
      base_amount: baseAmount,
      discount_amount: discount.discountAmount,
      final_amount: discount.finalAmount,
      valid_until: validUntil,
      is_lifetime_free: discount.isLifetimeFree,
    });
  }

  if (!razorpayKeyId || !razorpayKeySecret) {
    await adminClient
      .from("payments")
      .update({
        status: "failed",
        failure_reason: "Razorpay environment variables are missing.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);
    return errorResponse("Payment gateway is not configured.", 500);
  }

  const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
  const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(discount.finalAmount * 100),
      currency: "INR",
      receipt: `payment_${payment.id}`,
      notes: {
        payment_id: payment.id,
        user_id: user.id,
        coupon_code: discount.couponCode || "",
        plan_tier: selectedPlanTier,
      },
    }),
  });

  const razorpayOrder = await razorpayResponse.json();
  if (!razorpayResponse.ok || !razorpayOrder?.id) {
    await adminClient
      .from("payments")
      .update({
        status: "failed",
        failure_reason: razorpayOrder?.error?.description || "Failed to create Razorpay order.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    return errorResponse(
      razorpayOrder?.error?.description || "Failed to create Razorpay order.",
      razorpayResponse.status || 500,
    );
  }

  await adminClient
    .from("payments")
    .update({
      gateway_order_id: razorpayOrder.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  return jsonResponse({
    mode: "razorpay",
    key_id: razorpayKeyId,
    payment_id: payment.id,
    order_id: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency || "INR",
    base_amount: baseAmount,
    discount_amount: discount.discountAmount,
    final_amount: discount.finalAmount,
    coupon_code: discount.couponCode,
    valid_until: validUntil,
    plan_tier: selectedPlanTier,
  });
});
