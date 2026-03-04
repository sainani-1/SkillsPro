import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import usePopup from '../hooks/usePopup.jsx';

const AdminStudentReassignments = () => {
  const { profile } = useAuth();
  const { popupNode, openPopup } = usePopup();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [fromTeacherId, setFromTeacherId] = useState('');
  const [toTeacherId, setToTeacherId] = useState('');
  const [students, setStudents] = useState([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  const pushNotifications = async (rows) => {
    if (!rows?.length) return;
    try {
      const { error } = await supabase.from('admin_notifications').insert(rows);
      if (error && String(error.message || '').includes('target_user_id')) {
        const fallbackRows = rows.map((r) => {
          const { target_user_id, ...rest } = r;
          const marker = target_user_id ? `[target_user_id:${target_user_id}] ` : '';
          return {
            ...rest,
            content:
              marker && !String(rest.content || '').includes('[target_user_id:')
                ? `${marker}${rest.content || ''}`
                : rest.content,
          };
        });
        await supabase.from('admin_notifications').insert(fallbackRows);
      }
    } catch {
      // Keep reassignment flow resilient even if notification insert fails.
    }
  };

  const loadTeachers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'teacher')
      .order('full_name');
    if (error) throw error;

    const { data: assignments } = await supabase
      .from('teacher_assignments')
      .select('teacher_id, active')
      .eq('active', true);
    const counts = {};
    (assignments || []).forEach((a) => {
      counts[a.teacher_id] = (counts[a.teacher_id] || 0) + 1;
    });

    setTeachers((data || []).map((t) => ({ ...t, assigned_count: counts[t.id] || 0 })));
  };

  const loadSourceStudents = async (teacherId) => {
    if (!teacherId) {
      setStudents([]);
      setSelectedStudentIds([]);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, assigned_teacher_id')
      .eq('role', 'student')
      .eq('assigned_teacher_id', teacherId)
      .order('full_name');
    if (error) throw error;
    setStudents(data || []);
    setSelectedStudentIds([]);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      await loadTeachers();
      if (fromTeacherId) {
        await loadSourceStudents(fromTeacherId);
      }
    } catch (error) {
      openPopup('Load failed', error.message || 'Unable to load reassign data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadSourceStudents(fromTeacherId).catch((error) => {
      openPopup('Load failed', error.message || 'Unable to load source students.', 'error');
    });
  }, [fromTeacherId]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => (s.full_name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q)
    );
  }, [students, studentQuery]);

  const toggleStudent = (id) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const reassignSelected = async () => {
    if (!fromTeacherId || !toTeacherId) {
      openPopup('Validation', 'Choose both source and target teachers.', 'warning');
      return;
    }
    if (fromTeacherId === toTeacherId) {
      openPopup('Validation', 'Source and target teacher cannot be same.', 'warning');
      return;
    }
    if (selectedStudentIds.length === 0) {
      openPopup('Validation', 'Select at least one student.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const {
        data: { user }
      } = await supabase.auth.getUser();

      // Move assigned teacher reference on student profiles.
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ assigned_teacher_id: toTeacherId })
        .in('id', selectedStudentIds);
      if (profileErr) throw profileErr;

      // Deactivate old active assignment rows.
      const { error: deactivateErr } = await supabase
        .from('teacher_assignments')
        .update({ active: false })
        .eq('teacher_id', fromTeacherId)
        .eq('active', true)
        .in('student_id', selectedStudentIds);
      if (deactivateErr) throw deactivateErr;

      // Reuse existing target rows when present, else insert.
      const { data: existingTargetRows, error: existingErr } = await supabase
        .from('teacher_assignments')
        .select('id, student_id, teacher_id, active')
        .eq('teacher_id', toTeacherId)
        .in('student_id', selectedStudentIds);
      if (existingErr) throw existingErr;

      const existingByStudent = {};
      (existingTargetRows || []).forEach((row) => {
        existingByStudent[row.student_id] = row;
      });

      const toInsert = [];
      const toActivateIds = [];
      selectedStudentIds.forEach((studentId) => {
        const existing = existingByStudent[studentId];
        if (existing) {
          if (!existing.active) toActivateIds.push(existing.id);
        } else {
          toInsert.push({
            teacher_id: toTeacherId,
            student_id: studentId,
            assigned_by: user?.id || profile?.id || null,
            assigned_at: now,
            active: true
          });
        }
      });

      if (toActivateIds.length > 0) {
        const { error: activateErr } = await supabase
          .from('teacher_assignments')
          .update({ active: true, assigned_at: now, assigned_by: user?.id || profile?.id || null })
          .in('id', toActivateIds);
        if (activateErr) throw activateErr;
      }
      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase.from('teacher_assignments').insert(toInsert);
        if (insertErr) throw insertErr;
      }

      // Reassign open guidance requests as well.
      const { error: guidanceErr } = await supabase
        .from('guidance_requests')
        .update({ assigned_to_teacher_id: toTeacherId, updated_at: now })
        .eq('assigned_to_teacher_id', fromTeacherId)
        .in('student_id', selectedStudentIds)
        .in('status', ['pending', 'assigned', 'scheduled']);
      if (guidanceErr) throw guidanceErr;

      const fromTeacher = teachers.find((t) => t.id === fromTeacherId);
      const toTeacher = teachers.find((t) => t.id === toTeacherId);
      const selectedStudents = students.filter((s) => selectedStudentIds.includes(s.id));
      const adminId = user?.id || profile?.id || null;

      const studentNotifications = selectedStudents.map((s) => ({
        title: 'Teacher Reassigned',
        content: `Your teacher has been changed to ${toTeacher?.full_name || 'a new teacher'}.`,
        type: 'info',
        target_role: 'student',
        target_user_id: s.id,
        admin_id: adminId,
      }));
      const teacherNotifications = [
        {
          title: 'Students Reassigned',
          content: `${selectedStudentIds.length} student(s) were moved from you to ${toTeacher?.full_name || 'another teacher'}.`,
          type: 'warning',
          target_role: 'teacher',
          target_user_id: fromTeacherId,
          admin_id: adminId,
        },
        {
          title: 'New Students Assigned',
          content: `${selectedStudentIds.length} student(s) were assigned to you from ${fromTeacher?.full_name || 'another teacher'}.`,
          type: 'success',
          target_role: 'teacher',
          target_user_id: toTeacherId,
          admin_id: adminId,
        },
      ];
      await pushNotifications([...studentNotifications, ...teacherNotifications]);

      openPopup('Reassigned', `${selectedStudentIds.length} student(s) moved successfully.`, 'success');
      setSelectedStudentIds([]);
      setStudentQuery('');
      await loadAll();
    } catch (error) {
      openPopup('Reassign failed', error.message || 'Unable to reassign students.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {popupNode}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Student Reassignments</h1>
        <p className="text-slate-500">Move students from one teacher to another.</p>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">From Teacher</label>
            <select
              value={fromTeacherId}
              onChange={(e) => setFromTeacherId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Select source teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.email}) - {t.assigned_count} students
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">To Teacher</label>
            <select
              value={toTeacherId}
              onChange={(e) => setToTeacherId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Select target teacher</option>
              {teachers
                .filter((t) => t.id !== fromTeacherId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.email}) - {t.assigned_count} students
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-slate-900">Source Teacher Students</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-xs px-3 py-2 rounded border hover:bg-slate-50"
              onClick={() => setSelectedStudentIds(filteredStudents.map((s) => s.id))}
            >
              Select All (Filtered)
            </button>
            <button
              type="button"
              className="text-xs px-3 py-2 rounded border hover:bg-slate-50"
              onClick={() => setSelectedStudentIds([])}
            >
              Clear
            </button>
          </div>
        </div>
        <input
          type="text"
          value={studentQuery}
          onChange={(e) => setStudentQuery(e.target.value)}
          placeholder="Search source students by name or email..."
          className="w-full border rounded-lg px-3 py-2"
        />
        {loading ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : filteredStudents.length === 0 ? (
          <p className="text-slate-500 text-sm">No students found for selected source teacher.</p>
        ) : (
          <div className="border rounded-lg divide-y max-h-80 overflow-auto">
            {filteredStudents.map((s) => (
              <label key={s.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-slate-800">{s.full_name}</p>
                  <p className="text-xs text-slate-500">{s.email}</p>
                </div>
                <input
                  type="checkbox"
                  checked={selectedStudentIds.includes(s.id)}
                  onChange={() => toggleStudent(s.id)}
                />
              </label>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={reassignSelected}
          disabled={saving || !fromTeacherId || !toTeacherId || selectedStudentIds.length === 0}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Reassigning...' : `Reassign ${selectedStudentIds.length} Student(s)`}
        </button>
      </div>
    </div>
  );
};

export default AdminStudentReassignments;
