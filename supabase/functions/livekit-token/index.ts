import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TokenPayload = {
  sessionId?: number | string;
  mode?: "student" | "observer";
  requesterId?: string;
};

const roomNameForSession = (sessionId: number | string) => `skillpro-live-exam-session-${sessionId}`;

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
    const livekitUrl = Deno.env.get("LIVEKIT_URL");
    const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY");
    const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !anonKey || !livekitUrl || !livekitApiKey || !livekitApiSecret) {
      return new Response("Missing required environment variables.", { status: 500, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json()) as TokenPayload;
    const sessionId = Number(body.sessionId || 0);
    const mode = body.mode === "observer" ? "observer" : "student";
    const requesterId = String(body.requesterId || "").trim();
    if (!sessionId) {
      return new Response("sessionId is required.", { status: 400, headers: corsHeaders });
    }
    if (!requesterId) {
      return new Response("requesterId is required.", { status: 400, headers: corsHeaders });
    }

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", requesterId)
      .maybeSingle();

    if (!callerProfile?.role) {
      return new Response("Profile not found.", { status: 403, headers: corsHeaders });
    }

    const { data: sessionRow, error: sessionError } = await adminClient
      .from("exam_live_sessions")
      .select("id, slot_id, student_id, exam_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !sessionRow) {
      return new Response("Live exam session not found.", { status: 404, headers: corsHeaders });
    }

    let allowed = false;
    if (mode === "student") {
      allowed = requesterId === sessionRow.student_id;
    } else if (callerProfile.role === "admin") {
      allowed = true;
    } else if (callerProfile.role === "teacher") {
      const { data: slotRow } = await adminClient
        .from("exam_live_slots")
        .select("teacher_id")
        .eq("id", sessionRow.slot_id)
        .maybeSingle();

      if (slotRow?.teacher_id === requesterId) {
        allowed = true;
      } else {
        const { data: bookedStudent } = await adminClient
          .from("profiles")
          .select("assigned_teacher_id")
          .eq("id", sessionRow.student_id)
          .maybeSingle();
        allowed = bookedStudent?.assigned_teacher_id === requesterId;
      }
    } else if (callerProfile.role === "instructor") {
      const { data: instructorRow } = await adminClient
        .from("exam_slot_instructors")
        .select("id")
        .eq("slot_id", sessionRow.slot_id)
        .eq("instructor_id", requesterId)
        .maybeSingle();
      allowed = Boolean(instructorRow?.id);
    }

    if (!allowed) {
      return Response.json(
        {
          error: "Not allowed for this live exam session.",
          sessionId,
          mode,
          callerRole: callerProfile.role,
          slotId: sessionRow.slot_id,
        },
        { status: 403, headers: corsHeaders },
      );
    }

    const roomName = roomNameForSession(sessionId);
    const identity =
      mode === "student"
        ? `student:${sessionRow.student_id}:session:${sessionId}`
        : `${callerProfile.role}:${requesterId}:watch:${sessionId}`;

    const token = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity,
      ttl: "2h",
      name: identity,
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: mode === "student",
      canSubscribe: true,
      canPublishData: mode === "student",
    });

    return Response.json(
      {
        token: await token.toJwt(),
        url: livekitUrl,
        roomName,
        identity,
        mode,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});
