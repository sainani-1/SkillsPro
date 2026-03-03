import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, ArrowLeft, Lock, CheckCircle2, Eye, EyeOff, ShieldCheck, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const recoveryContextRef = useRef(false);

  const appBaseUrl = useMemo(() => {
    const configured = (import.meta.env.VITE_PUBLIC_APP_URL || '').trim();
    const fallback = window.location.origin;
    return (configured || fallback).replace(/\/+$/, '');
  }, []);

  const passwordStrength = useMemo(() => {
    const value = newPassword || '';
    let score = 0;
    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value)) score += 1;
    if (/[a-z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    if (score <= 2) return { label: 'Weak', color: 'bg-red-500', width: 'w-1/3' };
    if (score <= 4) return { label: 'Medium', color: 'bg-amber-500', width: 'w-2/3' };
    return { label: 'Strong', color: 'bg-emerald-500', width: 'w-full' };
  }, [newPassword]);

  useEffect(() => {
    let mounted = true;

    const checkRecoverySession = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const type = url.searchParams.get('type');
      const hash = window.location.hash || '';
      const hasRecoveryType = type === 'recovery' || hash.includes('type=recovery');
      const hasRecoveryIndicators =
        hasRecoveryType || !!code || hash.includes('access_token=') || hash.includes('token=');
      recoveryContextRef.current = hasRecoveryIndicators;

      try {
        if (code && hasRecoveryType) {
          await supabase.auth.exchangeCodeForSession(code);
        }

        const { data } = await supabase.auth.getSession();
        const hasUserSession = !!data?.session?.user;

        if (!mounted) return;
        if (hasRecoveryIndicators && hasUserSession) {
          setIsRecoveryMode(true);
          setStatus({
            type: 'info',
            message: 'Email verified for password reset. Enter your new password below.'
          });
          // Clean URL params/hash so reopening /reset-password does not keep recovery context.
          window.history.replaceState({}, document.title, '/reset-password');
          recoveryContextRef.current = false;
        } else {
          setIsRecoveryMode(false);
          recoveryContextRef.current = false;
          setStatus((prev) =>
            prev.type === 'info'
              ? { type: '', message: '' }
              : prev
          );
        }
      } catch {
        // keep request mode
        if (!mounted) return;
        setIsRecoveryMode(false);
      }
    };

    checkRecoverySession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if ((event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && recoveryContextRef.current)) && session?.user) {
        setIsRecoveryMode(true);
        setStatus({
          type: 'info',
          message: 'Recovery session verified. Set your new password now.'
        });
        window.history.replaceState({}, document.title, '/reset-password');
        recoveryContextRef.current = false;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSendResetLink = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setStatus({ type: 'error', message: 'Please enter your email address.' });
      return;
    }

    setSending(true);
    setStatus({ type: '', message: '' });
    try {
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!existingProfile?.id) {
        setStatus({ type: 'error', message: 'Email not registered. Register first.' });
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${appBaseUrl}/reset-password-confirm`
      });
      if (error) throw error;

      setStatus({
        type: 'success',
        message: `Reset link sent. Open your email and continue from ${appBaseUrl}/reset-password-confirm`
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to send reset link.' });
    } finally {
      setSending(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      setStatus({ type: 'error', message: 'Please enter and confirm your new password.' });
      return;
    }
    if (newPassword.length < 6) {
      setStatus({ type: 'error', message: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    setUpdating(true);
    setStatus({ type: '', message: '' });
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setStatus({ type: 'success', message: 'Password updated successfully. Redirecting to login...' });
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/login');
      }, 1200);
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to update password.' });
    } finally {
      setUpdating(false);
    }
  };

  const statusClass =
    status.type === 'error'
      ? 'bg-red-500/15 border-red-400/40 text-red-200'
      : status.type === 'success'
      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
      : 'bg-blue-500/15 border-blue-400/40 text-blue-200';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-7">
          <div className="w-16 h-16 mx-auto bg-gold-400 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Lock size={32} className="text-nani-dark" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
          <p className="text-slate-300">
            {isRecoveryMode
              ? 'Verified reset link. Set your new password.'
              : 'Enter your email to receive reset link.'}
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl space-y-5">
          {status.message ? (
            <div className={`border rounded-lg p-3 text-sm ${statusClass}`}>
              {status.message}
            </div>
          ) : null}

          {!isRecoveryMode ? (
            <form onSubmit={handleSendResetLink} className="space-y-4">
              <label className="block text-sm text-slate-300 font-medium">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your registered email"
                className="w-full p-3 rounded-lg bg-slate-950/70 border border-slate-600 text-white focus:outline-none focus:border-gold-400"
                required
              />
              <button
                type="submit"
                disabled={sending}
                className="w-full bg-gold-400 hover:bg-gold-300 text-nani-dark font-bold py-3 rounded-lg transition-colors disabled:opacity-60"
              >
                {sending ? 'Sending reset link...' : 'Send Reset Link'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <label className="block text-sm text-slate-300 font-medium">New password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full p-3 pr-11 rounded-lg bg-slate-950/70 border border-slate-600 text-white focus:outline-none focus:border-gold-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  aria-label="Toggle new password visibility"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="space-y-1">
                <div className="h-2 rounded bg-slate-700 overflow-hidden">
                  <div className={`h-2 ${passwordStrength.color} ${passwordStrength.width} transition-all`} />
                </div>
                <p className="text-xs text-slate-300">Strength: {passwordStrength.label}</p>
              </div>

              <label className="block text-sm text-slate-300 font-medium">Confirm new password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full p-3 pr-11 rounded-lg bg-slate-950/70 border border-slate-600 text-white focus:outline-none focus:border-gold-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <KeyRound size={14} />
                Use at least 8 characters with upper/lowercase, number and symbol.
              </div>

              <button
                type="submit"
                disabled={updating}
                className="w-full bg-gold-400 hover:bg-gold-300 text-nani-dark font-bold py-3 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                {updating ? 'Updating password...' : 'Set New Password'}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft size={18} />
            Back to Login
          </button>
        </div>

        {!isRecoveryMode ? (
          <p className="text-xs text-slate-400 text-center mt-4 flex items-center justify-center gap-1">
            <ShieldCheck size={14} />
            Only verified email users can complete password change via reset link.
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default ResetPassword;
