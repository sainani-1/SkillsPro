import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import AlertModal from '../components/AlertModal';
import { ClipboardList, CheckCircle, XCircle, User, Calendar, Clock, Save, X } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const Attendance = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [assignedStudents, setAssignedStudents] = useState([]);
  const studentsRef = useRef([]);
  const assignedStudentsRef = useRef([]);
  const sessionStudentsCacheRef = useRef({});
  const [selectedSession, setSelectedSession] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingChanges, setPendingChanges] = useState({});
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [postedSessionKeys, setPostedSessionKeys] = useState({});
  const [canAccessSession, setCanAccessSession] = useState(false);
  const [attendanceLocked, setAttendanceLocked] = useState(false);
  const [attendanceOverride, setAttendanceOverride] = useState(false);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [sequentialSaving, setSequentialSaving] = useState(false);
  const [sessionMarkedCount, setSessionMarkedCount] = useState(0);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });
  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  useEffect(() => {
    assignedStudentsRef.current = assignedStudents;
  }, [assignedStudents]);
  const isTeacher = profile?.role === 'teacher';
  const isAdmin = profile?.role === 'admin';

  const isSameCalendarDay = (left, right) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  // Attendance opens after the session start time and remains open until the end of that day.
  const canMarkAttendanceNow = (session) => {
    if (!session) return false;
    const now = new Date();
    const sessionDate = new Date(session.scheduled_for);
    if (!isSameCalendarDay(now, sessionDate)) return false;
    return now >= sessionDate;
  };

  const getSessionEndTime = (session) => {
    if (!session) return null;
    if (session.ends_at) return new Date(session.ends_at);
    const start = new Date(session.scheduled_for);
    return new Date(start.getTime() + 60 * 60 * 1000);
  };

  const getTeacherAttendanceStatus = (session, alreadyPosted) => {
    if (alreadyPosted) {
      return {
        label: 'Already Posted',
        title: 'Attendance already saved for this session'
      };
    }

    const now = new Date();
    const startTime = new Date(session.scheduled_for);
    const endTime = getSessionEndTime(session);

    if (now < startTime) {
      return {
        label: 'Not Yet Started',
        title: 'Attendance will be available after the scheduled start time'
      };
    }

    if (endTime && now >= endTime) {
      return {
        label: 'Not Posted',
        title: 'This session is completed but attendance has not been posted yet'
      };
    }

    return {
      label: 'Mark Attendance',
      title: 'Mark attendance'
    };
  };


  const loadData = async (options = {}) => {
    const { silent = false } = options;
    if (!profile) return;
    if (!silent) setLoading(true);

    if (isTeacher || isAdmin) {
      let query = supabase
        .from('class_sessions')
        .select('*, class_session_participants(student_id)');
      
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

      const classSessionIds = (classSessions || []).map((s) => s.id);
      let reassignmentMap = {};
      if (classSessionIds.length > 0) {
        const { data: reassignments, error: reassignmentError } = await supabase
          .from('session_reassignments')
          .select(`
            session_id,
            original_teacher_id,
            reassigned_to_teacher_id,
            original_teacher:original_teacher_id(id, full_name),
            reassigned_teacher:reassigned_to_teacher_id(id, full_name)
          `)
          .in('session_id', classSessionIds)
          .is('reverted_at', null);

        if (reassignmentError) {
          console.error('Error loading attendance reassignments:', reassignmentError);
        } else {
          reassignmentMap = (reassignments || []).reduce((acc, item) => {
            acc[item.session_id] = item;
            return acc;
          }, {});
        }
      }

      // Combine both types
      const allSessions = [
        ...(classSessions || []).map((s) => ({
          ...s,
          type: 'class',
          title: s.title,
          reassignment: reassignmentMap[s.id] || null
        })),
        ...(guidanceSessions || []).map((s) => ({ 
          ...s, 
          type: 'guidance', 
          title: s.guidance_requests?.topic || 'Guidance Session'
        }))
      ].sort((a, b) => new Date(b.scheduled_for) - new Date(a.scheduled_for));

      setSessions(allSessions);

      // Mark sessions that already have attendance posted.
      const guidanceSessionIds = allSessions.filter((s) => s.type === 'guidance').map((s) => s.id);
      let classPosted = [];
      let guidancePosted = [];
      if (classSessionIds.length > 0) {
        const { data } = await supabase
          .from('class_attendance')
          .select('session_id, student_id')
          .in('session_id', classSessionIds);
        classPosted = data || [];
      }
      if (guidanceSessionIds.length > 0) {
        const { data } = await supabase
          .from('guidance_attendance')
          .select('session_id')
          .in('session_id', guidanceSessionIds);
        guidancePosted = data || [];
      }
      const postedMap = {};
      const classAttendanceCountMap = {};
      classPosted.forEach((row) => {
        const key = `class-${row.session_id}`;
        if (!classAttendanceCountMap[key]) classAttendanceCountMap[key] = new Set();
        if (row.student_id) classAttendanceCountMap[key].add(row.student_id);
      });
      allSessions
        .filter((session) => session.type === 'class')
        .forEach((session) => {
          const key = `class-${session.id}`;
          const expectedCount = session.class_session_participants?.length || 0;
          const markedCount = classAttendanceCountMap[key]?.size || 0;
          postedMap[key] = expectedCount > 0 && markedCount >= expectedCount;
        });
      guidancePosted.forEach((r) => { postedMap[`guidance-${r.session_id}`] = true; });
      setPostedSessionKeys(postedMap);

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

      setAssignedStudents(Object.values(uniqueStudents));
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

  const loadStudentsForSession = async (session) => {
    if (!session) return [];

    if (session.type === 'class') {
      const { data: participants, error: participantError } = await supabase
        .from('class_session_participants')
        .select('student_id')
        .eq('session_id', session.id);

      if (participantError) {
        console.error('Error loading class participants:', participantError);
        return [];
      }

      const participantIds = [...new Set((participants || []).map((row) => row.student_id).filter(Boolean))];
      if (participantIds.length === 0) {
        return [];
      }

      const { data: participantProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .in('id', participantIds)
        .order('full_name');

      if (profileError) {
        console.error('Error loading participant profiles:', profileError);
        return [];
      }

      return participantProfiles || [];
    }

    const guidanceStudentId = session?.guidance_requests?.student_id;
    if (guidanceStudentId) {
      const { data: student } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .eq('id', guidanceStudentId)
        .maybeSingle();
      return student ? [student] : [];
    }

    return assignedStudentsRef.current || [];
  };

  const loadSessionAttendance = async (session) => {
    const sessionKey = `${session.type}-${session.id}`;
    const sessionStudents = await loadStudentsForSession(session);
    const cachedStudents = sessionStudentsCacheRef.current[sessionKey] || [];
    const visibleStudents =
      selectedSession && `${selectedSession.type}-${selectedSession.id}` === sessionKey
        ? (studentsRef.current || [])
        : [];

    const tableName = session.type === 'class' ? 'class_attendance' : 'guidance_attendance';
    const { data } = await supabase
      .from(tableName)
      .select('id, student_id, attended')
      .eq('session_id', session.id);

    let attendanceStudents = [];
    const attendanceStudentIds = [...new Set((data || []).map((record) => record.student_id).filter(Boolean))];
    if (attendanceStudentIds.length > 0) {
      const { data: attendanceProfiles, error: attendanceProfilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .in('id', attendanceStudentIds)
        .order('full_name');

      if (attendanceProfilesError) {
        console.error('Error loading attendance student profiles:', attendanceProfilesError);
      } else {
        attendanceStudents = attendanceProfiles || [];
      }
    }

    const fallbackStudents = cachedStudents.length > 0
      ? cachedStudents
      : visibleStudents.length > 0
      ? visibleStudents
      : attendanceStudents;
    const currentStudents = sessionStudents.length > 0 ? sessionStudents : fallbackStudents;

    if (currentStudents.length > 0) {
      sessionStudentsCacheRef.current[sessionKey] = currentStudents;
    }

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

    const attendanceMap = {};
    data?.forEach(record => {
      attendanceMap[record.student_id] = record.attended;
    });

    const baseStudents = currentStudents.length > 0
      ? currentStudents
      : (selectedSession && `${selectedSession.type}-${selectedSession.id}` === sessionKey && studentsRef.current.length > 0)
      ? studentsRef.current
      : [];

    const studentsWithAttendance = baseStudents.map(s => ({
      ...s,
      attended: attendanceMap[s.id],
      locked: false,
      recordId: data?.find(r => r.student_id === s.id)?.id
    }));

    const allStudentsMarked =
      studentsWithAttendance.length > 0 &&
      studentsWithAttendance.every((student) => !!student.recordId);

    if (data && data.length > 0) {
      setAttendanceLocked(allStudentsMarked && !(isAdmin && overrideActive));
      setPostedSessionKeys((prev) => ({
        ...prev,
        [`${session.type}-${session.id}`]: allStudentsMarked
      }));
    } else {
      setAttendanceLocked(false);
      setPostedSessionKeys((prev) => ({
        ...prev,
        [`${session.type}-${session.id}`]: false
      }));
    }

    if (studentsWithAttendance.length > 0 || studentsRef.current.length === 0) {
      setStudents(studentsWithAttendance);
    }

    return studentsWithAttendance;
  };

  const closeAttendanceModal = () => {
    setAttendanceModalOpen(false);
    setCurrentStudentIndex(0);
    setSequentialSaving(false);
    setSessionMarkedCount(0);
    setCloseConfirmOpen(false);
  };

  const requestCloseAttendanceModal = () => {
    if (sequentialSaving) return;
    if (isAdmin) {
      closeAttendanceModal();
      return;
    }
    if (sessionMarkedCount > 0) return;
    setCloseConfirmOpen(true);
  };

  const saveSingleAttendance = async (studentId, attended) => {
    if (!selectedSession) return { error: new Error('No session selected.') };

    const tableName = selectedSession.type === 'class' ? 'class_attendance' : 'guidance_attendance';
    const teacherId = selectedSession.teacher_id || profile.id;
    const student = studentsRef.current.find((item) => item.id === studentId);

    if (student?.recordId) {
      const { error } = await supabase
        .from(tableName)
        .update({
          teacher_id: teacherId,
          attended,
          marked_at: new Date().toISOString()
        })
        .eq('id', student.recordId);
      return { error };
    }

    const { data: insertedRows, error } = await supabase
      .from(tableName)
      .insert({
        session_id: selectedSession.id,
        student_id: studentId,
        teacher_id: teacherId,
        attended,
        marked_at: new Date().toISOString()
      })
      .select('id')
      .limit(1);

    return {
      error,
      recordId: insertedRows?.[0]?.id || null
    };
  };

  const handleSequentialAttendance = async (attended) => {
    const currentStudent = students[currentStudentIndex];
    if (!currentStudent || sequentialSaving) return;

    const canMarkNow = selectedSession ? canMarkAttendanceNow(selectedSession) : false;
    if (!canMarkNow && !isAdmin) {
      setAlertModal({
        show: true,
        title: 'Cannot Mark Attendance',
        message: 'Attendance can only be marked after the session start time and until the end of that day.',
        type: 'warning'
      });
      return;
    }

    if (attendanceLocked && !isAdmin) {
      setAlertModal({
        show: true,
        title: 'Attendance Locked',
        message: 'Attendance was already posted and cannot be edited.',
        type: 'warning'
      });
      return;
    }

    setSequentialSaving(true);

    try {
      const { error, recordId } = await saveSingleAttendance(currentStudent.id, attended);
      if (error) throw error;

      const updatedStudents = studentsRef.current.map((student) =>
        student.id === currentStudent.id
          ? { ...student, attended, recordId: student.recordId || recordId || student.recordId }
          : student
      );

      studentsRef.current = updatedStudents;
      setStudents(updatedStudents);
      setSessionMarkedCount((prev) => prev + 1);
      const allStudentsMarked = updatedStudents.every(
        (student) => !!(student.recordId || student.id === currentStudent.id)
      );
      setPostedSessionKeys((prev) => ({
        ...prev,
        [`${selectedSession.type}-${selectedSession.id}`]: allStudentsMarked
      }));
      const nextIndex = updatedStudents.findIndex(
        (student, index) => index > currentStudentIndex && !student.recordId
      );
      if (nextIndex === -1) {
        if (!attendanceOverride) {
          setAttendanceLocked(true);
        }
        closeAttendanceModal();
        setAlertModal({
          show: true,
          title: 'Success',
          message: 'Attendance marked for all students.',
          type: 'success'
        });
      } else {
        setCurrentStudentIndex(nextIndex);
      }
    } catch (error) {
      console.error('Error saving attendance:', error);
      setAlertModal({
        show: true,
        title: 'Error',
        message: error.message || 'Error saving attendance.',
        type: 'error'
      });
    } finally {
      setSequentialSaving(false);
    }
  };

  const selectSessionForAttendance = async (session) => {
    const canMarkNow = canMarkAttendanceNow(session);
    if (!canMarkNow && !isAdmin) {
      setAlertModal({
        show: true,
        title: 'Cannot Mark Attendance',
        message: 'Attendance can only be marked after the session start time and until the end of that day.',
        type: 'warning'
      });
      return;
    }

    setSelectedSession(session);
    setCanAccessSession(true);
    setPendingChanges({});
    setHasPendingChanges(false);
    setAttendanceLocked(false);
    setAttendanceOverride(false);
    const studentsForSession = await loadSessionAttendance(session);
    if (studentsForSession && studentsForSession.length > 0) {
      const firstUnmarkedIndex = studentsForSession.findIndex((student) => !student.recordId);
      const alreadyMarkedCount = studentsForSession.filter((student) => !!student.recordId).length;

      if (firstUnmarkedIndex === -1 && !isAdmin) {
        setAlertModal({
          show: true,
          title: 'Attendance Locked',
          message: 'Attendance for all students was already completed for this session.',
          type: 'warning'
        });
        return;
      }

      setCurrentStudentIndex(
        isAdmin
          ? 0
          : (firstUnmarkedIndex === -1 ? 0 : firstUnmarkedIndex)
      );
      setSessionMarkedCount(alreadyMarkedCount);
      setCloseConfirmOpen(false);
      setAttendanceModalOpen(true);
    } else {
      setAlertModal({
        show: true,
        title: 'No Students',
        message: 'No students assigned yet for this session.',
        type: 'warning'
      });
    }
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
    const canMarkNow = selectedSession ? canMarkAttendanceNow(selectedSession) : false;
    if (!canMarkNow && !isAdmin) {
      setAlertModal({
        show: true,
        title: 'Cannot Mark Attendance',
        message: 'Attendance can only be marked after the session start time and until the end of that day.',
        type: 'warning'
      });
      return;
    }

    if (attendanceLocked && !isAdmin) {
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
    const canMarkNow = selectedSession ? canMarkAttendanceNow(selectedSession) : false;
    if (!canMarkNow && !isAdmin) {
      setAlertModal({
        show: true,
        title: 'Cannot Mark Attendance',
        message: 'Attendance can only be marked after the session start time and until the end of that day.',
        type: 'warning'
      });
      return;
    }
    if (attendanceLocked && !isAdmin) {
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
        let error = null;

        if (student?.recordId) {
          const { error: updateError } = await supabase
            .from(tableName)
            .update({
              teacher_id: teacherId,
              attended: attended,
              marked_at: new Date().toISOString()
            })
            .eq('id', student.recordId);
          error = updateError;
        } else {
          const { error: insertError } = await supabase
            .from(tableName)
            .insert({
              session_id: selectedSession.id,
              student_id: studentId,
              teacher_id: teacherId,
              attended: attended,
              marked_at: new Date().toISOString()
            });
          error = insertError;
        }

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
      setPostedSessionKeys((prev) => ({
        ...prev,
        [`${selectedSession.type}-${selectedSession.id}`]: true
      }));
      await loadSessionAttendance(selectedSession);
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


  const shouldShowInitialLoader =
    loading &&
    sessions.length === 0 &&
    attendanceRecords.length === 0 &&
    students.length === 0 &&
    !selectedSession;

  if (shouldShowInitialLoader) {
    return <LoadingSpinner message="Loading attendance management..." />;
  }

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
      <AlertModal
        show={alertModal.show}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ show: false, title: '', message: '', type: 'info' })}
      />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Attendance Management</h1>
        <p className="text-slate-500">{isAdmin ? 'View and manage all attendance' : 'Mark and view attendance for your sessions'}</p>
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
                    {session.reassignment ? (
                      <p className="mb-2 text-sm text-amber-700">
                        {session.reassignment.reassigned_to_teacher_id === profile?.id
                          ? `Assigned to you from ${session.reassignment.original_teacher?.full_name || 'another teacher'}`
                          : `Reassigned from ${session.reassignment.original_teacher?.full_name || 'another teacher'} to ${session.reassignment.reassigned_teacher?.full_name || 'replacement teacher'}`}
                      </p>
                    ) : null}
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
                  {(() => {
                    const sessionKey = `${session.type}-${session.id}`;
                    const alreadyPosted = !!postedSessionKeys[sessionKey];
                    const statusMeta = getTeacherAttendanceStatus(session, alreadyPosted);
                    const canMarkCurrentSession = canMarkAttendanceNow(session) || isAdmin;
                    const canOpen = canMarkCurrentSession && !(alreadyPosted && !isAdmin);
                    const buttonText = isAdmin
                      ? (canMarkCurrentSession ? 'Mark Attendance' : 'View Session')
                      : statusMeta.label;
                    const buttonTitle = isAdmin
                      ? (canMarkCurrentSession ? 'Mark attendance' : 'Open session details')
                      : statusMeta.title;
                    return (
                  <button
                    onClick={() => selectSessionForAttendance(session)}
                    disabled={!canOpen}
                    title={buttonTitle}
                    className={`px-4 py-2 rounded-lg transition-colors font-semibold ${
                      canOpen
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-slate-300 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    {buttonText}
                  </button>
                    );
                  })()}
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
            {selectedSession.reassignment ? (
              <p className="mt-1 text-sm text-amber-700">
                {selectedSession.reassignment.reassigned_to_teacher_id === profile?.id
                  ? `This class was assigned to you from ${selectedSession.reassignment.original_teacher?.full_name || 'another teacher'} for leave coverage.`
                  : `This class is reassigned from ${selectedSession.reassignment.original_teacher?.full_name || 'another teacher'} to ${selectedSession.reassignment.reassigned_teacher?.full_name || 'replacement teacher'}.`}
              </p>
            ) : null}
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
            {isAdmin && !canMarkAttendanceNow(selectedSession) && !attendanceOverride && (
              <p className="text-sm text-orange-700 mt-2">
                Admin can review and update attendance for this session at any time.
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

        </div>
      )}

      {attendanceModalOpen && selectedSession && students[currentStudentIndex] ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">Mark Attendance</p>
                  <h3 className="mt-2 text-2xl font-bold">{selectedSession.title}</h3>
                  <p className="mt-2 text-sm text-blue-50">
                    Student {currentStudentIndex + 1} of {students.length}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={requestCloseAttendanceModal}
                  disabled={sequentialSaving || sessionMarkedCount > 0}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Close attendance popup"
                  title={sessionMarkedCount > 0 ? 'Attendance already started. Finish this popup to continue.' : 'Close attendance popup'}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                  style={{ width: `${((currentStudentIndex + 1) / Math.max(students.length, 1)) * 100}%` }}
                />
              </div>

              {selectedSession.reassignment ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {selectedSession.reassignment.reassigned_to_teacher_id === profile?.id
                    ? `Assigned to you from ${selectedSession.reassignment.original_teacher?.full_name || 'another teacher'}`
                    : `Reassigned class session`}
                </div>
              ) : null}

              <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                  {students[currentStudentIndex].avatar_url ? (
                    <img
                      src={students[currentStudentIndex].avatar_url}
                      alt={students[currentStudentIndex].full_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User size={28} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold text-slate-900">{students[currentStudentIndex].full_name}</p>
                  <p className="text-sm text-slate-500">{students[currentStudentIndex].email || 'No email available'}</p>
                  <div className="mt-2">
                    {students[currentStudentIndex].attended === true ? (
                      <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                        Current status: Present
                      </span>
                    ) : students[currentStudentIndex].attended === false ? (
                      <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                        Current status: Absent
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        Current status: Not marked yet
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSequentialAttendance(true)}
                  disabled={sequentialSaving}
                  className={`rounded-2xl px-5 py-4 text-base font-bold transition disabled:opacity-60 ${
                    students[currentStudentIndex].attended === true
                      ? 'bg-green-700 text-white ring-4 ring-green-100'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {sequentialSaving ? 'Saving...' : 'Present'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSequentialAttendance(false)}
                  disabled={sequentialSaving}
                  className={`rounded-2xl px-5 py-4 text-base font-bold transition disabled:opacity-60 ${
                    students[currentStudentIndex].attended === false
                      ? 'bg-red-700 text-white ring-4 ring-red-100'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {sequentialSaving ? 'Saving...' : 'Absent'}
                </button>
              </div>

              {isAdmin ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={closeAttendanceModal}
                    disabled={sequentialSaving}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    Exit Attendance Popup
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentStudentIndex((prev) => Math.max(prev - 1, 0))}
                    disabled={currentStudentIndex === 0 || sequentialSaving}
                    className="rounded-2xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Previous Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStudentIndex((prev) => Math.min(prev + 1, students.length - 1))}
                    disabled={currentStudentIndex === students.length - 1 || sequentialSaving}
                    className="rounded-2xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next Student
                  </button>
                  </div>
                </div>
              ) : null}

              {closeConfirmOpen ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-semibold text-amber-900">Exit attendance popup?</p>
                  <p className="mt-1 text-sm text-amber-800">
                    Attendance has not started yet. If you exit now, nothing will be saved.
                  </p>
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setCloseConfirmOpen(false)}
                      className="flex-1 rounded-xl border border-amber-300 px-4 py-2.5 font-semibold text-amber-900 transition hover:bg-amber-100"
                    >
                      Stay Here
                    </button>
                    <button
                      type="button"
                      onClick={closeAttendanceModal}
                      className="flex-1 rounded-xl bg-amber-600 px-4 py-2.5 font-semibold text-white transition hover:bg-amber-700"
                    >
                      Exit
                    </button>
                  </div>
                </div>
              ) : null}

            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Attendance;
