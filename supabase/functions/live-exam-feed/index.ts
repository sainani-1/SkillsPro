import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LIVE_STATUSES = ["active", "paused", "scheduled"];

const base64UrlToBytes = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const decodeJsonPart = (value: string) =>
  JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as Record<string, unknown>;

const decodeJwtPayload = (token: string) => {
  const payloadPart = token.split(".")[1] || "";
  return decodeJsonPart(payloadPart);
};

const verifyEs256Jwt = async (supabaseUrl: string, token: string) => {
  const [headerPart, payloadPart, signaturePart] = token.split(".");
  if (!headerPart || !payloadPart || !signaturePart) return false;

  const header = decodeJsonPart(headerPart);
  if (header.alg !== "ES256" || !header.kid) return false;

  const jwksResp = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
  if (!jwksResp.ok) return false;
  const jwks = await jwksResp.json() as { keys?: JsonWebKey[] };
  const jwk = (jwks.keys || []).find((key) => key.kid === header.kid);
  if (!jwk) return false;

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    base64UrlToBytes(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );
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
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response("Missing required Supabase environment variables.", { status: 500, headers: corsHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("Missing Authorization bearer token.", { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const callerJwt = authHeader.replace("Bearer ", "").trim();
    const jwtVerified = await verifyEs256Jwt(supabaseUrl, callerJwt);
    if (!jwtVerified) {
      return new Response("Invalid session token.", { status: 401, headers: corsHeaders });
    }
    const callerPayload = decodeJwtPayload(callerJwt);
    const callerId = String(callerPayload.sub || "").trim();
    if (!callerId) {
      return new Response("Invalid session token.", { status: 401, headers: corsHeaders });
    }

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", callerId)
      .maybeSingle();

    const callerRole = String(callerProfile?.role || "").toLowerCase();
    if (!["admin", "teacher", "instructor"].includes(callerRole)) {
      return new Response("Only staff can load live exam feed.", { status: 403, headers: corsHeaders });
    }

    const { data: sessions, error: sessionError } = await adminClient
      .from("exam_live_sessions")
      .select("*")
      .in("status", LIVE_STATUSES)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (sessionError) throw sessionError;

    const slotIds = Array.from(new Set((sessions || []).map((row) => row.slot_id).filter(Boolean)));
    if (!slotIds.length) {
      return Response.json({
        slots: [],
        bookings: [],
        sessions: [],
        violations: [],
        messages: [],
        instructors: [],
        overrides: [],
        facultyAttendance: [],
        profiles: [],
        exams: [],
        courses: [],
      }, { headers: corsHeaders });
    }

    const [
      slotResp,
      bookingResp,
      violationResp,
      messageResp,
      instructorResp,
      overrideResp,
      facultyAttendanceResp,
    ] = await Promise.all([
      adminClient.from("exam_live_slots").select("*").in("id", slotIds).neq("status", "cancelled"),
      adminClient.from("exam_slot_bookings").select("*").in("slot_id", slotIds),
      adminClient.from("exam_live_violations").select("*").in("slot_id", slotIds),
      adminClient.from("exam_live_messages").select("*").in("slot_id", slotIds),
      adminClient.from("exam_slot_instructors").select("*").in("slot_id", slotIds),
      adminClient.from("exam_slot_booking_overrides").select("*").in("slot_id", slotIds),
      adminClient.from("exam_slot_faculty_attendance").select("*").in("slot_id", slotIds),
    ]);

    const firstError = [
      slotResp.error,
      bookingResp.error,
      violationResp.error,
      messageResp.error,
      instructorResp.error,
      overrideResp.error,
      facultyAttendanceResp.error,
    ].find(Boolean);
    if (firstError) throw firstError;

    const slots = slotResp.data || [];
    const examIds = Array.from(new Set(slots.map((slot) => slot.exam_id).filter(Boolean)));
    const profileIds = new Set<string>();
    slots.forEach((slot) => {
      if (slot.teacher_id) profileIds.add(String(slot.teacher_id));
      if (slot.created_by) profileIds.add(String(slot.created_by));
    });
    (bookingResp.data || []).forEach((row) => row.student_id && profileIds.add(String(row.student_id)));
    (sessions || []).forEach((row) => row.student_id && profileIds.add(String(row.student_id)));
    (messageResp.data || []).forEach((row) => {
      if (row.sender_id) profileIds.add(String(row.sender_id));
      if (row.recipient_id) profileIds.add(String(row.recipient_id));
    });
    (instructorResp.data || []).forEach((row) => row.instructor_id && profileIds.add(String(row.instructor_id)));

    const [profileResp, examResp] = await Promise.all([
      profileIds.size
        ? adminClient
            .from("profiles")
            .select("id, full_name, email, role, assigned_teacher_id, premium_until")
            .in("id", Array.from(profileIds))
        : Promise.resolve({ data: [], error: null }),
      examIds.length
        ? adminClient.from("exams").select("id, course_id, test_name").in("id", examIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (profileResp.error) throw profileResp.error;
    if (examResp.error) throw examResp.error;

    const courseIds = Array.from(new Set((examResp.data || []).map((exam) => exam.course_id).filter(Boolean)));
    const courseResp = courseIds.length
      ? await adminClient.from("courses").select("id, title").in("id", courseIds)
      : { data: [], error: null };
    if (courseResp.error) throw courseResp.error;

    return Response.json({
      slots,
      bookings: bookingResp.data || [],
      sessions: (sessions || []).filter((session) => slots.some((slot) => String(slot.id) === String(session.slot_id))),
      violations: violationResp.data || [],
      messages: messageResp.data || [],
      instructors: instructorResp.data || [],
      overrides: overrideResp.data || [],
      facultyAttendance: facultyAttendanceResp.data || [],
      profiles: profileResp.data || [],
      exams: examResp.data || [],
      courses: courseResp.data || [],
    }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500, headers: corsHeaders },
    );
  }
});
