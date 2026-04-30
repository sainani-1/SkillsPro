const AUTH_COOKIE_ENDPOINT = '/api/auth-cookie';
const AUTH_REFRESH_ENDPOINT = '/api/auth-refresh';
const COOKIE_BRIDGE_ENABLED =
  !import.meta.env.DEV && import.meta.env.VITE_DISABLE_AUTH_COOKIE_BRIDGE !== 'true';

export const syncHttpOnlyAuthCookies = async (session) => {
  if (!COOKIE_BRIDGE_ENABLED) return;
  if (!session?.access_token || !session?.refresh_token) return;

  try {
    await fetch(AUTH_COOKIE_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresIn: session.expires_in || 15 * 60,
      }),
    });
  } catch {
    // Cookie sync is a hardening layer; the current Supabase tab session remains usable.
  }
};

export const clearHttpOnlyAuthCookies = async () => {
  if (!COOKIE_BRIDGE_ENABLED) return;
  try {
    await fetch(AUTH_COOKIE_ENDPOINT, {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch {
    // Ignore cleanup failures; local sign-out still proceeds.
  }
};

export const refreshSessionFromHttpOnlyCookie = async () => {
  if (!COOKIE_BRIDGE_ENABLED) return null;
  try {
    const response = await fetch(AUTH_REFRESH_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.access_token || !payload?.refresh_token) {
      return null;
    }
    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    };
  } catch {
    return null;
  }
};
