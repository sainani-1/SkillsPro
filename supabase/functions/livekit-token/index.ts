import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TokenPayload = {
  sessionId?: number | string;
  kind?: "exam" | "class";
  mode?: "student" | "observer";
  requesterId?: string;
  viewerInstanceId?: string;
  breakoutRoomId?: string;
};

const roomNameForSession = (sessionId: number | string) => `skillpro-live-exam-session-${sessionId}`;
const roomNameForClassSession = (sessionId: number | string) => `skillpro-live-class-session-${sessionId}`;
const roomNameForBreakout = (sessionId: number | string, breakoutRoomId: string) =>
  `skillpro-live-class-session-${sessionId}-breakout-${breakoutRoomId}`;

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
    const kind = body.kind === "class" ? "class" : "exam";
    const mode = body.mode === "observer" ? "observer" : "student";
    const requesterId = String(body.requesterId || "").trim();
    const viewerInstanceId = String(body.viewerInstanceId || "").trim();
    const breakoutRoomId = String(body.breakoutRoomId || "").trim();
    if (!sessionId) {
      return new Response("sessionId is required.", { status: 400, headers: corsHeaders });
    }
    if (!requesterId) {
      return new Response("requesterId is required.", { status: 400, headers: corsHeaders });
    }

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("id, role, full_name, email")
      .eq("id", requesterId)
      .maybeSingle();

    if (!callerProfile?.role) {
      return new Response("Profile not found.", { status: 403, headers: corsHeaders });
    }

    let roomName = "";
    let identity = "";
    let canPublish = false;

    if (kind === "class") {
      const { data: sessionRow, error: sessionError } = await adminClient
        .from("class_sessions")
        .select("id, teacher_id, status, livekit_controls")
        .eq("id", sessionId)
        .maybeSingle();

      if (sessionError || !sessionRow) {
        return new Response("Class session not found.", { status: 404, headers: corsHeaders });
      }

      const controls =
        sessionRow.livekit_controls && typeof sessionRow.livekit_controls === "object"
          ? sessionRow.livekit_controls as Record<string, unknown>
          : {};
      const bannedUserIds = Array.isArray(controls.banned_user_ids)
        ? controls.banned_user_ids.map((value) => String(value))
        : [];
      const roomLocked = Boolean(controls.room_locked);
      const breakout = controls.breakout && typeof controls.breakout === "object"
        ? controls.breakout as Record<string, unknown>
        : {};
      const breakoutActive = Boolean(breakout.active);
      const breakoutRooms = Array.isArray(breakout.rooms) ? breakout.rooms as Array<Record<string, unknown>> : [];
      const assignedBreakout = breakoutRooms.find((room) =>
        Array.isArray(room.participant_user_ids) &&
        room.participant_user_ids.map((value) => String(value)).includes(requesterId),
      );

      const isTeacherOwner = sessionRow.teacher_id === requesterId;
      const { data: participantRow } = await adminClient
        .from("class_session_participants")
        .select("session_id")
        .eq("session_id", sessionId)
        .eq("student_id", requesterId)
        .maybeSingle();

      const isParticipant = Boolean(participantRow?.session_id);
      const allowed =
        callerProfile.role === "admin" ||
        isTeacherOwner ||
        (callerProfile.role === "student" && isParticipant);

      if (!allowed) {
        return Response.json(
          {
            error: "Not allowed for this class session.",
            sessionId,
            callerRole: callerProfile.role,
          },
          { status: 403, headers: corsHeaders },
        );
      }

      if (callerProfile.role === "student" && bannedUserIds.includes(requesterId)) {
        return Response.json(
          { error: "You are restricted from rejoining this class." },
          { status: 403, headers: corsHeaders },
        );
      }

      if (callerProfile.role === "student" && roomLocked) {
        return Response.json(
          { error: "This class is locked. New student joins are disabled right now." },
          { status: 403, headers: corsHeaders },
        );
      }

      if (breakoutActive) {
        if (callerProfile.role === "student") {
          if (!assignedBreakout?.id) {
            return Response.json(
              { error: "Breakout rooms are active. You have not been assigned to a breakout room yet." },
              { status: 403, headers: corsHeaders },
            );
          }
          roomName = roomNameForBreakout(sessionId, String(assignedBreakout.id));
        } else {
          const requestedBreakoutId = breakoutRoomId || String(breakout.teacher_room_id || "");
          roomName = requestedBreakoutId ? roomNameForBreakout(sessionId, requestedBreakoutId) : roomNameForClassSession(sessionId);
        }
      } else {
        roomName = roomNameForClassSession(sessionId);
      }
      identity = `${callerProfile.role}:${requesterId}:class:${sessionId}`;
      canPublish = callerProfile.role === "admin" || isTeacherOwner || callerProfile.role === "student";
    } else {
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

      roomName = roomNameForSession(sessionId);
      identity =
        mode === "student"
          ? `student:${sessionRow.student_id}:session:${sessionId}`
          : `${callerProfile.role}:${requesterId}:watch:${sessionId}${viewerInstanceId ? `:${viewerInstanceId}` : ""}`;
      canPublish = mode === "student" || ["admin", "teacher", "instructor"].includes(String(callerProfile.role));
    }

    const participantDisplayName =
      String(callerProfile.full_name || "").trim() ||
      String(callerProfile.email || "").trim() ||
      `${callerProfile.role} user`;

    const token = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity,
      ttl: "2h",
      name: participantDisplayName,
    });

    const publishSources = canPublish
      ? mode === "student"
        ? ["camera", "microphone", "screen_share", "screen_share_audio"]
        : ["microphone"]
      : undefined;

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish,
      canSubscribe: true,
      canPublishData: canPublish,
      canPublishSources: publishSources,
    });

    return Response.json(
      {
        token: await token.toJwt(),
        url: livekitUrl,
        roomName,
        identity,
        kind,
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
