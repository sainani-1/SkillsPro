import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import AlertModal from '../components/AlertModal';
// npm install otplib
import { authenticator } from 'otplib';

const AdminMFALogin = ({ email }) => {
  const [code, setCode] = useState('');
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });

  const handleMFALogin = async () => {
    // Fetch admin profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('mfa_secret, role')
      .eq('email', email)
      .eq('role', 'admin')
      .single();
    if (error || !profile?.mfa_secret) {
      setAlertModal({ show: true, title: 'Error', message: 'MFA not registered or profile not found.', type: 'error' });
      return;
    }
    // Validate MFA code
    const isValid = authenticator.check(code, profile.mfa_secret);
    if (!isValid) {
      setAlertModal({ show: true, title: 'Invalid Code', message: 'Incorrect MFA code.', type: 'error' });
      return;
    }
    // MFA success, proceed to app
    window.location.href = '/app';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <AlertModal {...alertModal} onClose={() => setAlertModal({ show: false, title: '', message: '', type: 'info' })} />
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-8">Admin MFA Login</h1>
        <input
          type="text"
          className="w-full p-3 border rounded-lg bg-slate-50 mb-4"
          placeholder="Enter MFA code from app"
          value={code}
          onChange={e => setCode(e.target.value)}
        />
        <button className="w-full btn-gold py-3" onClick={handleMFALogin}>Verify MFA</button>
      </div>
    </div>
  );
};

export default AdminMFALogin;
