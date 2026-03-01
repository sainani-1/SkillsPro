import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import AlertModal from '../components/AlertModal';
import Toast from '../components/Toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });
  const [loggingIn, setLoggingIn] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      // First, sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !signInData?.user) {
        const signInMessage = signInError?.message || 'No user returned from sign in. Please try again.';
        setAlertModal({
          show: true,
          title: 'Login Error',
          message: signInMessage.includes('Email not confirmed')
            ? 'Email not verified. Please verify your email first, then login.'
            : signInMessage,
          type: 'error'
        });
        setLoggingIn(false);
        return;
      }

      const isEmailVerified = !!(signInData.user.email_confirmed_at || signInData.user.confirmed_at);
      if (!isEmailVerified) {
        await supabase.auth.signOut();
        setAlertModal({
          show: true,
          title: 'Email Not Verified',
          message: 'Please verify your email before logging in. Use "Resend verification email" if needed.',
          type: 'warning'
        });
        setLoggingIn(false);
        return;
      }

      // Fetch user profile
      let { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, is_disabled')
        .eq('id', signInData.user.id)
        .single();

      if (profileError || !userProfile) {
        // Create profile on first verified login using auth metadata
        const meta = signInData.user.user_metadata || {};
        const { error: createProfileError } = await supabase.from('profiles').upsert({
          id: signInData.user.id,
          auth_user_id: signInData.user.id,
          email: signInData.user.email || email.trim(),
          full_name: meta.full_name || 'Student',
          phone: meta.phone || null,
          avatar_url: meta.avatar_url || null,
          education_level: meta.education_level || null,
          study_stream: meta.study_stream || null,
          diploma_certificate: meta.diploma_certificate || null,
          core_subject: meta.core_subject || null,
          role: meta.role || 'student',
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

        if (createProfileError) {
          setAlertModal({
            show: true,
            title: 'Profile Error',
            message: createProfileError.message || 'Could not create user profile.',
            type: 'error'
          });
          setLoggingIn(false);
          return;
        }

        const profileFetchRetry = await supabase
          .from('profiles')
          .select('id, role, is_disabled')
          .eq('id', signInData.user.id)
          .single();
        userProfile = profileFetchRetry.data;
        profileError = profileFetchRetry.error;

        if (profileError || !userProfile) {
          setAlertModal({
            show: true,
            title: 'Profile Error',
            message: 'User profile not found or could not be loaded. Please contact support or try again.',
            type: 'error'
          });
          setLoggingIn(false);
          return;
        }
      }

      // Check if account is disabled
      if (userProfile.is_disabled) {
        await supabase.auth.signOut();
        setAlertModal({
          show: true,
          title: 'Account Disabled',
          message: 'Your account has been disabled by an administrator. Please contact support.',
          type: 'error'
        });
        setLoggingIn(false);
        return;
      }

      // Check for admin role and MFA
      if (userProfile.role === 'admin') {
        // Check if MFA is enabled for admin
        const { data: factors, error: mfaError } = await supabase.auth.mfa.listFactors();
        if (mfaError) {
          setAlertModal({
            show: true,
            title: 'MFA Error',
            message: 'Could not check MFA status. Please contact support.',
            type: 'error'
          });
          setLoggingIn(false);
          return;
        }
        const hasMFA = factors?.totp && factors.totp.length > 0;
        if (!hasMFA) {
          setLoggingIn(false);
          navigate('/admin-mfa-setup');
          return;
        }
        setLoggingIn(false);
        setToast({ show: true, message: 'Logged in successfully!', type: 'success' });
        navigate('/admin-mfa-verify');
        return;
      }

      // Account is active, proceed to app
      setLoggingIn(false);
      setToast({ show: true, message: 'Logged in successfully!', type: 'success' });
      navigate('/app');
    } catch (error) {
      console.error('Error during login:', error);
      setAlertModal({
        show: true,
        title: 'Error',
        message: 'Failed to login. Please try again.',
        type: 'error'
      });
      setLoggingIn(false);
      await supabase.auth.signOut();
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setAlertModal({
        show: true,
        title: 'Email Required',
        message: 'Enter your email first, then click resend verification.',
        type: 'warning'
      });
      return;
    }

    setResendingVerification(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
      });

      if (error) throw error;

      setAlertModal({
        show: true,
        title: 'Verification Sent',
        message: 'Verification email sent. Please check inbox/spam and verify before login.',
        type: 'success'
      });
    } catch (error) {
      setAlertModal({
        show: true,
        title: 'Resend Failed',
        message: error.message || 'Unable to resend verification email.',
        type: 'error'
      });
    } finally {
      setResendingVerification(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ show: false, message: '', type: 'success' })}
      />
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
        <AlertModal
          show={alertModal.show}
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => setAlertModal({ show: false, title: '', message: '', type: 'info' })}
        />
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full border rounded px-3 py-2"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full border rounded px-3 py-2"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="w-full btn-gold py-3" disabled={loggingIn}>
            {loggingIn ? 'Logging in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-center mt-6 text-sm">
          New here? <Link to="/register" className="text-blue-600 font-bold">Create Account</Link>
        </p>
        <p className="text-center mt-2 text-sm">
          Forgot password? <Link to="/reset-password" className="text-gold-600 font-bold">Reset here</Link>
        </p>
        <p className="text-center mt-2 text-sm text-slate-600">
          Email not verified?{' '}
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resendingVerification}
            className="text-blue-600 font-bold hover:underline disabled:opacity-60"
          >
            {resendingVerification ? 'Sending...' : 'Resend verification email'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
