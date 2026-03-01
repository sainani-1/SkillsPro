import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const PROFILE_CACHE_KEY = 'profile_cache';

  const readProfileCache = () => {
    try {
      const stored = localStorage.getItem(PROFILE_CACHE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error reading profile cache:', error);
      return null;
    }
  };

  const writeProfileCache = (data) => {
    try {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error writing profile cache:', error);
    }
  };

  const clearProfileCache = () => {
    try {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    } catch (error) {
      console.error('Error clearing profile cache:', error);
    }
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
      console.error('Error fetching profile:', error);
    } finally {
      if (!background) setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    clearProfileCache();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, fetchProfile, isPremium }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
