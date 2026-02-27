import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Lock, Mail, ArrowLeft, CheckCircle, KeyRound } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('email'); // email, check-email, new-password, success
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [hasToken, setHasToken] = useState(false);

  const [searchParams] = useSearchParams();

  // Check if user returned from password reset email link
  useEffect(() => {
    const checkResetToken = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = searchParams.get('type') || hashParams.get('type');
        const codeParam = searchParams.get('code') || hashParams.get('code');
        const hashAccessToken = hashParams.get('access_token');
        const hashRefreshToken = hashParams.get('refresh_token');

        // Supabase email links may include either a code param (PKCE) or access tokens in the hash.
        if (codeParam) {
          const { data, error } = await supabase.auth.exchangeCodeForSession({ code: codeParam });
          if (error) throw error;
          if (data?.session) {
            const confirmed = !!(data.session.user.email_confirmed_at || data.session.user.confirmed_at);
            if (!confirmed) {
              setError('Please verify your email before resetting your password. We just resent the verification link.');
              await supabase.auth.resend({ type: 'signup', email: data.session.user.email });
              await supabase.auth.signOut();
              setStep('email');
              return;
            }
            setHasToken(true);
            setStep('new-password');
            return;
          }
        }

        // Fallback: check hash tokens (access_token/refresh_token) if present
        const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');

        // If tokens exist, trust them regardless of type and set session
        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
          if (data?.session) {
            const confirmed = !!(data.session.user.email_confirmed_at || data.session.user.confirmed_at);
            if (!confirmed) {
              setError('Please verify your email before resetting your password. We just resent the verification link.');
              await supabase.auth.resend({ type: 'signup', email: data.session.user.email });
              await supabase.auth.signOut();
              setStep('email');
              return;
            }
            setHasToken(true);
            setStep('new-password');
            return;
          }
        }

        // Final fallback: if a recovery session already exists
        if (type === 'recovery' || hashAccessToken || hashRefreshToken) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && session.user) {
            const confirmed = !!(session.user.email_confirmed_at || session.user.confirmed_at);
            if (!confirmed) {
              setError('Please verify your email before resetting your password. We just resent the verification link.');
              await supabase.auth.resend({ type: 'signup', email: session.user.email });
              await supabase.auth.signOut();
              setStep('email');
              return;
            }
            setHasToken(true);
            setStep('new-password');
          }
        }
      } catch (err) {
        console.log('No reset token in session', err);
      }
    };
    checkResetToken();
  }, [searchParams]);
  const handleSendReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Try sending password reset email directly
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password-confirm`,
      });
      if (err) {
        // If error is user not found, show custom message
        if (err.message && err.message.toLowerCase().includes('user not found')) {
          setError('No account found with this email address');
        } else {
          setError(err.message || 'Failed to send reset email');
        }
        setLoading(false);
        return;
      }
      setMessage('Password reset link sent! Check your email and click the link to continue.');
      setStep('check-email');
    } catch (err) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    // Prevent double submission
    if (loading) return;
    
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { error: err } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (err) throw err;

      setMessage('Password updated successfully!');
      setStep('success');
      setTimeout(() => {
        supabase.auth.signOut();
        navigate('/login');
      }, 2500);
    } catch (err) {
      setError(err.message || 'Failed to reset password');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-nani-dark to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-gold-400 rounded-full flex items-center justify-center mb-4">
            <Lock size={32} className="text-nani-dark" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
          <p className="text-slate-400">
            {step === 'email' && 'Enter your email to receive a reset link'}
            {step === 'check-email' && 'Check your email for the reset link'}
            {step === 'new-password' && 'Create a new password'}
            {step === 'success' && 'Password reset successfully!'}
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-600 text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-4 bg-green-900/30 border border-green-600 text-green-400 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle size={18} />
            {message}
          </div>
        )}

        {/* Step 1: Enter Email */}
        {step === 'email' && (
          <form onSubmit={handleSendReset} className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 outline-none transition"
                  required
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                We'll send a password reset link to this email address
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gold-400 hover:bg-gold-300 disabled:opacity-50 text-nani-dark font-bold py-3 rounded-lg transition-colors"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white transition"
            >
              <ArrowLeft size={18} />
              Back to Login
            </button>
          </form>
        )}

        {/* Step 2: Check Email */}
        {step === 'check-email' && (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                <Mail size={32} className="text-blue-400" />
              </div>

              <h2 className="text-xl font-bold text-white mb-2">Check Your Email</h2>
              <p className="text-slate-400 text-sm">
                We've sent a password reset link to <strong className="text-gold-400">{email}</strong>
              </p>
              <p className="text-slate-500 text-xs mt-3">
                Click the link in the email to reset your password. The link will work for 24 hours.
              </p>
            </div>

            <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg space-y-2">
              <p className="font-semibold text-slate-300 text-sm">What happens next:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-slate-400">
                <li>Check your email inbox</li>
                <li>Click the reset password link</li>
                <li>Create your new password on this website</li>
                <li>You're done! Log in with your new password</li>
              </ol>
            </div>

            <div className="p-4 bg-amber-900/30 border border-amber-600 rounded-lg text-left text-sm text-amber-300">
              <p className="font-semibold mb-2">💡 Tip:</p>
              <p className="text-xs">
                Check your spam or junk folder if you don't see the email in a few minutes.
              </p>
            </div>

            <button
              onClick={() => {
                setEmail('');
                setStep('email');
                setMessage('');
              }}
              className="w-full bg-gold-400 hover:bg-gold-300 text-nani-dark font-bold py-3 rounded-lg transition-colors"
            >
              Try Another Email
            </button>

            <button
              onClick={() => navigate('/login')}
              className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white transition"
            >
              <ArrowLeft size={18} />
              Back to Login
            </button>
          </div>
        )}

        {/* Step 3: New Password */}
        {step === 'new-password' && (
          <form onSubmit={handleResetPassword} className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 space-y-6">
            <div className="p-4 bg-green-900/30 border border-green-600 rounded-lg flex items-center gap-3 text-green-400 text-sm">
              <CheckCircle size={20} />
              <span>Email verified! Now create your new password.</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                New Password
              </label>
              <div className="relative">
                <KeyRound size={18} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 outline-none transition"
                  required
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                At least 6 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <KeyRound size={18} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 outline-none transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gold-400 hover:bg-gold-300 disabled:opacity-50 text-nani-dark font-bold py-3 rounded-lg transition-colors"
            >
              {loading ? 'Updating...' : 'Reset Password'}
            </button>
          </form>
        )}

        {/* Step 4: Success */}
        {step === 'success' && (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 space-y-6 text-center">
            <div className="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
              <CheckCircle size={48} className="text-green-400" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Password Reset Successfully!</h2>
              <p className="text-slate-400 text-sm">
                Your password has been updated. Redirecting you to login page...
              </p>
            </div>

            <button
              onClick={() => navigate('/login')}
              className="w-full bg-gold-400 hover:bg-gold-300 text-nani-dark font-bold py-3 rounded-lg transition-colors"
            >
              Go to Login
            </button>
          </div>
        )}

        {/* Footer */}
        {step !== 'success' && (
          <div className="text-center mt-6">
            <p className="text-slate-400 text-sm">
              Remember your password?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-gold-400 hover:text-gold-300 font-semibold"
              >
                Log in
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
