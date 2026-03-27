import React, { useEffect, useMemo, useState } from 'react';
import { Bot, RefreshCcw, Search, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';
import usePopup from '../hooks/usePopup.jsx';

const AdminAutoAssignedStudents = () => {
  const { popupNode, openPopup } = usePopup();
  const [loading, setLoading] = useState(true);
  const [savingStudentId, setSavingStudentId] = useState('');
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherMap, setTeacherMap] = useState({});
  const [search, setSearch] = useState('');
  const [remapTeacherByStudent, setRemapTeacherByStudent] = useState({});

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const [{ data: studentRows, error: studentError }, { data: teacherRows, error: teacherError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, premium_until, assigned_teacher_id')
          .eq('role', 'student')
          .not('assigned_teacher_id', 'is', null)
          .gt('premium_until', now)
          .order('full_name'),
        supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('role', 'teacher')
          .order('full_name'),
      ]);

      if (studentError) throw studentError;
      if (teacherError) throw teacherError;

      const nextTeachers = teacherRows || [];
      const nextTeacherMap = Object.fromEntries(nextTeachers.map((teacher) => [teacher.id, teacher]));
      setTeachers(nextTeachers);
      setTeacherMap(nextTeacherMap);

      const studentIds = (studentRows || []).map((row) => row.id);
      let assignmentRows = [];
      if (studentIds.length) {
        const { data: assignments, error: assignmentError } = await supabase
          .from('teacher_assignments')
          .select('id, student_id, teacher_id, assigned_by, assigned_at, active')
          .in('student_id', studentIds)
          .eq('active', true);
        if (assignmentError) throw assignmentError;
        assignmentRows = assignments || [];
      }

      const assignmentByStudentId = Object.fromEntries(
        assignmentRows.map((row) => [row.student_id, row]),
      );

      setStudents(
        (studentRows || []).map((student) => {
          const assignment = assignmentByStudentId[student.id] || null;
          return {
            ...student,
            assignment,
            assignment_source: assignment
              ? assignment.assigned_by
                ? 'Manual/Admin'
                : 'Auto Assigned'
              : 'Assigned',
          };
        }),
      );

      setRemapTeacherByStudent(
        Object.fromEntries(
          (studentRows || []).map((student) => [student.id, student.assigned_teacher_id || '']),
        ),
      );
    } catch (error) {
      openPopup('Load failed', error.message || 'Unable to load auto-assigned students.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter(
      (student) =>
        String(student.full_name || '').toLowerCase().includes(query) ||
        String(student.email || '').toLowerCase().includes(query),
    );
  }, [students, search]);

  const handleRemap = async (student) => {
    const nextTeacherId = remapTeacherByStudent[student.id];
    if (!nextTeacherId || nextTeacherId === student.assigned_teacher_id) {
      openPopup('No changes', 'Choose a different teacher to remap this student.', 'warning');
      return;
    }

    setSavingStudentId(student.id);
    try {
      const now = new Date().toISOString();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ assigned_teacher_id: nextTeacherId })
        .eq('id', student.id);
      if (profileError) throw profileError;

      await supabase
        .from('teacher_assignments')
        .update({ active: false })
        .eq('student_id', student.id)
        .eq('active', true);

      const { data: existingTarget } = await supabase
        .from('teacher_assignments')
        .select('id')
        .eq('student_id', student.id)
        .eq('teacher_id', nextTeacherId)
        .maybeSingle();

      if (existingTarget?.id) {
        const { error } = await supabase
          .from('teacher_assignments')
          .update({
            active: true,
            assigned_at: now,
            assigned_by: user?.id || null,
          })
          .eq('id', existingTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('teacher_assignments').insert({
          teacher_id: nextTeacherId,
          student_id: student.id,
          assigned_by: user?.id || null,
          assigned_at: now,
          active: true,
        });
        if (error) throw error;
      }

      openPopup('Remapped', 'Student teacher mapping updated successfully.', 'success');
      await loadData();
    } catch (error) {
      openPopup('Remap failed', error.message || 'Could not remap this student.', 'error');
    } finally {
      setSavingStudentId('');
    }
  };

  return (
    <div className="space-y-6">
      {popupNode}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Auto Assigned Students</h1>
          <p className="text-slate-500">Premium students who already received a teacher automatically.</p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCcw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Students</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{students.length}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Teachers</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{teachers.length}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Auto Flow</p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
            <Bot size={16} />
            <span>Premium to Teacher linked</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search premium student..."
            className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none"
          />
        </div>

        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              Loading auto-assigned students...
            </div>
          ) : filteredStudents.length ? (
            filteredStudents.map((student) => {
              const assignedTeacher = teacherMap[student.assigned_teacher_id];
              return (
                <div key={student.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-slate-200">
                        {student.avatar_url ? (
                          <img src={student.avatar_url} alt={student.full_name} className="h-full w-full object-cover" />
                        ) : (
                          <Users size={18} className="text-slate-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{student.full_name}</p>
                        <p className="text-sm text-slate-500">{student.email}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Premium until {new Date(student.premium_until).toLocaleDateString('en-IN')}
                          </span>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${student.assignment_source === 'Auto Assigned' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                            {student.assignment_source}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-[280px] space-y-3">
                      <div className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">Current teacher</p>
                        <p className="mt-1">{assignedTeacher?.full_name || 'Not assigned'}</p>
                        <p className="text-xs text-slate-500">{assignedTeacher?.email || ''}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={remapTeacherByStudent[student.id] || ''}
                          onChange={(event) =>
                            setRemapTeacherByStudent((current) => ({
                              ...current,
                              [student.id]: event.target.value,
                            }))
                          }
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                        >
                          <option value="">Choose teacher...</option>
                          {teachers.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                              {teacher.full_name} ({teacher.email})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemap(student)}
                          disabled={savingStudentId === student.id}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                        >
                          {savingStudentId === student.id ? 'Remapping...' : 'Remap'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              No premium auto-assigned students found right now.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAutoAssignedStudents;
