import { supabase } from '../supabaseClient';

export const liveKitRoomNameForSession = (sessionId) => `skillpro-live-exam-session-${sessionId}`;

const normalizeLiveKitUrl = (rawUrl) => {
  const value = String(rawUrl || '').trim();
  if (!value) return value;
  if (value.startsWith('https://')) return `wss://${value.slice('https://'.length)}`;
  if (value.startsWith('http://')) return `ws://${value.slice('http://'.length)}`;
  return value;
};

export const getLiveKitTokenForSession = async ({ sessionId, mode, requesterId, viewerInstanceId = '' }) => {
  if (!requesterId) {
    throw new Error('LiveKit auth failed: requester id is missing.');
  }

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/livekit-token`;
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      sessionId,
      mode,
      requesterId,
      viewerInstanceId,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `LiveKit token failed with status ${response.status}.`);
  }

  if (!payload?.token || !payload?.url || !payload?.roomName) {
    throw new Error('LiveKit token response is incomplete.');
  }

  return {
    ...payload,
    url: normalizeLiveKitUrl(payload.url),
  };
};
