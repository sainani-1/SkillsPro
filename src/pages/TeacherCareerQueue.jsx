import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle, FileText, MessageSquare, Plus, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import { getOverdueHours } from '../utils/careerSupport';
import { sendAdminNotification } from '../utils/adminNotifications';

const TeacherCareerQueue = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState({ students: [], resumes: [], interviews: [], profiles: [], roadmaps: [], tasks: [] });
  const [taskForm, setTaskForm] = useState({ student_id: '', title: '', description: '', due_date: '' });

  const loadQueue = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError('');
    try {
      const studentQuery = profile.role === 'admin'
        ? supabase.from('profiles').select('id, full_name, email, assigned_teacher_id').eq('role', 'student')
        : supabase.from('profiles').select('id, full_name, email, assigned_teacher_id').eq('assigned_teacher_id', profile.id);
      const [students, resumes, interviews, profiles, roadmaps, tasks] = await Promise.all([
        studentQuery,
        profile.role === 'admin' ? supabase.from('career_resume_reviews').select('*').order('created_at', { ascending: false }) : supabase.from('career_resume_reviews').select('*').eq('teacher_id', profile.id).order('created_at', { ascending: false }),
        profile.role === 'admin' ? supabase.from('career_mock_interviews').select('*').order('created_at', { ascending: false }) : supabase.from('career_mock_interviews').select('*').eq('teacher_id', profile.id).order('created_at', { ascending: false }),
        profile.role === 'admin' ? supabase.from('career_profile_reviews').select('*').order('created_at', { ascending: false }) : supabase.from('career_profile_reviews').select('*').eq('teacher_id', profile.id).order('created_at', { ascending: false }),
        profile.role === 'admin' ? supabase.from('career_roadmaps').select('*').order('updated_at', { ascending: false }) : supabase.from('career_roadmaps').select('*').eq('teacher_id', profile.id).order('updated_at', { ascending: false }),
        profile.role === 'admin' ? supabase.from('career_tasks').select('*').order('created_at', { ascending: false }) : supabase.from('career_tasks').select('*').eq('teacher_id', profile.id).order('created_at', { ascending: false }),
      ]);
      const failed = [students, resumes, interviews, profiles, roadmaps, tasks].find((result) => result.error);
      if (failed?.error) throw failed.error;
      setRows({ students: students.data || [], resumes: resumes.data || [], interviews: interviews.data || [], profiles: profiles.data || [], roadmaps: roadmaps.data || [], tasks: tasks.data || [] });
    } catch (loadError) {
      setError(loadError.message || 'Failed to load teacher career queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQueue(); }, [profile?.id, profile?.role]);

  const studentMap = useMemo(() => Object.fromEntries(rows.students.map((student) => [student.id, student])), [rows.students]);
  const pendingResumes = rows.resumes.filter((row) => row.status !== 'reviewed');
  const pendingInterviews = rows.interviews.filter((row) => row.status !== 'completed');
  const pendingProfiles = rows.profiles.filter((row) => row.status !== 'reviewed');
  const overdueItems = [...pendingResumes, ...pendingInterviews, ...pendingProfiles].filter((row) => getOverdueHours(row.created_at, 48));

  const createTask = async () => {
    if (!taskForm.student_id || !taskForm.title.trim()) {
      setError('Choose a student and enter a task title.');
      return;
    }
    const { data, error: insertError } = await supabase
      .from('career_tasks')
      .insert({
        student_id: taskForm.student_id,
        teacher_id: profile.id,
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || null,
        due_date: taskForm.due_date || null,
      })
      .select('*')
      .single();
    if (insertError) {
      setError(insertError.message || 'Failed to create task.');
      return;
    }
    setRows((prev) => ({ ...prev, tasks: [data, ...prev.tasks] }));
    setTaskForm({ student_id: '', title: '', description: '', due_date: '' });
    await sendAdminNotification({
      target_user_id: data.student_id,
      target_role: 'student',
      title: 'New career task assigned',
      content: `${profile.full_name || 'Your teacher'} assigned a career support task: ${data.title}`,
      type: 'career_task',
    });
  };

  if (loading) return <LoadingSpinner message="Loading teacher career queue..." />;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-950 p-6 text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-200">Career Support</p>
        <h1 className="mt-2 text-3xl font-bold">Teacher Career Queue</h1>
        <p className="mt-2 text-slate-300">Manage pending reviews, report cards, roadmaps, overdue work, and student tasks.</p>
      </section>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-5">
        {[
          ['Pending Resumes', pendingResumes.length, <FileText key="i" />],
          ['Pending Interviews', pendingInterviews.length, <MessageSquare key="i" />],
          ['Pending Profiles', pendingProfiles.length, <Sparkles key="i" />],
          ['Tasks', rows.tasks.length, <CheckCircle key="i" />],
          ['Overdue', overdueItems.length, <AlertTriangle key="i" />],
        ].map(([label, value, icon]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{icon}<p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p></div>
        ))}
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Assign Career Task</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <select value={taskForm.student_id} onChange={(e) => setTaskForm((prev) => ({ ...prev, student_id: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-3 text-sm">
            <option value="">Choose student</option>
            {rows.students.map((student) => <option key={student.id} value={student.id}>{student.full_name || student.email}</option>)}
          </select>
          <input value={taskForm.title} onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Task title" className="rounded-xl border border-slate-300 px-3 py-3 text-sm" />
          <input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm((prev) => ({ ...prev, due_date: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-3 text-sm" />
          <textarea value={taskForm.description} onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))} rows={3} placeholder="Task details" className="rounded-xl border border-slate-300 px-3 py-3 text-sm md:col-span-2" />
        </div>
        <button type="button" onClick={createTask} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><Plus size={16} /> Assign Task</button>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Pending Work</h2>
        <div className="mt-4 grid gap-3">
          {[...pendingResumes.map((r) => ({ ...r, type: 'Resume', path: '/app/resume-reviews' })), ...pendingInterviews.map((r) => ({ ...r, type: 'Mock Interview', path: '/app/mock-interviews' })), ...pendingProfiles.map((r) => ({ ...r, type: 'Profile Review', path: '/app/resume-reviews' }))].map((item) => (
            <Link key={`${item.type}-${item.id}`} to={item.path} className="rounded-xl border border-slate-200 p-4 hover:bg-slate-50">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div><p className="font-bold text-slate-900">{item.type}: {studentMap[item.student_id]?.full_name || studentMap[item.student_id]?.email || 'Student'}</p><p className="text-sm text-slate-500">Created {new Date(item.created_at).toLocaleString('en-IN')}</p></div>
                {getOverdueHours(item.created_at, 48) ? <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">Overdue {getOverdueHours(item.created_at, 48)}h</span> : <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">Pending</span>}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default TeacherCareerQueue;
