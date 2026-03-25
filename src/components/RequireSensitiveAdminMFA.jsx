import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const SENSITIVE_MFA_TTL_MS = 10 * 60 * 1000;

const RequireSensitiveAdminMFA = ({ children }) => {
  const { realProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner message="Checking secure access..." />;
  }

  if (realProfile?.role !== 'admin') {
    return <Navigate to="/app" replace />;
  }

  const verifiedAt = Number(sessionStorage.getItem('admin_sensitive_mfa_verified_at') || 0);
  const verifiedUser = sessionStorage.getItem('admin_sensitive_mfa_verified_user');
  const isFresh = verifiedAt > 0 && Date.now() - verifiedAt < SENSITIVE_MFA_TTL_MS;

  if (!isFresh || verifiedUser !== realProfile?.id) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/admin-mfa-verify?scope=sensitive-passwords&next=${next}`} replace />;
  }

  return children;
};

export default RequireSensitiveAdminMFA;
