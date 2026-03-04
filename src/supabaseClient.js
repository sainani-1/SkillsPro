import { createClient } from '@supabase/supabase-js'

// NOTE: In a real deployment, these would be in a .env file.
// Since this is a generated demo, you must replace these with your Supabase credentials.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'skillpro-auth',
    flowType: 'pkce',
    // Set session expiration to 1 day (in seconds)
    // Supabase default is 7 days, override with 1 day
    // This is handled at the time of sign in, but we enforce logout below as well
  },
  global: {
    headers: {
      'x-client-info': 'skillpro-web'
    }
  }
});

// --- Session expiry sync and cross-tab safety ---
const SESSION_EXPIRY_KEY = 'skillpro-session-expiry';
function setSessionExpiry(session) {
  if (!session) return;
  // Prefer Supabase-issued expiry when available.
  const fromSession = Number(session.expires_at || 0) * 1000;
  const fallback = Date.now() + 24 * 60 * 60 * 1000;
  const expiry = Number.isFinite(fromSession) && fromSession > 0 ? fromSession : fallback;
  localStorage.setItem(SESSION_EXPIRY_KEY, String(expiry));
}
function clearSessionExpiry() {
  localStorage.removeItem(SESSION_EXPIRY_KEY);
}
// Keep local expiry synced with auth lifecycle events.
supabase.auth.onAuthStateChange((event, session) => {
  if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
    setSessionExpiry(session);
  }
  if (event === 'SIGNED_OUT') {
    clearSessionExpiry();
  }
});
// Check expiry on load/focus/storage and only sign out when truly expired.
async function checkSessionExpiry() {
  const expiry = localStorage.getItem(SESSION_EXPIRY_KEY);
  if (!expiry) return;

  const expiresAt = Number(expiry);
  if (!Number.isFinite(expiresAt)) return;

  if (Date.now() > expiresAt) {
    const { data: { session } } = await supabase.auth.getSession();
    // If Supabase still has a valid session, refresh local expiry and keep user logged in.
    if (session?.expires_at && Date.now() < session.expires_at * 1000) {
      setSessionExpiry(session);
      return;
    }
    supabase.auth.signOut();
    clearSessionExpiry();
    window.location.href = '/login';
  }
}
window.addEventListener('storage', (e) => {
  if (e.key === SESSION_EXPIRY_KEY) {
    void checkSessionExpiry();
  }
});
window.addEventListener('focus', () => {
  void checkSessionExpiry();
});
void checkSessionExpiry();
