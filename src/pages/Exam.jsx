import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useParams } from "react-router-dom";

/* ======================
STRICT PROCTOR
====================== */
const startProctor = (onViolation) => {

  let count = 0;

  const violate = (msg) => {
    count++;
    onViolation(count, msg);
  };

  const visibility = () => {
    if (document.hidden) violate("Tab Switch");
  };

  const blockKeys = e => {
    if (
      e.key === "F12" ||
      (e.ctrlKey && e.shiftKey && e.key === "I") ||
      (e.ctrlKey && e.key === "u")
    ) {
      e.preventDefault();
      violate("DevTools");
    }
  };

  const rightClick = e => {
    e.preventDefault();
    violate("Right Click");
  };

  document.addEventListener("visibilitychange", visibility);
  document.addEventListener("keydown", blockKeys);
  document.addEventListener("contextmenu", rightClick);

  return () => {
    document.removeEventListener("visibilitychange", visibility);
    document.removeEventListener("keydown", blockKeys);
    document.removeEventListener("contextmenu", rightClick);
  };
};

export default function Exam() {

  const { courseId } = useParams();

  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const [step, setStep] = useState("rules");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(6000); // 100 min
  const [warnings, setWarnings] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [violationMsg, setViolationMsg] = useState("");
  const [minQuestions, setMinQuestions] = useState(25);

  const [mediaStream, setMediaStream] = useState(null);

  /* ======================
LOAD QUESTIONS FROM ADMIN
====================== */
  useEffect(() => {
    // Load questions from exam_questions
    supabase
      .from("exam_questions")
      .select("*")
      .eq("course_id", courseId)
      .then(({ data }) => setQuestions(data || []));

    // Load min_questions for course, then always reload global setting
    supabase
      .from("courses")
      .select("min_questions")
      .eq("id", courseId)
      .then(({ data }) => {
        if (data && data.length > 0 && typeof data[0].min_questions === 'number' && !isNaN(data[0].min_questions)) {
          setMinQuestions(data[0].min_questions);
        } else {
          // fallback to global
          supabase
            .from("settings")
            .select("value")
            .eq("key", "min_questions")
            .then(({ data }) => {
              if (data && data.length > 0 && !isNaN(parseInt(data[0].value))) setMinQuestions(parseInt(data[0].value));
            });
        }
      });
  }, [courseId]);

  /* ======================
TIMER
====================== */
  useEffect(() => {
    if (step !== "exam") return;

    const t = setInterval(() => {
      setTimeLeft(v => {
        if (v <= 1) submitExam();
        return v - 1;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [step]);

  /* ======================
STRICT PROCTOR START
====================== */
  useEffect(() => {
    if (step !== "exam") return;

    // Block copy, paste, cut
    const blockCopyPaste = e => {
      e.preventDefault();
      handleViolation("Copy/Paste");
    };
    document.addEventListener("copy", blockCopyPaste);
    document.addEventListener("paste", blockCopyPaste);
    document.addEventListener("cut", blockCopyPaste);

    // Block right click (context menu)
    const blockContext = e => {
      e.preventDefault();
      handleViolation("Right Click");
    };
    document.addEventListener("contextmenu", blockContext);

    // Block DevTools
    const blockKeys = e => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && e.key === "I") ||
        (e.ctrlKey && e.key === "u")
      ) {
        e.preventDefault();
        handleViolation("DevTools");
      }
    };
    document.addEventListener("keydown", blockKeys);

    // Detect fullscreen exit
    const handleFullscreen = () => {
      if (document.fullscreenElement !== containerRef.current) {
        handleViolation("Fullscreen Exit");
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreen);

    // Detect tab change
    const handleVisibility = () => {
      if (document.hidden) handleViolation("Tab Switch");
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("copy", blockCopyPaste);
      document.removeEventListener("paste", blockCopyPaste);
      document.removeEventListener("cut", blockCopyPaste);
      document.removeEventListener("contextmenu", blockContext);
      document.removeEventListener("keydown", blockKeys);
      document.removeEventListener("fullscreenchange", handleFullscreen);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [step]);

  // Violation handler
  const handleViolation = (msg) => {
    setWarnings(w => {
      const next = w + 1;
      setViolationMsg(msg);
      if (next === 1) {
        alert("Warning: " + msg);
      }
      if (next === 2) {
        alert("Second violation: Exam will be auto-submitted and you are banned for 60 days.");
        banUserAndSubmit();
        setBlocked(true);
      }
      return next;
    });
  };

  // Ban user for 60 days and submit
  const banUserAndSubmit = async () => {
    const { data } = await supabase.auth.getUser();
    const banUntil = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
    await supabase.from("users").update({ ban_until: banUntil.toISOString() }).eq("id", data.user.id);
    await submitExam();
  };

  /* ======================
CAMERA START
====================== */
  const checkCameraMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(stream);
      alert("Camera & mic permission granted ✅");
      setStep("fullscreen"); // Advance to next step
    } catch (err) {
      alert("Camera & mic permission required. Please allow access in your browser settings.");
    }
  };

  const requestCamera = async () => {
    try {
      // Use existing stream if available
      const stream = mediaStream || await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      videoRef.current.srcObject = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.start();
      setStep("fullscreen");
    } catch {
      alert("Camera & mic permission required");
    }
  };

  /* ======================
FULLSCREEN START
====================== */
  const enterFullscreen = async () => {

    if (!containerRef.current) return;

    await containerRef.current.requestFullscreen();

    setStep("exam");
  };

  /* ======================
SUBMIT
====================== */
  const submitExam = async () => {
    // Stop recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    const { data } = await supabase.auth.getUser();
    await supabase.from("exam_attempts").insert({
      user_id: data.user.id,
      course_id: courseId,
      answers,
      warnings,
      submitted: true
    });
    // Optionally: upload video/audio (not implemented here)
    alert("Exam Submitted");
    window.location.href = "/app";
  };

  if (blocked)
    return (
      <div className="h-screen flex items-center justify-center text-red-600 text-2xl">
        Account Blocked
      </div>
    );

  /* ======================
RULES
====================== */
  if (step === "rules") {
    return (
      <div className="h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl mb-4">Exam Rules</h1>
        <ul className="mb-6 text-left">
          <li>• 100 minutes</li>
          <li>• Passing: 70%</li>
          <li>• Ask permission before fullscreen</li>
          <li>• Camera & mic mandatory (recorded)</li>
          <li>• Fullscreen enforced</li>
          <li>• Copy/paste/DevTools disabled</li>
          <li>• Tab change, fullscreen exit, unusual activity detected</li>
          <li>• 1st violation: warning</li>
          <li>• 2nd violation: auto submit + ban 60 days</li>
          <li>• Timer and your video always visible</li>
        </ul>
        <button
          onClick={() => setStep("permission")}
          className="bg-blue-600 text-white px-6 py-2"
        >
          Continue
        </button>
      </div>
    );
  }

  /* ======================
CAM PERMISSION
====================== */
  if (step === "permission")
    return (
      <div className="h-screen flex flex-col items-center justify-center">
        <h1>Allow Camera Access</h1>
        <button
          onClick={requestCamera}
          className="bg-blue-600 text-white px-6 py-2"
        >
          Allow Camera
        </button>
        <button
          onClick={checkCameraMicPermission}
          className="bg-gray-600 text-white px-6 py-2 mt-4"
        >
          Check Camera/Mic Permission
        </button>
      </div>
    );

  /* ======================
FULLSCREEN
====================== */
  if (step === "fullscreen")
    return (
      <div ref={containerRef}
        className="h-screen flex flex-col items-center justify-center">
        <video ref={videoRef}
          autoPlay muted
          className="mb-4 w-72 border rounded" />
        <button
          onClick={enterFullscreen}
          className="bg-green-600 text-white px-6 py-2">
          Enter Fullscreen & Start Exam
        </button>
      </div>
    );

  /* ======================
EXAM UI
====================== */
  // Track submission state
  const [submitted, setSubmitted] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleSubmitExam = async () => {
    if (submitted) return;
    setSubmitted(true);
    await submitExam();
    setSubmitSuccess(true);
  };

  return (
    <div ref={containerRef} className="relative p-6 min-h-screen bg-white">
      {/* Timer and video top-right */}
      <div className="absolute top-4 right-4 flex flex-col items-end z-10">
        <div className="bg-gray-900 text-white px-4 py-2 rounded mb-2 text-lg font-bold">
          Time: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
        </div>
        <video ref={videoRef} autoPlay muted className="w-32 h-24 border rounded shadow" />
        <div className="mt-2 text-sm text-red-600">Warnings: {warnings}/2</div>
        {violationMsg && <div className="text-xs text-yellow-700">Last: {violationMsg}</div>}
      </div>
      <div className="max-w-2xl mx-auto">
        {questions.map(q => (
          <div key={q.id} className="mb-6">
            <p className="font-semibold mb-2">{q.question}</p>
            {q.type === "mcq" &&
              q.options.map((o, i) => (
                <label key={i} className="block mb-1">
                  <input
                    type="radio"
                    name={`q_${q.id}`}
                    onChange={() => !submitted && setAnswers(a => ({ ...a, [q.id]: o }))}
                    checked={answers[q.id] === o}
                    disabled={submitted}
                  />
                  <span className="ml-2">{o}</span>
                </label>
              ))}
            {q.type === "written" &&
              <textarea
                className="border w-full"
                onChange={e => !submitted && setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                value={answers[q.id] || ""}
                disabled={submitted}
              />}
          </div>
        ))}
        {!submitSuccess ? (
          <button
            onClick={handleSubmitExam}
            className="bg-green-600 text-white px-6 py-2"
            disabled={submitted}
          >
            {submitted ? "Submitting..." : "Submit"}
          </button>
        ) : (
          <div className="text-green-600 font-bold text-xl mt-4">Done</div>
        )}
      </div>
    </div>
  );
}

/* =========================
     CAMERA/MIC PERMISSION CHECK
  ========================== */
const checkCameraMicPermission = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setMediaStream(stream);
    alert("Camera & mic permission granted ✅");
    setStep("fullscreen"); // Advance to next step
  } catch (err) {
    alert("Camera & mic permission required. Please allow access in your browser settings.");
  }
};