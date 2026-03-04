import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import usePopup from '../hooks/usePopup.jsx';
import useDialog from '../hooks/useDialog.jsx';

const AdminMFAManagement = () => {
  const navigate = useNavigate();
  const { openPopup, popupNode } = usePopup();
  const { confirm, dialogNode } = useDialog();
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState([]);
  const [processingId, setProcessingId] = useState('');
  const [verifyingFactorId, setVerifyingFactorId] = useState('');
  const [verifyIntent, setVerifyIntent] = useState('unregister');
  const [oldCode, setOldCode] = useState(['', '', '', '', '', '']);
  const oldCodeRefs = useRef([]);

  const resetOldCode = () => {
    setOldCode(['', '', '', '', '', '']);
    requestAnimationFrame(() => {
      const first = oldCodeRefs.current[0];
      if (first) {
        first.focus();
        first.select();
      }
    });
  };
  const oldCodeValue = oldCode.join('');

  const handleOldCodeChange = (value, index) => {
    const digit = value.replace(/\D/g, '').slice(0, 1);
    if (!digit) return;
    const next = [...oldCode];
    next[index] = digit;
    setOldCode(next);
    if (index < 5) {
      oldCodeRefs.current[index + 1]?.focus();
    }
  };

  const handleOldCodeKeyDown = (e, index) => {
    if (e.key !== 'Backspace') return;
    if (oldCode[index]) {
      const next = [...oldCode];
      next[index] = '';
      setOldCode(next);
      return;
    }
    if (index > 0) {
      oldCodeRefs.current[index - 1]?.focus();
      const next = [...oldCode];
      next[index - 1] = '';
      setOldCode(next);
    }
  };

  const verifyOldCodeAndContinue = async () => {
    if (!verifyingFactorId) return;
    if (oldCodeValue.length !== 6) {
      openPopup('Validation', 'Enter the current 6-digit MFA code.', 'warning');
      return;
    }

    try {
      setProcessingId(verifyingFactorId);
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: verifyingFactorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: verifyingFactorId,
        challengeId: challenge.id,
        code: oldCodeValue,
      });
      if (verifyError) throw verifyError;

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: verifyingFactorId });
      if (unenrollError) throw unenrollError;

      setVerifyingFactorId('');
      setVerifyIntent('unregister');
      resetOldCode();
      openPopup('Step 1 Completed', 'Old MFA code verified and factor removed.', 'success');
      await loadFactors();
      if (verifyIntent === 'register_again') {
        navigate('/admin-mfa-setup');
        return;
      }
      const setupNow = await confirm(
        'Old MFA is removed. Do you want to register new MFA now? (Step 2 confirmation happens in setup with new code verification)',
        'Register New MFA'
      );
      if (setupNow) navigate('/admin-mfa-setup');
    } catch (error) {
      openPopup('Verification failed', error.message || 'Current MFA code is invalid.', 'error');
      resetOldCode();
    } finally {
      setProcessingId('');
    }
  };

  const loadFactors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setFactors(data?.totp || []);
    } catch (error) {
      openPopup('Load failed', error.message || 'Unable to load MFA factors.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFactors();
  }, []);

  useEffect(() => {
    if (verifyingFactorId && !processingId && oldCodeValue.length === 6 && oldCode.every((d) => d)) {
      verifyOldCodeAndContinue();
    }
  }, [oldCodeValue, verifyingFactorId, processingId]);

  const handleUnregister = async (factorId) => {
    const ok = await confirm(
      'To unregister, you must verify with your current (old) MFA code first. Continue?',
      'Unregister MFA'
    );
    if (!ok) return;
    setVerifyIntent('unregister');
    resetOldCode();
    setVerifyingFactorId(factorId);
  };

  const handleRegisterOrRegisterAgain = async () => {
    if (factors.length === 0) {
      navigate('/admin-mfa-setup');
      return;
    }
    const primaryFactor = factors[0];
    const ok = await confirm(
      'Register Again requires old MFA verification first, then new MFA code verification in setup. Continue?',
      '2-Step MFA Re-Register'
    );
    if (!ok) return;
    setVerifyIntent('register_again');
    resetOldCode();
    setVerifyingFactorId(primaryFactor.id);
  };

  return (
    <div className="space-y-6">
      {popupNode}
      {dialogNode}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-xl text-white">
        <h1 className="text-2xl font-bold mb-1">Admin MFA Management</h1>
        <p className="text-slate-300">Unregister old MFA and register again when needed.</p>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-bold text-slate-900">Registered Factors</h2>
          <button
            onClick={handleRegisterOrRegisterAgain}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            disabled={!!verifyingFactorId || !!processingId}
          >
            {factors.length > 0 ? 'Register Again' : 'Register MFA'}
          </button>
        </div>
        {factors.length > 0 ? (
          <p className="text-xs text-slate-500">
            Only one MFA is allowed. Clicking <strong>Register Again</strong> requires old MFA verification first.
          </p>
        ) : null}

        {loading ? (
          <p className="text-slate-500">Loading MFA factors...</p>
        ) : factors.length === 0 ? (
          <div className="border rounded-lg p-4 bg-amber-50 text-amber-800">
            No MFA factor registered. Click <strong>Register / Register Again</strong> to set up new MFA.
          </div>
        ) : (
          <div className="space-y-3">
            {factors.length > 1 ? (
              <div className="border rounded-lg p-3 bg-red-50 text-red-800 text-sm">
                Multiple MFA factors detected ({factors.length}). For security, keep only one. Please unregister extras.
              </div>
            ) : null}
            <div className="divide-y border rounded-lg">
              {factors.map((factor) => (
                <div key={factor.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{factor.friendly_name || 'Authenticator App'}</p>
                    <p className="text-xs text-slate-500">Factor ID: {factor.id}</p>
                    <p className="text-xs text-slate-500">
                      Created: {factor.created_at ? new Date(factor.created_at).toLocaleString() : '-'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnregister(factor.id)}
                    disabled={processingId === factor.id || !!verifyingFactorId}
                    className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {processingId === factor.id ? 'Removing...' : 'Unregister'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {verifyingFactorId ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border-t-8 border-blue-500 shadow-xl p-8 space-y-6">
            <h3 className="text-2xl font-bold text-blue-700 text-center">Verify MFA</h3>
            <p className="text-sm text-slate-600 text-center">
              Step 1 confirmation: Enter your current 6-digit MFA code to continue.
            </p>
            <div className="flex justify-center gap-3">
              {[...Array(6)].map((_, i) => (
                <input
                  key={i}
                  id={`old-mfa-digit-${i}`}
                  ref={(el) => (oldCodeRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={oldCode[i]}
                  onChange={(e) => handleOldCodeChange(e.target.value, i)}
                  onKeyDown={(e) => handleOldCodeKeyDown(e, i)}
                  disabled={!!processingId}
                  autoFocus={i === 0}
                  className={`w-12 h-14 text-center text-2xl font-mono rounded-lg border-2 transition-all duration-150 outline-none ${
                    oldCode[i]
                      ? 'border-blue-600 bg-blue-50 text-blue-700 shadow'
                      : 'border-slate-300 bg-white text-slate-400'
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setVerifyingFactorId('');
                  resetOldCode();
                }}
                disabled={!!processingId}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={verifyOldCodeAndContinue}
                disabled={!!processingId || oldCodeValue.length !== 6}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {processingId ? 'Verifying MFA...' : 'Verify MFA & Continue'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminMFAManagement;
