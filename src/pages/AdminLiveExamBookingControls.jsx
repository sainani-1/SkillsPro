import React, { useEffect, useMemo, useState } from 'react';
import { Clock, KeyRound, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { logAdminActivity } from '../utils/adminActivityLogger';

const SETTING_KEY = 'live_exam_rebooking_wait_days';

export default function AdminLiveExamBookingControls() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [defaultDays, setDefaultDays] = useState(7);
  const [studentQuery, setStudentQuery] = useState('');
  const [form, setForm] = useState({
    userId: '',
    courseId: '',
    allowDate: '',
  });

  const matchedStudents = useMemo(() => {
    const term = String(studentQuery || '').trim().toLowerCase();
    if (!term || form.userId) return [];
    return students
      .filter((student) =>
        String(student.full_name || '').toLowerCase().includes(term) ||
        String(student.email || '').toLowerCase().includes(term)
      )
      .slice(0, 10);
  }, [form.userId, studentQuery, students]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [
          settingsResp,
          coursesResp,
          studentsResp,
          overridesResp,
        ] = await Promise.all([
          supabase.from('settings').select('value').eq('key', SETTING_KEY).maybeSingle(),
          supabase.from('courses').select('id, title').order('title'),
          supabase.from('profiles').select('id, full_name, email').eq('role', 'student').order('full_name'),
          supabase.from('exam_retake_overrides').select('id, user_id, course_id, allow_retake_at, created_at').order('created_at', { ascending: false }),
        ]);

        if (settingsResp.error) throw settingsResp.error;
        if (coursesResp.error) throw coursesResp.error;
        if (studentsResp.error) throw studentsResp.error;
        if (overridesResp.error) throw overridesResp.error;

        setDefaultDays(Math.max(0, Number(settingsResp.data?.value || 7) || 0));
        setCourses(coursesResp.data || []);
        setStudents(studentsResp.data || []);
        setOverrides(overridesResp.data || []);
      } catch (loadError) {
        setError(loadError.message || 'Failed to load booking controls.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleSaveDefault = async () => {
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const days = Math.max(0, Math.floor(Number(defaultDays) || 0));
      const { error: saveError } = await supabase.from('settings').upsert({
        key: SETTING_KEY,
        value: String(days),
      }, { onConflict: 'key' });
      if (saveError) throw saveError;
      setDefaultDays(days);
      setInfo('Live exam rebooking wait time updated.');
    } catch (saveError) {
      setError(saveError.message || 'Failed to save default wait days.');
    } finally {
      setSaving(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!form.userId || !form.courseId) {
      setError('Select a student and course first.');
      return;
    }

    setSaving(true);
    setError('');
    setInfo('');
    try {
      const allowAt = form.allowDate ? new Date(form.allowDate).toISOString() : new Date().toISOString();
      const { error: deleteError } = await supabase
        .from('exam_retake_overrides')
        .delete()
        .eq('user_id', form.userId)
        .eq('course_id', form.courseId);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from('exam_retake_overrides')
        .insert({
          user_id: form.userId,
          course_id: form.courseId,
          allow_retake_at: allowAt,
        });
      if (insertError) throw insertError;

      await logAdminActivity({
        adminId: profile?.id,
        action: 'Allowed live exam booking again',
        target: `${form.userId}:${form.courseId}`,
        details: {
          user_id: form.userId,
          course_id: form.courseId,
          allow_retake_at: allowAt,
          source: 'admin_live_exam_booking_controls',
        },
      });

      const { data: refreshed, error: refreshError } = await supabase
        .from('exam_retake_overrides')
        .select('id, user_id, course_id, allow_retake_at, created_at')
        .order('created_at', { ascending: false });
      if (refreshError) throw refreshError;

      setOverrides(refreshed || []);
      setForm({ userId: '', courseId: '', allowDate: '' });
      setStudentQuery('');
      setInfo('Student can now book/write the live exam again for that course.');
    } catch (grantError) {
      setError(grantError.message || 'Failed to grant booking access.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveOverride = async (id) => {
    setSaving(true);
    setError('');
    setInfo('');
    try {
      const targetRow = overrides.find((row) => row.id === id);
      const { error: deleteError } = await supabase.from('exam_retake_overrides').delete().eq('id', id);
      if (deleteError) throw deleteError;
      await logAdminActivity({
        adminId: profile?.id,
        action: 'Removed live exam rebooking override',
        target: String(id),
        details: {
          override_id: id,
          user_id: targetRow?.user_id || null,
          course_id: targetRow?.course_id || null,
          source: 'admin_live_exam_booking_controls',
        },
      });
      setOverrides((prev) => prev.filter((row) => row.id !== id));
      setInfo('Booking access override removed.');
    } catch (removeError) {
      setError(removeError.message || 'Failed to remove override.');
    } finally {
      setSaving(false);
    }
  };

  if (profile?.role !== 'admin') {
    return <div className="p-8 text-sm text-slate-600">Admins only.</div>;
  }

  if (loading) {
    return <LoadingSpinner message="Loading live exam booking controls..." />;
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Allow Failed To Book Slot</h1>
          <p className="mt-1 text-sm text-slate-600">Control how long students must wait before booking the same live exam again, and allow failed or blocked students to book the slot again when needed.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          <span className="font-semibold text-slate-900">{defaultDays}</span> day default wait
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {info ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Default Rebooking Wait</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">After a booked slot ends, students must wait this many days before booking the same course’s live exam again.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="number"
              min="0"
              value={defaultDays}
              onChange={(event) => setDefaultDays(event.target.value)}
              className="w-28 rounded-xl border border-slate-300 px-3 py-2"
            />
            <button
              type="button"
              onClick={handleSaveDefault}
              disabled={saving}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Save Wait Days
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-semibold text-slate-900">Allow Failed Student Again</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">Grant immediate or scheduled permission for a student to book or write the live exam again for a course after a failed attempt or booking issue.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Search Student</label>
              <input
                value={studentQuery}
                onChange={(event) => {
                  setStudentQuery(event.target.value);
                  setForm((prev) => ({ ...prev, userId: '' }));
                }}
                placeholder="Type name or email"
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              {matchedStudents.length > 0 ? (
                <div className="max-h-44 overflow-auto rounded-xl border border-slate-200">
                  {matchedStudents.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, userId: student.id }));
                        setStudentQuery(`${student.full_name || student.email} (${student.email})`);
                      }}
                      className="block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 last:border-b-0"
                    >
                      <p className="text-sm font-medium text-slate-900">{student.full_name || 'Student'}</p>
                      <p className="text-xs text-slate-500">{student.email}</p>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Course</label>
              <select
                value={form.courseId}
                onChange={(event) => setForm((prev) => ({ ...prev, courseId: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title || `Course ${course.id}`}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Optional allow date/time</label>
              <input
                type="datetime-local"
                value={form.allowDate}
                onChange={(event) => setForm((prev) => ({ ...prev, allowDate: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
              <p className="text-xs text-slate-500">Leave blank to allow immediately.</p>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleGrantAccess}
              disabled={saving}
              className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              Allow Booking / Writing Again
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Active Rebooking Overrides</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left">Student</th>
                <th className="px-4 py-3 text-left">Course</th>
                <th className="px-4 py-3 text-left">Allowed At</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {overrides.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-4 py-6 text-center text-slate-500">No overrides created yet.</td>
                </tr>
              ) : overrides.map((row) => {
                const student = students.find((item) => String(item.id) === String(row.user_id));
                const course = courses.find((item) => String(item.id) === String(row.course_id));
                return (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{student?.full_name || 'Student'}</p>
                      <p className="text-xs text-slate-500">{student?.email || row.user_id}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{course?.title || `Course ${row.course_id}`}</td>
                    <td className="px-4 py-3 text-slate-700">{row.allow_retake_at ? new Date(row.allow_retake_at).toLocaleString('en-IN') : '-'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleRemoveOverride(row.id)}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
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
