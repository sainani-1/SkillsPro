import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  clearStoredSessionKey,
  heartbeatSingleSession,
  isCurrentDeviceSessionOwner,
  releaseSingleSession,
  setSingleSessionNotice
} from '../utils/singleSession';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const conflictStateRef = useRef({ strikes: 0, lastAt: 0 });

  const PROFILE_CACHE_KEY = 'profile_cache';

  const readProfileCache = () => {
    try {
      const stored = localStorage.getItem(PROFILE_CACHE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      return null;
    }
  };

  const writeProfileCache = (data) => {
    try {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      // Ignore cache write failures; app state remains source of truth.
    }
  };

  const clearProfileCache = () => {
    try {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    } catch (error) {
      // Ignore cache clear failures.
    }
  };

  const handleSingleSessionConflict = async (userId) => {
    setSingleSessionNotice('Your account was logged in from another device.');
    clearStoredSessionKey(userId);
    setUser(null);
    setProfile(null);
    clearProfileCache();
    await supabase.auth.signOut();
  };

  const isPremium = (p) => {
    if (!p) return false;
    const until = p.premium_until ? new Date(p.premium_until) : null;
    return p.role === 'admin' || p.role === 'teacher' || (until && until > new Date());
  };

  useEffect(() => {
    let isMounted = true;
    const cachedProfile = readProfileCache();
    if (cachedProfile?.profile) {
      setProfile(cachedProfile.profile);
      if (cachedProfile.userId) {
        setUser({ id: cachedProfile.userId });
      }
      setLoading(false);
    }

    // Wait for Supabase to restore session from localStorage
    const restoreSession = async () => {
      // Wait for Supabase to finish restoring session (it does this async on load)
      // Poll for up to 500ms
      let tries = 0;
      let session = null;
      while (tries < 10 && !session) {
        const { data } = await supabase.auth.getSession();
        session = data.session;
        if (session) break;
        await new Promise(res => setTimeout(res, 50));
        tries++;
      }
      if (!isMounted) return;
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id, { background: !!cachedProfile?.profile });
      else {
        setProfile(null);
        clearProfileCache();
        setLoading(false);
      }
    };

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id, { background: true });
      else {
        setProfile(null);
        clearProfileCache();
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    let checking = false;
    conflictStateRef.current = { strikes: 0, lastAt: 0 };

    const validateAndHeartbeat = async () => {
      if (checking || cancelled) return;
      checking = true;
      try {
        const owned = await isCurrentDeviceSessionOwner(user.id);
        if (cancelled) return;
        if (owned === false) {
          const now = Date.now();
          const prev = conflictStateRef.current;
          const withinWindow = now - prev.lastAt < 15000;
          const nextStrikes = withinWindow ? prev.strikes + 1 : 1;
          conflictStateRef.current = { strikes: nextStrikes, lastAt: now };
          // Require repeated mismatches to reduce accidental logouts from transient/stale checks.
          if (nextStrikes >= 2) {
            await handleSingleSessionConflict(user.id);
          }
          return;
        }
        conflictStateRef.current = { strikes: 0, lastAt: 0 };
        if (owned === true) {
          await heartbeatSingleSession(user.id);
        }
      } finally {
        checking = false;
      }
    };

    validateAndHeartbeat();
    const interval = setInterval(validateAndHeartbeat, 5000);
    const onFocus = () => validateAndHeartbeat();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') validateAndHeartbeat();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    const channel = supabase
      .channel(`single-session-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'active_user_sessions', filter: `user_id=eq.${user.id}` },
        validateAndHeartbeat
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'active_user_sessions', filter: `user_id=eq.${user.id}` },
        validateAndHeartbeat
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchProfile = async (userId, options = {}) => {
    const { background = false } = options;
    try {
      if (!background) setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      
      setProfile(data);
      writeProfileCache({ userId: data.id, profile: data });
    } catch (error) {
      setProfile(null);
    } finally {
      if (!background) setLoading(false);
    }
  };

  const signOut = async () => {
    const currentUserId = user?.id || profile?.id;
    // Best effort: release active-session lock before auth token is cleared.
    try {
      await releaseSingleSession(currentUserId);
    } catch (error) {
      // Ignore release failures; local sign-out should still proceed.
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    clearProfileCache();
    clearStoredSessionKey(currentUserId);
    try {
      sessionStorage.removeItem('admin_mfa_verified');
      sessionStorage.removeItem('admin_mfa_verified_user');
      sessionStorage.removeItem('admin_face_verified');
    } catch (error) {
      // Ignore storage cleanup failures.
    }
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, fetchProfile, isPremium }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
