import React, { useEffect } from 'react';

const Toast = ({ show, message, type = 'success', duration = 2500, onClose }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  if (!show) return null;

  const color =
    type === 'success' ? 'bg-green-600' :
    type === 'error' ? 'bg-red-600' :
    type === 'warning' ? 'bg-yellow-500' :
    'bg-blue-600';

  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-semibold text-lg ${color} animate-fade-in`}
      style={{ minWidth: 220 }}
    >
      {message}
    </div>
  );
};

export default Toast;
