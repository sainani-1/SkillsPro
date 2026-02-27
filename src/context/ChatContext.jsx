import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { profile } = useAuth();
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  useEffect(() => {
    if (!profile) return;
    
    // Only track messages for teachers
    if (profile.role !== 'teacher') {
      setTotalUnreadCount(0);
      return;
    }

    console.log('ChatContext: Loading unread messages for teacher:', profile.id);

    // Load initial unread messages count
    const loadUnreadCount = async () => {
      try {
        const { data: memberGroups } = await supabase
          .from('chat_members')
          .select('group_id')
          .eq('user_id', profile.id);

        console.log('ChatContext: Member groups:', memberGroups);

        if (!memberGroups || memberGroups.length === 0) {
          console.log('ChatContext: No groups found');
          setTotalUnreadCount(0);
          return;
        }

        const groupIds = memberGroups.map(m => m.group_id);
        console.log('ChatContext: Group IDs:', groupIds);

        // Count all messages as unread initially
        const { count: totalCount } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .in('group_id', groupIds);

        console.log('ChatContext: Total message count:', totalCount);
        setTotalUnreadCount(totalCount || 0);
      } catch (error) {
        console.error('ChatContext: Error loading unread count:', error);
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
        console.log('ChatContext: New message received:', payload.new);
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
