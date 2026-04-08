import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { isAdminPasskeyVerifiedForUser } from '../utils/adminPasskey';

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
  const passkeyVerified = isAdminPasskeyVerifiedForUser(profile?.id);
  if ((!mfaVerified || mfaVerifiedUser !== profile?.id) && !passkeyVerified) {
    return <Navigate to="/admin-auth-choice" replace />;
  }

  return children;
};

export default RequireAdminMFA;
