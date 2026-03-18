import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Calendar, Plus, Clock, Video, ExternalLink, Trash2, X } from 'lucide-react';
import AlertModal from '../components/AlertModal';
import { sendAdminNotification } from '../utils/adminNotifications';

const ClassSchedule = () => {
  const { profile, isPremium } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [joinLink, setJoinLink] = useState('');
  const [meetingType, setMeetingType] = useState('jitsi');
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });
  const [deleteModal, setDeleteModal] = useState({ show: false, sessionId: null, sessionTitle: '' });
  const [nowTick, setNowTick] = useState(Date.now());

  // Convert datetime-local value to UTC ISO assuming input is IST clock time.
  // This keeps 18:14 entered by teacher displayed as 18:14 for all users in IST.
  const istLocalToUtcIso = (dateTimeLocal) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(dateTimeLocal || '');
    if (!match) return null;
    const [, y, m, d, hh, mm] = match;
    const utcMs = Date.UTC(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm)
    ) - (5.5 * 60 * 60 * 1000); // IST offset
    return new Date(utcMs).toISOString();
  };

  useEffect(() => {
    if (!profile?.id || !profile?.role) return;
    loadSessions();
    loadStudents();
    if (profile.role === 'admin') {
      loadTeachers();
    }
  }, [profile?.id, profile?.role]);

  // Auto refresh every 1 minute:
  // - refresh sessions so newly scheduled classes appear automatically
  // - update time-based status (upcoming/completed) without manual reload
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(Date.now());
      loadSessions();
    }, 60000);
    return () => clearInterval(interval);
  }, [profile?.id, profile?.role]);

  const loadTeachers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'teacher')
      .order('full_name');
    setTeachers(data || []);
  };

  const loadStudents = async () => {
    let query = supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'student');

    if (profile?.role === 'teacher') {
      query = query.eq('assigned_teacher_id', profile.id);
    }

    const { data } = await query.order('full_name');
    setStudents(data || []);
  };

  const loadSessions = async () => {
    let query;
    if (profile?.role === 'admin') {
      query = supabase
        .from('class_sessions')
        .select('*, class_session_participants(student_id, profiles(full_name))');
    } else if (profile?.role === 'teacher') {
      query = supabase
        .from('class_sessions')
        .select('*, class_session_participants(student_id, profiles(full_name))')
        .eq('teacher_id', profile.id);
    } else {
      query = supabase
        .from('class_sessions')
        .select('*, class_session_participants!inner(student_id)')
        .eq('class_session_participants.student_id', profile.id);
    }
    
    const { data } = await query.order('scheduled_for', { ascending: false });
    setSessions(data || []);
  };

  const getSessionEndTime = (session) => {
    if (session?.ends_at) return new Date(session.ends_at);
    const start = new Date(session.scheduled_for);
    return new Date(start.getTime() + 60 * 60 * 1000);
  };

  const isSessionCompleted = (session) => {
    // nowTick forces re-render and status recomputation every minute.
    void nowTick;
    return new Date() >= getSessionEndTime(session);
  };

  const deleteSession = async () => {
    const sessionId = deleteModal.sessionId;
    setDeleteModal({ show: false, sessionId: null, sessionTitle: '' });

    try {
      // Delete participants first
      await supabase
        .from('class_session_participants')
        .delete()
        .eq('session_id', sessionId);

      // Delete session
      const { error } = await supabase
        .from('class_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      setAlertModal({
        show: true,
        title: 'Success',
        message: 'Session deleted successfully',
        type: 'success'
      });

      loadSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
      setAlertModal({
        show: true,
        title: 'Error',
        message: 'Failed to delete session',
        type: 'error'
      });
    }
  };

  const createSession = async () => {
    if (!title || !scheduledAt || !endsAt) {
      setAlertModal({
        show: true,
        title: 'Missing Information',
        message: 'Please fill session title, start time and session upto time',
        type: 'warning'
      });
      return;
    }

    if (profile.role === 'admin' && !selectedTeacher) {
      setAlertModal({
        show: true,
        title: 'Missing Teacher',
        message: 'Please select a teacher for this session',
        type: 'warning'
      });
      return;
    }

    if (meetingType === 'external' && !joinLink) {
      setAlertModal({
        show: true,
        title: 'Missing Link',
        message: 'Please provide meeting link for external platform',
        type: 'warning'
      });
      return;
    }
    
    const link = meetingType === 'external' ? joinLink : null;
    
    const isoDateString = istLocalToUtcIso(scheduledAt);
    if (!isoDateString) {
      setAlertModal({
        show: true,
        title: 'Invalid Date',
        message: 'Please select a valid date and time',
        type: 'warning'
      });
      return;
    }
    const endsAtIso = istLocalToUtcIso(endsAt);
    if (!endsAtIso) {
      setAlertModal({
        show: true,
        title: 'Invalid End Time',
        message: 'Please select a valid session upto time',
        type: 'warning'
      });
      return;
    }
    if (new Date(endsAtIso) <= new Date(isoDateString)) {
      setAlertModal({
        show: true,
        title: 'Invalid Duration',
        message: 'Session upto time must be after start time',
        type: 'warning'
      });
      return;
    }
    
    const teacherId = profile.role === 'admin' ? selectedTeacher : profile.id;

    const { data: sessionData, error: sessionError } = await supabase.from('class_sessions').insert({
      teacher_id: teacherId,
      title,
      scheduled_for: isoDateString,
      ends_at: endsAtIso,
      meeting_link: link,
      meeting_type: meetingType
    }).select().single();

    if (sessionError) {
      setAlertModal({
        show: true,
        title: 'Error',
        message: 'Failed to create session',
        type: 'error'
      });
      return;
    }

    // Add participants:
    // - selected students, or
    // - all students when none selected.
    const recipientStudentIds = selectedStudents.length > 0
      ? selectedStudents
      : (students || []).map((s) => s.id);

    if (recipientStudentIds.length > 0) {
      const participants = recipientStudentIds.map(studentId => ({
        session_id: sessionData.id,
        student_id: studentId
      }));
      const { error: participantError } = await supabase
        .from('class_session_participants')
        .insert(participants);

      if (participantError) {
        setAlertModal({
          show: true,
          title: 'Error',
          message: 'Session created, but failed to assign students',
          type: 'warning'
        });
      }
    }

    // Create class notifications for scheduled students so they see it in dashboard/notifications.
    try {
      const schedulerName = profile?.full_name || 'Teacher';
      const sessionTime = new Date(sessionData.scheduled_for).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      });
      const basePayload = {
        title: `Class Scheduled: ${title}`,
        content: `${schedulerName} scheduled "${title}" for ${sessionTime} (upto ${new Date(sessionData.ends_at || new Date(new Date(sessionData.scheduled_for).getTime() + 60 * 60 * 1000)).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        })}).`,
        type: 'info',
        target_role: 'student'
      };

      if (recipientStudentIds.length > 0) {
        const notificationRows = recipientStudentIds.map((studentId) => ({
          ...basePayload,
          target_user_id: studentId,
          class_session_id: sessionData.id,
          admin_id: profile?.id || null
        }));
        const { error: notifError } = await supabase.from('admin_notifications').insert(notificationRows);
        if (notifError && (String(notifError.message || '').includes('target_user_id') || String(notifError.message || '').includes('class_session_id'))) {
          // Backward compatibility when new columns are not present yet.
          const fallbackRows = recipientStudentIds.map((studentId) => ({
            ...basePayload,
            content: `[target_user_id:${studentId}] ${basePayload.content}`,
            admin_id: profile?.id || null
          }));
          await supabase.from('admin_notifications').insert(fallbackRows);
        }
      } else {
        const { error: notifError } = await supabase.from('admin_notifications').insert({
          ...basePayload,
          class_session_id: sessionData.id,
          admin_id: profile?.id || null
        });
        if (notifError && String(notifError.message || '').includes('class_session_id')) {
          await supabase.from('admin_notifications').insert({
            ...basePayload,
            admin_id: profile?.id || null
          });
        }
      }
    } catch (notificationError) {
      console.error('Failed to create class notifications:', notificationError);
    }

    if (profile?.role === 'teacher') {
      await sendAdminNotification({
        title: 'New Class Scheduled',
        content: `${profile?.full_name || 'Teacher'} scheduled "${title}" for ${new Date(sessionData.scheduled_for).toLocaleString('en-IN')}.`,
        admin_id: profile?.id || null,
      });
    }
    
    setTitle('');
    setScheduledAt('');
    setEndsAt('');
    setJoinLink('');
    setMeetingType('jitsi');
    setSelectedStudents([]);
    setSelectedTeacher('');
    setShowForm(false);
    setAlertModal({
      show: true,
      title: 'Success',
      message: 'Session scheduled and student notifications sent.',
      type: 'success'
    });
    loadSessions();
  };

  const isFreeStudent = profile?.role === 'student' && !isPremium(profile);

  if (isFreeStudent) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Class Schedule</h1>
            <p className="text-slate-500">Manage daily live sessions (9-10 AM, 5-6 PM)</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
          <h2 className="text-xl font-bold text-amber-900 mb-2">Upgrade to Premium</h2>
          <p className="text-amber-800 mb-4">
            Live classes are available for premium members only.
          </p>
          <a
            href="/app/payment"
            className="inline-block px-5 py-2.5 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700"
          >
            Upgrade Now
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Class Schedule</h1>
          <p className="text-slate-500">Manage daily live sessions (9-10 AM, 5-6 PM)</p>
        </div>
        {(profile.role === 'teacher' || profile.role === 'admin') && (
          <button 
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={20} />
            Schedule Session
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-6 border">
          <h2 className="text-lg font-bold mb-4">Schedule New Session</h2>
          <div className="space-y-4">
            {profile.role === 'admin' && (
              <div>
                <label className="block text-sm font-medium mb-2">Assign Teacher</label>
                <select
                  value={selectedTeacher}
                  onChange={e => setSelectedTeacher(e.target.value)}
                  className="w-full border rounded-lg p-2"
                >
                  <option value="">Choose teacher...</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.full_name} ({teacher.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">Session Title</label>
              <input 
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Python Basics - Morning Session"
                className="w-full border rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Date & Time</label>
              <input 
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full border rounded-lg p-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                Recommended slots: 9:00-10:00 AM or 5:00-6:00 PM
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Session Upto</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={e => setEndsAt(e.target.value)}
                className="w-full border rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Meeting Platform</label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => setMeetingType('jitsi')}
                  className={`p-3 border-2 rounded-lg text-left transition ${
                    meetingType === 'jitsi' 
                      ? 'border-blue-600 bg-blue-50' 
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="font-semibold text-sm">Jitsi Meet</div>
                  <div className="text-xs text-slate-500">Our Platform</div>
                </button>
                <button
                  type="button"
                  onClick={() => setMeetingType('external')}
                  className={`p-3 border-2 rounded-lg text-left transition ${
                    meetingType === 'external' 
                      ? 'border-purple-600 bg-purple-50' 
                      : 'border-slate-200 hover:border-purple-300'
                  }`}
                >
                  <div className="font-semibold text-sm">External Link</div>
                  <div className="text-xs text-slate-500">Zoom, Meet, etc.</div>
                </button>
              </div>
              {meetingType === 'external' && (
                <input 
                  type="text"
                  value={joinLink}
                  onChange={e => setJoinLink(e.target.value)}
                  placeholder="https://zoom.us/j/... or Google Meet link"
                  className="w-full border rounded-lg p-2"
                  required
                />
              )}
              {meetingType === 'jitsi' && (
                <p className="text-xs text-green-600 mt-2">
                  ✓ Meeting room will be automatically created with Jitsi
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Students (Optional - Leave empty for all assigned students)
              </label>
              <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedStudents.length === students.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStudents(students.map(s => s.id));
                      } else {
                        setSelectedStudents([]);
                      }
                    }}
                    className="rounded"
                  />
                  <span className="font-semibold">Select All ({students.length})</span>
                </label>
                <div className="border-t pt-2 space-y-1">
                  {students.map(student => (
                    <label key={student.id} className="flex items-center gap-2 text-sm hover:bg-slate-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudents([...selectedStudents, student.id]);
                          } else {
                            setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                          }
                        }}
                        className="rounded"
                      />
                      <span>{student.full_name}</span>
                      <span className="text-xs text-slate-400">({student.email})</span>
                    </label>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {selectedStudents.length === 0 ? 'All assigned students can join' : `${selectedStudents.length} student(s) selected`}
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={createSession}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Create Session
              </button>
              <button 
                onClick={() => setShowForm(false)}
                className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl p-6 border">
        <h2 className="text-lg font-bold mb-4">Upcoming Sessions</h2>
        <div className="space-y-3">
          {sessions.filter((s) => !isSessionCompleted(s)).map(session => (
            (() => {
              const isStudent = profile.role === 'student';
              const start = new Date(session.scheduled_for);
              const end = getSessionEndTime(session);
              const now = new Date();
              const canStudentJoinNow = !isStudent || (now >= start && now < end);
              return (
            <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${session.meeting_type === 'jitsi' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                  {session.meeting_type === 'jitsi' ? (
                    <Video className="text-blue-600" size={24} />
                  ) : (
                    <ExternalLink className="text-purple-600" size={24} />
                  )}
                </div>
                <div>
                  <p className="font-semibold">{session.title}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(session.scheduled_for).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                      timeZone: 'Asia/Kolkata'
                    })}
                  </p>
                  <p className="text-xs text-slate-500">
                    Upto: {getSessionEndTime(session).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                      timeZone: 'Asia/Kolkata'
                    })}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {session.meeting_type === 'jitsi' ? '🟢 Jitsi Meet' : '🔗 External Platform'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {session.meeting_type === 'jitsi' ? (
                  <button
                    onClick={() => {
                      if (!canStudentJoinNow) return;
                      console.log('Join Class button clicked, session:', session);
                      console.log('Navigating to:', `/live-class/${session.id}`);
                      navigate(`/live-class/${session.id}`);
                    }}
                    disabled={!canStudentJoinNow}
                    className={`px-6 py-2 rounded-lg text-sm flex items-center gap-2 transition ${
                      canStudentJoinNow
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-slate-300 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <Video size={18} />
                    {canStudentJoinNow ? 'Join Class' : 'Available at Scheduled Time'}
                  </button>
                ) : (
                  <a 
                    href={session.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (!canStudentJoinNow) e.preventDefault();
                    }}
                    className={`px-6 py-2 rounded-lg text-sm flex items-center gap-2 transition ${
                      canStudentJoinNow
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-slate-300 text-slate-600 pointer-events-none'
                    }`}
                  >
                    <ExternalLink size={18} />
                    {canStudentJoinNow ? 'Open Link' : 'Available at Scheduled Time'}
                  </a>
                )}
                {(profile.role === 'teacher' || profile.role === 'admin') && (
                  <button
                    onClick={() => setDeleteModal({ show: true, sessionId: session.id, sessionTitle: session.title })}
                    className="bg-red-600 text-white p-2 rounded-lg text-sm hover:bg-red-700 transition"
                    title="Delete Session"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
              );
            })()
          ))}
          {sessions.filter((s) => !isSessionCompleted(s)).length === 0 && (
            <p className="text-center text-slate-400 py-8">No upcoming sessions</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border">
        <h2 className="text-lg font-bold mb-4">Past Sessions</h2>
        <div className="space-y-2">
          {sessions.filter((s) => isSessionCompleted(s)).map(session => (
            <div key={session.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="font-semibold text-sm">{session.title}</p>
                <p className="text-xs text-slate-500">
                  {new Date(session.scheduled_for).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'Asia/Kolkata'
                  })}
                </p>
                <p className="text-xs text-slate-500">
                  Upto: {getSessionEndTime(session).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'Asia/Kolkata'
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-slate-200 text-slate-600 px-3 py-1 rounded-full">
                  Completed
                </span>
                {(profile.role === 'teacher' || profile.role === 'admin') && (
                  <button
                    onClick={() => setDeleteModal({ show: true, sessionId: session.id, sessionTitle: session.title })}
                    className="text-red-600 hover:text-red-700 p-1"
                    title="Delete Session"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {sessions.filter((s) => isSessionCompleted(s)).length === 0 && (
            <p className="text-center text-slate-400 py-4">No past sessions</p>
          )}
        </div>
      </div>
      <AlertModal
        show={alertModal.show}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ show: false, title: '', message: '', type: 'info' })}
      />

      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="bg-red-100 p-3 rounded-full">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Session</h3>
                <p className="text-gray-600 mb-1">Are you sure you want to delete this session?</p>
                <p className="text-sm font-semibold text-gray-800 mb-4">"{deleteModal.sessionTitle}"</p>
                <p className="text-sm text-red-600">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteModal({ show: false, sessionId: null, sessionTitle: '' })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={deleteSession}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassSchedule;
