import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import AlertModal from '../components/AlertModal';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // First, sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setAlertModal({
          show: true,
          title: 'Login Error',
          message: signInError.message,
          type: 'error'
        });
        return;
      }

      // Fetch user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, is_disabled')
        .eq('id', signInData.user.id)
        .single();
      if (profileError) throw profileError;

      // Check if account is disabled
      if (userProfile.is_disabled) {
        await supabase.auth.signOut();
        setAlertModal({
          show: true,
          title: 'Account Disabled',
          message: 'Your account has been disabled by an administrator. Please contact support.',
          type: 'error'
        });
        return;
      }

      // Check for admin role and MFA
      if (userProfile.role === 'admin') {
        // Check if MFA is enabled for admin
        const { data: factors, error: mfaError } = await supabase.auth.mfa.listFactors();
        if (mfaError) throw mfaError;
        const hasMFA = factors?.totp && factors.totp.length > 0;
        if (!hasMFA) {
          navigate('/admin-mfa-setup');
          return;
        }
        navigate('/admin-mfa-verify');
        return;
      }

      // Account is active, proceed to app
      navigate('/app');
    } catch (error) {
      console.error('Error during login:', error);
      setAlertModal({
        show: true,
        title: 'Error',
        message: 'Failed to login. Please try again.',
        type: 'error'
      });
      await supabase.auth.signOut();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
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
          <button type="submit" className="w-full btn-gold py-3">Sign In</button>
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