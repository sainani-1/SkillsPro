import { useEffect, useRef } from 'react';

/**
 * Strict fullscreen proctoring hook for government-level exam monitoring.
 * Handles:
 * - Fullscreen enforcement
 * - Exit detection, warning, countdown, and auto-termination
 * - Max allowed exits
 * - Proper cleanup
 *
 * @param {boolean} isActive - Whether exam is active
 * @param {function} onViolation - Called with (count, reason) on violation
 * @param {function} onTerminate - Called when termination condition met
 * @param {function} onPause - Called when exam should pause
 * @param {function} onResume - Called when exam should resume
 * @param {number} maxExits - Max allowed fullscreen exits (default 3)
 * @param {number} countdownSec - Countdown seconds before auto-terminate (default 20)
 * @returns {object} { exitCount, isPaused, countdown, reEnterFullscreen }
 */
export function useFullscreenProctor({
  isActive,
  onViolation,
  onTerminate,
  onPause,
  onResume,
  maxExits = 3,
  countdownSec = 20,
}) {
  const exitCountRef = useRef(0);
  const countdownRef = useRef(countdownSec);
  const timerRef = useRef(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!isActive) return;
    function handleFullscreenChange() {
      if (!document.fullscreenElement) {
        exitCountRef.current += 1;
        onViolation?.(exitCountRef.current, 'fullscreen');
        onPause?.();
        pausedRef.current = true;
        countdownRef.current = countdownSec;
        timerRef.current = setInterval(() => {
          countdownRef.current -= 1;
          if (countdownRef.current <= 0) {
            clearInterval(timerRef.current);
            onTerminate?.('fullscreen_timeout');
          }
        }, 1000);
        if (exitCountRef.current > maxExits) {
          clearInterval(timerRef.current);
          onTerminate?.('fullscreen_exit_limit');
        }
      } else {
        if (pausedRef.current) {
          onResume?.();
          pausedRef.current = false;
        }
        clearInterval(timerRef.current);
        countdownRef.current = countdownSec;
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      clearInterval(timerRef.current);
    };
  }, [isActive, onViolation, onTerminate, onPause, onResume, maxExits, countdownSec]);

  // Expose re-enter fullscreen helper
  const reEnterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {}
  };

  return {
    exitCount: exitCountRef.current,
    isPaused: pausedRef.current,
    countdown: countdownRef.current,
    reEnterFullscreen,
  };
}
