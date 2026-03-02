import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Clock, Plus, Trash2, SlidersHorizontal } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const AdminExamOverrides = () => {
  const { profile } = useAuth();
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ userId: '', courseId: '', days: 60, allowDate: '' });
  const [studentQuery, setStudentQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overrides');
  const [defaultDays, setDefaultDays] = useState(60);
  const [error, setError] = useState('');

  const courseOptions = useMemo(() => courses.map(c => ({ value: c.id, label: c.title || `Course ${c.id}` })), [courses]);
  const matchedStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return [];
    return students
      .filter(
        (s) =>
          (s.full_name || '').toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [students, studentQuery]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [{ data: courseData }, { data: overrideData }, { data: settings }, { data: studentData }] = await Promise.all([
          supabase.from('courses').select('id, title').order('title'),
          supabase.from('exam_retake_overrides').select('id, user_id, course_id, allow_retake_at, created_at').order('created_at', { ascending: false }),
          supabase.from('exam_settings').select('default_lock_days').eq('id', 1).maybeSingle(),
          supabase.from('profiles').select('id, full_name, email').eq('role', 'student').order('full_name')
        ]);

        if (courseData) setCourses(courseData);
        if (studentData) setStudents(studentData);
        if (overrideData) {
          setOverrides(overrideData);
          const userIds = [...new Set(overrideData.map(o => o.user_id).filter(Boolean))];
          if (userIds.length) {
            const { data: users, error: userErr } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', userIds);
            if (!userErr && users) {
              const map = {};
              users.forEach(u => { map[u.id] = u; });
              setUsersMap(map);
            }
          }
        }

        if (settings?.default_lock_days) {
          setDefaultDays(settings.default_lock_days);
        }
      } catch (err) {
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!form.userId || !form.courseId) {
      setError('User ID and Course are required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      let allowAt = null;
      if (form.allowDate) {
        const parsed = new Date(form.allowDate);
        if (isNaN(parsed.getTime())) throw new Error('Invalid date/time');
        allowAt = parsed;
      } else {
        const days = Number(form.days || 0);
        const now = new Date();
        now.setDate(now.getDate() + days);
        allowAt = now;
      }

      await supabase.from('exam_retake_overrides')
        .delete()
        .eq('user_id', form.userId)
        .eq('course_id', form.courseId);

      const { error: insertError } = await supabase.from('exam_retake_overrides').insert({
        user_id: form.userId,
        course_id: form.courseId,
        allow_retake_at: allowAt.toISOString()
      });

      if (insertError) throw insertError;

      setForm(prev => ({ ...prev, days: 60, allowDate: '' }));
      setStudentQuery('');
      const { data: refresh } = await supabase
        .from('exam_retake_overrides')
        .select('id, user_id, course_id, allow_retake_at, created_at')
        .order('created_at', { ascending: false });
      if (refresh) setOverrides(refresh);
    } catch (err) {
      setError(err.message || 'Failed to save override.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id) => {
    setSaving(true);
    try {
      await supabase.from('exam_retake_overrides').delete().eq('id', id);
      setOverrides(prev => prev.filter(o => o.id !== id));
    } catch (err) {
      setError(err.message || 'Failed to delete override.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDefaultDays = async () => {
    if (Number.isNaN(Number(defaultDays)) || Number(defaultDays) < 0) {
      setError('Default days must be zero or positive.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const daysInt = Math.floor(Number(defaultDays));
      const { error: setErr } = await supabase
        .from('exam_settings')
        .upsert({ id: 1, default_lock_days: daysInt }, { onConflict: 'id' });
      if (setErr) throw setErr;
      setDefaultDays(daysInt);
    } catch (err) {
      setError(err.message || 'Failed to save default days.');
    } finally {
      setSaving(false);
    }
  };

  if (profile?.role !== 'admin') return <div className="p-8">Admins only.</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Exam Retake Controls</h1>
          <p className="text-slate-600 text-sm">Set global default days and per-student/course overrides.</p>
        </div>
        <div className="flex items-center gap-3 text-slate-600 text-sm">
          <Clock size={16} />
          <span>Default lock is {defaultDays} days unless overridden.</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setActiveTab('overrides')}
          className={`px-4 py-2 rounded-lg border ${activeTab === 'overrides' ? 'bg-nani-dark text-white border-nani-dark' : 'border-slate-300 text-slate-700'}`}
        >
          Per-Student Overrides
        </button>
        <button
          onClick={() => setActiveTab('defaults')}
          className={`px-4 py-2 rounded-lg border ${activeTab === 'defaults' ? 'bg-nani-dark text-white border-nani-dark' : 'border-slate-300 text-slate-700'}`}
        >
          Default Days
        </button>
      </div>

      {activeTab === 'overrides' && (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Create / Update Override</h2>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-600">Search Student</label>
            <input
              value={studentQuery}
              onChange={(e) => {
                setStudentQuery(e.target.value);
                setForm({ ...form, userId: '' });
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="Type name or email..."
            />
            {matchedStudents.length > 0 && !form.userId && (
              <div className="border rounded-lg max-h-44 overflow-auto">
                {matchedStudents.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => {
                      setForm({ ...form, userId: s.id });
                      setStudentQuery(`${s.full_name} (${s.email})`);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b last:border-b-0"
                  >
                    <p className="text-sm font-medium text-slate-800">{s.full_name}</p>
                    <p className="text-xs text-slate-500">{s.email}</p>
                  </button>
                ))}
              </div>
            )}
            {form.userId && (
              <p className="text-xs text-emerald-700">
                Selected: {students.find((s) => s.id === form.userId)?.full_name || form.userId}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-600">Course</label>
            <select
              value={form.courseId}
              onChange={e => setForm({ ...form, courseId: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
            >
              <option value="">Select course</option>
              {courseOptions.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-600">Wait (days) from now</label>
            <input
              type="number"
              min="0"
              value={form.days}
              onChange={e => setForm({ ...form, days: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
            <p className="text-xs text-slate-500">Set 0 for immediate retake. Ignored if explicit date is set.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-600">Or set exact date/time</label>
            <input
              type="datetime-local"
              value={form.allowDate}
              onChange={e => setForm({ ...form, allowDate: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
            <p className="text-xs text-slate-500">Overrides the days field.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-nani-dark text-white px-4 py-2 rounded-lg hover:bg-black disabled:opacity-60"
          >
            <Plus size={16} />
            {saving ? 'Saving...' : 'Save Override'}
          </button>
          <button
            onClick={() => {
              setForm({ userId: '', courseId: '', days: 60, allowDate: '' });
              setStudentQuery('');
            }}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
            type="button"
          >
            Clear
          </button>
        </div>
      </div>
      )}

      {activeTab === 'defaults' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 text-slate-700">
            <SlidersHorizontal size={18} />
            <h2 className="font-semibold">Default Lock Days (all exams)</h2>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm text-slate-600">Days</label>
              <input
                type="number"
                min="0"
                value={defaultDays}
                onChange={e => setDefaultDays(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
              <p className="text-xs text-slate-500">Applies when no override exists.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSaveDefaultDays}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-nani-dark text-white px-4 py-2 rounded-lg hover:bg-black disabled:opacity-60"
              >
                <Plus size={16} />
                {saving ? 'Saving...' : 'Save Default'}
              </button>
              <button
                onClick={() => setDefaultDays(60)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Reset to 60
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-semibold text-slate-800">Current Overrides</h2>
          <span className="text-xs text-slate-500">Showing latest first</span>
        </div>
        {loading ? (
          <LoadingSpinner fullPage={false} message="Loading exam overrides..." />
        ) : overrides.length === 0 ? (
          <div className="p-6 text-slate-600">No overrides set.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left">Course</th>
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-left">Allow Retake At</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overrides.map(o => {
                  const courseLabel = courseOptions.find(c => `${c.value}` === `${o.course_id}`)?.label || o.course_id;
                  const userLabel = usersMap[o.user_id]?.full_name || usersMap[o.user_id]?.email || o.user_id;
                  return (
                    <tr key={o.id}>
                      <td className="px-4 py-3 font-medium text-slate-800">{courseLabel}</td>
                      <td className="px-4 py-3 text-slate-700">{userLabel}</td>
                      <td className="px-4 py-3 text-slate-700">{o.allow_retake_at ? new Date(o.allow_retake_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{o.created_at ? new Date(o.created_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleRemove(o.id)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                          disabled={saving}
                        >
                          <Trash2 size={16} />
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminExamOverrides;
