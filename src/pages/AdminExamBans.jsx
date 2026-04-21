import React, { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { logAdminActivity } from '../utils/adminActivityLogger';

export default function AdminExamBans() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState([]);

  useEffect(() => {
    const loadStudents = async () => {
      try {
        setLoading(true);
        setError('');
        const { data, error: loadError } = await supabase
          .from('profiles')
          .select('id, full_name, email, role, avatar_url, is_exam_banned, exam_ban_reason, exam_banned_at')
          .eq('role', 'student')
          .order('full_name');
        if (loadError) throw loadError;
        setStudents(data || []);
      } catch (loadError) {
        setError(loadError.message || 'Failed to load exam-ban users.');
      } finally {
        setLoading(false);
      }
    };

    void loadStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    const term = String(search || '').trim().toLowerCase();
    if (!term) return students;
    return students.filter((student) =>
      [student.full_name, student.email, student.is_exam_banned ? 'banned' : 'active']
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [search, students]);

  const handleBanToggle = async (student, shouldBan) => {
    if (!student?.id) return;
    const defaultReason = shouldBan
      ? (student.exam_ban_reason || 'Banned from exams by admin.')
      : '';
    const reason = shouldBan
      ? window.prompt('Reason for banning this user from exams?', defaultReason)
      : window.confirm(`Remove exam ban for ${student.full_name || student.email || 'this user'}?`);

    if ((shouldBan && reason === null) || (!shouldBan && !reason)) return;

    setSaving(true);
    setError('');
    setInfo('');
    try {
      const patch = shouldBan
        ? {
            is_exam_banned: true,
            exam_ban_reason: String(reason || '').trim() || 'Banned from exams by admin.',
            exam_banned_at: new Date().toISOString(),
            exam_banned_by: profile?.id || null,
          }
        : {
            is_exam_banned: false,
            exam_ban_reason: null,
            exam_banned_at: null,
            exam_banned_by: null,
          };

      const { error: updateError } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', student.id);
      if (updateError) throw updateError;

      await logAdminActivity({
        adminId: profile?.id,
        action: shouldBan ? 'Banned exam access' : 'Removed exam ban',
        target: student.id,
        details: {
          student_id: student.id,
          reason: shouldBan ? patch.exam_ban_reason : null,
          source: 'admin_exam_bans',
        },
      });

      setStudents((prev) =>
        prev.map((row) => (
          row.id === student.id
            ? { ...row, ...patch }
            : row
        ))
      );
      setInfo(
        shouldBan
          ? `${student.full_name || student.email || 'Student'} is now banned from exams.`
          : `${student.full_name || student.email || 'Student'} can write exams again.`
      );
    } catch (actionError) {
      setError(actionError.message || 'Failed to update exam ban.');
    } finally {
      setSaving(false);
    }
  };

  if (profile?.role !== 'admin') {
    return <div className="p-8 text-sm text-slate-600">Admins only.</div>;
  }

  if (loading) {
    return <LoadingSpinner message="Loading exam-ban controls..." />;
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Exam Bans</h1>
          <p className="mt-1 text-sm text-slate-600">Search students, permanently block exam access, or remove the ban when they are allowed back.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          <span className="font-semibold text-slate-900">{students.filter((row) => row.is_exam_banned).length}</span> banned user{students.filter((row) => row.is_exam_banned).length === 1 ? '' : 's'}
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {info ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div> : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Student Search</h2>
            <p className="mt-1 text-sm text-slate-600">Find a student by name, email, or current exam-ban status.</p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search student or status"
            className="w-full max-w-md rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Student</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Reason</th>
                <th className="px-3 py-2 text-left">Banned At</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-3 py-8 text-center text-slate-500">No students match this search.</td>
                </tr>
              ) : filteredStudents.map((student) => (
                <tr key={student.id} className="border-t border-slate-200">
                  <td className="px-3 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{student.full_name || 'Student'}</p>
                      <p className="text-xs text-slate-500">{student.email || '-'}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${student.is_exam_banned ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {student.is_exam_banned ? 'Banned' : 'Allowed'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{student.exam_ban_reason || '-'}</td>
                  <td className="px-3 py-3 text-slate-600">{student.exam_banned_at ? new Date(student.exam_banned_at).toLocaleString('en-IN') : '-'}</td>
                  <td className="px-3 py-3">
                    {student.is_exam_banned ? (
                      <button
                        type="button"
                        onClick={() => handleBanToggle(student, false)}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Remove Ban
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleBanToggle(student, true)}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Ban In Exam
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
