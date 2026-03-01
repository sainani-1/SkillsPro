import React, { useEffect, useState } from 'react';
import { Mail, ArrowLeft, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const DEFAULT_SUPPORT_EMAIL = 'support@skillpro.com';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [supportEmail, setSupportEmail] = useState(DEFAULT_SUPPORT_EMAIL);
  const [step, setStep] = useState('steps');

  useEffect(() => {
    const loadSupportEmail = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'password_reset_support_email')
          .maybeSingle();
        if (data?.value) setSupportEmail(data.value);
      } catch {
        // keep default
      }
    };
    loadSupportEmail();
  }, []);

  const openMail = () => {
    const subject = encodeURIComponent('Password Reset Request');
    const body = encodeURIComponent(
      'Hello Admin,%0D%0A%0D%0AI request password reset for my account.%0D%0A%0D%0AThank you.'
    );
    window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
    setStep('sent');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-nani-dark to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-gold-400 rounded-full flex items-center justify-center mb-4">
            <Lock size={32} className="text-nani-dark" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
          <p className="text-slate-400">
            {step === 'steps'
              ? 'Follow these reset password steps'
              : 'Reset request submitted'}
          </p>
        </div>

        {step === 'steps' ? (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 space-y-6">
            <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg space-y-2">
              <p className="font-semibold text-slate-300 text-sm">Reset Password Steps</p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
                <li>
                  Send Mail To{' '}
                  <span className="text-gold-400 font-semibold">{supportEmail}</span>
                </li>
                <li>
                  Check Mail For New Password. New password will be sent to you within 48 hours through mail.
                </li>
              </ol>
            </div>

            <button
              type="button"
              onClick={openMail}
              className="w-full bg-gold-400 hover:bg-gold-300 text-nani-dark font-bold py-3 rounded-lg transition-colors"
            >
              Send Mail
            </button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white transition"
            >
              <ArrowLeft size={18} />
              Back to Login
            </button>
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                <Mail size={32} className="text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Check Your Email</h2>
              <p className="text-slate-400 text-sm">
                Your request was sent to <strong className="text-gold-400">{supportEmail}</strong>
              </p>
              <p className="text-slate-500 text-xs mt-3">
                New password will be sent to your mail within 48 hours.
              </p>
            </div>

            <button
              onClick={() => setStep('steps')}
              className="w-full bg-gold-400 hover:bg-gold-300 text-nani-dark font-bold py-3 rounded-lg transition-colors"
            >
              Back to Steps
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
      </div>
    </div>
  );
};

export default ResetPassword;

