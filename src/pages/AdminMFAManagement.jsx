import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import usePopup from '../hooks/usePopup.jsx';
import useDialog from '../hooks/useDialog.jsx';
import { useAuth } from '../context/AuthContext';
import { logAdminActivity } from '../utils/adminActivityLogger';
import {
  deleteAdminPasskey,
  getStoredAdminPasskey,
  listAdminPasskeys,
} from '../utils/adminPasskey';

const AdminMFAManagement = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { openPopup, popupNode } = usePopup();
  const { confirm, dialogNode } = useDialog();
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState([]);
  const [passkeys, setPasskeys] = useState([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(true);
  const [removingPasskeyId, setRemovingPasskeyId] = useState('');
  const [processingId, setProcessingId] = useState('');
  const [verifyingFactorId, setVerifyingFactorId] = useState('');
  const [verifyIntent, setVerifyIntent] = useState('unregister');
  const [verifyStep, setVerifyStep] = useState('first');
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
  const currentDevicePasskey = getStoredAdminPasskey(user?.id);

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
      openPopup('Validation', 'Enter the 6-digit MFA code.', 'warning');
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

      if (verifyIntent === 'unregister' && verifyStep === 'first') {
        setVerifyStep('second');
        resetOldCode();
        openPopup('Step 1 Completed', 'First MFA verification successful. Enter a fresh MFA code for final confirmation.', 'success');
        return;
      }

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: verifyingFactorId });
      if (unenrollError) throw unenrollError;

      setVerifyingFactorId('');
      setVerifyStep('first');
      setVerifyIntent('unregister');
      resetOldCode();
      openPopup('Success', 'MFA factor removed.', 'success');
      await loadFactors();
      if (verifyIntent === 'register_again') {
        navigate('/admin-mfa-setup');
        return;
      }
      if (verifyIntent === 'unregister') return;
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

  const loadPasskeys = async () => {
    if (!user?.id) {
      setPasskeys([]);
      setLoadingPasskeys(false);
      return;
    }

    try {
      setLoadingPasskeys(true);
      const records = await listAdminPasskeys(user.id);
      setPasskeys(records);
    } catch (error) {
      openPopup('Load failed', error.message || 'Unable to load passkey devices.', 'error');
    } finally {
      setLoadingPasskeys(false);
    }
  };

  useEffect(() => {
    void loadFactors();
  }, []);

  useEffect(() => {
    void loadPasskeys();
  }, [user?.id]);

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
    setVerifyStep('first');
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
    setVerifyStep('first');
    resetOldCode();
    setVerifyingFactorId(primaryFactor.id);
  };

  const handleDeletePasskey = async (passkey) => {
    if (!user?.id || !passkey?.deviceId) return;
    const ok = await confirm(
      `Delete the passkey for ${passkey.deviceLabel || 'this device'}? This browser will need MFA again before it can add a new passkey.`,
      'Delete Passkey'
    );
    if (!ok) return;

    try {
      setRemovingPasskeyId(passkey.deviceId);
      await deleteAdminPasskey({ userId: user.id, deviceId: passkey.deviceId });
      await logAdminActivity({
        adminId: user.id,
        eventType: 'action',
        action: 'Deleted admin passkey',
        target: passkey.deviceId,
        details: {
          module: 'admin-mfa-management',
          device_label: passkey.deviceLabel || null,
          browser: passkey.browser || null,
          os: passkey.os || null,
          host: passkey.host || null,
        },
      });
      openPopup('Deleted', 'Passkey removed successfully. You can add it again from passkey setup.', 'success');
      await loadPasskeys();
    } catch (error) {
      openPopup('Delete failed', error.message || 'Unable to delete this passkey.', 'error');
    } finally {
      setRemovingPasskeyId('');
    }
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

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Admin Passkey Devices</h2>
            <p className="text-sm text-slate-500">
              See which browser and device created a passkey, remove it, and set it up again when needed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin-auth-choice')}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Add or Recreate Passkey
          </button>
        </div>

        {loadingPasskeys ? (
          <p className="text-slate-500">Loading passkey devices...</p>
        ) : passkeys.length === 0 ? (
          <div className="border rounded-lg p-4 bg-slate-50 text-slate-600">
            No passkey has been registered for this admin yet.
          </div>
        ) : (
          <div className="space-y-3">
            {passkeys.map((passkey) => {
              const isCurrentDevice = currentDevicePasskey?.deviceId === passkey.deviceId;
              return (
                <div key={passkey.deviceId} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">{passkey.deviceLabel || 'Registered device'}</p>
                        {isCurrentDevice ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                            This device
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-slate-600">
                        {passkey.browser || 'Browser'} {passkey.os ? `on ${passkey.os}` : ''}
                      </p>
                      <p className="text-xs text-slate-500">
                        Created: {passkey.createdAt ? new Date(passkey.createdAt).toLocaleString('en-IN') : '-'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Last used: {passkey.lastUsedAt ? new Date(passkey.lastUsedAt).toLocaleString('en-IN') : 'Not used yet'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Site: {passkey.host || '-'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeletePasskey(passkey)}
                      disabled={removingPasskeyId === passkey.deviceId}
                      className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {removingPasskeyId === passkey.deviceId ? 'Deleting...' : 'Delete Passkey'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {profile?.full_name ? (
          <p className="text-xs text-slate-500">
            Signed in as {profile.full_name}. Delete a passkey here, then use Add or Recreate Passkey to register it again.
          </p>
        ) : null}
      </div>

      {verifyingFactorId ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border-t-8 border-blue-500 shadow-xl p-8 space-y-6">
            <h3 className="text-2xl font-bold text-blue-700 text-center">Verify MFA</h3>
            <p className="text-sm text-slate-600 text-center">
              {verifyIntent === 'unregister' && verifyStep === 'second'
                ? 'Step 2 confirmation: Enter a fresh 6-digit MFA code to finalize unregister.'
                : 'Step 1 confirmation: Enter your current 6-digit MFA code to continue.'}
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
                  setVerifyStep('first');
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
                {processingId
                  ? 'Verifying MFA...'
                  : verifyIntent === 'unregister' && verifyStep === 'second'
                    ? 'Verify MFA & Unregister'
                    : 'Verify MFA & Continue'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminMFAManagement;
