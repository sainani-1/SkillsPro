import React, { useEffect, useRef, useState } from 'react';

const Toast = ({ show, message, type = 'success', duration = 5000, onClose, pauseOnHover = true }) => {
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const remainingRef = useRef(duration);
  const [remainingMs, setRemainingMs] = useState(duration);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = (ms) => {
    clearTimer();
    if (!show) return;
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onClose();
    }, Math.max(0, ms));
  };

  useEffect(() => {
    if (show) {
      setRemainingMs(duration);
      remainingRef.current = duration;
      startTimer(duration);
    } else {
      clearTimer();
    }
    return () => clearTimer();
  }, [show, duration, onClose]);

  if (!show) return null;

  const color =
    type === 'success' ? 'bg-green-600' :
    type === 'error' ? 'bg-red-600' :
    type === 'warning' ? 'bg-yellow-500' :
    'bg-blue-600';

  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-semibold text-lg ${color} animate-fade-in`}
      style={{ minWidth: 220 }}
      onMouseEnter={() => {
        if (!pauseOnHover) return;
        const elapsed = Date.now() - startedAtRef.current;
        const nextRemaining = Math.max(0, remainingRef.current - elapsed);
        remainingRef.current = nextRemaining;
        setRemainingMs(nextRemaining);
        clearTimer();
      }}
      onMouseLeave={() => {
        if (!pauseOnHover) return;
        startTimer(remainingRef.current);
      }}
    >
      {message}
    </div>
  );
};

export default Toast;
