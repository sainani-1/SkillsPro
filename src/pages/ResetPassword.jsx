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
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${appBaseUrl}/reset-password-confirm`
      });
      if (error) throw error;

      setStatus({
        type: 'success',
        message: `If this email is registered, a reset link has been sent. Continue from ${appBaseUrl}/reset-password-confirm`
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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-8 relative">
      <div className="absolute top-5 right-5 md:top-8 md:right-8 z-10">
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-full shadow-lg flex items-center justify-center overflow-hidden">
          <img
            src="/skillpro-logo.png"
            alt="SkillPro logo"
            className="w-10 h-10 md:w-12 md:h-12 object-contain rounded-full mix-blend-multiply"
          />
        </div>
      </div>
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.1fr,1.2fr] rounded-3xl overflow-hidden border border-slate-700/70 shadow-2xl">
        <aside className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 md:p-10 text-white flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold-400/95 mb-5">
              <Lock size={28} className="text-slate-900" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">Reset Your Password</h1>
            <p className="mt-3 text-slate-300 text-sm md:text-base">
              {isRecoveryMode
                ? 'Recovery session verified. Set a strong new password.'
                : 'Enter your email and we will send a secure password reset link.'}
            </p>
          </div>

          <div className="mt-8 space-y-3 text-sm">
            <div className="flex items-center gap-3 text-slate-200">
              <ShieldCheck size={16} className="text-emerald-400" />
              Secure token-based reset flow
            </div>
            <div className="flex items-center gap-3 text-slate-200">
              <Mail size={16} className="text-blue-300" />
              Link opens in a verified recovery session
            </div>
            <div className="flex items-center gap-3 text-slate-200">
              <KeyRound size={16} className="text-amber-300" />
              Password update signs out old sessions
            </div>
          </div>
        </aside>

        <section className="bg-white/10 backdrop-blur-lg p-7 md:p-10">
          <div className="flex items-center gap-2 mb-6">
            <div className={`h-2 flex-1 rounded-full ${!isRecoveryMode ? 'bg-gold-400' : 'bg-slate-600'}`} />
            <div className={`h-2 flex-1 rounded-full ${isRecoveryMode ? 'bg-gold-400' : 'bg-slate-600'}`} />
          </div>

          {status.message ? (
            <div className={`border rounded-xl p-3 text-sm mb-5 ${statusClass}`}>
              {status.message}
            </div>
          ) : null}

          {!isRecoveryMode ? (
            <form onSubmit={handleSendResetLink} className="space-y-4">
              <label className="block text-sm text-slate-200 font-medium">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-3 py-3 rounded-xl bg-slate-950/70 border border-slate-600 text-white focus:outline-none focus:border-gold-400"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="w-full bg-gold-400 hover:bg-gold-300 text-slate-900 font-extrabold py-3 rounded-xl transition-colors disabled:opacity-60"
              >
                {sending ? 'Sending Reset Link...' : 'Send Reset Link'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <label className="block text-sm text-slate-200 font-medium">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full p-3 pr-11 rounded-xl bg-slate-950/70 border border-slate-600 text-white focus:outline-none focus:border-gold-400"
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
                <p className="text-xs text-slate-300">Password strength: {passwordStrength.label}</p>
              </div>

              <label className="block text-sm text-slate-200 font-medium">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full p-3 pr-11 rounded-xl bg-slate-950/70 border border-slate-600 text-white focus:outline-none focus:border-gold-400"
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
              <p className="text-xs text-slate-300 flex items-center gap-2">
                <KeyRound size={14} />
                Minimum 8+ characters recommended with mixed-case, number and symbol.
              </p>

              <button
                type="submit"
                disabled={updating}
                className="w-full bg-gold-400 hover:bg-gold-300 text-slate-900 font-extrabold py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                {updating ? 'Updating Password...' : 'Set New Password'}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-5 w-full flex items-center justify-center gap-2 text-slate-300 hover:text-white transition"
          >
            <ArrowLeft size={18} />
            Back to Login
          </button>
        </section>
      </div>
    </div>
  );
};

export default ResetPassword;
