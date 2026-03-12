import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { isLikelyDevToolsOpen } from '../utils/devtoolsDetection';

const SETTING_KEYS = [
  'disable_right_click_global',
  'disable_ctrl_u_global',
  'disable_ctrl_shift_i_global',
  'disable_ctrl_shift_j_global',
  'disable_ctrl_shift_c_global',
  'disable_f12_global',
  'disable_windows_g_global',
  'detect_devtools_global',
];

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

const parseBooleanSetting = (value, fallback) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
};

const GlobalInteractionGuards = () => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('key, value')
          .in('key', SETTING_KEYS);

        if (error) throw error;

        const nextSettings = { ...DEFAULT_SETTINGS };
        (data || []).forEach((row) => {
          nextSettings[row.key] = parseBooleanSetting(row.value, DEFAULT_SETTINGS[row.key]);
        });

        if (active) {
          setSettings(nextSettings);
        }
      } catch {
        if (active) {
          setSettings(DEFAULT_SETTINGS);
        }
      }
    };

    loadSettings();

    const channel = supabase
      .channel('global-interaction-guards-settings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settings' },
        (payload) => {
          const key = payload?.new?.key || payload?.old?.key;
          if (SETTING_KEYS.includes(key)) {
            loadSettings();
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const blockContextMenu = (event) => {
      if (!settings.disable_right_click_global) return;
      event.preventDefault();
    };

    const blockRestrictedShortcuts = (event) => {
      const key = String(event.key || '').toLowerCase();
      const usesModifier = event.ctrlKey || event.metaKey;
      const isF12 = settings.disable_f12_global && key === 'f12';
      const isInspectShortcut =
        settings.disable_ctrl_shift_i_global && usesModifier && event.shiftKey && key === 'i';
      const isConsoleShortcut =
        settings.disable_ctrl_shift_j_global && usesModifier && event.shiftKey && key === 'j';
      const isElementPickerShortcut =
        settings.disable_ctrl_shift_c_global && usesModifier && event.shiftKey && key === 'c';
      const isViewSourceShortcut = settings.disable_ctrl_u_global && usesModifier && key === 'u';
      const isGameBarShortcut = settings.disable_windows_g_global && event.metaKey && key === 'g';

      if (
        isF12 ||
        isInspectShortcut ||
        isConsoleShortcut ||
        isElementPickerShortcut ||
        isViewSourceShortcut ||
        isGameBarShortcut
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const detectDevTools = () => {
      if (!settings.detect_devtools_global) return;
      if (isLikelyDevToolsOpen()) {
        document.body.innerHTML =
          '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#020617;color:#fff;font-family:Arial,sans-serif;text-align:center;"><div><h1 style="font-size:28px;margin:0 0 12px;">Access blocked</h1><p style="margin:0;font-size:15px;opacity:.85;">Close developer tools and refresh the page.</p></div></div>';
      }
    };

    document.addEventListener('contextmenu', blockContextMenu, true);
    window.addEventListener('contextmenu', blockContextMenu, true);
    document.addEventListener('keydown', blockRestrictedShortcuts, true);
    window.addEventListener('keydown', blockRestrictedShortcuts, true);
    const devToolsInterval = window.setInterval(detectDevTools, 1000);

    return () => {
      document.removeEventListener('contextmenu', blockContextMenu, true);
      window.removeEventListener('contextmenu', blockContextMenu, true);
      document.removeEventListener('keydown', blockRestrictedShortcuts, true);
      window.removeEventListener('keydown', blockRestrictedShortcuts, true);
      window.clearInterval(devToolsInterval);
    };
  }, [settings]);

  return null;
};

export default GlobalInteractionGuards;
