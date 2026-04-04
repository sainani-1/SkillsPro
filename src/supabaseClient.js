import { createClient } from '@supabase/supabase-js'
import {
  clearDailyLoginState,
  isDailyLoginExpired,
  readDailyLoginState,
  writeDailyLoginState
} from './utils/dailySession';

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

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.supabase = supabase;
}

const syncDailyLoginState = (session) => {
  if (!session?.user) return;
  const existing = readDailyLoginState();
  writeDailyLoginState({
    userId: session.user.id,
    email: session.user.email || existing?.email || '',
    authProvider: session.user.app_metadata?.provider || existing?.authProvider || 'email'
  });
};

supabase.auth.onAuthStateChange((event, session) => {
  if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
    syncDailyLoginState(session);
  }
  if (event === 'SIGNED_OUT') {
    clearDailyLoginState();
  }
});

async function checkSessionExpiry() {
  const loginState = readDailyLoginState();
  if (!loginState) return;
  if (!isDailyLoginExpired(loginState)) return;

  try {
    await supabase.auth.signOut();
  } finally {
    clearDailyLoginState();
    window.location.href = '/login';
  }
}

window.addEventListener('storage', (e) => {
  if (e.key === 'skillpro-login-state') {
    void checkSessionExpiry();
  }
});
window.addEventListener('focus', () => {
  void checkSessionExpiry();
});
window.setInterval(() => {
  void checkSessionExpiry();
}, 60 * 1000);
void checkSessionExpiry();
