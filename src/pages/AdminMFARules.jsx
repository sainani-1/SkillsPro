import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Save } from 'lucide-react';
import { supabase } from '../supabaseClient';
import usePopup from '../hooks/usePopup';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ADMIN_SENSITIVE_MFA_SETTINGS_KEY,
  ADMIN_SENSITIVE_ROUTE_OPTIONS,
  DEFAULT_ADMIN_SENSITIVE_MFA_PATHS,
  normalizeAdminSensitivePaths,
} from '../utils/adminSensitiveRoutes';

const AdminMFARules = () => {
  const { popupNode, openPopup } = usePopup();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState(DEFAULT_ADMIN_SENSITIVE_MFA_PATHS);

  useEffect(() => {
    let active = true;

    const loadRules = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', ADMIN_SENSITIVE_MFA_SETTINGS_KEY)
          .maybeSingle();

        if (!active) return;
        if (error) throw error;
        setSelectedPaths(normalizeAdminSensitivePaths(data?.value));
      } catch (error) {
        if (!active) return;
        setSelectedPaths([...DEFAULT_ADMIN_SENSITIVE_MFA_PATHS]);
        openPopup('Load failed', error.message || 'Could not load MFA rules.', 'error');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadRules();
    return () => {
      active = false;
    };
  }, [openPopup]);

  const selectedCount = useMemo(() => selectedPaths.length, [selectedPaths]);

  const togglePath = (path) => {
    setSelectedPaths((current) =>
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path]
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const nextValue = JSON.stringify(selectedPaths);
      const { error } = await supabase
        .from('settings')
        .upsert({ key: ADMIN_SENSITIVE_MFA_SETTINGS_KEY, value: nextValue }, { onConflict: 'key' });

      if (error) throw error;
      openPopup('Saved', 'Sensitive MFA page rules updated.', 'success');
    } catch (error) {
      openPopup('Save failed', error.message || 'Could not save MFA rules.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading MFA rules..." />;
  }

  return (
    <div className="space-y-6">
      {popupNode}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-blue-800 p-6 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/10 p-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">MFA Rules</h1>
            <p className="mt-1 text-sm text-slate-200">Choose which admin pages should ask for a fresh MFA verification.</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Protected Admin Pages</h2>
            <p className="mt-1 text-sm text-slate-500">{selectedCount} page{selectedCount === 1 ? '' : 's'} currently require a fresh MFA check across the admin panel.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setSelectedPaths(ADMIN_SENSITIVE_ROUTE_OPTIONS.map((item) => item.path))}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Turn All On
            </button>
            <button
              type="button"
              onClick={() => setSelectedPaths([])}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Turn All Off
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Rules'}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {ADMIN_SENSITIVE_ROUTE_OPTIONS.map((item) => {
            const selected = selectedPaths.includes(item.path);
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => togglePath(item.path)}
                className={`rounded-3xl border-2 p-5 text-left transition ${
                  selected
                    ? 'border-blue-600 bg-blue-50 shadow-sm'
                    : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="mt-2 text-xs text-slate-500">{item.description}</p>
                    <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">{item.path}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      selected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {selected ? 'MFA On' : 'MFA Off'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminMFARules;
