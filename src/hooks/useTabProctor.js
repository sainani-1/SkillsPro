import { useEffect, useRef } from 'react';

/**
 * Strict tab switch proctoring hook.
 * Handles:
 * - Tab visibilitychange detection
 * - Warning and auto-termination after max allowed
 * - Proper cleanup
 *
 * @param {boolean} isActive
 * @param {function} onViolation (count, reason)
 * @param {function} onTerminate (reason)
 * @param {number} maxSwitches
 * @returns {object} { switchCount }
 */
export function useTabProctor({ isActive, onViolation, onTerminate, maxSwitches = 2 }) {
  const switchCountRef = useRef(0);

  useEffect(() => {
    if (!isActive) return;
    function handleVisibility() {
      if (document.hidden) {
        switchCountRef.current += 1;
        onViolation?.(switchCountRef.current, 'tab');
        if (switchCountRef.current > maxSwitches) {
          onTerminate?.('tab_switch_limit');
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isActive, onViolation, onTerminate, maxSwitches]);

  return { switchCount: switchCountRef.current };
}
