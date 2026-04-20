import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import { getOverdueHours } from '../utils/careerSupport';

const AdminCareerAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ resumes: [], interviews: [], profiles: [], roadmaps: [], tasks: [], teachers: [] });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [resumes, interviews, profiles, roadmaps, tasks, teachers] = await Promise.all([
          supabase.from('career_resume_reviews').select('*'),
          supabase.from('career_mock_interviews').select('*'),
          supabase.from('career_profile_reviews').select('*'),
          supabase.from('career_roadmaps').select('*'),
          supabase.from('career_tasks').select('*'),
          supabase.from('profiles').select('id, full_name, email').eq('role', 'teacher'),
        ]);
        const failed = [resumes, interviews, profiles, roadmaps, tasks, teachers].find((result) => result.error);
        if (failed?.error) throw failed.error;
        setData({ resumes: resumes.data || [], interviews: interviews.data || [], profiles: profiles.data || [], roadmaps: roadmaps.data || [], tasks: tasks.data || [], teachers: teachers.data || [] });
      } catch (loadError) {
        setError(loadError.message || 'Failed to load career analytics.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const analytics = useMemo(() => {
    const pending = [
      ...data.resumes.filter((row) => row.status !== 'reviewed'),
      ...data.interviews.filter((row) => row.status !== 'completed'),
      ...data.profiles.filter((row) => row.status !== 'reviewed'),
    ];
    const completedInterviews = data.interviews.filter((row) => row.status === 'completed');
    const avgInterview = completedInterviews.length
      ? Math.round(completedInterviews.reduce((sum, row) => sum + (Number(row.rating) || 0), 0) / completedInterviews.length)
      : 0;
    const teacherCounts = data.teachers.map((teacher) => ({
      teacher,
      count: [...data.resumes, ...data.interviews, ...data.profiles, ...data.roadmaps, ...data.tasks].filter((row) => row.teacher_id === teacher.id).length,
    })).sort((a, b) => b.count - a.count).slice(0, 8);
    return {
      totalRequests: data.resumes.length + data.interviews.length + data.profiles.length,
      pending: pending.length,
      overdue: pending.filter((row) => getOverdueHours(row.created_at, 48)).length,
      avgInterview,
      teacherCounts,
    };
  }, [data]);

  if (loading) return <LoadingSpinner message="Loading career analytics..." />;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-950 p-6 text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-200">Admin</p>
        <h1 className="mt-2 text-3xl font-bold">Career Analytics</h1>
        <p className="mt-2 text-slate-300">Track Premium Plus support usage, teacher load, completion, and overdue items.</p>
      </section>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Total Requests', analytics.totalRequests, <BarChart3 key="i" />],
          ['Pending', analytics.pending, <Users key="i" />],
          ['Overdue', analytics.overdue, <AlertTriangle key="i" />],
          ['Avg Interview Rating', `${analytics.avgInterview}/5`, <CheckCircle key="i" />],
        ].map(([label, value, icon]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{icon}<p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p></div>
        ))}
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Most Active Teachers</h2>
        <div className="mt-4 grid gap-3">
          {analytics.teacherCounts.map(({ teacher, count }) => (
            <div key={teacher.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-slate-900">{teacher.full_name || teacher.email}</p>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{count} items</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminCareerAnalytics;
