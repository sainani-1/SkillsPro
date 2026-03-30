import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DeletePayload = {
  user_id?: string;
  profile_id?: string;
  reason?: string;
};

const isMissingTableError = (message: string) => {
  const m = message.toLowerCase();
  return m.includes("does not exist") || m.includes("relation") || m.includes("undefined table");
};

const ignoreMissingTable = async (fn: () => Promise<{ error: { message?: string } | null }>) => {
  const res = await fn();
  if (!res.error) return;
  const msg = String(res.error.message || "");
  if (isMissingTableError(msg)) return;
  throw new Error(msg || "Cleanup failed");
};

const isAuthUserMissingError = (message: string) => {
  const m = message.toLowerCase();
  return m.includes("user not found") || m.includes("not found");
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
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
      return new Response("Invalid admin session token.", { status: 401, headers: corsHeaders });
    }

    const callerId = callerData.user.id;
    const { data: callerProfile, error: roleError } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", callerId)
      .maybeSingle();

    const body = (await req.json()) as DeletePayload;
    const rawUserId = String(body.user_id || "").trim();
    const rawProfileId = String(body.profile_id || "").trim();
    const reason = String(body.reason || "Deleted by admin").trim();
    if (!rawUserId && !rawProfileId) {
      return new Response("user_id or profile_id is required.", { status: 400, headers: corsHeaders });
    }

    let userId = rawUserId;
    let profileId = rawProfileId;

    if (!profileId && rawUserId) {
      const { data: profileByAuth } = await adminClient
        .from("profiles")
        .select("id")
        .eq("auth_user_id", rawUserId)
        .maybeSingle();
      profileId = profileByAuth?.id || rawUserId;
    }

    if (!userId && rawProfileId) {
      const { data: profileById } = await adminClient
        .from("profiles")
        .select("auth_user_id")
        .eq("id", rawProfileId)
        .maybeSingle();
      userId = String(profileById?.auth_user_id || rawProfileId).trim();
    }

    const isAdmin = !roleError && !!callerProfile && callerProfile.role === "admin";
    const isSelfDelete = callerId === userId || callerId === profileId;
    if (!isAdmin && !isSelfDelete) {
      return new Response("Only admin or account owner can delete this user.", {
        status: 403,
        headers: corsHeaders,
      });
    }

    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("id, full_name, email, role, phone")
      .eq("id", profileId)
      .maybeSingle();

    if (targetProfile) {
      await adminClient.from("deleted_accounts").insert({
        user_id: profileId,
        full_name: targetProfile.full_name || null,
        email: targetProfile.email || null,
        role: targetProfile.role || null,
        phone: targetProfile.phone || null,
        reason,
        deleted_by: callerId,
        deleted_at: new Date().toISOString(),
      });
    }

    let authDeleted = false;
    let authSoftDeleted = false;
    let deleteMessage = "User deleted successfully.";

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId, false);
    if (!deleteError) {
      authDeleted = true;
    } else if (!isAuthUserMissingError(String(deleteError.message || ""))) {
      const { error: softDeleteError } = await adminClient.auth.admin.deleteUser(userId, true);
      if (!softDeleteError) {
        authSoftDeleted = true;
        deleteMessage = "Auth user could not be hard-deleted, so it was soft-deleted before profile cleanup.";
      } else {
        const fallbackEmail =
          `${userId.slice(0, 8)}.deleted.${Date.now()}@deleted.local`;
        const randomPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const { error: fallbackError } = await adminClient.auth.admin.updateUserById(userId, {
          email: fallbackEmail,
          password: randomPassword,
          user_metadata: { account_deleted: true, account_deleted_at: new Date().toISOString() },
        });

        if (fallbackError) {
          return new Response(
            JSON.stringify({
              success: false,
              deleted: false,
              message: `Failed to delete user: ${deleteError.message}`,
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        deleteMessage =
          "Auth user could not be deleted, but credentials were rotated so the account can no longer be used.";
      }
    } else {
      authDeleted = true;
      deleteMessage = "Auth user was already missing, so only profile cleanup was needed.";
    }

    // Best-effort cleanup for known user-linked tables to reduce FK delete failures.
    const { data: ownedChatGroups } = await adminClient
      .from("chat_groups")
      .select("id")
      .eq("created_by", profileId);
    const ownedGroupIds = (ownedChatGroups || []).map((g) => g.id).filter(Boolean);

    await ignoreMissingTable(() => adminClient.from("chat_members").delete().eq("user_id", profileId));
    await ignoreMissingTable(() => adminClient.from("chat_messages").delete().eq("sender_id", profileId));
    if (ownedGroupIds.length > 0) {
      await ignoreMissingTable(() => adminClient.from("chat_members").delete().in("group_id", ownedGroupIds));
      await ignoreMissingTable(() => adminClient.from("chat_messages").delete().in("group_id", ownedGroupIds));
    }
    await ignoreMissingTable(() => adminClient.from("chat_groups").delete().eq("created_by", profileId));
    await ignoreMissingTable(() => adminClient.from("teacher_assignment_requests").delete().eq("student_id", profileId));
    await ignoreMissingTable(() => adminClient.from("teacher_assignment_requests").delete().eq("teacher_id", profileId));
    await ignoreMissingTable(() => adminClient.from("teacher_assignments").delete().eq("student_id", profileId));
    await ignoreMissingTable(() => adminClient.from("teacher_assignments").delete().eq("teacher_id", profileId));
    await ignoreMissingTable(() =>
      adminClient.from("profiles").update({ assigned_teacher_id: null }).eq("assigned_teacher_id", profileId)
    );
    await ignoreMissingTable(() =>
      adminClient
        .from("guidance_requests")
        .update({
          assigned_to_teacher_id: null,
          assigned_at: null,
          status: "pending",
        })
        .eq("assigned_to_teacher_id", profileId)
        .in("status", ["assigned", "scheduled"])
    );
    await ignoreMissingTable(() =>
      adminClient
        .from("guidance_requests")
        .update({
          assigned_to_teacher_id: null,
          assigned_at: null,
        })
        .eq("assigned_to_teacher_id", profileId)
    );
    await ignoreMissingTable(() => adminClient.from("class_session_participants").delete().eq("student_id", profileId));
    await ignoreMissingTable(() => adminClient.from("exam_submissions").delete().eq("user_id", profileId));
    await ignoreMissingTable(() => adminClient.from("certificates").delete().eq("user_id", profileId));
    await ignoreMissingTable(() => adminClient.from("notification_reads").delete().eq("user_id", profileId));
    await ignoreMissingTable(() => adminClient.from("active_user_sessions").delete().eq("user_id", profileId));
    await ignoreMissingTable(() => adminClient.from("profiles").delete().eq("id", profileId));

    return new Response(
      JSON.stringify({
        success: true,
        deleted: true,
        authDeleted,
        authSoftDeleted,
        message: deleteMessage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return new Response(message, { status: 500, headers: corsHeaders });
  }
});
