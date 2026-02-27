import React from 'react';
import { AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';

const AlertModal = ({ show, title, message, type = 'info', onClose }) => {
  if (!show) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={48} className="text-green-600" />;
      case 'error':
        return <AlertTriangle size={48} className="text-red-600" />;
      case 'warning':
        return <AlertCircle size={48} className="text-yellow-600" />;
      default:
        return <Info size={48} className="text-blue-600" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success':
        return {
          border: 'border-green-500',
          bg: 'bg-green-100',
          title: 'text-green-600',
          button: 'bg-green-600 hover:bg-green-700'
        };
      case 'error':
        return {
          border: 'border-red-500',
          bg: 'bg-red-100',
          title: 'text-red-600',
          button: 'bg-red-600 hover:bg-red-700'
        };
      case 'warning':
        return {
          border: 'border-yellow-500',
          bg: 'bg-yellow-100',
          title: 'text-yellow-600',
          button: 'bg-yellow-600 hover:bg-yellow-700'
        };
      default:
        return {
          border: 'border-blue-500',
          bg: 'bg-blue-100',
          title: 'text-blue-600',
          button: 'bg-blue-600 hover:bg-blue-700'
        };
    }
  };

  const styles = getStyles();

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className={`bg-white rounded-2xl p-8 max-w-md mx-4 shadow-2xl border-4 ${styles.border}`}>
        <div className="flex flex-col items-center text-center space-y-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center ${styles.bg}`}>
            {getIcon()}
          </div>
          <h2 className={`text-3xl font-bold ${styles.title}`}>{title}</h2>
          <p className="text-slate-700 text-lg break-words">{message}</p>
          <button 
            onClick={onClose}
            className={`w-full py-3 rounded-lg font-bold text-lg text-white transition-colors ${styles.button}`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
