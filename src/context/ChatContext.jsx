import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { profile } = useAuth();
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const isFetchNetworkIssue = (err) => {
    const message = String(err?.message || '').toLowerCase();
    const details = String(err?.details || '').toLowerCase();
    return (
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      details.includes('failed to fetch') ||
      details.includes('cors') ||
      message.includes('err_failed') ||
      message.includes('525')
    );
  };

  useEffect(() => {
    if (!profile) return;
    
    // Only track messages for teachers
    if (profile.role !== 'teacher') {
      setTotalUnreadCount(0);
      return;
    }

    // Load initial unread messages count
    const loadUnreadCount = async () => {
      try {
        const { data: memberGroups, error: memberError } = await supabase
          .from('chat_members')
          .select('group_id')
          .eq('user_id', profile.id);

        if (memberError) throw memberError;

        if (!memberGroups || memberGroups.length === 0) {
          setTotalUnreadCount(0);
          return;
        }

        const groupIds = memberGroups.map(m => m.group_id);

        // Count all messages as unread initially
        const { count: totalCount, error: countError } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .in('group_id', groupIds);

        if (countError) throw countError;
        setTotalUnreadCount(totalCount || 0);
      } catch (error) {
        setTotalUnreadCount(0);
        if (!isFetchNetworkIssue(error)) {
          console.error('ChatContext: Error loading unread count:', error);
        }
      }
    };

    loadUnreadCount();

    // Listen for new messages
    const subscription = supabase
      .channel('global_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      }, payload => {
        setTotalUnreadCount(prev => prev + 1);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile]);

  const clearUnreadCount = () => {
    setTotalUnreadCount(0);
  };

  return (
    <ChatContext.Provider value={{ totalUnreadCount, setTotalUnreadCount, clearUnreadCount }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};
