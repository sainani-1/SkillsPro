import React, { useEffect, useState } from 'react';
import { KeyRound, Save, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import usePopup from '../hooks/usePopup';
import { useAuth } from '../context/AuthContext';
import { logAdminActivity } from '../utils/adminActivityLogger';

const SETTING_KEY = 'login_email_otp_enabled';

const AdminLoginOtpSettings = () => {
  const { profile } = useAuth();
  const { popupNode, openPopup } = usePopup();
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const loadSetting = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', SETTING_KEY)
          .maybeSingle();
        if (error) throw error;
        if (active) setEnabled(data?.value !== 'false');
      } catch (error) {
        if (active) {
          openPopup('Error', error.message || 'Failed to load login OTP setting.', 'error');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSetting();
    return () => {
      active = false;
    };
  }, [openPopup]);

  const saveSetting = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: SETTING_KEY, value: String(enabled) }, { onConflict: 'key' });
      if (error) throw error;

      await logAdminActivity({
        adminId: profile?.id,
        action: enabled ? 'Enabled login email OTP' : 'Disabled login email OTP',
        target: SETTING_KEY,
        details: { enabled },
      });

      openPopup('Saved', enabled ? 'Login OTP is now ON for every email/password login.' : 'Login OTP is now OFF. Users will login directly after password.', 'success');
    } catch (error) {
      openPopup('Error', error.message || 'Failed to save login OTP setting.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading login OTP setting..." />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {popupNode}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="px-6 py-7">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
            <KeyRound size={14} />
            Login Security
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight">Email OTP Login Control</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Turn email OTP verification on or off for all email/password logins. Admin MFA still remains separate after admin login.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Require OTP for login</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                {enabled
                  ? 'ON: users enter email/password, receive an email OTP, then complete login.'
                  : 'OFF: users login directly after correct email/password. No email OTP is requested.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setEnabled((value) => !value)}
            className={`relative h-9 w-16 shrink-0 rounded-full transition ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
            aria-pressed={enabled}
            aria-label="Toggle login OTP"
          >
            <span className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition ${enabled ? 'left-8' : 'left-1'}`} />
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          If OTP is turned off, Gmail SMTP settings are not used during login. Password reset emails are unaffected because Supabase controls them separately.
        </div>

        <button
          type="button"
          onClick={saveSetting}
          disabled={saving}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-bold text-white shadow-lg shadow-amber-100 transition hover:bg-amber-600 disabled:opacity-60"
        >
          <Save size={18} />
          {saving ? 'Saving...' : 'Save Setting'}
        </button>
      </section>
    </div>
  );
};

export default AdminLoginOtpSettings;
