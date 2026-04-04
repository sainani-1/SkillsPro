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

    const payload = await req.json().catch(() => ({}));
    const paymentId = String(payload.payment_id || "").trim();
    const paymentApp = String(payload.payment_app || "").trim();

    if (!paymentId || !paymentApp) {
      return errorResponse("Payment ID and payment app are required.", 400);
    }

    const { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .select("id, user_id, metadata")
      .eq("id", paymentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (paymentError || !payment) {
      return errorResponse("Payment request not found.", 404);
    }

    const metadata = payment.metadata && typeof payment.metadata === "object" ? payment.metadata : {};
    const nextMetadata = {
      ...metadata,
      payment_app: paymentApp,
      payment_request_state: "app_selected",
    };

    const { error: updateError } = await adminClient
      .from("payments")
      .update({
        metadata: nextMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId)
      .eq("user_id", user.id);

    if (updateError) {
      return errorResponse(updateError.message || "Failed to update payment request.", 500);
    }

    return jsonResponse({
      payment_id: paymentId,
      payment_app: paymentApp,
      status: "updated",
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unexpected request update error.", 500);
  }
});
