import React, { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import usePopup from '../hooks/usePopup';
import { logAdminActivity } from '../utils/adminActivityLogger';

const LAST_SEEN_MULTI_SESSION_ALERTS_KEY_PREFIX = 'lastSeenMultiSessionAlerts_';

const AdminMultiSessionAlerts = () => {
  const { profile } = useAuth();
  const { popupNode, openPopup } = usePopup();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('multi_session_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      openPopup('Load failed', error.message || 'Could not load multi-session alerts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAlerts();
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    localStorage.setItem(`${LAST_SEEN_MULTI_SESSION_ALERTS_KEY_PREFIX}${profile.id}`, new Date().toISOString());
  }, [profile?.id]);

  const newAlerts = useMemo(
    () => alerts.filter((item) => item.admin_status === 'new'),
    [alerts]
  );

  const updateAlertStatus = async (alertRow, nextStatus) => {
    try {
      setSavingId(alertRow.id);
      const payload = {
        admin_status: nextStatus,
        reviewed_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('multi_session_alerts')
        .update(payload)
        .eq('id', alertRow.id);

      if (error) throw error;

      await logAdminActivity({
        adminId: profile?.id,
        action: 'Updated multi-session alert status',
        target: String(alertRow.id),
        details: {
          alert_id: alertRow.id,
          user_id: alertRow.user_id,
          next_status: nextStatus,
        },
      });

      setAlerts((current) =>
        current.map((item) => (item.id === alertRow.id ? { ...item, ...payload } : item))
      );
      openPopup('Updated', `Alert marked as ${nextStatus}.`, 'success');
    } catch (error) {
      openPopup('Update failed', error.message || 'Could not update alert.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading multi-session alerts..." />;
  }

  return (
    <div className="space-y-6">
      {popupNode}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-red-800 p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/10 p-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Multi-Session Alerts</h1>
            <p className="mt-1 text-sm text-slate-200">Review accounts that attempted to stay active on more than one device at the same time.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{newAlerts.length}</span> new alert{newAlerts.length === 1 ? '' : 's'}
        </div>
        <button
          type="button"
          onClick={() => loadAlerts()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {alerts.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            No multi-session alerts yet.
          </div>
        ) : alerts.map((item) => (
          <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{item.full_name || item.email || 'User'}</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.admin_status === 'resolved'
                      ? 'bg-emerald-100 text-emerald-700'
                      : item.admin_status === 'reviewed'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {item.admin_status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{item.email || 'No email'}{item.phone ? ` • ${item.phone}` : ''}</p>
                <p className="mt-1 text-xs text-slate-400">Created {new Date(item.created_at).toLocaleString('en-IN')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingId === item.id}
                  onClick={() => updateAlertStatus(item, 'reviewed')}
                  className="rounded-xl border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                >
                  Mark Reviewed
                </button>
                <button
                  type="button"
                  disabled={savingId === item.id}
                  onClick={() => updateAlertStatus(item, 'resolved')}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Resolve
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Existing Device</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{item.existing_device_label || 'Unknown device'}</p>
                <p className="mt-1 text-xs text-slate-500">{item.existing_updated_at ? new Date(item.existing_updated_at).toLocaleString('en-IN') : 'No timestamp'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">New Device</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{item.new_device_label || 'Unknown device'}</p>
                <p className="mt-1 text-xs text-slate-500">Violation count: {item.violation_count || 1}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminMultiSessionAlerts;
