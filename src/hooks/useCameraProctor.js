import { useEffect, useRef } from 'react';
// You must install face-api.js and provide a model loader elsewhere in your app.
// This hook expects a <video> ref and a loaded face-api.js model.

/**
 * Strict camera/face proctoring hook.
 * Handles:
 * - Face presence (one face, no face, multiple faces)
 * - Black/camera block detection
 * - Warning and auto-termination
 * - Proper cleanup
 *
 * @param {boolean} isActive
 * @param {object} videoRef - React ref to <video>
 * @param {function} onWarning (count, reason)
 * @param {function} onTerminate (reason)
 * @param {number} maxNoFaceSec
 * @returns {object} { faceWarnings }
 */
export function useCameraProctor({
  isActive,
  videoRef,
  onWarning,
  onTerminate,
  maxNoFaceSec = 10,
}) {
  const faceWarningsRef = useRef(0);
  const noFaceTimer = useRef(null);
  const lastFaceDetected = useRef(Date.now());

  useEffect(() => {
    if (!isActive || !videoRef.current) return;
    let running = true;
    async function checkFace() {
      if (!window.faceapi || !videoRef.current) return;
      try {
        const detections = await window.faceapi.detectAllFaces(videoRef.current);
        if (!running) return;
        if (!detections || detections.length === 0) {
          // No face
          if (Date.now() - lastFaceDetected.current > maxNoFaceSec * 1000) {
            faceWarningsRef.current += 1;
            onWarning?.(faceWarningsRef.current, 'no_face');
            lastFaceDetected.current = Date.now();
          }
        } else if (detections.length > 1) {
          // Multiple faces
          onTerminate?.('multiple_faces');
        } else {
          // One face
          lastFaceDetected.current = Date.now();
        }
      } catch (e) {
        // Camera block/black screen
        onTerminate?.('camera_blocked');
      }
    }
    noFaceTimer.current = setInterval(checkFace, 1000);
    return () => {
      running = false;
      clearInterval(noFaceTimer.current);
    };
  }, [isActive, videoRef, onWarning, onTerminate, maxNoFaceSec]);

  return { faceWarnings: faceWarningsRef.current };
}
