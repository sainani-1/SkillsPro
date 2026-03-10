import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const RequireAdminMFA = ({ children }) => {
  const { profile, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  if (profile?.role !== 'admin') {
    return children;
  }

  const mfaVerified = sessionStorage.getItem('admin_mfa_verified') === 'true';
  const mfaVerifiedUser = sessionStorage.getItem('admin_mfa_verified_user');
  if (!mfaVerified || mfaVerifiedUser !== profile?.id) {
    return <Navigate to="/admin-mfa-verify" replace />;
  }

  return children;
};

export default RequireAdminMFA;
