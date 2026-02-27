import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { Send, MessageCircle, Users } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const TeacherChat = () => {
  const { profile } = useAuth();
  const { clearUnreadCount } = useChat();
  const [chatGroups, setChatGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastSeenGroupId, setLastSeenGroupId] = useState(null);
  const messagesEndRef = useRef(null);

  // Clear global unread count when opening chat
  useEffect(() => {
    clearUnreadCount();
  }, [clearUnreadCount]);

  useEffect(() => {
    if (!profile?.id) return;

    loadChatGroups();
    
    // Listen for new messages in all groups to show unread badge
    const allMessagesSubscription = supabase
      .channel('all_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      }, payload => {
        // Only increment unread if message is NOT in currently selected group
        if (payload.new.group_id !== selectedGroup) {
          setUnreadCounts(prev => ({
            ...prev,
            [payload.new.group_id]: (prev[payload.new.group_id] || 0) + 1
          }));
        }
      })
      .subscribe();
    
    return () => {
      allMessagesSubscription.unsubscribe();
    };
  }, [profile?.id]);

  useEffect(() => {
    setChatGroups([]);
    setSelectedGroup(null);
    setMessages([]);
    setGroupMembers([]);
    setUnreadCounts({});
    setLoading(true);
  }, [profile?.id]);

  useEffect(() => {
    if (selectedGroup) {
      loadMessages();
      loadMembers();
      // Mark this group as seen - clear unread only for newly viewed messages
      setLastSeenGroupId(selectedGroup);
      setUnreadCounts(prev => ({
        ...prev,
        [selectedGroup]: 0
      }));
      const subscription = supabase
        .channel(`chat:${selectedGroup}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `group_id=eq.${selectedGroup}`
        }, payload => {
          setMessages(prev => [...prev, payload.new]);
        })
        .subscribe();

      return () => subscription.unsubscribe();
    }
  }, [selectedGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatGroups = async () => {
    if (!profile?.id) return;
    try {
      console.log('Loading chat groups for teacher:', profile.id);
      
      // Get all groups where teacher is a member
      const { data: memberGroups, error: memberError } = await supabase
        .from('chat_members')
        .select('group_id')
        .eq('user_id', profile.id);

      console.log('Member groups:', memberGroups, 'Error:', memberError);

      if (!memberGroups || memberGroups.length === 0) {
        console.log('No chat groups found for teacher');
        setLoading(false);
        return;
      }

      const groupIds = memberGroups.map(m => m.group_id);
      console.log('Group IDs:', groupIds);

      // Get group details
      const { data: groups, error: groupError } = await supabase
        .from('chat_groups')
        .select('*')
        .in('id', groupIds)
        .order('created_at', { ascending: false });

      console.log('Groups:', groups, 'Error:', groupError);

      setChatGroups(groups || []);
      
      // Initialize unread counts to 0 - they'll increment only when new messages arrive
      if (groups && groups.length > 0) {
        const unreadCounts = {};
        for (const group of groups) {
          unreadCounts[group.id] = 0; // Start at 0, only show badge for NEW messages
        }
        setUnreadCounts(unreadCounts);
        console.log('Setting selected group to:', groups[0].id);
        setSelectedGroup(groups[0].id);
      }
    } catch (error) {
      console.error('Error loading chat groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!selectedGroup) return;

    try {
      const { data } = await supabase
        .from('chat_messages')
        .select('*, profiles(full_name, avatar_url)')
        .eq('group_id', selectedGroup)
        .order('created_at', { ascending: true });
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const loadMembers = async () => {
    if (!selectedGroup) return;

    try {
      const { data } = await supabase
        .from('chat_members')
        .select('*, profiles(full_name, avatar_url, email)')
        .eq('group_id', selectedGroup);
      setGroupMembers(data || []);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedGroup) return;

    try {
      await supabase.from('chat_messages').insert({
        group_id: selectedGroup,
        sender_id: profile.id,
        content: newMessage
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading chats..." />;
  }

  if (chatGroups.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 text-center">
        <MessageCircle className="mx-auto mb-4 text-slate-400" size={48} />
        <h2 className="text-xl font-bold mb-2">No Student Messages Yet</h2>
        <p className="text-slate-600">Students will send you messages here once assigned</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-200px)]">
      {/* Chat List */}
      <div className="bg-white rounded-xl border overflow-y-auto">
        <div className="p-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold flex items-center gap-2">
            <Users size={20} /> Student Chats
          </h2>
        </div>
        <div className="divide-y">
          {chatGroups.map(group => (
            <button
              key={group.id}
              onClick={() => setSelectedGroup(group.id)}
              className={`w-full p-4 text-left hover:bg-slate-50 transition flex items-center justify-between ${
                selectedGroup === group.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
              }`}
            >
              <div className="flex-1">
                <p className="font-semibold text-sm">Chat Group {group.id}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Created {new Date(group.created_at).toLocaleDateString()}
                </p>
              </div>
              {unreadCounts[group.id] > 0 && (
                <div className="ml-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold animate-pulse">
                  {unreadCounts[group.id]}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      {selectedGroup && (
        <div className="lg:col-span-3 bg-white rounded-xl border flex flex-col">
          {/* Header */}
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold">Student Chat</h2>
            <p className="text-xs text-slate-500">
              {groupMembers.length} member{groupMembers.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <MessageCircle className="mx-auto mb-2 text-slate-300" size={48} />
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.sender_id === profile.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex gap-2 max-w-[70%] ${isMe ? 'flex-row-reverse' : ''}`}>
                      <img
                        src={msg.profiles?.avatar_url || 'https://via.placeholder.com/32'}
                        alt={msg.profiles?.full_name}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                      <div>
                        <p className="text-[10px] text-slate-600 mb-1">
                          {msg.profiles?.full_name}
                        </p>
                        <div
                          className={`p-3 rounded-lg ${
                            isMe ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900'
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && sendMessage()}
                placeholder="Type your message..."
                className="flex-1 border rounded-lg p-2 text-sm"
              />
              <button
                onClick={sendMessage}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherChat;
