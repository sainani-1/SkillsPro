import { supabase } from '../supabaseClient';

const DEVICE_ID_KEY = 'single_session_device_id';
const ACTIVE_SESSION_KEY_PREFIX = 'single_session_key_';
const SESSION_NOTICE_KEY = 'single_session_notice';

const generateRandomKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
};

export const getOrCreateDeviceId = () => {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = `dev_${generateRandomKey()}`;
  localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
};

export const getStoredSessionKey = (userId) => {
  if (!userId) return null;
  return localStorage.getItem(`${ACTIVE_SESSION_KEY_PREFIX}${userId}`) || null;
};

export const setStoredSessionKey = (userId, key) => {
  if (!userId || !key) return;
  localStorage.setItem(`${ACTIVE_SESSION_KEY_PREFIX}${userId}`, key);
};

export const clearStoredSessionKey = (userId) => {
  if (!userId) return;
  localStorage.removeItem(`${ACTIVE_SESSION_KEY_PREFIX}${userId}`);
};

export const setSingleSessionNotice = (message) => {
  const value = typeof message === 'string' ? message : JSON.stringify(message);
  sessionStorage.setItem(SESSION_NOTICE_KEY, value);
};

export const takeSingleSessionNotice = () => {
  const message = sessionStorage.getItem(SESSION_NOTICE_KEY);
  if (message) sessionStorage.removeItem(SESSION_NOTICE_KEY);
  if (!message) return null;
  try {
    return JSON.parse(message);
  } catch {
    return message;
  }
};

export const claimSingleSession = async (userId, options = {}) => {
  const { forceTakeover = false, deviceLabel = 'Web' } = options;
  if (!userId) return { status: 'error', reason: 'missing_user' };

  const deviceId = getOrCreateDeviceId();
  const localKey = getStoredSessionKey(userId);

  const { data: currentRow, error: readError } = await supabase
    .from('active_user_sessions')
    .select('user_id, active_session_key, device_id, device_label, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) {
    const message = String(readError.message || '').toLowerCase();
    if (
      message.includes('active_user_sessions') ||
      message.includes('does not exist') ||
      message.includes('relation')
    ) {
      return { status: 'unavailable', reason: 'missing_table' };
    }
    return { status: 'unavailable', reason: 'read_failed', error: readError };
  }

  const otherActiveSession =
    !!currentRow?.active_session_key &&
    currentRow.active_session_key !== localKey &&
    currentRow.device_id !== deviceId;

  if (otherActiveSession && !forceTakeover) {
    return {
      status: 'requires_takeover',
      reason: 'already_logged_in_elsewhere',
      conflictingSession: currentRow || null,
      incomingDevice: {
        device_id: deviceId,
        device_label: deviceLabel,
      },
    };
  }

  const nextKey = generateRandomKey();
  const payload = {
    user_id: userId,
    active_session_key: nextKey,
    device_id: deviceId,
    device_label: deviceLabel,
    updated_at: new Date().toISOString()
  };

  const { error: upsertError } = await supabase
    .from('active_user_sessions')
    .upsert(payload, { onConflict: 'user_id' });

  if (upsertError) {
    return { status: 'unavailable', reason: 'upsert_failed', error: upsertError };
  }

  setStoredSessionKey(userId, nextKey);
  return { status: 'claimed' };
};

export const isCurrentDeviceSessionOwner = async (userId) => {
  if (!userId) return null;
  const localKey = getStoredSessionKey(userId);
  if (!localKey) return null;

  const { data, error } = await supabase
    .from('active_user_sessions')
    .select('active_session_key')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return null;
  if (!data?.active_session_key) return null;
  return data.active_session_key === localKey;
};

export const fetchActiveSessionRecord = async (userId) => {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('active_user_sessions')
    .select('user_id, active_session_key, device_id, device_label, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return null;
  return data || null;
};

export const heartbeatSingleSession = async (userId) => {
  if (!userId) return;
  const localKey = getStoredSessionKey(userId);
  if (!localKey) return;

  await supabase
    .from('active_user_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('active_session_key', localKey);
};

export const releaseSingleSession = async (userId) => {
  if (!userId) return;
  const localKey = getStoredSessionKey(userId);
  if (!localKey) return;

  await supabase
    .from('active_user_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('active_session_key', localKey);
};
