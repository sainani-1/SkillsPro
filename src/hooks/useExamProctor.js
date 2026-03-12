import { useEffect, useRef } from "react";
import { isLikelyDevToolsOpen } from "../utils/devtoolsDetection";

export function useExamProctor({
  examPhase,
  videoRef,
  onTerminate,
  onPause,
  onResume,
}) {
  const activeRef = useRef(false);
  const fullscreenCount = useRef(0);
  const noFaceSeconds = useRef(0);
  const fsTimer = useRef(null);
  const faceInterval = useRef(null);

  useEffect(() => {
    activeRef.current = examPhase === "RUNNING";
  }, [examPhase]);

  useEffect(() => {
    if (!activeRef.current) return;

    /* FULLSCREEN */
    function handleFullscreen() {
      if (!activeRef.current) return;

      if (!document.fullscreenElement) {
        fullscreenCount.current++;

        if (fullscreenCount.current > 3) {
          onTerminate("fullscreen_limit");
          return;
        }

        onPause();

        let countdown = 20;

        fsTimer.current = setInterval(() => {
          if (!activeRef.current) {
            clearInterval(fsTimer.current);
            return;
          }

          countdown--;
          if (countdown <= 0) {
            clearInterval(fsTimer.current);
            onTerminate("fullscreen_timeout");
          }
        }, 1000);
      } else {
        clearInterval(fsTimer.current);
        onResume();
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreen);

    /* TAB CHANGE → ACCOUNT BLOCK */
    function handleVisibility() {
      if (!activeRef.current) return;
      if (document.hidden) {
        onTerminate("tab_block_account");
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);

    /* APP SWITCH → ACCOUNT BLOCK */
    function handleBlur() {
      if (!activeRef.current) return;
      onTerminate("app_switch_block_account");
    }

    window.addEventListener("blur", handleBlur);

    /* DEVTOOLS */
    const devInterval = setInterval(() => {
      if (!activeRef.current) return;
      if (isLikelyDevToolsOpen()) {
        onTerminate("devtools_block_account");
      }
    }, 1000);

    /* FACE MONITOR */
    faceInterval.current = setInterval(async () => {
      if (!activeRef.current) return;
      if (!window.faceapi || !videoRef.current) return;

      const detections =
        await window.faceapi.detectAllFaces(videoRef.current);

      if (!detections || detections.length === 0) {
        noFaceSeconds.current++;
        if (noFaceSeconds.current > 10) {
          onTerminate("no_face_block_account");
        }
      } else if (detections.length > 1) {
        onTerminate("multiple_faces_block_account");
      } else {
        noFaceSeconds.current = 0;
      }
    }, 1000);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreen);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      clearInterval(devInterval);
      clearInterval(faceInterval.current);
      clearInterval(fsTimer.current);
    };
  }, [examPhase]);
}
