import { useEffect, useRef } from 'react';

/**
 * Strict window blur/app switch proctoring hook.
 * Handles:
 * - Blur event detection
 * - Warning and auto-termination after max allowed
 * - Proper cleanup
 *
 * @param {boolean} isActive
 * @param {function} onViolation (count, reason)
 * @param {function} onTerminate (reason)
 * @param {number} maxBlurs
 * @returns {object} { blurCount }
 */
export function useBlurProctor({ isActive, onViolation, onTerminate, maxBlurs = 2 }) {
  const blurCountRef = useRef(0);

  useEffect(() => {
    if (!isActive) return;
    function handleBlur() {
      blurCountRef.current += 1;
      onViolation?.(blurCountRef.current, 'blur');
      if (blurCountRef.current > maxBlurs) {
        onTerminate?.('blur_limit');
      }
    }
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('blur', handleBlur);
    };
  }, [isActive, onViolation, onTerminate, maxBlurs]);

  return { blurCount: blurCountRef.current };
}
