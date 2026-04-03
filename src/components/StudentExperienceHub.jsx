import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Flame, Medal, MessageSquare, PlayCircle, Sparkles } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { BADGE_LEVELS, computeCurrentStreak, getBadgeForPoints, getNextBadge } from '../utils/learningActivity';
import { getVideoCompletionPercent } from '../utils/videoProgress';

function clampPercent(value) {
  return Math.min(100, Math.max(0, Math.round(value || 0)));
}

function formatMinutes(totalMinutes) {
  if (!totalMinutes) return '0h';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function getSessionDurationMinutes(session) {
  const start = session?.scheduled_for ? new Date(session.scheduled_for) : null;
  const end = session?.ends_at ? new Date(session.ends_at) : null;
  if (!start || Number.isNaN(start.getTime())) return 0;
  if (!end || Number.isNaN(end.getTime())) return 60;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function makeLastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      minutes: 0,
    };
  });
}

const StudentExperienceHub = ({ profile, courses, certificates, examResults, videoProgressByCourseId = {} }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPoints: 0,
    currentStreak: 0,
    weeklyMinutes: 0,
    avgProgress: 0,
    completionPercent: 0,
    badge: null,
    nextBadge: null,
    weeklyChart: makeLastSevenDays(),
    recommendations: [],
    forumPosts: 0,
    forumAnswers: 0,
    codingRuns: 0,
  });

  useEffect(() => {
    if (!profile?.id) return;

    let cancelled = false;

    const loadExperience = async () => {
      setLoading(true);

      const enrolledCourseIds = courses.map((course) => course.course_id).filter(Boolean);
      const lastSevenDays = makeLastSevenDays();
      const startDateIso = lastSevenDays[0].key;

      const [
        activityResult,
        sessionsResult,
        codingRunsResult,
        forumPostsResult,
        forumAnswersResult,
        allCoursesResult,
      ] = await Promise.all([
        supabase
          .from('learning_activity_events')
          .select('points_awarded, duration_minutes, created_at, occurred_on')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('class_sessions')
          .select('scheduled_for, ends_at, class_session_participants!inner(student_id)')
          .eq('class_session_participants.student_id', profile.id)
          .gte('scheduled_for', `${startDateIso}T00:00:00.000Z`)
          .order('scheduled_for', { ascending: true }),
        supabase
          .from('coding_playground_runs')
          .select('created_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('discussion_posts')
          .select('id, created_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('discussion_answers')
          .select('id, created_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false }),
        supabase.from('courses').select('id, title, category, description, thumbnail_url').order('created_at', { ascending: false }),
      ]);

      if (cancelled) return;

      const activityRows = activityResult.data || [];
      const sessionRows = sessionsResult.data || [];
      const codingRows = codingRunsResult.data || [];
      const postRows = forumPostsResult.data || [];
      const answerRows = forumAnswersResult.data || [];
      const availableCourses = allCoursesResult.data || [];

      const getCoursePercent = (course) => {
        const videoProgress = videoProgressByCourseId[String(course.course_id)] || null;
        const videoPercent = getVideoCompletionPercent(videoProgress);
        return Math.max(0, Math.min(100, Math.max(Number(course.progress) || 0, videoPercent)));
      };

      const completedCourses = courses.filter((course) => {
        if (course.completed) return true;
        if (getCoursePercent(course) >= 100) return true;
        return Boolean(examResults?.[course.course_id]?.passed);
      }).length;

      const passedExams = Object.values(examResults || {}).filter((entry) => entry?.passed).length;
      const avgProgress = courses.length
        ? courses.reduce((sum, course) => sum + getCoursePercent(course), 0) / courses.length
        : 0;
      const completionPercent = courses.length ? (completedCourses / courses.length) * 100 : 0;

      const basePoints =
        completedCourses * 100 +
        certificates.length * 75 +
        passedExams * 40 +
        codingRows.length * 12 +
        postRows.length * 20 +
        answerRows.length * 25;

      const activityPoints = activityRows.reduce((sum, row) => sum + (Number(row.points_awarded) || 0), 0);
      const totalPoints = basePoints + activityPoints;

      const activityDates = [
        ...activityRows.map((row) => row.occurred_on || row.created_at),
        ...codingRows.map((row) => row.created_at),
        ...postRows.map((row) => row.created_at),
        ...answerRows.map((row) => row.created_at),
        ...sessionRows.map((row) => row.scheduled_for),
      ];

      const weeklyData = lastSevenDays.map((day) => ({ ...day }));
      const weeklyIndex = new Map(weeklyData.map((day) => [day.key, day]));

      activityRows.forEach((row) => {
        const key = String(row.occurred_on || row.created_at || '').slice(0, 10);
        const bucket = weeklyIndex.get(key);
        if (bucket) {
          bucket.minutes += Math.max(0, Number(row.duration_minutes) || 0);
        }
      });

      codingRows.forEach((row) => {
        const key = String(row.created_at || '').slice(0, 10);
        const bucket = weeklyIndex.get(key);
        if (bucket) {
          bucket.minutes += 15;
        }
      });

      sessionRows.forEach((row) => {
        const key = String(row.scheduled_for || '').slice(0, 10);
        const bucket = weeklyIndex.get(key);
        if (bucket) {
          bucket.minutes += getSessionDurationMinutes(row);
        }
      });

      Object.values(videoProgressByCourseId || {}).forEach((progress) => {
        const key = String(progress?.updatedAt || '').slice(0, 10);
        const bucket = weeklyIndex.get(key);
        if (bucket) {
          bucket.minutes += Math.max(0, Math.round((Number(progress.currentTime) || 0) / 60));
        }
      });

      const weeklyMinutes = weeklyData.reduce((sum, day) => sum + day.minutes, 0);
      const badge = getBadgeForPoints(totalPoints);
      const nextBadge = getNextBadge(totalPoints);

      const subjectTokens = [profile.core_subject, profile.study_stream]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      const recommendations = availableCourses
        .filter((course) => !enrolledCourseIds.includes(course.id))
        .sort((left, right) => {
          const leftScore = subjectTokens.some((token) =>
            `${left.title} ${left.category} ${left.description || ''}`.toLowerCase().includes(token)
          )
            ? 1
            : 0;
          const rightScore = subjectTokens.some((token) =>
            `${right.title} ${right.category} ${right.description || ''}`.toLowerCase().includes(token)
          )
            ? 1
            : 0;
          return rightScore - leftScore;
        })
        .slice(0, 3);

      setStats({
        totalPoints,
        currentStreak: computeCurrentStreak(activityDates),
        weeklyMinutes,
        avgProgress: clampPercent(avgProgress),
        completionPercent: clampPercent(completionPercent),
        badge,
        nextBadge,
        weeklyChart: weeklyData,
        recommendations,
        forumPosts: postRows.length,
        forumAnswers: answerRows.length,
        codingRuns: codingRows.length,
      });
      setLoading(false);
    };

    loadExperience();

    const handleRefresh = () => {
      loadExperience();
    };
    window.addEventListener('student-experience-refresh', handleRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener('student-experience-refresh', handleRefresh);
    };
  }, [profile?.id, profile?.core_subject, profile?.study_stream, profile?.full_name, profile?.avatar_url, courses, certificates.length, examResults, videoProgressByCourseId]);

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Points</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{stats.totalPoints}</p>
          <p className="mt-2 text-sm text-slate-500">Earned from courses, coding, and community activity.</p>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
            <Flame size={14} />
            Streak
          </p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{stats.currentStreak} days</p>
          <p className="mt-2 text-sm text-slate-500">Stay active daily to keep your streak alive.</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">This Week</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{formatMinutes(stats.weeklyMinutes)}</p>
          <p className="mt-2 text-sm text-slate-500">Learning time across classes, practice, and activity logs.</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
            <BarChart3 size={14} />
            Completion
          </p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{stats.completionPercent}%</p>
          <p className="mt-2 text-sm text-slate-500">Average course completion is {stats.avgProgress}%.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Analytics</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Weekly learning rhythm</h2>
            </div>
            <Link to="/app/coding-playground" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Open Playground
            </Link>
          </div>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.weeklyChart}>
                <defs>
                  <linearGradient id="learningMinutesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip formatter={(value) => [`${value} min`, 'Learning']} />
                <Area type="monotone" dataKey="minutes" stroke="#059669" fill="url(#learningMinutesFill)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Gamification</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Badges and reward track</h2>
          <div className={`mt-5 rounded-2xl bg-gradient-to-r ${stats.badge?.tone || 'from-slate-200 via-white to-slate-300'} p-[1px]`}>
            <div className="rounded-2xl bg-slate-950/95 p-5 text-white">
              <p className="text-sm text-slate-300">Current tier</p>
              <p className="mt-2 text-2xl font-bold">{stats.badge?.label || 'Starter'}</p>
              <p className="mt-2 text-sm text-slate-300">
                {stats.nextBadge
                  ? `${Math.max(stats.nextBadge.points - stats.totalPoints, 0)} points to ${stats.nextBadge.label}.`
                  : 'Top tier unlocked. Keep building your lead.'}
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {BADGE_LEVELS.slice().reverse().map((level) => (
              <div key={level.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">{level.label}</span>
                  <span className="text-slate-500">{level.points} pts</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                    style={{ width: `${clampPercent((stats.totalPoints / level.points) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <Link to="/app/skill-badges" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            <Medal size={16} />
            Open full achievements
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Recommended</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Courses to take next</h2>
            </div>
            <Sparkles size={18} className="text-emerald-600" />
          </div>
          <div className="mt-5 space-y-4">
            {loading ? (
              <p className="text-sm text-slate-500">Preparing recommendations...</p>
            ) : stats.recommendations.length === 0 ? (
              <p className="text-sm text-slate-500">You are already enrolled in the best matching courses.</p>
            ) : (
              stats.recommendations.map((course) => (
                <Link key={course.id} to={`/app/course/${course.id}`} className="block rounded-2xl border border-slate-200 p-4 hover:border-emerald-300 hover:bg-emerald-50/40">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">{course.category || 'Course'}</p>
                  <h3 className="mt-2 text-lg font-bold text-slate-900">{course.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{course.description || 'Sharpen your fundamentals with this recommendation.'}</p>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Engagement</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Practice and discussion</h2>
          <div className="mt-5 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Runs', value: stats.codingRuns },
                  { name: 'Posts', value: stats.forumPosts },
                  { name: 'Answers', value: stats.forumAnswers },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis allowDecimals={false} stroke="#64748b" />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-5 grid gap-3">
            <Link to="/app/discussion-forum" className="inline-flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 hover:border-sky-300 hover:bg-sky-50">
              <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
                <MessageSquare size={16} />
                Discussion forum
              </span>
              <span className="text-sm text-slate-500">Ask and answer doubts</span>
            </Link>
            <Link to="/app/coding-playground" className="inline-flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 hover:border-emerald-300 hover:bg-emerald-50">
              <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
                <PlayCircle size={16} />
                Coding playground
              </span>
              <span className="text-sm text-slate-500">Run code instantly</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StudentExperienceHub;
