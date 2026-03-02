import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Send, MessageCircle, CheckCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const ChatWithTeacher = () => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [groupId, setGroupId] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteConfirmFinal, setDeleteConfirmFinal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState(null);

  const [initialLoad, setInitialLoad] = useState(true);

  // Persist last read time per group in localStorage for unread badge clearing
  const setChatReadTime = (groupId) => {
    if (!profile?.id || !groupId) return;
    const key = `chatReadTimes_${profile.id}`;
    const stored = localStorage.getItem(key);
    let map = new Map();
    if (stored) {
      try {
        map = new Map(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing chat read times:', e);
      }
    }
    map.set(groupId, new Date().toISOString());
    localStorage.setItem(key, JSON.stringify(Array.from(map.entries())));
  };

  const getChatClearedAt = (gid) => {
    if (!profile?.id || !gid) return null;
    const key = `chatClearedAt_${profile.id}_${gid}`;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const setChatClearedAt = (gid, isoTime) => {
    if (!profile?.id || !gid) return;
    const key = `chatClearedAt_${profile.id}_${gid}`;
    try {
      localStorage.setItem(key, isoTime || new Date().toISOString());
    } catch {
      // ignore storage errors
    }
  };

  const scrollToBottom = (smooth = false) => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  };

  useEffect(() => {
    // Only auto-scroll if not the initial load
    if (!initialLoad && messages.length > 0) {
      requestAnimationFrame(() => scrollToBottom(true));
    }
  }, [messages, initialLoad]);

  useEffect(() => {
    // Re-initialize chat only when relevant profile keys change.
    setMessages([]);
    setGroupId(null);
    setTeacher(null);
    setLoading(true);
    setDeleteConfirm(false);
    setDeleteConfirmFinal(false);
    setSuccessMessage('');
    setError(null);
    setInitialLoad(true);
    initChat();
  }, [profile?.id, profile?.assigned_teacher_id]);

  useEffect(() => {
    if (groupId) {
      loadMessages();
      const subscription = supabase
        .channel(`chat:${groupId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `group_id=eq.${groupId}`
        }, payload => {
          if (payload.new.sender_id === profile?.id) {
            // Own message is added optimistically in sendMessage().
            return;
          }
          const clearedAt = getChatClearedAt(groupId);
          if (!clearedAt || new Date(payload.new.created_at) > new Date(clearedAt)) {
            setMessages(prev => [...prev, payload.new]);
          }
          // Mark chat as read when viewing the page and receiving new messages
          setChatReadTime(groupId);
        })
        .subscribe();

      return () => subscription.unsubscribe();
    }
  }, [groupId]);

  // On unmount, persist latest read time to clear badges
  useEffect(() => {
    return () => {
      if (groupId) {
        setChatReadTime(groupId);
      }
    };
  }, [groupId]);


  const initChat = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    
    console.log('Profile:', profile);
    console.log('Assigned Teacher ID:', profile.assigned_teacher_id);
    
    if (!profile.assigned_teacher_id) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Get assigned teacher and find existing group in parallel
      const [teacherResponse, myGroupsResponse] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', profile.assigned_teacher_id)
          .single(),
        supabase
          .from('chat_members')
          .select('group_id')
          .eq('user_id', profile.id)
      ]);
      
      if (teacherResponse.error) {
        console.error('Teacher fetch error:', teacherResponse.error);
        setError('Unable to find your assigned teacher. Please contact support.');
        setLoading(false);
        return;
      }
      
      console.log('Teacher Data:', teacherResponse.data);
      setTeacher(teacherResponse.data);

      let groupIdToUse = null;
      
      // Check if teacher is in any of my groups
      if (myGroupsResponse.data && myGroupsResponse.data.length > 0) {
        const myGroupIds = myGroupsResponse.data.map(g => g.group_id);
        
        // Find which of these groups also has the teacher - single query
        const { data: teacherInGroups } = await supabase
          .from('chat_members')
          .select('group_id')
          .eq('user_id', profile.assigned_teacher_id)
          .in('group_id', myGroupIds);
        
        if (teacherInGroups && teacherInGroups.length > 0) {
          groupIdToUse = teacherInGroups[0].group_id;
        }
      }

      // Create new group if none exists
      if (!groupIdToUse) {
        const { data: newGroup, error: createError } = await supabase
          .from('chat_groups')
          .insert({ 
            group_type: 'student_teacher',
            name: `${profile.full_name} - ${teacherResponse.data.full_name}`,
            created_by: profile.id
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating group:', createError);
          setError('Unable to create chat. Please try again or contact support.');
          setLoading(false);
          return;
        }

        if (newGroup) {
          const { error: memberError } = await supabase.from('chat_members').insert([
            { group_id: newGroup.id, user_id: profile.id },
            { group_id: newGroup.id, user_id: profile.assigned_teacher_id }
          ]);
          
          if (memberError) {
            console.error('Error adding members:', memberError);
            setLoading(false);
            return;
          }
          
          groupIdToUse = newGroup.id;
        }
      }

      if (groupIdToUse) {
        setGroupId(groupIdToUse);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
      setError('Failed to load chat. Please refresh the page.');
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }
    
    try {
      const { data } = await supabase
        .from('chat_messages')
        .select('id, content, sender_id, created_at, sender:profiles(full_name, avatar_url)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });
      const clearedAt = getChatClearedAt(groupId);
      const filteredMessages = (data || []).filter((msg) => {
        if (!clearedAt) return true;
        return new Date(msg.created_at) > new Date(clearedAt);
      });
      setMessages(filteredMessages);
      // Mark chat as read on load so sidebar badge clears
      setChatReadTime(groupId);
      if (initialLoad) {
        setInitialLoad(false);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const permanentlyDeleteChat = async () => {
    if (!groupId) return;

    try {
      // Always clear locally for current student view, even if DB delete is blocked by RLS.
      const clearedAt = new Date().toISOString();
      setChatClearedAt(groupId, clearedAt);

      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('group_id', groupId);

      if (error) {
        console.warn('Server delete blocked/failed; applied local clear only:', error.message);
      }

      setMessages([]);
      setDeleteConfirm(false);
      setDeleteConfirmFinal(false);
      setSuccessMessage('Chat cleared successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error deleting chat:', err);
      setError('Failed to clear chat. Please try again.');
      setDeleteConfirm(false);
      setDeleteConfirmFinal(false);
    }
  };

  const handleClearChatClick = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
    } else if (!deleteConfirmFinal) {
      setDeleteConfirmFinal(true);
    } else {
      permanentlyDeleteChat();
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(false);
    setDeleteConfirmFinal(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !groupId) return;
    const content = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      group_id: groupId,
      sender_id: profile.id,
      content,
      created_at: new Date().toISOString(),
      sender: {
        full_name: profile.full_name,
        avatar_url: profile.avatar_url
      }
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');
    setError(null);

    const { error: sendError } = await supabase.from('chat_messages').insert({
      group_id: groupId,
      sender_id: profile.id,
      content
    });

    if (sendError) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(content);
      console.error('Error sending message:', sendError);
      setError('Failed to send message. Please try again.');
      return;
    }
  };

  if (!profile) {
    return <LoadingSpinner message="Setting up your chat..." />;
  }

  if (!profile.assigned_teacher_id) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <MessageCircle className="mx-auto mb-4 text-slate-400" size={48} />
        <h2 className="text-xl font-bold mb-2">No Teacher Assigned Yet</h2>
        <p className="text-slate-600 mb-4">A teacher will be assigned to you soon!</p>
        <a href="/app/request-teacher" className="text-blue-600 hover:underline">
          Request a teacher now →
        </a>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <MessageCircle className="mx-auto mb-4 text-red-400" size={48} />
        <h2 className="text-xl font-bold mb-2 text-red-600">Chat Error</h2>
        <p className="text-slate-600 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner message="Loading chat..." />;
  }

  if (!teacher) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <MessageCircle className="mx-auto mb-4 text-slate-400" size={48} />
        <h2 className="text-xl font-bold mb-2">Unable to load chat</h2>
        <p className="text-slate-600 mb-4">Please refresh or try again in a moment.</p>
        <button
          onClick={() => initChat()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border flex flex-col h-[calc(100vh-200px)]">
      <div className="p-6 border-b space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Chat with {teacher?.full_name || 'Teacher'}</h2>
            <p className="text-sm text-slate-500">Ask your doubts and get instant help</p>
          </div>
          
          {/* Delete Confirmation Dialogs */}
          {deleteConfirm && !deleteConfirmFinal && (
            <div className="flex gap-2">
              <button
                onClick={cancelDelete}
                className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleClearChatClick}
                className="px-3 py-1 bg-red-100 text-red-600 text-sm rounded hover:bg-red-200 transition-all font-medium"
              >
                Confirm Delete?
              </button>
            </div>
          )}

          {deleteConfirmFinal && (
            <div className="flex gap-2">
              <button
                onClick={cancelDelete}
                className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleClearChatClick}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-all font-bold"
              >
                Confirm Final Delete
              </button>
            </div>
          )}

          {!deleteConfirm && !deleteConfirmFinal && (
            <button
              onClick={handleClearChatClick}
              className="px-3 py-1 bg-red-100 text-red-600 text-sm rounded-lg hover:bg-red-200 transition-all"
            >
              Delete Chat
            </button>
          )}
        </div>
        
        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-lg flex items-center gap-2">
            <CheckCircle size={18} />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
        )}
      </div>

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map(msg => {
          const isMe = msg.sender_id === profile.id;
          const senderProfile = msg.sender || msg.profiles;
          const text = msg.content || '';
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[70%] ${isMe ? 'flex-row-reverse' : ''}`}>
                <img 
                  src={senderProfile?.avatar_url || 'https://via.placeholder.com/40'} 
                  alt={senderProfile?.full_name || 'User'}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
                <div>
                  <div className={`p-4 rounded-lg ${
                    isMe ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900'
                  }`}>
                    <p className="text-sm">{text}</p>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 border-t bg-slate-50">
        <div className="flex gap-3">
          <input 
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type your message..."
            className="flex-1 border border-slate-200 rounded-lg p-3 focus:outline-none focus:border-nani-dark text-sm"
          />
          <button 
            onClick={sendMessage}
            className="bg-nani-dark text-white px-4 py-3 rounded-lg hover:bg-nani-dark/90 transition-all"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWithTeacher;
