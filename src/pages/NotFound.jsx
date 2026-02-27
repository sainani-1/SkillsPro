
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NotFound = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleGoHome = () => {
    if (user) {
      navigate('/app', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 px-4 text-center">
      <div className="text-7xl mb-4">404</div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Page not found</h1>
      <p className="text-slate-600 mb-6">The page you are looking for does not exist or the URL is incorrect.</p>
      <button
        onClick={handleGoHome}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Go to Home
      </button>
    </div>
  );
};

export default NotFound;
