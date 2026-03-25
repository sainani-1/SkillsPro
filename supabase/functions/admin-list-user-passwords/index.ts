import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const isMissingTrackingTableError = (error: { code?: string; message?: string } | null) => {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01" || message.includes("admin_managed_user_passwords");
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
    if (!supabaseUrl || !serviceRoleKey) {
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
    const { data: callerData, error: callerError } = await adminClient.auth.getUser(callerJwt);
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
      return new Response("Only admin users can view tracked passwords.", {
        status: 403,
        headers: corsHeaders,
      });
    }

    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id, auth_user_id, full_name, email, role, deleted_at, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (profilesError) {
      console.error("Failed to load profiles:", profilesError.message);
      return new Response(
        JSON.stringify({
          users: [],
          warning: profilesError.message,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const { data: trackedPasswords, error: trackedPasswordsError } = await adminClient
      .from("admin_managed_user_passwords")
      .select("user_id, auth_user_id, email, password_plain, password_source, updated_at");
    if (trackedPasswordsError && !isMissingTrackingTableError(trackedPasswordsError)) {
      console.error("Failed to load tracked passwords:", trackedPasswordsError.message);
      return new Response(
        JSON.stringify({
          users: (profiles || []).map((profile) => ({
            id: profile.id,
            auth_user_id: profile.auth_user_id,
            full_name: profile.full_name,
            email: profile.email,
            role: profile.role,
            tracked_password: null,
            password_source: null,
            password_updated_at: null,
          })),
          warning: trackedPasswordsError.message,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const passwordMap = new Map((trackedPasswords || []).map((row) => [row.user_id, row]));
    const users = (profiles || []).map((profile) => {
      const tracked = passwordMap.get(profile.id) || passwordMap.get(profile.auth_user_id) || null;
      return {
        id: profile.id,
        auth_user_id: profile.auth_user_id,
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
        tracked_password: tracked?.password_plain || null,
        password_source: tracked?.password_source || null,
        password_updated_at: tracked?.updated_at || null,
      };
    });

    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return new Response(message, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
