import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

const EXAM_PHASES = {
  RULES: "RULES",
  PERMISSION: "PERMISSION",
  FULLSCREEN: "FULLSCREEN",
  RUNNING: "RUNNING",
  SUBMITTING: "SUBMITTING",
  RESULT: "RESULT",
  TERMINATED: "TERMINATED",
};

const FULLSCREEN_TIMEOUT_SEC = 20;
const MAX_FULLSCREEN_WARNINGS = 3;
const RETAKE_LOCK_DAYS = 60;
const EXAM_SESSION_PREFIX = "strict_exam_session";

function normalizeOptions(options) {
  if (Array.isArray(options)) return options;
  if (typeof options === "string") {
    try {
      const parsed = JSON.parse(options);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function isAnswered(value) {
  return !(value === undefined || value === null || value === "");
}

function hasActiveVideoTrack(stream) {
  if (!stream) return false;
  const tracks = stream.getVideoTracks?.() || [];
  return tracks.some((track) => track.readyState === "live" && track.enabled);
}

function formatDisplaySubmissionId(rawId) {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  const digits = String(rawId || "").replace(/\D/g, "");
  const serial = (digits.slice(-5) || String(Math.floor(10000 + Math.random() * 90000))).padStart(5, "0");
  return `SkillPro-${dd}${mm}${yy}${serial}`;
}

function generateDeterministicCode(seed) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  let code = "";
  for (let i = 0; i < 12; i += 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    code += alphabet[hash % alphabet.length];
  }
  return code;
}

function formatCertificateId(cert) {
  const date = cert?.issued_at ? new Date(cert.issued_at) : new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const random = generateDeterministicCode(String(cert?.id ?? `${y}${m}${d}`));
  return `SkillPro-${y}-${m}-${d}-${random}`;
}

export default function Exam() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [examId, setExamId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [displaySubmissionId, setDisplaySubmissionId] = useState("");
  const [pendingResultData, setPendingResultData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [phase, setPhase] = useState(EXAM_PHASES.RULES);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [rulesAccepted, setRulesAccepted] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const [permissionLoading, setPermissionLoading] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);

  const [fullscreenWarnings, setFullscreenWarnings] = useState(0);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [fullscreenCountdown, setFullscreenCountdown] = useState(20);
  const fullscreenTimerRef = useRef(null);

  const [resultData, setResultData] = useState(null);
  const [terminateReason, setTerminateReason] = useState("");
  const [isBlockingAccount, setIsBlockingAccount] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [tabSwitchWarnings, setTabSwitchWarnings] = useState(0);
  const [showTabWarningModal, setShowTabWarningModal] = useState(false);
  const [retakeLockedUntil, setRetakeLockedUntil] = useState(null);
  const [passedExamInfo, setPassedExamInfo] = useState(null);
  const [demoCourseBlocked, setDemoCourseBlocked] = useState(false);
  const [needsFullscreenResume, setNeedsFullscreenResume] = useState(false);
  const [resumeCountdown, setResumeCountdown] = useState(FULLSCREEN_TIMEOUT_SEC);
  const [showExitGestureConfirm, setShowExitGestureConfirm] = useState(false);
  const [exitLocking, setExitLocking] = useState(false);
  const [showBackSwipeConfirm, setShowBackSwipeConfirm] = useState(false);
  const [backSwipeLocking, setBackSwipeLocking] = useState(false);
  const [submitReady, setSubmitReady] = useState(false);
  const [submitCountdown, setSubmitCountdown] = useState(6);
  const [submissionFinalized, setSubmissionFinalized] = useState(false);
  const [bootstrappingExam, setBootstrappingExam] = useState(true);
  const isTerminatingRef = useRef(false);
  const lastAppSwitchEventRef = useRef(0);
  const fullscreenWarningsRef = useRef(0);
  const hasRestoredSessionRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const getSessionKey = (userId = null) =>
    `${EXAM_SESSION_PREFIX}:${courseId}:${userId || "anon"}`;
  const safeSessionGet = (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const safeSessionSet = (key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // ignore storage write errors
    }
  };
  const safeSessionRemove = (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore storage remove errors
    }
  };

  const answeredCount = useMemo(
    () => Object.values(answers).filter(isAnswered).length,
    [answers]
  );

  useEffect(() => {
    // Immediate restore on mount to avoid flashing back to Step 1
    const raw = safeSessionGet(getSessionKey()) || safeSessionGet(getSessionKey(currentUserId));
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.answers && typeof parsed.answers === "object") {
        setAnswers(parsed.answers);
      }
      if (Number.isInteger(parsed?.activeQuestionIndex)) {
        setActiveQuestionIndex(Math.max(parsed.activeQuestionIndex, 0));
      }
      if (typeof parsed?.rulesAccepted === "boolean") {
        setRulesAccepted(parsed.rulesAccepted);
      }
      if (Number.isInteger(parsed?.fullscreenWarnings)) {
        fullscreenWarningsRef.current = parsed.fullscreenWarnings;
        setFullscreenWarnings(parsed.fullscreenWarnings);
      }
      if (Number.isInteger(parsed?.tabSwitchWarnings)) {
        setTabSwitchWarnings(parsed.tabSwitchWarnings);
      }
      if (parsed?.phase === EXAM_PHASES.RUNNING || parsed?.phase === EXAM_PHASES.SUBMITTING) {
        setPhase(EXAM_PHASES.RUNNING);
        setNeedsFullscreenResume(true);
        setInfoMsg(
          `Session restored. Re-enter fullscreen to continue from question ${Math.max(
            (parsed.activeQuestionIndex ?? 0) + 1,
            1
          )}.`
        );
      } else if (
        parsed?.phase === EXAM_PHASES.RULES ||
        parsed?.phase === EXAM_PHASES.PERMISSION ||
        parsed?.phase === EXAM_PHASES.FULLSCREEN
      ) {
        setPhase(parsed.phase);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadExam() {
      setErrorMsg("");
      if (mounted) setBootstrappingExam(true);
      try {
      setRetakeLockedUntil(null);
      setPassedExamInfo(null);
      setDemoCourseBlocked(false);

      // Final Exam route passes courseId. Questions are stored by exam_id.
      const [{ data: examRow, error: examError }, { data: courseRow, error: courseError }] =
        await Promise.all([
          supabase
            .from("exams")
            .select("id")
            .eq("course_id", courseId)
            .maybeSingle(),
          supabase
            .from("courses")
            .select("id, is_free")
            .eq("id", courseId)
            .maybeSingle(),
        ]);

      if (!mounted) return;

      if (examError) {
        setErrorMsg("Error loading exam: " + examError.message);
        return;
      }
      if (courseError) {
        setErrorMsg("Error loading course: " + courseError.message);
        return;
      }
      if (courseRow?.is_free) {
        setDemoCourseBlocked(true);
        safeSessionRemove(getSessionKey());
        return;
      }

      const resolvedExamId = examRow?.id ?? null;
      setExamId(resolvedExamId);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.id) {
        setErrorMsg("User not authenticated.");
        return;
      }
      setCurrentUserId(userData.user.id);
      const [
        submissionResp,
        overrideResp,
        questionsResp
      ] = await Promise.all([
        supabase
          .from("exam_submissions")
          .select("passed, next_attempt_allowed_at, submitted_at, score_percent")
          .eq("user_id", userData.user.id)
          .eq("exam_id", resolvedExamId ?? courseId)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("exam_retake_overrides")
          .select("allow_retake_at")
          .eq("user_id", userData.user.id)
          .eq("course_id", courseId)
          .order("allow_retake_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("exam_questions")
          .select("*")
          .eq("exam_id", resolvedExamId ?? courseId)
          .order("order_index", { ascending: true }),
      ]);

      const { data: latestSubmission, error: submissionError } = submissionResp;
      if (submissionError) {
        setErrorMsg("Error loading exam status: " + submissionError.message);
        return;
      }

      const { data: overrideRow, error: overrideError } = overrideResp;
      if (overrideError) {
        setErrorMsg("Error loading retake override: " + overrideError.message);
        return;
      }

      const now = new Date();
      const overrideDate = overrideRow?.allow_retake_at
        ? new Date(overrideRow.allow_retake_at)
        : null;
      const latestSubmissionDate = latestSubmission?.submitted_at
        ? new Date(latestSubmission.submitted_at)
        : null;
      // Override is valid only if it's active now and created at/after the latest failed submission.
      const overrideAllowsRetake =
        !!overrideDate &&
        overrideDate <= now &&
        (!latestSubmissionDate || overrideDate >= latestSubmissionDate);

      const nextAllowedAt = latestSubmission?.next_attempt_allowed_at
        ? new Date(latestSubmission.next_attempt_allowed_at)
        : null;

      if (latestSubmission && latestSubmission.passed === true) {
        let certificatePreviewId = null;
        try {
          const { data: certRow } = await supabase
            .from("certificates")
            .select("id, issued_at")
            .eq("user_id", userData.user.id)
            .eq("course_id", courseId)
            .is("revoked_at", null)
            .order("issued_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (certRow?.id) {
            certificatePreviewId = formatCertificateId(certRow);
          }
        } catch {
          // Best-effort only, keep passed flow resilient.
        }
        setPassedExamInfo({
          submittedAt: latestSubmission.submitted_at || null,
          scorePercent: latestSubmission.score_percent ?? null,
          certificatePreviewId,
        });
        safeSessionRemove(getSessionKey(userData.user.id));
        safeSessionRemove(getSessionKey());
        return;
      }

      if (
        !overrideAllowsRetake &&
        latestSubmission &&
        latestSubmission.passed === false &&
        nextAllowedAt &&
        nextAllowedAt > now
      ) {
        setRetakeLockedUntil(nextAllowedAt.toISOString());
        return;
      }

      if (!hasRestoredSessionRef.current) {
        const raw =
          safeSessionGet(getSessionKey(userData.user.id)) ||
          safeSessionGet(getSessionKey());
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.answers && typeof parsed.answers === "object") {
              setAnswers(parsed.answers);
            }
            if (Number.isInteger(parsed?.activeQuestionIndex)) {
              setActiveQuestionIndex(Math.max(parsed.activeQuestionIndex, 0));
            }
            if (typeof parsed?.rulesAccepted === "boolean") {
              setRulesAccepted(parsed.rulesAccepted);
            }
            if (Number.isInteger(parsed?.fullscreenWarnings)) {
              fullscreenWarningsRef.current = parsed.fullscreenWarnings;
              setFullscreenWarnings(parsed.fullscreenWarnings);
            }
            if (Number.isInteger(parsed?.tabSwitchWarnings)) {
              setTabSwitchWarnings(parsed.tabSwitchWarnings);
            }
            const resumablePhases = new Set([
              EXAM_PHASES.RULES,
              EXAM_PHASES.PERMISSION,
              EXAM_PHASES.FULLSCREEN,
              EXAM_PHASES.RUNNING,
              EXAM_PHASES.SUBMITTING,
            ]);
            if (resumablePhases.has(parsed?.phase)) {
              if (parsed.phase === EXAM_PHASES.RUNNING || parsed.phase === EXAM_PHASES.SUBMITTING) {
                setPhase(EXAM_PHASES.RUNNING);
                setNeedsFullscreenResume(true);
                setInfoMsg(
                  `Session restored. Re-enter fullscreen to continue from question ${Math.max(
                    (parsed.activeQuestionIndex ?? 0) + 1,
                    1
                  )}.`
                );
              } else {
                setPhase(parsed.phase);
              }
            }
          } catch {
            // ignore invalid session data
          }
        }
        hasRestoredSessionRef.current = true;
      }

      const { data, error } = questionsResp;

      if (!mounted) return;

      if (error) {
        setErrorMsg("Error loading questions: " + error.message);
        return;
      }

      // If exam exists but has no questions, check legacy courseId mapping once.
      if (resolvedExamId !== null && (!data || data.length === 0)) {
        const { data: legacyData, error: legacyError } = await supabase
          .from("exam_questions")
          .select("*")
          .eq("exam_id", courseId)
          .order("order_index", { ascending: true });

        if (!mounted) return;
        if (!legacyError && legacyData?.length) {
          setQuestions(legacyData);
          return;
        }
      }

      setQuestions(data || []);
      } finally {
        if (mounted) setBootstrappingExam(false);
      }
    }

    loadExam();

    return () => {
      mounted = false;
    };
  }, [courseId]);

  useEffect(() => {
    if (phase === EXAM_PHASES.RESULT || phase === EXAM_PHASES.TERMINATED) return;
    if (!hasRestoredSessionRef.current) return;
    const sessionKey = getSessionKey(currentUserId);
    const sessionKeyAnon = getSessionKey();
    const payload = {
      answers,
      activeQuestionIndex,
      rulesAccepted,
      phase,
      fullscreenWarnings,
      tabSwitchWarnings,
      updatedAt: Date.now(),
    };
    safeSessionSet(sessionKey, JSON.stringify(payload));
    safeSessionSet(sessionKeyAnon, JSON.stringify(payload));
  }, [
    currentUserId,
    courseId,
    answers,
    activeQuestionIndex,
    rulesAccepted,
    phase,
    fullscreenWarnings,
    tabSwitchWarnings,
  ]);

  useEffect(() => {
    if (questions.length === 0) return;
    setActiveQuestionIndex((prev) => Math.min(prev, questions.length - 1));
  }, [questions.length]);

  useEffect(() => {
    if (!videoRef.current || !cameraStream) return;
    // Re-bind stream every time preview element remounts (e.g. resume overlay transitions).
    videoRef.current.srcObject = null;
    videoRef.current.srcObject = cameraStream;
    const playPromise = videoRef.current.play?.();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }, [cameraStream, phase, needsFullscreenResume]);

  useEffect(() => {
    if (phase !== EXAM_PHASES.RUNNING && phase !== EXAM_PHASES.SUBMITTING) return;
    if (phase === EXAM_PHASES.SUBMITTING && submissionFinalized) return;
    if (!needsFullscreenResume && hasActiveVideoTrack(cameraStream)) return;
    let cancelled = false;
    (async () => {
      const stream = await requestCameraMicPermissions();
      if (!cancelled && stream) {
        if (cameraStream && !hasActiveVideoTrack(cameraStream)) {
          cameraStream.getTracks().forEach((track) => track.stop());
        }
        setCameraStream(stream);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, needsFullscreenResume, cameraStream, submissionFinalized]);

  useEffect(() => {
    if (phase !== EXAM_PHASES.RUNNING) return;
    if (needsFullscreenResume) return;

    const handleAppSwitchAttempt = () => {
      const now = Date.now();
      if (now - lastAppSwitchEventRef.current < 1200) return;
      lastAppSwitchEventRef.current = now;

      setTabSwitchWarnings((prev) => {
        const next = prev + 1;
        if (next >= 2) {
          void terminateAndBlock("Second app/tab switch detected during exam.");
          return next;
        }
        setShowTabWarningModal(true);
        return next;
      });
    };

    const handleVisibility = () => {
      if (document.hidden) {
        handleAppSwitchAttempt();
      }
    };

    const handleBlur = () => {
      handleAppSwitchAttempt();
    };

    const clearFullscreenTimer = () => {
      if (fullscreenTimerRef.current) {
        clearInterval(fullscreenTimerRef.current);
        fullscreenTimerRef.current = null;
      }
    };

    const handleFullscreenChange = () => {
      const inFullscreen = Boolean(document.fullscreenElement);

      if (!inFullscreen) {
        const warningCount = fullscreenWarningsRef.current + 1;
        fullscreenWarningsRef.current = warningCount;
        setFullscreenWarnings(warningCount);
        setShowFullscreenPrompt(true);
        setFullscreenCountdown(FULLSCREEN_TIMEOUT_SEC);

        if (warningCount > MAX_FULLSCREEN_WARNINGS) {
          clearFullscreenTimer();
          void terminateAndBlock("Fullscreen exited more than 3 times.");
          return;
        }

        clearFullscreenTimer();
        fullscreenTimerRef.current = setInterval(() => {
          setFullscreenCountdown((prev) => {
            if (prev <= 1) {
              clearFullscreenTimer();
              void terminateAndBlock("Did not return to fullscreen within 20 seconds.");
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        clearFullscreenTimer();
        setShowFullscreenPrompt(false);
        setFullscreenCountdown(FULLSCREEN_TIMEOUT_SEC);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      clearFullscreenTimer();
    };
  }, [phase, needsFullscreenResume]);

  useEffect(() => {
    if (phase !== EXAM_PHASES.RUNNING && phase !== EXAM_PHASES.SUBMITTING) return;
    if (needsFullscreenResume) return;

    const prevent = (event) => event.preventDefault();
    const preventCopyKeys = (event) => {
      const key = String(event.key || "").toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ["c", "v", "x", "a"].includes(key)) {
        event.preventDefault();
      }
    };
    const body = document.body;
    const previousUserSelect = body.style.userSelect;
    const previousWebkitUserSelect = body.style.webkitUserSelect;
    body.style.userSelect = "none";
    body.style.webkitUserSelect = "none";

    document.addEventListener("copy", prevent);
    document.addEventListener("paste", prevent);
    document.addEventListener("cut", prevent);
    document.addEventListener("selectstart", prevent);
    document.addEventListener("contextmenu", prevent);
    document.addEventListener("dragstart", prevent);
    document.addEventListener("keydown", preventCopyKeys);

    return () => {
      body.style.userSelect = previousUserSelect;
      body.style.webkitUserSelect = previousWebkitUserSelect;
      document.removeEventListener("copy", prevent);
      document.removeEventListener("paste", prevent);
      document.removeEventListener("cut", prevent);
      document.removeEventListener("selectstart", prevent);
      document.removeEventListener("contextmenu", prevent);
      document.removeEventListener("dragstart", prevent);
      document.removeEventListener("keydown", preventCopyKeys);
    };
  }, [phase, needsFullscreenResume]);

  useEffect(() => {
    if (phase !== EXAM_PHASES.RUNNING) return;
    if (needsFullscreenResume) return;

    const handleTouchStart = (event) => {
      if (event.touches && event.touches.length >= 2) {
        event.preventDefault();
        setShowExitGestureConfirm(true);
      }
    };
    const handleGestureStart = (event) => {
      event.preventDefault();
      setShowExitGestureConfirm(true);
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: false });
    document.addEventListener("gesturestart", handleGestureStart);
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("gesturestart", handleGestureStart);
    };
  }, [phase, needsFullscreenResume]);

  useEffect(() => {
    const inStrictPhase =
      phase === EXAM_PHASES.RUNNING ||
      phase === EXAM_PHASES.SUBMITTING ||
      phase === EXAM_PHASES.FULLSCREEN;
    if (!inStrictPhase) return;

    // Add a history entry so browser back/trackpad swipe is trapped first.
    window.history.pushState({ examGuard: true }, "", window.location.href);

    const handlePopState = () => {
      // Keep student on exam page and show explicit confirm modal.
      window.history.go(1);
      setShowBackSwipeConfirm(true);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [phase]);

  useEffect(() => {
    if (!needsFullscreenResume || phase !== EXAM_PHASES.RUNNING) return;

    if (resumeTimerRef.current) {
      clearInterval(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    setResumeCountdown(FULLSCREEN_TIMEOUT_SEC);
    resumeTimerRef.current = setInterval(() => {
      setResumeCountdown((prev) => {
        if (prev <= 1) {
          if (resumeTimerRef.current) {
            clearInterval(resumeTimerRef.current);
            resumeTimerRef.current = null;
          }
          void terminateAndBlock("Did not re-enter fullscreen within 20 seconds after refresh.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const handleImmediateBlockOnSwitch = () => {
      if (document.hidden) {
        void terminateAndBlock("Tab/app switch detected on resume fullscreen prompt.");
      }
    };

    const handleBlur = () => {
      void terminateAndBlock("App switch detected on resume fullscreen prompt.");
    };

    document.addEventListener("visibilitychange", handleImmediateBlockOnSwitch);
    window.addEventListener("blur", handleBlur);

    return () => {
      if (resumeTimerRef.current) {
        clearInterval(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleImmediateBlockOnSwitch);
      window.removeEventListener("blur", handleBlur);
    };
  }, [needsFullscreenResume, phase]);

  useEffect(() => {
    if (!needsFullscreenResume) return;
    if (document.fullscreenElement) {
      setNeedsFullscreenResume(false);
      setShowFullscreenPrompt(false);
      setFullscreenCountdown(FULLSCREEN_TIMEOUT_SEC);
      if (resumeTimerRef.current) {
        clearInterval(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
    }
  }, [needsFullscreenResume]);

  useEffect(() => {
    if (phase !== EXAM_PHASES.SUBMITTING || !pendingResultData) return;
    setSubmitReady(false);
    setSubmitCountdown(6);
    const timer = setInterval(() => {
      setSubmitCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setSubmitReady(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, pendingResultData]);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      if (fullscreenTimerRef.current) {
        clearInterval(fullscreenTimerRef.current);
      }
    };
  }, [cameraStream]);

  async function enterFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      return true;
    } catch {
      setErrorMsg("Fullscreen is required. Please allow fullscreen mode.");
      return false;
    }
  }

  async function requestCameraMicPermissions() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg("This browser does not support camera/microphone access.");
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      return stream;
    } catch (error) {
      setErrorMsg(
        "Camera and microphone permissions are required to start the exam."
      );
      return null;
    }
  }

  function continueAfterRules() {
    if (!rulesAccepted) return;
    setErrorMsg("");
    setInfoMsg("");
    setPhase(EXAM_PHASES.PERMISSION);
  }

  async function requestPermissionsStep() {
    if (phase !== EXAM_PHASES.PERMISSION) return;
    setPermissionLoading(true);
    setErrorMsg("");
    setInfoMsg("");

    const stream = await requestCameraMicPermissions();
    if (!stream) {
      setPermissionLoading(false);
      return;
    }

    setCameraStream(stream);
    setPhase(EXAM_PHASES.FULLSCREEN);
    setInfoMsg("Camera and microphone granted. Enter fullscreen to start writing the exam.");
    setPermissionLoading(false);
  }

  async function startExamInFullscreen() {
    if (phase !== EXAM_PHASES.FULLSCREEN) return;
    setErrorMsg("");
    setInfoMsg("");
    const fullscreenOk = await enterFullscreen();
    if (!fullscreenOk) {
      return;
    }

    setPhase(EXAM_PHASES.RUNNING);
    setNeedsFullscreenResume(false);
    setShowFullscreenPrompt(false);
    setFullscreenCountdown(FULLSCREEN_TIMEOUT_SEC);
    setInfoMsg("Strict proctoring is active. Do not switch tabs/apps or exit fullscreen.");
  }

  async function reEnterFullscreen() {
    const ok = await enterFullscreen();
    if (!ok) return;
    setNeedsFullscreenResume(false);
    setShowFullscreenPrompt(false);
    setFullscreenCountdown(FULLSCREEN_TIMEOUT_SEC);
    setResumeCountdown(FULLSCREEN_TIMEOUT_SEC);
    if (resumeTimerRef.current) {
      clearInterval(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }

  async function lockAccountFor60Days(reason) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user?.id) {
      throw new Error("User not authenticated.");
    }

    const lockedUntil = new Date();
    lockedUntil.setDate(lockedUntil.getDate() + 60);

    const { error } = await supabase
      .from("profiles")
      .update({
        is_locked: true,
        locked_until: lockedUntil.toISOString(),
      })
      .eq("id", userData.user.id);

    if (error) throw new Error(error.message);

    return {
      until: lockedUntil,
      reason,
    };
  }

  async function terminateAndBlock(reason) {
    if (isTerminatingRef.current) return;
    isTerminatingRef.current = true;
    setIsBlockingAccount(true);
    setTerminateReason(reason);

    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }

      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }

      const lockInfo = await lockAccountFor60Days(reason);
      setPhase(EXAM_PHASES.TERMINATED);
      safeSessionRemove(getSessionKey(currentUserId));
      safeSessionRemove(getSessionKey());
      setErrorMsg(
        `Account blocked until ${lockInfo.until.toLocaleDateString("en-IN")} due to strict proctoring violation.`
      );
    } catch (error) {
      setErrorMsg("Failed to block account: " + error.message);
      setPhase(EXAM_PHASES.TERMINATED);
    } finally {
      setIsBlockingAccount(false);
    }
  }

  async function lockExamFor60Days(reason) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user?.id) {
      throw new Error("User not authenticated.");
    }
    const lockUntil = new Date(Date.now() + RETAKE_LOCK_DAYS * 24 * 60 * 60 * 1000);
    const payload = {
      user_id: userData.user.id,
      exam_id: examId ?? courseId,
      score_percent: 0,
      passed: false,
      next_attempt_allowed_at: lockUntil.toISOString(),
      submitted_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("exam_submissions")
      .upsert([payload], { onConflict: "exam_id,user_id" });
    if (error) throw new Error(error.message);

    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
    safeSessionRemove(getSessionKey(currentUserId));
    safeSessionRemove(getSessionKey());
    setTerminateReason(reason);
    setRetakeLockedUntil(lockUntil.toISOString());
  }

  async function confirmExitAndLockExam() {
    if (exitLocking) return;
    setExitLocking(true);
    try {
      await lockExamFor60Days("User confirmed exit gesture during exam.");
      setShowExitGestureConfirm(false);
      setPhase(EXAM_PHASES.RULES);
      setInfoMsg("");
      setErrorMsg("Exam locked for 60 days due to confirmed exit gesture.");
    } catch (error) {
      setErrorMsg("Failed to lock exam: " + error.message);
    } finally {
      setExitLocking(false);
    }
  }

  async function confirmBackSwipeAndLockExam() {
    if (backSwipeLocking) return;
    setBackSwipeLocking(true);
    try {
      await lockExamFor60Days("User confirmed browser back/swipe exit during exam.");
      setShowBackSwipeConfirm(false);
      navigate("/app/courses", { replace: true });
    } catch (error) {
      setErrorMsg("Failed to lock exam: " + error.message);
    } finally {
      setBackSwipeLocking(false);
    }
  }

  async function submitExam() {
    if (phase !== EXAM_PHASES.RUNNING) return;

    setErrorMsg("");
    setInfoMsg("");
    setSubmitReady(false);
    setSubmitCountdown(6);
    setSubmissionFinalized(false);
    setDisplaySubmissionId("");
    setPhase(EXAM_PHASES.SUBMITTING);

    // Stop proctor media immediately once submission starts.
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
    setShowFullscreenPrompt(false);
    setFullscreenCountdown(FULLSCREEN_TIMEOUT_SEC);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.id) {
        throw new Error("User not authenticated.");
      }

      if (!studentName || !courseName) {
        const [profileResp, courseResp] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name")
            .eq("id", userData.user.id)
            .maybeSingle(),
          supabase
            .from("courses")
            .select("title")
            .eq("id", courseId)
            .maybeSingle(),
        ]);
        if (profileResp.data?.full_name) setStudentName(profileResp.data.full_name);
        if (courseResp.data?.title) setCourseName(courseResp.data.title);
      }

      let correct = 0;
      let total = 0;

      questions.forEach((q) => {
        const options = normalizeOptions(q.options);
        const answer = answers[q.id];
        const hasMcq = options.length > 0 && Number.isInteger(q.correct_index);
        if (!hasMcq) return;
        total += 1;
        if (answer === options[q.correct_index]) {
          correct += 1;
        }
      });

      const percentage = total === 0 ? 0 : Math.round((correct / total) * 100);
      const passed = total === 0 ? true : percentage >= 40;
      const nextAttemptAllowedAt = passed
        ? null
        : new Date(Date.now() + RETAKE_LOCK_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const submissionPayload = {
        user_id: userData.user.id,
        exam_id: examId ?? courseId,
        score_percent: percentage,
        passed,
        next_attempt_allowed_at: nextAttemptAllowedAt,
        submitted_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("exam_submissions")
        .upsert([submissionPayload], {
          onConflict: "exam_id,user_id",
        });
      if (error) throw new Error(error.message);
      const { data: submissionRow } = await supabase
        .from("exam_submissions")
        .select("id")
        .eq("user_id", userData.user.id)
        .eq("exam_id", examId ?? courseId)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const rawSubmissionId = submissionRow?.id ? String(submissionRow.id) : "N/A";
      setSubmissionId(rawSubmissionId);
      setDisplaySubmissionId(formatDisplaySubmissionId(rawSubmissionId));

      if (passed && submissionRow?.id) {
        // Best-effort only: certificate insertion can be blocked by RLS depending on policy.
        // Do not fail exam submission when certificate insert is denied.
        const { error: certError } = await supabase
          .from("certificates")
          .insert([
            {
              user_id: userData.user.id,
              course_id: courseId,
              exam_submission_id: submissionRow.id,
              issued_at: new Date().toISOString(),
            },
          ]);
        if (certError && certError.code !== "23505" && certError.code !== "42501") {
          console.warn("Certificate insert skipped:", certError.message);
        }
      }

      setSubmissionFinalized(true);
      setPendingResultData({ correct, total, percentage, passed, nextAttemptAllowedAt });
    } catch (error) {
      setErrorMsg("Error submitting exam: " + error.message);
      setPhase(EXAM_PHASES.RUNNING);
    }
  }

  function openResultsPage() {
    if (!pendingResultData) return;
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setResultData(pendingResultData);
    setPendingResultData(null);
    safeSessionRemove(getSessionKey(currentUserId));
    safeSessionRemove(getSessionKey());
    setPhase(EXAM_PHASES.RESULT);
  }

  const activeQuestion = questions[activeQuestionIndex];
  const isExamWorkspace =
    phase === EXAM_PHASES.RUNNING || phase === EXAM_PHASES.SUBMITTING;

  if (phase === EXAM_PHASES.TERMINATED) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-red-200 p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-700">Exam Terminated</h1>
          <p className="text-slate-700">
            Your account is locked for 60 days due to strict proctoring violation.
          </p>
          {terminateReason ? (
            <p className="text-sm text-slate-500">Reason: {terminateReason}</p>
          ) : null}
          {isBlockingAccount ? <p className="text-sm text-slate-500">Applying account lock...</p> : null}
          <button
            onClick={() => navigate("/app")}
            className="px-5 py-2 rounded-lg bg-slate-900 text-white font-semibold"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (bootstrappingExam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-emerald-50 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-xl">
          <div className="px-8 py-7 bg-gradient-to-r from-slate-900 to-slate-700 text-white">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Checking Exam Access</h1>
            <p className="text-sm text-slate-200 mt-1">
              Validating eligibility, lock status, and question availability.
            </p>
          </div>
          <div className="p-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
              <div>
                <p className="font-semibold text-slate-900">Please wait...</p>
                <p className="text-sm text-slate-600">This usually takes a few seconds.</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">Course + exam mapping</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">Retake / pass checks</div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">Question readiness</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (retakeLockedUntil) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-amber-200 p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-amber-700">Exam Locked</h1>
          <p className="text-slate-700">
            You failed this exam. Retake is locked for 60 days.
          </p>
          <p className="text-sm text-slate-600">
            You can retake after: {new Date(retakeLockedUntil).toLocaleString("en-IN")}
          </p>
          <button
            onClick={() => navigate("/app/courses")}
            className="px-5 py-2 rounded-lg bg-slate-900 text-white font-semibold"
          >
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  if (demoCourseBlocked) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-blue-200 p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-blue-700">Demo Course</h1>
          <p className="text-slate-700">
            This is a demo course. This didnt have any exams, tests and certifications.
          </p>
          <button
            onClick={() => navigate("/app/courses")}
            className="px-5 py-2 rounded-lg bg-slate-900 text-white font-semibold"
          >
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0 && !passedExamInfo) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-amber-200 p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-amber-700">Exam Not Available</h1>
          <p className="text-slate-700">
            Still questions to be added. Please try again later.
          </p>
          <button
            onClick={() => navigate("/app/courses")}
            className="px-5 py-2 rounded-lg bg-slate-900 text-white font-semibold"
          >
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  if (passedExamInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full rounded-3xl border border-emerald-200 bg-white shadow-xl overflow-hidden">
          <div className="px-8 py-7 bg-gradient-to-r from-emerald-600 to-green-500 text-white">
            <h1 className="text-3xl font-extrabold">Exam Completed</h1>
            <p className="mt-1 text-emerald-50">
              You have already passed this final exam. Re-attempt is not allowed.
            </p>
          </div>
          <div className="p-8 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">STATUS</p>
                <p className="text-2xl font-extrabold text-emerald-700 mt-1">PASSED</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">SCORE</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {passedExamInfo.scorePercent !== null ? `${passedExamInfo.scorePercent}%` : "Recorded"}
                </p>
              </div>
            </div>
            {passedExamInfo.submittedAt ? (
              <p className="text-sm text-slate-600">
                Passed on: {new Date(passedExamInfo.submittedAt).toLocaleString("en-IN")}
              </p>
            ) : null}
            <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
              Exam completed. Click below to view your certificate preview.
            </p>
            <div className="flex flex-wrap gap-3">
              {passedExamInfo.certificatePreviewId ? (
                <button
                  onClick={() =>
                    navigate(
                      `/certificate-preview/${encodeURIComponent(passedExamInfo.certificatePreviewId)}`
                    )
                  }
                  className="px-6 py-2.5 rounded-lg bg-blue-700 text-white font-semibold hover:bg-blue-800"
                >
                  Show Certificate Preview
                </button>
              ) : null}
              <button
                onClick={() => navigate("/app/my-certificates")}
                className="px-6 py-2.5 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800"
              >
                View Certificate
              </button>
              <button
                onClick={() => navigate("/app/courses")}
                className="px-6 py-2.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800"
              >
                Back to Courses
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === EXAM_PHASES.SUBMITTING) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl bg-white/95 rounded-3xl shadow-2xl border border-emerald-200 p-8 text-center space-y-6">
          {!submitReady ? (
            <div className="mx-auto w-16 h-16 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
          ) : (
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 border-4 border-emerald-500 flex items-center justify-center">
              <span className="text-3xl font-extrabold text-emerald-700">✓</span>
            </div>
          )}
          <h1 className="text-3xl font-extrabold text-emerald-700">
            {!submitReady ? "Submitting..." : "Submitted"}
          </h1>
          <p className="text-slate-700">
            {!submitReady
              ? "Please wait while we securely process your submission."
              : "Submission completed successfully. You can now view results."}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500 font-semibold">Submission ID</p>
              <p className="text-lg font-extrabold text-slate-900 break-all">{displaySubmissionId || "Generating..."}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500 font-semibold">Student Name</p>
              <p className="text-sm font-bold text-slate-900">{studentName || "Student"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500 font-semibold">Course Name</p>
              <p className="text-sm font-bold text-slate-900">{courseName || `Course ${courseId}`}</p>
            </div>
          </div>
          {pendingResultData ? (
            <button
              onClick={openResultsPage}
              disabled={!submitReady}
              className="px-6 py-2 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800 disabled:opacity-60"
            >
              {submitReady ? "Show Results" : `Submitting... ${submitCountdown}s`}
            </button>
          ) : (
            <p className="text-sm text-slate-600">Finalizing submission...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div
        className={`mx-auto grid gap-6 ${
          isExamWorkspace
            ? "max-w-7xl grid-cols-1 lg:grid-cols-[280px,1fr]"
            : "max-w-4xl grid-cols-1"
        }`}
      >
        {isExamWorkspace ? (
          <aside className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 h-fit lg:sticky lg:top-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Question Navigator</h2>
            <p className="text-xs text-slate-500 mb-4">
              Review all admin-added questions and jump by number.
            </p>

            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, index) => {
                const answered = isAnswered(answers[q.id]);
                const active = index === activeQuestionIndex;
                return (
                  <button
                    key={q.id}
                    onClick={() => setActiveQuestionIndex(index)}
                    className={[
                      "h-10 rounded-lg text-sm font-bold border transition",
                      active ? "bg-slate-900 text-white border-slate-900" : "",
                      !active && answered ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "",
                      !active && !answered ? "bg-slate-50 text-slate-700 border-slate-300" : "",
                    ].join(" ")}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 text-xs text-slate-600 space-y-1">
              <p>Total Questions: <span className="font-semibold">{questions.length}</span></p>
              <p>Answered: <span className="font-semibold">{answeredCount}</span></p>
              <p>Warnings: <span className="font-semibold text-amber-600">{fullscreenWarnings}/3</span></p>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 mb-2">Live Proctor Camera</h3>
              <div className="rounded-xl overflow-hidden border border-slate-300 bg-black aspect-video">
                <video
                  key={`${phase}-${needsFullscreenResume ? "resume" : "live"}-${cameraStream ? "stream" : "nostream"}`}
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </aside>
        ) : null}

        <main className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-8 space-y-5">
          <header className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Strict Proctoring Exam</h1>
            <p className="text-sm text-slate-600">
              Rules acceptance, camera/mic permission, and fullscreen are mandatory before writing.
            </p>
            {infoMsg ? <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">{infoMsg}</p> : null}
            {errorMsg ? <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorMsg}</p> : null}
          </header>

          {phase === EXAM_PHASES.RULES ||
          phase === EXAM_PHASES.PERMISSION ||
          phase === EXAM_PHASES.FULLSCREEN ? (
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 text-white overflow-hidden">
              <div className="px-6 py-5 border-b border-white/20">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl md:text-2xl font-bold">
                    {phase === EXAM_PHASES.RULES ? "Step 1: Accept Rules" : ""}
                    {phase === EXAM_PHASES.PERMISSION ? "Step 2: Allow Camera & Microphone" : ""}
                    {phase === EXAM_PHASES.FULLSCREEN ? "Step 3: Start in Fullscreen" : ""}
                  </h2>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white text-slate-900">
                    {phase === EXAM_PHASES.RULES
                      ? "1/3"
                      : phase === EXAM_PHASES.PERMISSION
                      ? "2/3"
                      : "3/3"}
                  </span>
                </div>
              </div>

              <div className="p-6 md:p-8 bg-white text-slate-900">
                {phase === EXAM_PHASES.RULES ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">No tab/app switching during exam.</div>
                      <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">Stay in fullscreen until submission completes.</div>
                      <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">Camera and microphone must stay allowed.</div>
                      <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">Violations can lock account for 60 days.</div>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-lg p-3">
                      <input
                        type="checkbox"
                        checked={rulesAccepted}
                        onChange={(event) => setRulesAccepted(event.target.checked)}
                      />
                      I accept all exam rules.
                    </label>
                    <button
                      onClick={continueAfterRules}
                      disabled={!rulesAccepted}
                      className="px-6 py-2 rounded-lg bg-slate-900 text-white font-semibold disabled:opacity-60"
                    >
                      Continue
                    </button>
                  </div>
                ) : null}

                {phase === EXAM_PHASES.PERMISSION ? (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-700">
                      Allow camera and microphone to continue. A browser permission popup may appear near the address bar.
                    </p>
                    <button
                      onClick={requestPermissionsStep}
                      disabled={permissionLoading || questions.length === 0}
                      className="px-6 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-60"
                    >
                      {permissionLoading ? "Requesting Permissions..." : "Allow Cam & Mic"}
                    </button>
                  </div>
                ) : null}

                {phase === EXAM_PHASES.FULLSCREEN ? (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-700">
                      Click below to enter fullscreen. Questions will appear only after fullscreen starts.
                    </p>
                    <button
                      onClick={startExamInFullscreen}
                      className="px-6 py-2 rounded-lg bg-emerald-600 text-white font-semibold"
                    >
                      Enter Fullscreen
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {(phase === EXAM_PHASES.RUNNING || phase === EXAM_PHASES.SUBMITTING) && activeQuestion ? (
            <section className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  Question {activeQuestionIndex + 1} of {questions.length}
                </p>
                <h3 className="text-lg font-semibold text-slate-900 mt-1">
                  {activeQuestion.question}
                </h3>
              </div>

              {normalizeOptions(activeQuestion.options).length > 0 ? (
                <div className="space-y-3">
                  {normalizeOptions(activeQuestion.options).map((option, idx) => (
                    <label
                      key={idx}
                      className="flex items-start gap-3 border rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-50"
                    >
                      <input
                        type="radio"
                        name={`q_${activeQuestion.id}`}
                        value={option}
                        checked={answers[activeQuestion.id] === option}
                        disabled={phase !== EXAM_PHASES.RUNNING || needsFullscreenResume}
                        onChange={(event) => {
                          setAnswers((prev) => ({
                            ...prev,
                            [activeQuestion.id]: event.target.value,
                          }));
                        }}
                      />
                      <span className="text-sm text-slate-800">{option}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  className="w-full min-h-[140px] border rounded-lg p-3 outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Write your answer..."
                  disabled={phase !== EXAM_PHASES.RUNNING || needsFullscreenResume}
                  value={answers[activeQuestion.id] || ""}
                  onChange={(event) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [activeQuestion.id]: event.target.value,
                    }))
                  }
                />
              )}
            </section>
          ) : null}

          {(phase === EXAM_PHASES.RUNNING || phase === EXAM_PHASES.SUBMITTING) && !activeQuestion ? (
            <p className="text-sm text-red-700">Still questions to be added. Please try again later.</p>
          ) : null}

          {phase === EXAM_PHASES.RUNNING || phase === EXAM_PHASES.SUBMITTING ? (
            <div className="flex flex-wrap gap-3 pt-3 border-t">
              <button
                onClick={() =>
                  setActiveQuestionIndex((prev) => Math.max(prev - 1, 0))
                }
                className="px-4 py-2 rounded-lg border border-slate-300 font-medium"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setActiveQuestionIndex((prev) =>
                    Math.min(prev + 1, Math.max(questions.length - 1, 0))
                  )
                }
                className="px-4 py-2 rounded-lg border border-slate-300 font-medium"
              >
                Next
              </button>
              <button
                onClick={() => setShowSubmitConfirm(true)}
                disabled={phase === EXAM_PHASES.SUBMITTING || needsFullscreenResume}
                className="ml-auto px-5 py-2 rounded-lg bg-slate-900 text-white font-semibold disabled:opacity-60"
              >
                {phase === EXAM_PHASES.SUBMITTING ? "Submitting..." : "Submit Exam"}
              </button>
            </div>
          ) : null}

          {phase === EXAM_PHASES.RESULT && resultData ? (
            <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white">
              <div
                className={`px-8 py-7 text-white ${
                  resultData.passed
                    ? "bg-gradient-to-r from-emerald-600 to-green-500"
                    : "bg-gradient-to-r from-rose-600 to-red-500"
                }`}
              >
                <h2 className="text-3xl font-extrabold tracking-tight">Final Exam Result</h2>
                <p className="text-sm mt-1 opacity-90">
                  {resultData.passed
                    ? "Congratulations, you have successfully passed."
                    : "Result processed. Please review your score and next attempt date."}
                </p>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
                    <p className="text-xs font-semibold text-slate-500">STATUS</p>
                    <p className={`text-3xl font-extrabold mt-1 ${resultData.passed ? "text-emerald-700" : "text-red-700"}`}>
                      {resultData.passed ? "PASS" : "FAIL"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
                    <p className="text-xs font-semibold text-slate-500">SCORE</p>
                    <p className="text-3xl font-extrabold mt-1 text-slate-900">{resultData.percentage}%</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
                    <p className="text-xs font-semibold text-slate-500">CORRECT</p>
                    <p className="text-3xl font-extrabold mt-1 text-slate-900">
                      {resultData.correct}/{resultData.total}
                    </p>
                  </div>
                </div>

                {!resultData.passed && resultData.nextAttemptAllowedAt ? (
                  <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                    Retake locked until {new Date(resultData.nextAttemptAllowedAt).toLocaleString("en-IN")}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3 justify-center">
                  {resultData.passed ? (
                    <button
                      onClick={() => navigate("/app/my-certificates")}
                      className="px-6 py-2.5 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800"
                    >
                      View Certificate
                    </button>
                  ) : null}
                  <button
                    onClick={() => navigate("/app/courses")}
                    className="px-6 py-2.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800"
                  >
                    Back to Courses
                  </button>
                </div>
              </div>
            </div>
          ) : null}

        </main>
      </div>

      {showFullscreenPrompt && (phase === EXAM_PHASES.RUNNING || phase === EXAM_PHASES.SUBMITTING) ? (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-red-200 shadow-xl space-y-4 text-center">
            <h2 className="text-xl font-bold text-red-700">Return to Fullscreen</h2>
            <p className="text-slate-700">
              You exited fullscreen. Warning {Math.min(fullscreenWarnings, MAX_FULLSCREEN_WARNINGS)}/{MAX_FULLSCREEN_WARNINGS}.
            </p>
            <div className="mx-auto w-20 h-20 rounded-full border-4 border-red-200 bg-red-50 flex items-center justify-center">
              <span className="text-2xl font-extrabold text-red-700">{fullscreenCountdown}</span>
            </div>
            <p className="text-sm text-slate-500">
              Re-enter fullscreen within {fullscreenCountdown} seconds, otherwise your account will be blocked for 60 days.
            </p>
            <button
              onClick={reEnterFullscreen}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold"
            >
              Re-enter Fullscreen
            </button>
          </div>
        </div>
      ) : null}

      {needsFullscreenResume && phase === EXAM_PHASES.RUNNING ? (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-blue-200 shadow-xl space-y-4 text-center">
            <h2 className="text-xl font-bold text-slate-900">Resume Exam</h2>
            <p className="text-sm text-slate-700">
              Browser refresh exited fullscreen. Re-enter fullscreen to continue from your saved question and answers.
            </p>
            <div className="mx-auto w-20 h-20 rounded-full border-4 border-blue-200 bg-blue-50 flex items-center justify-center">
              <span className="text-2xl font-extrabold text-blue-700">{resumeCountdown}</span>
            </div>
            <p className="text-sm text-slate-600">
              Re-enter within {resumeCountdown} seconds. After 0, account will be blocked.
            </p>
            <button
              onClick={reEnterFullscreen}
              className="px-5 py-2 rounded-lg bg-slate-900 text-white font-semibold"
            >
              Re-enter Fullscreen
            </button>
          </div>
        </div>
      ) : null}

      {showSubmitConfirm && phase === EXAM_PHASES.RUNNING ? (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-slate-200 shadow-xl space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Confirm Submission</h2>
            <p className="text-sm text-slate-700">
              Are you sure you want to submit your exam? You cannot edit answers after this.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowSubmitConfirm(false);
                  await submitExam();
                }}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold"
              >
                Confirm Submit
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showTabWarningModal && (phase === EXAM_PHASES.RUNNING || phase === EXAM_PHASES.SUBMITTING) ? (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-amber-200 shadow-xl space-y-4 text-center">
            <h2 className="text-xl font-bold text-amber-700">Proctor Warning</h2>
            <p className="text-sm text-slate-700">
              App/Tab change detected. Next time your account will be blocked for 60 days.
            </p>
            <button
              onClick={() => setShowTabWarningModal(false)}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold"
            >
              I Understand
            </button>
          </div>
        </div>
      ) : null}

      {showExitGestureConfirm && phase === EXAM_PHASES.RUNNING ? (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-red-200 shadow-xl space-y-4 text-center">
            <h2 className="text-xl font-bold text-red-700">Exit Gesture Detected</h2>
            <p className="text-sm text-slate-700">
              You triggered a multi-touch/gesture that may exit exam mode.
              If you confirm exit, this exam will be locked for 60 days (same as failed exam lock).
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowExitGestureConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 font-medium"
                disabled={exitLocking}
              >
                Continue Exam
              </button>
              <button
                onClick={confirmExitAndLockExam}
                className="px-4 py-2 rounded-lg bg-red-700 text-white font-semibold disabled:opacity-60"
                disabled={exitLocking}
              >
                {exitLocking ? "Locking..." : "Confirm Exit & Lock 60 Days"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showBackSwipeConfirm ? (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-red-200 shadow-xl space-y-4 text-center">
            <h2 className="text-xl font-bold text-red-700">Leave Exam Confirmation</h2>
            <p className="text-sm text-slate-700">
              Back-swipe/browser back was detected. If you confirm exit, this attempt will be marked failed and exam will be locked for 60 days.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowBackSwipeConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 font-medium"
                disabled={backSwipeLocking}
              >
                Stay In Exam
              </button>
              <button
                onClick={confirmBackSwipeAndLockExam}
                className="px-4 py-2 rounded-lg bg-red-700 text-white font-semibold disabled:opacity-60"
                disabled={backSwipeLocking}
              >
                {backSwipeLocking ? "Locking..." : "Confirm Exit & Fail"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
