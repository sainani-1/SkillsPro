import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ResetPayload = {
  user_id?: string;
  email?: string;
  new_password?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response("Missing required Supabase environment variables.", {
        status: 500,
        headers: corsHeaders,
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("Missing Authorization bearer token.", {
        status: 401,
        headers: corsHeaders,
      });
    }
    const callerJwt = authHeader.replace("Bearer ", "").trim();

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const callerAuthClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${callerJwt}` } },
    });

    const { data: callerData, error: callerError } = await callerAuthClient.auth.getUser();
    if (callerError || !callerData?.user?.id) {
      return new Response("Invalid admin session token.", {
        status: 401,
        headers: corsHeaders,
      });
    }

    const callerId = callerData.user.id;
    const { data: callerProfile, error: roleError } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", callerId)
      .maybeSingle();

    if (roleError || !callerProfile || callerProfile.role !== "admin") {
      return new Response("Only admin users can reset passwords.", {
        status: 403,
        headers: corsHeaders,
      });
    }

    const body = (await req.json()) as ResetPayload;
    const userId = (body.user_id || "").trim();
    const newPassword = body.new_password || "";

    if (!userId) {
      return new Response("user_id is required.", {
        status: 400,
        headers: corsHeaders,
      });
    }
    if (newPassword.length < 6) {
      return new Response("new_password must be at least 6 characters.", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError) {
      return new Response(updateError.message, {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Optional audit trail; ignore if table/permission is absent.
    await adminClient.from("admin_password_resets").insert({
      admin_id: callerId,
      target_user_id: userId,
      target_email: body.email || null,
      created_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password updated successfully.",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return new Response(message, {
      status: 500,
      headers: corsHeaders,
    });
  }
});

