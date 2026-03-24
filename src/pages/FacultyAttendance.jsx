import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

const getExamDisplayName = (exam, course) => {
  const examName = String(exam?.test_name || '').trim();
  const courseName = String(course?.title || '').trim();
  if (examName && courseName) return `${examName} - ${courseName}`;
  if (examName) return examName;
  if (courseName) return `Final Exam - ${courseName}`;
  return exam?.id ? `Exam ${exam.id}` : 'Exam';
};

const nowIso = () => new Date().toISOString();

export default function FacultyAttendance() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [slotInstructors, setSlotInstructors] = useState([]);
  const [facultyAttendance, setFacultyAttendance] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [examsById, setExamsById] = useState({});
  const [coursesById, setCoursesById] = useState({});

  const isAdmin = profile?.role === 'admin';

  const loadData = async ({ silent = false } = {}) => {
    if (!profile?.id || !isAdmin) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const { data: slotRows, error: slotError } = await supabase
        .from('exam_live_slots')
        .select('*')
        .neq('status', 'cancelled')
        .order('starts_at', { ascending: true });
      if (slotError) throw slotError;

      const slotIds = (slotRows || []).map((slot) => slot.id);
      const examIds = Array.from(new Set((slotRows || []).map((slot) => slot.exam_id).filter(Boolean)));

      const [
        bookingResp,
        instructorResp,
        facultyAttendanceResp,
        examResp,
        courseResp,
      ] = await Promise.all([
        slotIds.length
          ? supabase.from('exam_slot_bookings').select('*').in('slot_id', slotIds)
          : Promise.resolve({ data: [], error: null }),
        slotIds.length
          ? supabase.from('exam_slot_instructors').select('*').in('slot_id', slotIds)
          : Promise.resolve({ data: [], error: null }),
        slotIds.length
          ? supabase.from('exam_slot_faculty_attendance').select('*').in('slot_id', slotIds)
          : Promise.resolve({ data: [], error: null }),
        examIds.length
          ? supabase.from('exams').select('id, course_id, test_name').in('id', examIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('courses').select('id, title'),
      ]);

      if (bookingResp.error) throw bookingResp.error;
      if (instructorResp.error) throw instructorResp.error;
      if (facultyAttendanceResp.error) throw facultyAttendanceResp.error;
      if (examResp.error) throw examResp.error;
      if (courseResp.error) throw courseResp.error;

      const bookingRows = bookingResp.data || [];
      const instructorRows = instructorResp.data || [];
      const facultyRows = facultyAttendanceResp.data || [];
      const examRows = examResp.data || [];
      const courseRows = courseResp.data || [];

      const profileIds = new Set();
      (slotRows || []).forEach((slot) => {
        if (slot.teacher_id) profileIds.add(slot.teacher_id);
      });
      bookingRows.forEach((booking) => {
        if (booking.student_id) profileIds.add(booking.student_id);
      });
      instructorRows.forEach((row) => {
        if (row.instructor_id) profileIds.add(row.instructor_id);
        if (row.assigned_by) profileIds.add(row.assigned_by);
      });
      facultyRows.forEach((row) => {
        if (row.faculty_id) profileIds.add(row.faculty_id);
        if (row.marked_by) profileIds.add(row.marked_by);
      });

      const profileIdsList = Array.from(profileIds);
      const { data: profileRows, error: profileError } = profileIdsList.length
        ? await supabase.from('profiles').select('id, full_name, email, role').in('id', profileIdsList)
        : { data: [], error: null };
      if (profileError) throw profileError;

      const nextProfilesById = {};
      (profileRows || []).forEach((row) => {
        nextProfilesById[row.id] = row;
      });

      const nextExamsById = {};
      examRows.forEach((row) => {
        nextExamsById[row.id] = row;
      });

      const nextCoursesById = {};
      courseRows.forEach((row) => {
        nextCoursesById[row.id] = row;
      });

      setSlots(slotRows || []);
      setBookings(bookingRows);
      setSlotInstructors(instructorRows);
      setFacultyAttendance(facultyRows);
      setProfilesById(nextProfilesById);
      setExamsById(nextExamsById);
      setCoursesById(nextCoursesById);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load faculty attendance.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.id, isAdmin]);

  useEffect(() => {
    if (!profile?.id || !isAdmin) return undefined;
    const channel = supabase
      .channel(`faculty-attendance-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_live_slots' }, () => loadData({ silent: true }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_slot_bookings' }, () => loadData({ silent: true }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_slot_instructors' }, () => loadData({ silent: true }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_slot_faculty_attendance' }, () => loadData({ silent: true }))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, isAdmin]);

  const rows = useMemo(() => {
    const attendanceByKey = {};
    facultyAttendance.forEach((record) => {
      attendanceByKey[`${record.slot_id}:${record.faculty_id}`] = record;
    });

    const rowsList = [];

    slots.forEach((slot) => {
      const slotBookings = bookings.filter((booking) => String(booking.slot_id) === String(slot.id) && booking.status !== 'cancelled');
      if (slotBookings.length === 0) return;

      const faculties = [];
      if (slot.teacher_id) {
        faculties.push({
          facultyId: slot.teacher_id,
          facultyRole: 'teacher',
        });
      }
      slotInstructors
        .filter((row) => String(row.slot_id) === String(slot.id))
        .forEach((row) => {
          faculties.push({
            facultyId: row.instructor_id,
            facultyRole: 'instructor',
          });
        });

      const uniqueFaculties = faculties.filter(
        (item, index, arr) => arr.findIndex((row) => String(row.facultyId) === String(item.facultyId)) === index
      );

      const exam = examsById[slot.exam_id];
      const course = coursesById[exam?.course_id];
      const examLabel = getExamDisplayName(exam, course);
      const autoAbsent = new Date(slot.ends_at) < new Date();

      uniqueFaculties.forEach((faculty) => {
        const attendance = attendanceByKey[`${slot.id}:${faculty.facultyId}`];
        const facultyProfile = profilesById[faculty.facultyId];
        slotBookings.forEach((booking) => {
          const student = profilesById[booking.student_id];
          rowsList.push({
            key: `${slot.id}:${faculty.facultyId}:${booking.student_id}`,
            slotId: slot.id,
            bookingId: booking.id,
            facultyId: faculty.facultyId,
            facultyRole: faculty.facultyRole,
            facultyName: facultyProfile?.full_name || facultyProfile?.email || 'Faculty',
            studentName: student?.full_name || student?.email || 'Student',
            examLabel,
            slotTime: formatDateTime(slot.starts_at),
            slotEndsAt: slot.ends_at,
            status: attendance?.status || (autoAbsent ? 'absent' : 'pending'),
            markedBy: attendance?.marked_by ? profilesById[attendance.marked_by] : null,
            markedByRole: attendance?.marked_by_role || '',
            markedAt: attendance?.marked_at || '',
          });
        });
      });
    });

    return rowsList.sort((a, b) => new Date(a.slotTime) - new Date(b.slotTime));
  }, [slots, bookings, slotInstructors, facultyAttendance, profilesById, examsById, coursesById]);

  const handleMark = async (row, status) => {
    if (!row?.slotId || !row?.facultyId) return;
    const key = `${row.slotId}:${row.facultyId}:${status}`;
    setSavingKey(key);
    setError('');
    setInfo('');
    try {
      const { error: upsertError } = await supabase
        .from('exam_slot_faculty_attendance')
        .upsert({
          slot_id: row.slotId,
          faculty_id: row.facultyId,
          faculty_role: row.facultyRole,
          status,
          marked_by: profile.id,
          marked_by_role: profile.role,
          marked_at: nowIso(),
          updated_at: nowIso(),
        }, { onConflict: 'slot_id,faculty_id' });
      if (upsertError) throw upsertError;
      setInfo(`Faculty marked ${status}.`);
      await loadData({ silent: true });
    } catch (actionError) {
      setError(actionError.message || 'Failed to update faculty attendance.');
    } finally {
      setSavingKey('');
    }
  };

  if (loading) return <LoadingSpinner message="Loading faculty attendance..." />;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
        Faculty attendance is available only in the admin panel.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Faculty Attendance</h1>
        <p className="mt-2 text-sm text-slate-500">Track whether the assigned teacher and instructor were present for each booked exam session.</p>
        {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {info ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div> : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Faculty Presence Register</h2>
            <p className="mt-1 text-sm text-slate-500">Each row shows faculty name, student name, exam time, and the current faculty attendance status.</p>
          </div>
          <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{rows.length} rows</div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-3 text-left">Faculty</th>
                <th className="px-3 py-3 text-left">Student</th>
                <th className="px-3 py-3 text-left">Exam</th>
                <th className="px-3 py-3 text-left">Time</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Marked By</th>
                <th className="px-3 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-3 py-8 text-center text-slate-500">No booked live exam faculty records yet.</td>
                </tr>
              ) : rows.map((row) => {
                const saving = savingKey === `${row.slotId}:${row.facultyId}:present` || savingKey === `${row.slotId}:${row.facultyId}:absent`;
                return (
                  <tr key={row.key} className="border-t border-slate-200">
                    <td className="px-3 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{row.facultyName}</p>
                        <p className="text-xs capitalize text-slate-500">{row.facultyRole}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{row.studentName}</td>
                    <td className="px-3 py-3 text-slate-700">{row.examLabel}</td>
                    <td className="px-3 py-3 text-slate-700">{row.slotTime}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        row.status === 'present'
                          ? 'bg-emerald-100 text-emerald-700'
                          : row.status === 'absent'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {row.markedBy
                        ? `${row.markedBy.full_name || row.markedBy.email} (${row.markedByRole || '-'})`
                        : row.status === 'absent'
                          ? 'Auto absent after session end'
                          : '-'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleMark(row, 'present')}
                          className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-60"
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleMark(row, 'absent')}
                          className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200 disabled:opacity-60"
                        >
                          Absent
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
