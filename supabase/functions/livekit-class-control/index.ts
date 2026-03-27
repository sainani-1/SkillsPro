import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RoomServiceClient } from "npm:livekit-server-sdk@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ControlAction =
  | "set_spotlight"
  | "clear_spotlight"
  | "kick_participant"
  | "ban_participant"
  | "mute_participant"
  | "unmute_participant"
  | "mute_all_students"
  | "disable_camera_participant"
  | "enable_camera_participant"
  | "disable_all_student_cameras"
  | "lock_room"
  | "unlock_room"
  | "start_breakouts_auto"
  | "assign_breakout_room"
  | "set_teacher_breakout_room"
  | "broadcast_breakout_message"
  | "close_breakouts";

type ControlPayload = {
  sessionId?: number | string;
  requesterId?: string;
  action?: ControlAction;
  targetIdentity?: string;
  targetUserId?: string;
  payload?: Record<string, unknown>;
};

const roomNameForClassSession = (sessionId: number | string) => `skillpro-live-class-session-${sessionId}`;

const readControls = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};

const mergeUniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)));
const removeString = (values: string[], target: string) => values.filter((value) => value !== target);

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
    const livekitUrl = Deno.env.get("LIVEKIT_URL");
    const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY");
    const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !livekitUrl || !livekitApiKey || !livekitApiSecret) {
      return new Response("Missing required environment variables.", { status: 500, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const roomService = new RoomServiceClient(livekitUrl, livekitApiKey, livekitApiSecret);
    const body = (await req.json()) as ControlPayload;

    const sessionId = Number(body.sessionId || 0);
    const requesterId = String(body.requesterId || "").trim();
    const action = body.action;
    const targetIdentity = String(body.targetIdentity || "").trim();
    const targetUserId = String(body.targetUserId || "").trim();
    const payload = body.payload && typeof body.payload === "object" ? body.payload as Record<string, unknown> : {};

    if (!sessionId || !requesterId || !action) {
      return Response.json({ error: "sessionId, requesterId and action are required." }, { status: 400, headers: corsHeaders });
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", requesterId)
      .maybeSingle();

    if (!profile || !["teacher", "admin"].includes(String(profile.role))) {
      return Response.json({ error: "Only teacher or admin can control the class." }, { status: 403, headers: corsHeaders });
    }

    const { data: sessionRow, error: sessionError } = await adminClient
      .from("class_sessions")
      .select("id, teacher_id, livekit_controls")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !sessionRow) {
      return Response.json({ error: "Class session not found." }, { status: 404, headers: corsHeaders });
    }

    if (profile.role === "teacher" && sessionRow.teacher_id !== requesterId) {
      return Response.json({ error: "Only the assigned teacher can control this class." }, { status: 403, headers: corsHeaders });
    }

    const roomName = roomNameForClassSession(sessionId);
    const controls = readControls(sessionRow.livekit_controls);
    let nextControls = { ...controls };

    const saveControls = async () => {
      const { error } = await adminClient
        .from("class_sessions")
        .update({ livekit_controls: nextControls })
        .eq("id", sessionId);

      if (error) throw error;
    };

    const listParticipants = async () => {
      try {
        return await roomService.listParticipants(roomName);
      } catch {
        return [];
      }
    };

    const resolveTrackSid = async (identity: string, source: "microphone" | "camera") => {
      const participants = await listParticipants();
      const participant = participants.find((entry) => entry.identity === identity);
      const track = participant?.tracks?.find((entry) =>
        source === "microphone"
          ? entry.source === 1 || String(entry.name || "").toLowerCase().includes("microphone")
          : entry.source === 2 || String(entry.name || "").toLowerCase().includes("camera"),
      );
      return track?.sid || "";
    };

    switch (action) {
      case "set_spotlight":
        nextControls.spotlight_identity = targetIdentity || null;
        await saveControls();
        break;
      case "clear_spotlight":
        nextControls.spotlight_identity = null;
        await saveControls();
        break;
      case "kick_participant":
        if (!targetIdentity) throw new Error("targetIdentity is required.");
        await roomService.removeParticipant(roomName, targetIdentity);
        break;
      case "ban_participant":
        if (!targetIdentity || !targetUserId) throw new Error("targetIdentity and targetUserId are required.");
        nextControls.banned_user_ids = mergeUniqueStrings([
          ...(Array.isArray(nextControls.banned_user_ids) ? nextControls.banned_user_ids.map((value) => String(value)) : []),
          targetUserId,
        ]);
        await saveControls();
        await roomService.removeParticipant(roomName, targetIdentity);
        break;
      case "mute_participant": {
        if (!targetIdentity || !targetUserId) throw new Error("targetIdentity and targetUserId are required.");
        nextControls.restricted_audio_user_ids = mergeUniqueStrings([
          ...(Array.isArray(nextControls.restricted_audio_user_ids)
            ? nextControls.restricted_audio_user_ids.map((value) => String(value))
            : []),
          targetUserId,
        ]);
        await saveControls();
        const micSid = await resolveTrackSid(targetIdentity, "microphone");
        if (micSid) await roomService.mutePublishedTrack(roomName, targetIdentity, micSid, true);
        break;
      }
      case "unmute_participant": {
        if (!targetUserId) throw new Error("targetUserId is required.");
        nextControls.restricted_audio_user_ids = removeString(
          Array.isArray(nextControls.restricted_audio_user_ids)
            ? nextControls.restricted_audio_user_ids.map((value) => String(value))
            : [],
          targetUserId,
        );
        await saveControls();
        break;
      }
      case "mute_all_students": {
        const participants = await listParticipants();
        nextControls.restricted_audio_user_ids = mergeUniqueStrings([
          ...(Array.isArray(nextControls.restricted_audio_user_ids)
            ? nextControls.restricted_audio_user_ids.map((value) => String(value))
            : []),
          ...participants
            .filter((entry) => String(entry.identity || "").startsWith("student:"))
            .map((entry) => String(entry.identity || "").split(":")[1] || ""),
        ]);
        await saveControls();
        for (const participant of participants.filter((entry) => String(entry.identity || "").startsWith("student:"))) {
          const track = participant.tracks?.find((entry) => entry.source === 1);
          if (track?.sid) {
            await roomService.mutePublishedTrack(roomName, participant.identity, track.sid, true);
          }
        }
        break;
      }
      case "disable_camera_participant": {
        if (!targetIdentity || !targetUserId) throw new Error("targetIdentity and targetUserId are required.");
        nextControls.restricted_video_user_ids = mergeUniqueStrings([
          ...(Array.isArray(nextControls.restricted_video_user_ids)
            ? nextControls.restricted_video_user_ids.map((value) => String(value))
            : []),
          targetUserId,
        ]);
        await saveControls();
        const cameraSid = await resolveTrackSid(targetIdentity, "camera");
        if (cameraSid) await roomService.mutePublishedTrack(roomName, targetIdentity, cameraSid, true);
        break;
      }
      case "enable_camera_participant": {
        if (!targetUserId) throw new Error("targetUserId is required.");
        nextControls.restricted_video_user_ids = removeString(
          Array.isArray(nextControls.restricted_video_user_ids)
            ? nextControls.restricted_video_user_ids.map((value) => String(value))
            : [],
          targetUserId,
        );
        await saveControls();
        break;
      }
      case "disable_all_student_cameras": {
        const participants = await listParticipants();
        nextControls.restricted_video_user_ids = mergeUniqueStrings([
          ...(Array.isArray(nextControls.restricted_video_user_ids)
            ? nextControls.restricted_video_user_ids.map((value) => String(value))
            : []),
          ...participants
            .filter((entry) => String(entry.identity || "").startsWith("student:"))
            .map((entry) => String(entry.identity || "").split(":")[1] || ""),
        ]);
        await saveControls();
        for (const participant of participants.filter((entry) => String(entry.identity || "").startsWith("student:"))) {
          const track = participant.tracks?.find((entry) => entry.source === 2);
          if (track?.sid) {
            await roomService.mutePublishedTrack(roomName, participant.identity, track.sid, true);
          }
        }
        break;
      }
      case "lock_room":
        nextControls.room_locked = true;
        await saveControls();
        break;
      case "unlock_room":
        nextControls.room_locked = false;
        await saveControls();
        break;
      case "start_breakouts_auto": {
        const roomCount = Math.max(2, Math.min(6, Number(payload.roomCount || 2)));
        const { data: participants } = await adminClient
          .from("class_session_participants")
          .select("student_id, profiles(full_name, email)")
          .eq("session_id", sessionId);

        const studentIds = (participants || []).map((entry: any) => String(entry.student_id));
        const rooms = Array.from({ length: roomCount }, (_, index) => ({
          id: `room-${index + 1}`,
          name: `Breakout ${index + 1}`,
          participant_user_ids: studentIds.filter((_, studentIndex) => studentIndex % roomCount === index),
        }));

        nextControls.breakout = {
          active: true,
          teacher_room_id: "",
          rooms,
          broadcast_message: "",
          broadcast_at: new Date().toISOString(),
        };
        await saveControls();
        break;
      }
      case "assign_breakout_room": {
        const roomId = String(payload.roomId || "").trim();
        if (!targetUserId || !roomId) throw new Error("targetUserId and payload.roomId are required.");
        const breakout = nextControls.breakout && typeof nextControls.breakout === "object"
          ? { ...(nextControls.breakout as Record<string, unknown>) }
          : { active: true, teacher_room_id: "", rooms: [] };
        const rooms = Array.isArray(breakout.rooms) ? breakout.rooms as Array<Record<string, unknown>> : [];
        breakout.rooms = rooms.map((room) => {
          const ids = Array.isArray(room.participant_user_ids) ? room.participant_user_ids.map((value) => String(value)) : [];
          return {
            ...room,
            participant_user_ids:
              String(room.id) === roomId
                ? mergeUniqueStrings([...ids.filter((value) => value !== targetUserId), targetUserId])
                : ids.filter((value) => value !== targetUserId),
          };
        });
        breakout.active = true;
        nextControls.breakout = breakout;
        await saveControls();
        break;
      }
      case "set_teacher_breakout_room": {
        const roomId = String(payload.roomId || "").trim();
        const breakout = nextControls.breakout && typeof nextControls.breakout === "object"
          ? { ...(nextControls.breakout as Record<string, unknown>) }
          : { active: true, rooms: [] };
        breakout.teacher_room_id = roomId;
        breakout.active = true;
        nextControls.breakout = breakout;
        await saveControls();
        break;
      }
      case "broadcast_breakout_message": {
        const message = String(payload.message || "").trim();
        const breakout = nextControls.breakout && typeof nextControls.breakout === "object"
          ? { ...(nextControls.breakout as Record<string, unknown>) }
          : { active: true, rooms: [] };
        breakout.broadcast_message = message;
        breakout.broadcast_at = new Date().toISOString();
        nextControls.breakout = breakout;
        await saveControls();
        break;
      }
      case "close_breakouts":
        {
          const existingBreakout = nextControls.breakout && typeof nextControls.breakout === "object"
            ? { ...(nextControls.breakout as Record<string, unknown>) }
            : { rooms: [] };
          const existingRooms = Array.isArray(existingBreakout.rooms) ? existingBreakout.rooms as Array<Record<string, unknown>> : [];
          const lastRoomLabels = Object.fromEntries(
            existingRooms.flatMap((room) => {
              const roomName = String(room.name || room.id || "Breakout");
              const userIds = Array.isArray(room.participant_user_ids)
                ? room.participant_user_ids.map((value) => String(value)).filter(Boolean)
                : [];
              return userIds.map((userId) => [userId, roomName]);
            }),
          );
        nextControls.breakout = {
          active: false,
          teacher_room_id: "",
          rooms: [],
          last_room_labels: lastRoomLabels,
          last_closed_at: new Date().toISOString(),
          broadcast_message: "",
          broadcast_at: new Date().toISOString(),
        };
        await saveControls();
        break;
        }
      default:
        return Response.json({ error: "Unsupported action." }, { status: 400, headers: corsHeaders });
    }

    const { data: updatedSession } = await adminClient
      .from("class_sessions")
      .select("id, livekit_controls")
      .eq("id", sessionId)
      .maybeSingle();

    return Response.json({ ok: true, controls: updatedSession?.livekit_controls || nextControls }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500, headers: corsHeaders },
    );
  }
});
