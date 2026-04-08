import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import Toast from '../components/Toast';
import AlertModal from '../components/AlertModal';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  clearAdminVerificationState,
  createAdminPasskey,
  hasStoredAdminPasskey,
  isAdminPasskeyVerifiedForUser,
  isPasskeySupported,
  verifyAdminPasskey,
} from '../utils/adminPasskey';

const AdminAuthChoice = () => {
  const PASSKEY_CONFIRM_DELAY_MS = 60 * 1000;
  const navigate = useNavigate();
  const { user, profile, loading, signOut } = useAuth();
  const [checkingFactors, setCheckingFactors] = useState(true);
  const [hasMfa, setHasMfa] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [passkeyStep, setPasskeyStep] = useState('idle');
  const [mfaCode, setMfaCode] = useState(['', '', '', '', '', '']);
  const [waitRemaining, setWaitRemaining] = useState(PASSKEY_CONFIRM_DELAY_MS);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'error' });
  const mfaInputRefs = useRef([]);

  const supportsPasskeys = isPasskeySupported();
  const hasPasskey = hasStoredAdminPasskey(user?.id);
  const mfaCodeStr = mfaCode.join('');
  const waitSeconds = Math.ceil(waitRemaining / 1000);

  useEffect(() => {
    clearAdminVerificationState();
  }, []);

  useEffect(() => {
    let active = true;

    const loadFactors = async () => {
      if (!user?.id || profile?.role !== 'admin') {
        if (active) setCheckingFactors(false);
        return;
      }

      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        if (!active) return;
        setHasMfa((data?.totp || []).length > 0);
      } catch (error) {
        if (!active) return;
        setAlert({
          show: true,
          title: 'Verification Check Failed',
          message: error.message || 'Unable to load admin verification options.',
          type: 'error',
        });
      } finally {
        if (active) setCheckingFactors(false);
      }
    };

    loadFactors();
    return () => {
      active = false;
    };
  }, [user?.id, profile?.role]);

  useEffect(() => {
    if (user?.id && profile?.role === 'admin' && isAdminPasskeyVerifiedForUser(user.id)) {
      navigate('/app', { replace: true });
    }
  }, [navigate, profile?.role, user?.id]);

  useEffect(() => {
    if (passkeyStep !== 'wait') return undefined;

    setWaitRemaining(PASSKEY_CONFIRM_DELAY_MS);
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, PASSKEY_CONFIRM_DELAY_MS - (Date.now() - startedAt));
      setWaitRemaining(remaining);
      if (remaining <= 0) {
        window.clearInterval(timer);
        setPasskeyStep('mfa2');
        setMfaCode(['', '', '', '', '', '']);
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [passkeyStep]);

  const resetPasskeyEnrollment = () => {
    setPasskeyStep('idle');
    setMfaCode(['', '', '', '', '', '']);
    setWaitRemaining(PASSKEY_CONFIRM_DELAY_MS);
  };

  const focusFirstMfaDigit = () => {
    requestAnimationFrame(() => {
      const first = mfaInputRefs.current[0];
      if (first) {
        first.focus();
        first.select();
      }
    });
  };

  const resetMfaCode = () => {
    setMfaCode(['', '', '', '', '', '']);
    focusFirstMfaDigit();
  };

  const handleMfaChange = (value, index) => {
    const digit = value.replace(/\D/g, '').slice(0, 1);
    if (!digit) return;

    const next = [...mfaCode];
    next[index] = digit;
    setMfaCode(next);
    if (index < 5) {
      mfaInputRefs.current[index + 1]?.focus();
    }
  };

  const handleMfaKeyDown = (event, index) => {
    if (event.key !== 'Backspace') return;

    if (mfaCode[index]) {
      const next = [...mfaCode];
      next[index] = '';
      setMfaCode(next);
      return;
    }

    if (index > 0) {
      mfaInputRefs.current[index - 1]?.focus();
      const next = [...mfaCode];
      next[index - 1] = '';
      setMfaCode(next);
    }
  };

  const verifyCurrentMfaCode = async (codeValue) => {
    const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
    if (factorError) throw factorError;
    if (!(factors?.totp || []).length) {
      throw new Error('You must register MFA before creating a passkey.');
    }

    const factorId = factors.totp[0].id;
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) throw challengeError;

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: codeValue,
    });
    if (verifyError) {
      throw new Error('Invalid MFA code. Try again.');
    }
  };

  const continueWithMfa = () => {
    if (!hasMfa) {
      navigate('/admin-mfa-setup', { replace: true });
      return;
    }
    navigate('/admin-mfa-verify', { replace: true });
  };

  const handlePasskey = async () => {
    if (!user?.id) return;

    try {
      setBusyAction('passkey');
      if (hasPasskey) {
        await verifyAdminPasskey({ userId: user.id });
        setToast({ show: true, message: 'Passkey verified. Redirecting...', type: 'success' });
      } else {
        if (!hasMfa) {
          navigate('/admin-mfa-setup', { replace: true });
          return;
        }
        setPasskeyStep('mfa1');
        setMfaCode(['', '', '', '', '', '']);
        setToast({
          show: true,
          message: 'Complete MFA once, wait 1 minute, then complete MFA again to create a passkey.',
          type: 'success',
        });
        setTimeout(focusFirstMfaDigit, 50);
        return;
      }
      setTimeout(() => navigate('/app', { replace: true }), 700);
    } catch (error) {
      setAlert({
        show: true,
        title: 'Passkey Unavailable',
        message: error.message || 'Unable to use passkey on this device. You can continue with MFA instead.',
        type: 'warning',
      });
    } finally {
      setBusyAction('');
    }
  };

  const handlePasskeyMfaConfirm = async () => {
    if (!user?.id || (passkeyStep !== 'mfa1' && passkeyStep !== 'mfa2')) return;

    try {
      setBusyAction(passkeyStep);
      await verifyCurrentMfaCode(mfaCodeStr);

      if (passkeyStep === 'mfa1') {
        setToast({
          show: true,
          message: 'First MFA check passed. Wait 1 minute, then verify again.',
          type: 'success',
        });
        setPasskeyStep('wait');
        setMfaCode(['', '', '', '', '', '']);
      } else {
        await createAdminPasskey({
          userId: user.id,
          email: user.email,
          displayName: profile?.full_name || 'Admin',
        });
        resetPasskeyEnrollment();
        setToast({ show: true, message: 'Passkey created. Redirecting...', type: 'success' });
        setTimeout(() => navigate('/app', { replace: true }), 700);
      }
    } catch (error) {
      setAlert({
        show: true,
        title: 'MFA Verification Failed',
        message: error.message || 'Unable to verify the MFA code.',
        type: 'warning',
      });
      resetMfaCode();
    } finally {
      setBusyAction('');
    }
  };

  if (loading || checkingFactors) {
    return <LoadingSpinner message="Preparing admin verification..." />;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (profile?.role !== 'admin') return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.16),_transparent_28%),linear-gradient(180deg,_#eff6ff_0%,_#dbeafe_46%,_#bfdbfe_100%)] px-4 py-8">
      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />
      <AlertModal show={alert.show} title={alert.title} message={alert.message} type={alert.type} onClose={() => setAlert((prev) => ({ ...prev, show: false }))} />

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_1.02fr]">
          <div className="hidden rounded-[2rem] border border-blue-200/60 bg-slate-950 px-8 py-10 text-white shadow-[0_30px_80px_rgba(30,41,59,0.28)] lg:block">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400/15 text-cyan-300">
              <ShieldCheck size={30} />
            </div>
            <h1 className="mt-8 text-4xl font-black tracking-tight">Choose admin verification</h1>
            <p className="mt-4 text-base leading-7 text-slate-300">
              After login, admins can continue with a device passkey or with the existing authenticator-based MFA check.
            </p>
            <div className="mt-8 space-y-4">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-semibold text-white">Passkey</p>
                <p className="mt-1 text-sm text-slate-400">
                  {hasPasskey ? 'Use the passkey already registered on this device.' : 'Create a new passkey on this device, then use it for future admin logins.'}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm font-semibold text-white">Authenticator MFA</p>
                <p className="mt-1 text-sm text-slate-400">
                  {hasMfa ? 'Continue with your 6-digit authenticator code.' : 'No MFA is registered yet, so setup will open first.'}
                </p>
              </div>
            </div>
          </div>

          <div className="w-full rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_rgba(37,99,235,0.18)] backdrop-blur-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
              <ShieldCheck size={14} />
              Admin checkpoint
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Use passkey or MFA</h2>
            <p className="mt-3 text-slate-600">
              Pick how you want to finish admin verification for this session.
            </p>

            <div className="mt-8 grid gap-4">
              <button
                type="button"
                onClick={handlePasskey}
                disabled={!supportsPasskeys || busyAction !== ''}
                className="rounded-[1.5rem] border border-blue-200 bg-blue-50 p-5 text-left transition hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
                    <KeyRound size={22} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-bold text-blue-950">{hasPasskey ? 'Use passkey' : 'Create passkey'}</h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                        {supportsPasskeys ? 'Recommended' : 'Not supported'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {supportsPasskeys
                        ? hasPasskey
                          ? 'Verify with the saved device passkey.'
                          : 'Register a device passkey only after two MFA checks, separated by a 1-minute wait.'
                        : 'This browser or device does not support passkeys, so use MFA instead.'}
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={continueWithMfa}
                disabled={busyAction !== ''}
                className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-left transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <Smartphone size={22} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-bold text-slate-900">{hasMfa ? 'Continue with MFA' : 'Setup MFA'}</h3>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        Fallback
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {hasMfa
                        ? 'Use the existing authenticator code flow.'
                        : 'No authenticator factor is registered yet, so setup will start first.'}
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {passkeyStep !== 'idle' ? (
              <div className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-amber-900">
                      {passkeyStep === 'mfa1' && 'Passkey setup: MFA check 1 of 2'}
                      {passkeyStep === 'wait' && 'Passkey setup: waiting period'}
                      {passkeyStep === 'mfa2' && 'Passkey setup: MFA check 2 of 2'}
                    </h3>
                    <p className="mt-1 text-sm text-amber-800">
                      {passkeyStep === 'mfa1' && 'Enter your authenticator code to start passkey registration.'}
                      {passkeyStep === 'wait' && `Wait ${waitSeconds} more second${waitSeconds === 1 ? '' : 's'} before the second MFA confirmation.`}
                      {passkeyStep === 'mfa2' && 'Enter a fresh authenticator code. The passkey will be created only if this second check also passes.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetPasskeyEnrollment}
                    disabled={busyAction !== ''}
                    className="text-sm font-semibold text-amber-900 transition hover:text-amber-950 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>

                {passkeyStep === 'mfa1' || passkeyStep === 'mfa2' ? (
                  <>
                    <div className="mt-5 flex justify-center gap-2">
                      {[...Array(6)].map((_, index) => (
                        <input
                          key={index}
                          ref={(element) => {
                            mfaInputRefs.current[index] = element;
                          }}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={mfaCode[index]}
                          onChange={(event) => handleMfaChange(event.target.value, index)}
                          onKeyDown={(event) => handleMfaKeyDown(event, index)}
                          disabled={busyAction !== ''}
                          className={`h-14 w-12 rounded-lg border-2 text-center text-2xl font-mono outline-none transition-all duration-150 ${
                            mfaCode[index]
                              ? 'border-amber-600 bg-amber-100 text-amber-900 shadow'
                              : 'border-amber-200 bg-white text-slate-400'
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handlePasskeyMfaConfirm}
                      disabled={busyAction !== '' || mfaCodeStr.length !== 6 || !mfaCode.every((digit) => digit)}
                      className="mt-5 w-full rounded-2xl bg-amber-600 py-3 text-base font-bold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
                    >
                      {busyAction === 'mfa1' && 'Verifying first MFA...'}
                      {busyAction === 'mfa2' && 'Verifying second MFA...'}
                      {busyAction === '' && passkeyStep === 'mfa1' && 'Confirm first MFA'}
                      {busyAction === '' && passkeyStep === 'mfa2' && 'Confirm second MFA and create passkey'}
                    </button>
                  </>
                ) : (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-center text-base font-semibold text-amber-900">
                    Second MFA confirmation unlocks in {waitSeconds}s
                  </div>
                )}
              </div>
            ) : null}

            <button
              type="button"
              onClick={signOut}
              disabled={busyAction !== ''}
              className="mt-6 text-sm font-semibold text-slate-500 transition hover:text-slate-700"
            >
              Logout instead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAuthChoice;
