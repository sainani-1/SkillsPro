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
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      // First, sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !signInData?.user) {
        setAlertModal({
          show: true,
          title: 'Login Error',
          message: signInError ? signInError.message : 'No user returned from sign in. Please try again.',
          type: 'error'
        });
        setLoggingIn(false);
        return;
      }

      // Fetch user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, is_disabled')
        .eq('id', signInData.user.id)
        .single();

      if (profileError || !userProfile) {
        // Optionally, create profile if missing
        // await supabase.from('profiles').insert({ id: signInData.user.id, role: 'student', is_disabled: false });
        setAlertModal({
          show: true,
          title: 'Profile Error',
          message: 'User profile not found or could not be loaded. Please contact support or try again.',
          type: 'error'
        });
        setLoggingIn(false);
        return;
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
      </div>
    </div>
  );
};

export default Login;