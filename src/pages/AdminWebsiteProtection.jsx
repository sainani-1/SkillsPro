import React, { useEffect, useState } from 'react';
import { Save, Shield } from 'lucide-react';
import { supabase } from '../supabaseClient';
import usePopup from '../hooks/usePopup';
import LoadingSpinner from '../components/LoadingSpinner';

const DEFAULT_SETTINGS = {
  disable_right_click_global: true,
  disable_ctrl_u_global: true,
  disable_ctrl_shift_i_global: true,
  disable_ctrl_shift_j_global: true,
  disable_ctrl_shift_c_global: true,
  disable_f12_global: true,
  disable_windows_g_global: true,
  detect_devtools_global: true,
};

const SETTING_ITEMS = [
  {
    key: 'disable_right_click_global',
    title: 'Disable Right Click',
    description: 'Blocks the context menu across the full website.',
  },
  {
    key: 'disable_ctrl_u_global',
    title: 'Disable Ctrl + U / Cmd + U',
    description: 'Prevents the browser view-source shortcut on supported browsers.',
  },
  {
    key: 'disable_ctrl_shift_i_global',
    title: 'Disable Ctrl + Shift + I / Cmd + Shift + I',
    description: 'Blocks the common inspect shortcut on supported browsers.',
  },
  {
    key: 'disable_ctrl_shift_j_global',
    title: 'Disable Ctrl + Shift + J / Cmd + Shift + J',
    description: 'Blocks the common console shortcut on supported browsers.',
  },
  {
    key: 'disable_ctrl_shift_c_global',
    title: 'Disable Ctrl + Shift + C / Cmd + Shift + C',
    description: 'Blocks the element picker shortcut on supported browsers.',
  },
  {
    key: 'disable_f12_global',
    title: 'Disable F12',
    description: 'Stops the common developer tools shortcut where the browser allows it.',
  },
  {
    key: 'disable_windows_g_global',
    title: 'Disable Windows + G',
    description: 'Best effort only. Windows can still capture this before the page does.',
  },
  {
    key: 'detect_devtools_global',
    title: 'Block When Devtools Opens',
    description: 'Best effort only. Detects an open devtools panel and blocks the page view.',
  },
];

const parseBooleanSetting = (value, fallback) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
};

const AdminWebsiteProtection = () => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { popupNode, openPopup } = usePopup();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('key, value')
          .in('key', SETTING_ITEMS.map((item) => item.key));

        if (error) throw error;

        const nextSettings = { ...DEFAULT_SETTINGS };
        (data || []).forEach((row) => {
          nextSettings[row.key] = parseBooleanSetting(row.value, DEFAULT_SETTINGS[row.key]);
        });
        setSettings(nextSettings);
      } catch (error) {
        openPopup('Error', `Failed to load website protection settings: ${error.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [openPopup]);

  const handleToggle = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = Object.entries(settings).map(([key, value]) => ({
        key,
        value: String(value),
      }));

      const { error } = await supabase.from('settings').upsert(payload, { onConflict: 'key' });
      if (error) throw error;

      openPopup('Success', 'Website protection settings saved successfully.', 'success');
    } catch (error) {
      openPopup('Error', `Failed to save website protection settings: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading website protection settings..." />;
  }

  return (
    <div className="space-y-6">
      {popupNode}

      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-700 p-6 rounded-xl text-white">
        <div className="flex items-center gap-3 mb-2">
          <Shield size={26} />
          <h1 className="text-2xl font-bold">Website Protection</h1>
        </div>
        <p className="text-slate-200">
          Control which shortcut and interaction blocks stay active across the full website.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="space-y-4">
          {SETTING_ITEMS.map((item) => {
            const enabled = settings[item.key];
            return (
              <div
                key={item.key}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{item.title}</h2>
                  <p className="text-sm text-slate-500">{item.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(item.key)}
                  className={`inline-flex min-w-28 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                    enabled ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {enabled ? 'ON' : 'OFF'}
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Website Protection'}
        </button>
      </div>
    </div>
  );
};

export default AdminWebsiteProtection;
