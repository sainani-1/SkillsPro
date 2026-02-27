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

// --- Enforce 1 day session expiration and cross-tab sync ---
const SESSION_EXPIRY_KEY = 'skillpro-session-expiry';
function setSessionExpiry() {
  const now = Date.now();
  // 1 day in ms
  const expiry = now + 24 * 60 * 60 * 1000;
  localStorage.setItem(SESSION_EXPIRY_KEY, expiry.toString());
}
function clearSessionExpiry() {
  localStorage.removeItem(SESSION_EXPIRY_KEY);
}
// Set expiry on login
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) {
    setSessionExpiry();
  }
  if (event === 'SIGNED_OUT') {
    clearSessionExpiry();
  }
});
// Check expiry on every load and every tab focus
function checkSessionExpiry() {
  const expiry = localStorage.getItem(SESSION_EXPIRY_KEY);
  if (expiry && Date.now() > Number(expiry)) {
    supabase.auth.signOut();
    clearSessionExpiry();
    window.location.href = '/login';
  }
}
window.addEventListener('storage', (e) => {
  if (e.key === SESSION_EXPIRY_KEY) {
    checkSessionExpiry();
  }
});
window.addEventListener('focus', checkSessionExpiry);
checkSessionExpiry();