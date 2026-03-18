import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import AvatarImage from '../components/AvatarImage';
import { MessageCircle, Shield, Users, BookOpen, Calendar, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Students' },
  { value: 'teacher', label: 'Teachers' },
  { value: 'admin', label: 'Admins' },
  { value: 'all', label: 'All Users' },
];

const AdminUserAccess = () => {
  const navigate = useNavigate();
  const { startImpersonation } = useAuth();
  const { userId } = useParams();
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState('student');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [chatGroups, setChatGroups] = useState([]);
  const [chatMembersByGroup, setChatMembersByGroup] = useState({});
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [enrollments, setEnrollments] = useState([]);
  const [classSessions, setClassSessions] = useState([]);
  const [teacherStudents, setTeacherStudents] = useState([]);
  const [error, setError] = useState('');

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        String(user.full_name || '').toLowerCase().includes(query) ||
        String(user.email || '').toLowerCase().includes(query);
      return matchesRole && matchesSearch;
    });
  }, [users, roleFilter, search]);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (!userId || !users.length) return;
    const matched = users.find((user) => String(user.id) === String(userId));
    if (matched) {
      setRoleFilter(matched.role || 'all');
      void loadUserAccess(matched.id);
    }
  }, [userId, users]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, phone, avatar_url, assigned_teacher_id, created_at, premium_until')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setUsers(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  const loadUserAccess = async (targetUserId) => {
    try {
      setDetailLoading(true);
      setError('');
      setSelectedGroupId(null);
      setChatMessages([]);
      setChatMembersByGroup({});
      setNewMessage('');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, phone, avatar_url, assigned_teacher_id, created_at, premium_until, education_level, study_stream, core_subject')
        .eq('id', targetUserId)
        .single();

      if (profileError) throw profileError;
      setSelectedUser(profile);

      const [
        enrollmentResp,
        classResp,
        teacherStudentsResp,
        memberGroupsResp,
      ] = await Promise.all([
        supabase
          .from('enrollments')
          .select('id, progress, completed, courses(title, category)')
          .eq('student_id', targetUserId),
        profile.role === 'teacher'
          ? supabase
              .from('class_sessions')
              .select('id, title, scheduled_for, ends_at, meeting_type')
              .eq('teacher_id', targetUserId)
              .order('scheduled_for', { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [], error: null }),
        profile.role === 'teacher'
          ? supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('role', 'student')
              .eq('assigned_teacher_id', targetUserId)
              .order('full_name')
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('chat_members')
          .select('group_id')
          .eq('user_id', targetUserId),
      ]);

      if (enrollmentResp.error) throw enrollmentResp.error;
      if (classResp.error) throw classResp.error;
      if (teacherStudentsResp.error) throw teacherStudentsResp.error;
      if (memberGroupsResp.error) throw memberGroupsResp.error;

      setEnrollments(enrollmentResp.data || []);
      setClassSessions(classResp.data || []);
      setTeacherStudents(teacherStudentsResp.data || []);

      const groupIds = (memberGroupsResp.data || []).map((row) => row.group_id).filter(Boolean);
      if (groupIds.length === 0) {
        setChatGroups([]);
        return;
      }

      const [{ data: groups, error: groupsError }, { data: messages, error: messagesError }, { data: groupMembers, error: groupMembersError }] = await Promise.all([
        supabase
          .from('chat_groups')
          .select('id, name, created_at, group_type')
          .in('id', groupIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('chat_messages')
          .select('id, group_id, content, created_at, sender_id, sender:profiles(full_name, email)')
          .in('group_id', groupIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('chat_members')
          .select('group_id, user_id, profiles(full_name, email, role)')
          .in('group_id', groupIds),
      ]);

      if (groupsError) throw groupsError;
      if (messagesError) throw messagesError;
      if (groupMembersError) throw groupMembersError;

      const latestByGroup = {};
      (messages || []).forEach((message) => {
        if (!latestByGroup[message.group_id]) {
          latestByGroup[message.group_id] = message;
        }
      });

      const membersMap = (groupMembers || []).reduce((acc, row) => {
        if (!acc[row.group_id]) acc[row.group_id] = [];
        acc[row.group_id].push({
          user_id: row.user_id,
          full_name: row.profiles?.full_name || 'User',
          email: row.profiles?.email || '',
          role: row.profiles?.role || '',
        });
        return acc;
      }, {});

      setChatMembersByGroup(membersMap);

      const nextGroups = (groups || []).map((group) => ({
        ...group,
        latestMessage: latestByGroup[group.id] || null,
        messageCount: (messages || []).filter((message) => message.group_id === group.id).length,
        members: membersMap[group.id] || [],
      }));
      setChatGroups(nextGroups);
      if (nextGroups[0]?.id) {
        setSelectedGroupId(nextGroups[0].id);
        setChatMessages((messages || []).filter((message) => message.group_id === nextGroups[0].id).reverse());
      }
    } catch (err) {
      setError(err.message || 'Failed to load user access data.');
    } finally {
      setDetailLoading(false);
    }
  };

  const openUser = (user) => {
    navigate(`/app/admin/user-access/${user.id}`);
    void loadUserAccess(user.id);
  };

  const openUserView = () => {
    if (!selectedUser) return;
    startImpersonation(selectedUser);
    navigate('/app');
  };

  const handleSelectChat = async (groupId) => {
    setSelectedGroupId(groupId);
    setNewMessage('');
    const { data, error: messagesError } = await supabase
      .from('chat_messages')
      .select('id, group_id, content, created_at, sender_id, sender:profiles(full_name, email)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      setError(messagesError.message || 'Failed to load chat messages.');
      return;
    }
    setChatMessages(data || []);
  };

  const handleSendAdminMessage = async () => {
    if (!selectedGroupId || !selectedUser?.id || !newMessage.trim() || sendingMessage) return;

    try {
      setSendingMessage(true);
      setError('');

      const content = newMessage.trim();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        throw new Error('Admin session not found. Please sign in again.');
      }

      const { data: insertedMessage, error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          group_id: selectedGroupId,
          sender_id: user.id,
          content,
        })
        .select('id, group_id, content, created_at, sender_id, sender:profiles(full_name, email)')
        .single();

      if (insertError) throw insertError;

      setChatMessages((prev) => [...prev, insertedMessage]);
      setChatGroups((prev) =>
        prev.map((group) =>
          group.id === selectedGroupId
            ? {
                ...group,
                latestMessage: insertedMessage,
                messageCount: (group.messageCount || 0) + 1,
              }
            : group
        )
      );
      setNewMessage('');
    } catch (err) {
      setError(err.message || 'Failed to send admin message.');
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading admin user access..." />;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-6 text-white">
        <div className="flex items-center gap-3">
          <Shield size={24} />
          <div>
            <h1 className="text-2xl font-bold">Admin User Access</h1>
            <p className="text-slate-200">Review student, teacher, and admin accounts with profile, study, class, and chat visibility.</p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRoleFilter(option.value)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  roleFilter === option.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />

          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => openUser(user)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedUser?.id === user.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <AvatarImage
                    userId={user.id}
                    avatarUrl={user.avatar_url}
                    alt={user.full_name}
                    fallbackName={user.full_name || 'User'}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{user.full_name || 'User'}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{user.role}</p>
                  </div>
                </div>
              </button>
            ))}
            {filteredUsers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No users match this filter.
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          {detailLoading ? (
            <LoadingSpinner fullPage={false} message="Loading user access details..." />
          ) : !selectedUser ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
              Select a user to view account access details.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-4">
                  <AvatarImage
                    userId={selectedUser.id}
                    avatarUrl={selectedUser.avatar_url}
                    alt={selectedUser.full_name}
                    fallbackName={selectedUser.full_name || 'User'}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedUser.full_name}</h2>
                    <p className="text-sm text-slate-500">{selectedUser.email}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{selectedUser.role}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openUserView}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Open Full User View
                  </button>
                  <p className="text-xs text-slate-500 self-center">
                    This switches the app shell into that user's role/view. Some actions can still be limited by backend permissions.
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Phone</p>
                    <p className="font-semibold text-slate-800">{selectedUser.phone || '-'}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Joined</p>
                    <p className="font-semibold text-slate-800">
                      {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString('en-IN') : '-'}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Premium</p>
                    <p className="font-semibold text-slate-800">
                      {selectedUser.premium_until && new Date(selectedUser.premium_until) > new Date()
                        ? `Until ${new Date(selectedUser.premium_until).toLocaleDateString('en-IN')}`
                        : 'No'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <BookOpen size={18} className="text-blue-600" />
                    <h3 className="font-semibold text-slate-800">Learning / Teaching Context</h3>
                  </div>
                  {selectedUser.role === 'student' ? (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-600">
                        Assigned teacher: <span className="font-semibold text-slate-800">{selectedUser.assigned_teacher_id || 'Not assigned'}</span>
                      </p>
                      {enrollments.length === 0 ? (
                        <p className="text-sm text-slate-500">No enrollments found.</p>
                      ) : (
                        enrollments.map((enrollment) => (
                          <div key={enrollment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="font-medium text-slate-800">{enrollment.courses?.title || 'Course'}</p>
                            <p className="text-xs text-slate-500">{enrollment.courses?.category || '-'}</p>
                            <p className="mt-1 text-xs text-slate-600">
                              Progress: {Math.round(enrollment.progress || 0)}% {enrollment.completed ? '(Completed)' : ''}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  ) : selectedUser.role === 'teacher' ? (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600">
                        Core subject: <span className="font-semibold text-slate-800">{selectedUser.core_subject || '-'}</span>
                      </p>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-slate-800">Assigned students</p>
                        <p className="text-2xl font-bold text-blue-700">{teacherStudents.length}</p>
                      </div>
                      {classSessions.length === 0 ? (
                        <p className="text-sm text-slate-500">No recent scheduled classes found.</p>
                      ) : (
                        classSessions.map((session) => (
                          <div key={session.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="font-medium text-slate-800">{session.title || 'Class Session'}</p>
                            <p className="text-xs text-slate-500">{new Date(session.scheduled_for).toLocaleString('en-IN')}</p>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      Admin account access is available below through profile and chats.
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <UserCheck size={18} className="text-emerald-600" />
                    <h3 className="font-semibold text-slate-800">Account Snapshot</h3>
                  </div>
                  <div className="space-y-2 text-sm text-slate-700">
                    <p>Education: {selectedUser.education_level || '-'}</p>
                    <p>Stream: {selectedUser.study_stream || '-'}</p>
                    <p>User ID: <span className="font-mono text-xs">{selectedUser.id}</span></p>
                    {selectedUser.role === 'student' ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/app/admin/student/${selectedUser.id}`)}
                        className="mt-2 inline-flex rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                      >
                        Open Full Student Detail
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Users size={18} className="text-violet-600" />
                    <h3 className="font-semibold text-slate-800">Chat Groups</h3>
                  </div>
                  {chatGroups.length === 0 ? (
                    <p className="text-sm text-slate-500">No chat groups found for this user.</p>
                  ) : (
                    <div className="space-y-2">
                      {chatGroups.map((group) => (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => handleSelectChat(group.id)}
                          className={`w-full rounded-lg border p-3 text-left ${
                            selectedGroupId === group.id ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <p className="text-sm font-semibold text-slate-800">{group.name || `Chat ${group.id}`}</p>
                          <p className="text-xs text-slate-500">{group.group_type || 'chat'}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {(group.members || []).map((member) => member.full_name).join(', ') || 'No participants'}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {group.messageCount || 0} messages
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">{group.latestMessage?.content || 'No messages yet'}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <MessageCircle size={18} className="text-rose-600" />
                    <h3 className="font-semibold text-slate-800">Chat Messages</h3>
                  </div>
                  {selectedGroupId && chatMessages.length === 0 ? (
                    <p className="text-sm text-slate-500">No messages in this chat yet.</p>
                  ) : !selectedGroupId ? (
                    <p className="text-sm text-slate-500">Select a chat group to view messages.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Participants</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(chatMembersByGroup[selectedGroupId] || []).map((member) => (
                            <span
                              key={`${selectedGroupId}-${member.user_id}`}
                              className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                            >
                              {member.full_name}
                              {member.role ? ` • ${member.role}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="max-h-[500px] space-y-3 overflow-y-auto pr-1">
                        {chatMessages.map((message) => (
                          <div key={message.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-800">
                                {message.sender?.full_name || message.sender?.email || message.sender_id}
                              </p>
                              <p className="text-xs text-slate-500">{new Date(message.created_at).toLocaleString('en-IN')}</p>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{message.content || '(empty message)'}</p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Admin Reply
                        </label>
                        <div className="flex flex-col gap-3">
                          <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            rows={3}
                            placeholder="Send a message into this chat as admin"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-400"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleSendAdminMessage}
                              disabled={!newMessage.trim() || sendingMessage}
                              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              {sendingMessage ? 'Sending...' : 'Send Message'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedUser.role === 'teacher' ? (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Calendar size={18} className="text-amber-600" />
                    <h3 className="font-semibold text-slate-800">Assigned Students</h3>
                  </div>
                  {teacherStudents.length === 0 ? (
                    <p className="text-sm text-slate-500">No students are assigned to this teacher.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {teacherStudents.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => openUser(student)}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left hover:bg-slate-100"
                        >
                          <p className="text-sm font-semibold text-slate-800">{student.full_name}</p>
                          <p className="text-xs text-slate-500">{student.email}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUserAccess;
