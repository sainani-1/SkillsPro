import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import AlertModal from '../components/AlertModal';
import { ClipboardList, CheckCircle, XCircle, User, Calendar, Clock, Save } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const Attendance = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const studentsRef = useRef([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingChanges, setPendingChanges] = useState({});
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canAccessSession, setCanAccessSession] = useState(false);
  const [attendanceLocked, setAttendanceLocked] = useState(false);
  const [attendanceOverride, setAttendanceOverride] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });
    useEffect(() => {
      studentsRef.current = students;
    }, [students]);
  const isTeacher = profile?.role === 'teacher';
  const isAdmin = profile?.role === 'admin';

  // Check if selected session is today
  const checkSessionDate = (session) => {
    if (!session) return false;
    const today = new Date();
    const sessionDate = new Date(session.scheduled_for);
    return today.toDateString() === sessionDate.toDateString();
  };


  const loadData = async (options = {}) => {
    const { silent = false } = options;
    if (!profile) return;
    if (!silent) setLoading(true);

    if (isTeacher || isAdmin) {
      let query = supabase
        .from('class_sessions')
        .select('*');
      
      if (isTeacher) {
        query = query.eq('teacher_id', profile.id);
      }
      
      const { data: classSessions } = await query.order('scheduled_for', { ascending: false });

      let guidanceQuery = supabase
        .from('guidance_sessions')
        .select('*, guidance_requests(*)');
      
      if (isTeacher) {
        guidanceQuery = guidanceQuery.eq('teacher_id', profile.id);
      }
      
      const { data: guidanceSessions } = await guidanceQuery.order('scheduled_for', { ascending: false });

      // Combine both types
      const allSessions = [
        ...(classSessions || []).map(s => ({ ...s, type: 'class', title: s.title })),
        ...(guidanceSessions || []).map(s => ({ 
          ...s, 
          type: 'guidance', 
          title: s.guidance_requests?.topic || 'Guidance Session'
        }))
      ].sort((a, b) => new Date(b.scheduled_for) - new Date(a.scheduled_for));

      setSessions(allSessions);

      // Load all assigned students
      let studentQuery = supabase
        .from('guidance_requests')
        .select('student_id, profiles!guidance_requests_student_id_fkey(id, full_name, avatar_url, email)');
      
      if (isTeacher) {
        studentQuery = studentQuery.eq('assigned_to_teacher_id', profile.id);
      }
      
      const { data: assignedStudents } = await studentQuery;

      const uniqueStudents = {};
      assignedStudents?.forEach(item => {
        const student = item.profiles;
        if (student && !uniqueStudents[student.id]) {
          uniqueStudents[student.id] = student;
        }
      });

      setStudents(Object.values(uniqueStudents));
    } else {
      // Student: Load their attendance records from both tables
      const { data: classAttendance } = await supabase
        .from('class_attendance')
        .select('*, session:class_sessions(title, scheduled_for)')
        .eq('student_id', profile.id)
        .order('marked_at', { ascending: false });

      const { data: guidanceAttendance } = await supabase
        .from('guidance_attendance')
        .select('*, session:guidance_sessions(scheduled_for, guidance_requests(topic))')
        .eq('student_id', profile.id)
        .order('marked_at', { ascending: false });

      const combined = [
        ...(classAttendance || []).map(a => ({ ...a, type: 'class' })),
        ...(guidanceAttendance || []).map(a => ({ ...a, type: 'guidance' }))
      ].sort((a, b) => new Date(b.marked_at) - new Date(a.marked_at));

      setAttendanceRecords(combined);
    }
    
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [profile]);

  useEffect(() => {
    if (!profile || isTeacher || isAdmin) return;

    const channel = supabase
      .channel(`attendance:student:${profile.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'class_attendance',
        filter: `student_id=eq.${profile.id}`
      }, () => {
        loadData({ silent: true });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'guidance_attendance',
        filter: `student_id=eq.${profile.id}`
      }, () => {
        loadData({ silent: true });
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [profile, isTeacher, isAdmin]);

  const loadSessionAttendance = async (session) => {
    const tableName = session.type === 'class' ? 'class_attendance' : 'guidance_attendance';
    const { data } = await supabase
      .from(tableName)
      .select('id, student_id, attended')
      .eq('session_id', session.id);

    let overrideActive = false;
    if (isAdmin) {
      const { data: overrideData, error: overrideError } = await supabase
        .from('attendance_edit_overrides')
        .select('is_unlocked')
        .eq('session_id', session.id)
        .eq('session_type', session.type)
        .maybeSingle();

      if (overrideError) {
        console.error('Override lookup error:', overrideError);
      }

      overrideActive = !!overrideData?.is_unlocked;
      setAttendanceOverride(overrideActive);
    }

    if (data && data.length > 0) {
      setAttendanceLocked(!(isAdmin && overrideActive));
    } else {
      setAttendanceLocked(false);
    }

    const attendanceMap = {};
    data?.forEach(record => {
      attendanceMap[record.student_id] = record.attended;
    });

    const currentStudents = studentsRef.current || [];
    const studentsWithAttendance = currentStudents.map(s => ({
      ...s,
      attended: attendanceMap[s.id],
      locked: false,
      recordId: data?.find(r => r.student_id === s.id)?.id
    }));

    setStudents(studentsWithAttendance);
  };

  const selectSessionForAttendance = async (session) => {
    const isToday = checkSessionDate(session);
    if (!isToday && !isAdmin) {
      setAlertModal({
        show: true,
        title: 'Cannot Mark Attendance',
        message: 'Attendance can only be marked on the day of the session.',
        type: 'warning'
      });
      return;
    }

    if (!isAdmin) {
      const tableName = session.type === 'class' ? 'class_attendance' : 'guidance_attendance';
      const { count, error } = await supabase
        .from(tableName)
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session.id);

      if (error) {
        console.error('Attendance lookup error:', error);
      }

      if ((count || 0) > 0) {
        setAlertModal({
          show: true,
          title: 'Attendance Locked',
          message: 'Attendance was already posted and cannot be reopened.',
          type: 'warning'
        });
        return;
      }
    }
    setSelectedSession(session);
    setCanAccessSession(true);
    setActiveTab('mark');
    setPendingChanges({});
    setHasPendingChanges(false);
    setAttendanceLocked(false);
    setAttendanceOverride(false);
    await loadSessionAttendance(session);
  };

  useEffect(() => {
    if (!selectedSession) return;

    const tableName = selectedSession.type === 'class' ? 'class_attendance' : 'guidance_attendance';
    const channel = supabase
      .channel(`attendance:${selectedSession.type}:${selectedSession.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: tableName,
        filter: `session_id=eq.${selectedSession.id}`
      }, () => {
        loadSessionAttendance(selectedSession);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [selectedSession]);

  const markAttendance = (studentId, attended) => {
    const isToday = selectedSession ? checkSessionDate(selectedSession) : false;
    if (!isToday && !(isAdmin && attendanceOverride)) {
      setAlertModal({
        show: true,
        title: 'Cannot Mark Attendance',
        message: 'Attendance can only be marked on the day of the session.',
        type: 'warning'
      });
      return;
    }

    if (attendanceLocked && !(isAdmin && attendanceOverride)) {
      setAlertModal({
        show: true,
        title: 'Attendance Locked',
        message: 'Attendance was already posted and cannot be edited.',
        type: 'warning'
      });
      return;
    }
    // Add to pending changes
    setPendingChanges(prev => ({
      ...prev,
      [studentId]: attended
    }));
    setHasPendingChanges(true);

    // Update UI immediately
    setStudents(prev => prev.map(s => 
      s.id === studentId ? { ...s, attended } : s
    ));
  };

  const saveAttendance = async () => {
    if (!selectedSession || !hasPendingChanges) return;
    const isToday = selectedSession ? checkSessionDate(selectedSession) : false;
    if (!isToday && !(isAdmin && attendanceOverride)) {
      setAlertModal({
        show: true,
        title: 'Cannot Mark Attendance',
        message: 'Attendance can only be marked on the day of the session.',
        type: 'warning'
      });
      return;
    }
    if (attendanceLocked && !(isAdmin && attendanceOverride)) {
      setAlertModal({
        show: true,
        title: 'Attendance Locked',
        message: 'Attendance was already posted and cannot be edited.',
        type: 'warning'
      });
      return;
    }
    setSaving(true);

    const tableName = selectedSession.type === 'class' ? 'class_attendance' : 'guidance_attendance';
    const teacherId = selectedSession.teacher_id || profile.id;
    
    try {
      for (const [studentId, attended] of Object.entries(pendingChanges)) {
        const student = students.find(s => s.id === studentId);
        
        const { error } = await supabase
          .from(tableName)
          .upsert({
            id: student?.recordId,
            session_id: selectedSession.id,
            student_id: studentId,
            teacher_id: teacherId,
            attended: attended,
            marked_at: new Date().toISOString(),
          }, {
            onConflict: 'session_id,student_id'
          });

        if (error) {
          console.error('Error saving attendance:', error);
          setAlertModal({
            show: true,
            title: 'Error',
            message: 'Error saving attendance: ' + error.message,
            type: 'error'
          });
          setSaving(false);
          return;
        }
      }

      setPendingChanges({});
      setHasPendingChanges(false);
      if (!attendanceOverride) setAttendanceLocked(true);
      setAlertModal({
        show: true,
        title: 'Success',
        message: 'Attendance saved successfully!',
        type: 'success'
      });
    } catch (err) {
      console.error(err);
      setAlertModal({
        show: true,
        title: 'Error',
        message: 'Error saving attendance',
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };


  if (loading) return <LoadingSpinner message="Loading attendance management..." />;

  if (!isTeacher && !isAdmin) {
    // Student view - show their attendance history
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Attendance</h1>
          <p className="text-slate-500">Your attendance history across all sessions</p>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Session</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {attendanceRecords.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                    No attendance records yet
                  </td>
                </tr>
              ) : (
                attendanceRecords.map(record => (
                  <tr key={`${record.type}-${record.id}`}>
                    <td className="px-6 py-4">
                      {record.type === 'class' ? record.session?.title : record.session?.guidance_requests?.topic || 'Guidance'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        record.type === 'class' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {record.type === 'class' ? 'Class' : 'Guidance'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(record.session?.scheduled_for).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {record.attended ? (
                        <span className="flex items-center gap-1 text-green-600 font-semibold">
                          <CheckCircle size={18} /> Present
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 font-semibold">
                          <XCircle size={18} /> Absent
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Teacher/Admin view - tabs for sessions and marking
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Attendance Management</h1>
        <p className="text-slate-500">{isAdmin ? 'View and manage all attendance' : 'Mark and view attendance for your sessions'}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === 'sessions'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Sessions ({sessions.length})
        </button>
        <button
          onClick={() => setActiveTab('mark')}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === 'mark'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          disabled={!selectedSession}
        >
          Mark Attendance {selectedSession && `- ${selectedSession.title}`}
        </button>
      </div>

      {activeTab === 'sessions' && (
        <div className="grid gap-4">
          {sessions.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border text-center text-slate-500">
              No sessions found. Sessions will appear here once scheduled.
            </div>
          ) : (
            sessions.map(session => (
              <div key={`${session.type}-${session.id}`} className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-lg">{session.title}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${
                        session.type === 'class' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {session.type === 'class' ? 'Class' : 'Guidance'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(session.scheduled_for).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {new Date(session.scheduled_for).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => selectSessionForAttendance(session)}
                    disabled={!checkSessionDate(session) && !isAdmin}
                    title={checkSessionDate(session) || isAdmin ? 'Mark attendance' : 'Attendance can only be marked on session day'}
                    className={`px-4 py-2 rounded-lg transition-colors font-semibold ${
                      checkSessionDate(session) || isAdmin
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-slate-300 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    {checkSessionDate(session) || isAdmin ? 'Mark Attendance' : 'Not Today'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'mark' && selectedSession && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-xl border">
            <h3 className="font-bold text-lg">{selectedSession.title}</h3>
            <p className="text-sm text-slate-600">
              {new Date(selectedSession.scheduled_for).toLocaleString()} • 
              <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                selectedSession.type === 'class' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
              }`}>
                {selectedSession.type === 'class' ? 'Class Session' : 'Guidance Session'}
              </span>
            </p>
            {attendanceLocked && (
              <p className="text-sm text-red-600 mt-2">
                Attendance already posted. Editing is disabled.
              </p>
            )}
            {isAdmin && !checkSessionDate(selectedSession) && !attendanceOverride && (
              <p className="text-sm text-orange-700 mt-2">
                Attendance can only be marked on the session day unless override is enabled.
              </p>
            )}
            {isAdmin && attendanceOverride && (
              <p className="text-sm text-green-700 mt-2">
                Admin override enabled. Editing allowed.
              </p>
            )}
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (!selectedSession) return;
                  setOverrideLoading(true);

                  if (attendanceOverride) {
                    const { error } = await supabase
                      .from('attendance_edit_overrides')
                      .delete()
                      .eq('session_id', selectedSession.id)
                      .eq('session_type', selectedSession.type);

                    if (error) {
                      console.error('Override delete error:', error);
                      setAlertModal({
                        show: true,
                        title: 'Error',
                        message: 'Failed to disable override: ' + error.message,
                        type: 'error'
                      });
                      setOverrideLoading(false);
                      return;
                    }

                    setAttendanceOverride(false);
                    setAttendanceLocked(true);
                    setOverrideLoading(false);
                    return;
                  }

                  const { error } = await supabase
                    .from('attendance_edit_overrides')
                    .insert({
                      session_id: selectedSession.id,
                      session_type: selectedSession.type,
                      is_unlocked: true,
                      unlocked_by: profile.id,
                      unlocked_at: new Date().toISOString()
                    });

                  if (error) {
                    console.error('Override insert error:', error);
                    setAlertModal({
                      show: true,
                      title: 'Error',
                      message: 'Failed to enable override: ' + error.message,
                      type: 'error'
                    });
                    setOverrideLoading(false);
                    return;
                  }

                  setAttendanceOverride(true);
                  setAttendanceLocked(false);
                  setOverrideLoading(false);
                }}
                disabled={overrideLoading}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  attendanceOverride
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                } disabled:opacity-60`}
              >
                {overrideLoading
                  ? 'Updating...'
                  : attendanceOverride
                  ? 'Disable Re-Edit'
                  : 'Allow Re-Edit'}
              </button>
            </div>
          )}

          {/* Save Button */}
          {hasPendingChanges && !attendanceLocked && (
            <div className="flex gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex-1">
                <p className="font-semibold text-yellow-900">You have pending changes</p>
                <p className="text-sm text-yellow-800">Click Save to apply these changes</p>
              </div>
              <button
                onClick={saveAttendance}
                disabled={saving}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={18} />
                {saving ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          )}

          <div className="grid gap-3">
            {students.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border text-center text-slate-500">
                No students assigned yet.
              </div>
            ) : (
              students.map(student => (
                <div key={student.id} className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4 relative">
                  {/* Student Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold overflow-hidden">
                    {student.avatar_url ? (
                      <img src={student.avatar_url} alt={student.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <User size={24} />
                    )}
                  </div>

                  {/* Student Info */}
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{student.full_name}</p>
                    <p className="text-xs text-slate-500 font-mono">{student.id.substring(0, 8)}...</p>
                    <p className="text-xs text-slate-600">{student.email}</p>
                  </div>

                  {/* Attendance Status */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => markAttendance(student.id, true)}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                        student.attended === true
                          ? 'bg-green-600 text-white ring-2 ring-green-300'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      <CheckCircle size={18} className="inline mr-1" />
                      Present
                    </button>
                    <button
                      onClick={() => markAttendance(student.id, false)}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                        student.attended === false
                          ? 'bg-red-600 text-white ring-2 ring-red-300'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      <XCircle size={18} className="inline mr-1" />
                      Absent
                    </button>

                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
