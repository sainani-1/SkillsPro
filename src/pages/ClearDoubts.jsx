import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { MessageCircle, Clock, User, CheckCircle, AlertCircle, Send } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const ClearDoubts = () => {
  const { profile } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [selectedChat, setSelectedChat] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [chatReadTimes, setChatReadTimes] = useState(new Map()); // Map of groupId -> lastReadAt timestamp
  const [deleteConfirm, setDeleteConfirm] = useState(false); // First confirmation
  const [deleteConfirmFinal, setDeleteConfirmFinal] = useState(false); // Second confirmation
  const [successMessage, setSuccessMessage] = useState(''); // Success toast

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      // Scroll the last message element into view - more reliable than scrollHeight
      messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  };

  // Scroll to latest message whenever chatMessages update (new messages arrived)
  useEffect(() => {
    if (chatMessages.length > 0) {
      // Scroll after DOM renders
      setTimeout(() => scrollToBottom(), 100);
      setTimeout(() => scrollToBottom(), 200);
    }
  }, [chatMessages]);

  // When chat is selected, scroll to latest message
  useEffect(() => {
    if (selectedChat && selectedChat.id) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [selectedChat?.id]);

  // Load read chats from localStorage on mount
  useEffect(() => {
    if (profile?.id) {
      const stored = localStorage.getItem(`chatReadTimes_${profile.id}`);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setChatReadTimes(new Map(data));
        } catch (e) {
          console.error('Error loading read times:', e);
        }
      }
    }
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.role === 'teacher') {
      fetchStudentChats(true); // initial load shows spinner
      // Refresh chats every 30 seconds without spinner
      const interval = setInterval(() => fetchStudentChats(false), 30000);
      return () => clearInterval(interval);
    }
  }, [profile]); // Only re-run when profile changes

  useEffect(() => {
    setChats([]);
    setSelectedChat(null);
    setChatMessages([]);
    setChatReadTimes(new Map());
    setDeleteConfirm(false);
    setDeleteConfirmFinal(false);
    setSuccessMessage('');
    setInitialLoadDone(false);
    setLoading(true);
  }, [profile?.id]);

  const fetchStudentChats = async (showSpinner = false) => {
    try {
      if (!profile?.id) return;
      if (showSpinner || !initialLoadDone) setLoading(true);
      
      // Step 1: Get all chat groups where teacher is a member with their last message in ONE query
      const { data: memberGroups, error: memberError } = await supabase
        .from('chat_members')
        .select(`
          group_id,
          chat_groups (
            id,
            name,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', profile.id);

      if (memberError) throw memberError;

      if (!memberGroups || memberGroups.length === 0) {
        setChats([]);
        setLoading(false);
        setInitialLoadDone(true);
        return;
      }

      const groups = memberGroups.map(mg => mg.chat_groups).filter(Boolean);
      const groupIds = groups.map(g => g.id);

      // Step 2: Get last message for all groups in ONE query
      const { data: allMessages } = await supabase
        .from('chat_messages')
        .select('id, content, sender_id, created_at, group_id, sender:profiles(id, full_name, avatar_url)')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false });

      // Group messages by group_id and get the last one for each
      const lastMessagesByGroup = {};
      (allMessages || []).forEach(msg => {
        if (!lastMessagesByGroup[msg.group_id]) {
          lastMessagesByGroup[msg.group_id] = msg;
        }
      });

      // Get fresh read times from localStorage
      const stored = localStorage.getItem(`chatReadTimes_${profile.id}`);
      let currentReadTimes = chatReadTimes;
      if (stored) {
        try {
          currentReadTimes = new Map(JSON.parse(stored));
        } catch (e) {
          console.error('Error loading read times:', e);
        }
      }

      // Step 3: Calculate unread count for each group from the messages we already have
      const groupsWithMessages = groups.map(group => {
        const lastReadAt = currentReadTimes.get(group.id);
        const groupMessages = (allMessages || []).filter(m => m.group_id === group.id);
        
        let unreadCount = 0;
        if (lastReadAt) {
          unreadCount = groupMessages.filter(
            m => m.sender_id !== profile.id && new Date(m.created_at) > new Date(lastReadAt)
          ).length;
        } else {
          unreadCount = groupMessages.filter(m => m.sender_id !== profile.id).length;
        }

        return {
          ...group,
          lastMessage: lastMessagesByGroup[group.id] || null,
          unreadCount,
          is_read: unreadCount === 0
        };
      });

      // Sort by updated_at descending
      groupsWithMessages.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

      setChats(groupsWithMessages);
      if (!initialLoadDone) setInitialLoadDone(true);
    } catch (err) {
      console.error('Error fetching chats:', err);
    } finally {
      if (showSpinner || !initialLoadDone) setLoading(false);
    }
  };

  const loadChatMessages = async (groupId) => {
    try {
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*, sender:profiles(id, full_name, avatar_url)')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Set messages and scroll to bottom after render
      setChatMessages(messages || []);
      
      // Multiple scroll attempts with longer delays to ensure DOM is fully rendered
      setTimeout(() => scrollToBottom(), 150);
      setTimeout(() => scrollToBottom(), 300);
      setTimeout(() => scrollToBottom(), 500);

      // Mark this chat as read with current timestamp
      const now = new Date().toISOString();
      const updatedReadTimes = new Map(chatReadTimes);
      updatedReadTimes.set(groupId, now);
      setChatReadTimes(updatedReadTimes);
      localStorage.setItem(`chatReadTimes_${profile.id}`, JSON.stringify([...updatedReadTimes]));

      // Mark this specific chat as read in local state
      const chatToSelect = chats.find(c => c.id === groupId);
      if (chatToSelect) {
        setSelectedChat({ ...chatToSelect, is_read: true, unreadCount: 0 });
      }

      // Update the chats list
      setChats(prevChats =>
        prevChats.map(c => 
          c.id === groupId 
            ? { ...c, is_read: true, unreadCount: 0 }
            : c
        )
      );
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const handleSelectChat = (chat) => {
    loadChatMessages(chat.id);
  };

  const permanentlyDeleteChat = async () => {
    if (!selectedChat) return;

    try {
      // Delete all messages in this chat group from database
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('group_id', selectedChat.id);

      if (error) throw error;

      // Close chat and show success
      setSelectedChat(null);
      setChatMessages([]);
      setDeleteConfirm(false);
      setDeleteConfirmFinal(false);
      setSuccessMessage('Chat deleted successfully!');
      
      // Remove success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Refresh chat list
      fetchStudentChats(false);
    } catch (err) {
      console.error('Error deleting chat:', err);
      alert('Failed to delete chat');
      setDeleteConfirm(false);
      setDeleteConfirmFinal(false);
    }
  };

  const handleClearChatClick = () => {
    if (!deleteConfirm) {
      // First click - show first confirmation
      setDeleteConfirm(true);
    } else if (!deleteConfirmFinal) {
      // Second click - show final confirmation
      setDeleteConfirmFinal(true);
    } else {
      // Third click - actually delete
      permanentlyDeleteChat();
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(false);
    setDeleteConfirmFinal(false);
  };

  const sendReply = async () => {
    if (!selectedChat || !reply.trim()) return;

    try {
      setSending(true);
      const payload = {
        group_id: selectedChat.id,
        sender_id: profile.id,
        content: reply.trim()
      };
      const { error } = await supabase
        .from('chat_messages')
        .insert(payload);

      if (error) throw error;

      setReply('');
      loadChatMessages(selectedChat.id);
    } catch (err) {
      console.error('Error sending reply:', err);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const filteredChats = chats.filter(c => {
    if (filter === 'unread') return c.unreadCount > 0;
    if (filter === 'read') return c.unreadCount === 0;
    return true;
  });

  const unreadCount = chats.filter(c => c.unreadCount > 0).length;
  const readCount = chats.filter(c => c.unreadCount === 0).length;

  if (profile?.role !== 'teacher') {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm text-center">
        <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
        <p className="text-slate-500 mt-1">Only teachers can access student chats.</p>
      </div>
    );
  }

  if (loading) return <LoadingSpinner message="Loading student chats..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Student Chats</h1>
        <p className="text-slate-500">View all messages from your students</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            filter === 'all'
              ? 'bg-nani-dark text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          All ({chats.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-lg font-medium transition-all relative ${
            filter === 'unread'
              ? 'bg-red-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Unread ({unreadCount})
          {unreadCount > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{unreadCount}</span>}
        </button>
        <button
          onClick={() => setFilter('read')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            filter === 'read'
              ? 'bg-nani-dark text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Read ({readCount})
        </button>
      </div>

      {filteredChats.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-slate-100 shadow-sm text-center">
          <MessageCircle className="mx-auto text-slate-300 mb-3" size={48} />
          <p className="text-slate-600 font-medium">No chats</p>
          <p className="text-slate-500 text-sm">Messages from students will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Chats List */}
          <div className="lg:col-span-2 space-y-3">
            {filteredChats.map(chat => (
              <div
                key={chat.id}
                onClick={() => handleSelectChat(chat)}
                className={`bg-white p-4 rounded-xl border cursor-pointer transition-all relative ${
                  selectedChat?.id === chat.id
                    ? 'border-nani-dark shadow-lg'
                    : 'border-slate-100 hover:border-slate-300'
                } ${chat.unreadCount > 0 ? 'bg-blue-50' : ''}`}
              >
                {/* Unread Badge */}
                {chat.unreadCount > 0 && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                    •
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <img
                    src={chat.lastMessage?.sender?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.chat_members?.[0]?.user_id || 'Student')}`}
                    alt="Student"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className={`font-semibold ${chat.unreadCount > 0 ? 'text-slate-900 font-bold' : 'text-slate-900'}`}>
                        {chat.name || 'Group Chat'}
                        {chat.unreadCount > 0 && <span className="text-red-500 ml-1">●</span>}
                      </p>
                    </div>
                    <p className={`text-sm font-medium mb-2 truncate ${chat.unreadCount > 0 ? 'text-slate-800 font-semibold' : 'text-slate-700'}`}>
                      {chat.lastMessage?.content || 'No messages yet'}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {chat.lastMessage?.created_at ? new Date(chat.lastMessage.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                      {chat.unreadCount > 0 && (
                        <span className="flex items-center gap-1 text-red-600 font-medium">
                          {chat.unreadCount} unread
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Messages Panel */}
          {selectedChat && (
            <div className="lg:col-span-3">
              <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-lg sticky top-4 space-y-4 flex flex-col h-[80vh]">
                {/* Success Message Toast */}
                {successMessage && (
                  <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
                    <CheckCircle size={18} />
                    <span className="text-sm font-medium">{successMessage}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-slate-900 flex-1">{selectedChat.name || 'Chat'}</h3>
                  
                  {/* Delete Confirmation Dialogs */}
                  {deleteConfirm && !deleteConfirmFinal && (
                    <div className="flex gap-2">
                      <button
                        onClick={cancelDelete}
                        className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded hover:bg-slate-200 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleClearChatClick}
                        className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded hover:bg-red-200 transition-all font-medium"
                      >
                        Confirm Delete?
                      </button>
                    </div>
                  )}

                  {deleteConfirmFinal && (
                    <div className="flex gap-2">
                      <button
                        onClick={cancelDelete}
                        className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded hover:bg-slate-200 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleClearChatClick}
                        className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-all font-bold"
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

                  <button
                    onClick={() => {
                      setSelectedChat(null);
                      setChatMessages([]);
                      cancelDelete();
                    }}
                    className="text-slate-400 hover:text-slate-600 text-xl"
                  >
                    ✕
                  </button>
                </div>

                {/* Messages Display */}
                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-3 bg-slate-50 p-3 rounded-lg">
                  {chatMessages.length === 0 ? (
                    <p className="text-center text-slate-500 text-sm">No messages yet</p>
                  ) : (
                    chatMessages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender_id === profile.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs p-3 rounded-lg ${
                          msg.sender_id === profile.id
                            ? 'bg-nani-dark text-white'
                            : 'bg-white text-slate-900 border border-slate-200'
                        }`}>
                          {msg.sender_id !== profile.id && (
                            <p className="text-xs font-semibold mb-1">{msg.sender?.full_name}</p>
                          )}
                          <p className="text-sm break-words">{msg.content || '(no message)'}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && sendReply()}
                    placeholder="Type your reply..."
                    className="flex-1 p-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-nani-dark"
                  />
                  <button
                    onClick={sendReply}
                    disabled={!reply.trim() || sending}
                    className="bg-nani-dark text-white px-3 py-2 rounded-lg hover:bg-nani-dark/90 disabled:opacity-50 transition-all"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClearDoubts;
