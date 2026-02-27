import { useEffect, useRef } from 'react';

/**
 * Strict DevTools proctoring hook.
 * Handles:
 * - DevTools open detection (window size trick)
 * - Instant auto-termination
 * - Proper cleanup
 *
 * @param {boolean} isActive
 * @param {function} onTerminate (reason)
 */
export function useDevToolsProctor({ isActive, onTerminate }) {
  const checkInterval = useRef(null);

  useEffect(() => {
    if (!isActive) return;
    function detectDevTools() {
      const threshold = 160;
      if (
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
      ) {
        onTerminate?.('devtools_open');
      }
    }
    checkInterval.current = setInterval(detectDevTools, 1000);
    return () => {
      clearInterval(checkInterval.current);
    };
  }, [isActive, onTerminate]);
}
