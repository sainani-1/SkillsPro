import React, { useEffect, useState } from 'react';
import { Mail, ArrowLeft, Lock, CheckCircle2 } from 'lucide-react';
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

  useEffect(() => {
    let mounted = true;

    const checkRecoverySession = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const type = url.searchParams.get('type');
      const hash = window.location.hash || '';

      try {
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }

        const { data } = await supabase.auth.getSession();
        const hasRecoveryType = type === 'recovery' || hash.includes('type=recovery');
        const hasUserSession = !!data?.session?.user;

        if (!mounted) return;
        if (hasRecoveryType && hasUserSession) {
          setIsRecoveryMode(true);
          setStatus({
            type: 'info',
            message: 'Email verified for password reset. Enter your new password below.'
          });
        }
      } catch {
        // keep request mode
      }
    };

    checkRecoverySession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session?.user)) {
        setIsRecoveryMode(true);
        setStatus({
          type: 'info',
          message: 'Recovery session verified. Set your new password now.'
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSendResetLink = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setStatus({ type: 'error', message: 'Please enter your email address.' });
      return;
    }

    setSending(true);
    setStatus({ type: '', message: '' });
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;

      setStatus({
        type: 'success',
        message: 'Reset link sent. Open your email and click the link to set a new password.'
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-nani-dark to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-gold-400 rounded-full flex items-center justify-center mb-4">
            <Lock size={32} className="text-nani-dark" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
          <p className="text-slate-400">
            {isRecoveryMode
              ? 'Verified reset link. Set your new password.'
              : 'Enter your email to receive reset link.'}
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 space-y-5">
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
                className="w-full p-3 rounded-lg bg-slate-950/60 border border-slate-700 text-white focus:outline-none focus:border-gold-400"
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
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full p-3 rounded-lg bg-slate-950/60 border border-slate-700 text-white focus:outline-none focus:border-gold-400"
                required
              />

              <label className="block text-sm text-slate-300 font-medium">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full p-3 rounded-lg bg-slate-950/60 border border-slate-700 text-white focus:outline-none focus:border-gold-400"
                required
              />

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
          <p className="text-xs text-slate-500 text-center mt-4 flex items-center justify-center gap-1">
            <Mail size={14} />
            Only verified email users can complete password change via reset link.
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default ResetPassword;
