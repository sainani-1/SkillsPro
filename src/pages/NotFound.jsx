
import React from 'react';

const NotFound = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 px-4 text-center">
      <div className="text-7xl mb-4">404</div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Page not found</h1>
      <p className="text-slate-600 mb-6">The page you are looking for does not exist or the URL is incorrect.</p>
      <p className="text-sm text-slate-500">
        Please check the URL or go back.
      </p>
    </div>
  );
};

export default NotFound;
