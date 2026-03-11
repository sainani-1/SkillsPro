import React, { useEffect, useState } from 'react';
import { Award, Flame, MessageSquare, PlayCircle, Trophy } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { BADGE_LEVELS, computeCurrentStreak, getBadgeForPoints } from '../utils/learningActivity';

const ACHIEVEMENTS = [
  {
    key: 'bronze',
    title: 'Bronze Explorer',
    description: 'Reach 100 points through practice and learning.',
  },
  {
    key: 'silver',
    title: 'Silver Climber',
    description: 'Reach 500 points and build consistent momentum.',
  },
  {
    key: 'gold',
    title: 'Gold Champion',
    description: 'Reach 1000 points and become one of the strongest learners.',
  },
  {
    key: 'streak',
    title: 'Daily Streak',
    description: 'Study for 7 consecutive days.',
  },
  {
    key: 'forum',
    title: 'Forum Helper',
    description: 'Contribute 5 answers in the discussion forum.',
  },
  {
    key: 'playground',
    title: 'Code Runner',
    description: 'Complete 10 coding playground executions.',
  },
];

const SkillBadges = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    points: 0,
    streak: 0,
    forumAnswers: 0,
    forumPosts: 0,
    codingRuns: 0,
    completedCourses: 0,
    certificates: 0,
    passedExams: 0,
    unlocked: [],
    currentBadge: null,
  });

  useEffect(() => {
    if (!profile?.id) return;

    const load = async () => {
      setLoading(true);

      const [eventsResult, postsResult, answersResult, runsResult, enrollmentsResult, certificatesResult, examsResult] = await Promise.all([
        supabase.from('learning_activity_events').select('points_awarded, occurred_on, created_at').eq('user_id', profile.id),
        supabase.from('discussion_posts').select('id').eq('user_id', profile.id),
        supabase.from('discussion_answers').select('id, created_at').eq('user_id', profile.id),
        supabase.from('coding_playground_runs').select('id, created_at').eq('user_id', profile.id),
        supabase.from('enrollments').select('course_id, progress, completed').eq('student_id', profile.id),
        supabase.from('certificates').select('id').eq('user_id', profile.id),
        supabase.from('exam_submissions').select('passed, score_percent, submitted_at').eq('user_id', profile.id),
      ]);

      const events = eventsResult.data || [];
      const forumPosts = postsResult.data || [];
      const forumAnswers = answersResult.data || [];
      const codingRuns = runsResult.data || [];
      const enrollments = enrollmentsResult.data || [];
      const certificates = certificatesResult.data || [];
      const passedExams = (examsResult.data || []).filter((row) => row.passed).length;
      const completedCourses = enrollments.filter((row) => row.completed || Number(row.progress) >= 100).length;
      const points =
        events.reduce((sum, row) => sum + (Number(row.points_awarded) || 0), 0) +
        completedCourses * 100 +
        certificates.length * 75 +
        passedExams * 40 +
        forumAnswers.length * 25 +
        codingRuns.length * 12;

      const streak = computeCurrentStreak([
        ...events.map((row) => row.occurred_on || row.created_at),
        ...forumAnswers.map((row) => row.created_at),
        ...codingRuns.map((row) => row.created_at),
      ]);

      const unlocked = [
        ...(points >= 100 ? ['bronze'] : []),
        ...(points >= 500 ? ['silver'] : []),
        ...(points >= 1000 ? ['gold'] : []),
        ...(streak >= 7 ? ['streak'] : []),
        ...(forumAnswers.length >= 5 ? ['forum'] : []),
        ...(codingRuns.length >= 10 ? ['playground'] : []),
      ];

      setStats({
        points,
        streak,
        forumAnswers: forumAnswers.length,
        forumPosts: forumPosts.length,
        codingRuns: codingRuns.length,
        completedCourses,
        certificates: certificates.length,
        passedExams,
        unlocked,
        currentBadge: getBadgeForPoints(points),
      });
      setLoading(false);
    };

    load();
  }, [profile?.id]);

  if (loading) {
    return <LoadingSpinner message="Loading achievements..." />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-amber-300 via-white to-amber-500 p-[1px] shadow-lg">
        <div className="rounded-3xl bg-slate-950 px-8 py-7 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Gamification System</p>
          <h1 className="mt-3 text-3xl font-bold">Achievements, streaks, and reward milestones</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            Current status: {stats.currentBadge?.label || 'Starter tier'} with {stats.points} total points.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            <Award size={14} />
            Points
          </p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{stats.points}</p>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
            <Flame size={14} />
            Streak
          </p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{stats.streak} days</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
            <MessageSquare size={14} />
            Answers
          </p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{stats.forumAnswers}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            <PlayCircle size={14} />
            Runs
          </p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{stats.codingRuns}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {ACHIEVEMENTS.map((achievement) => {
          const unlocked = stats.unlocked.includes(achievement.key);
          const threshold = BADGE_LEVELS.find((item) => item.key === achievement.key)?.points || null;
          return (
            <div
              key={achievement.key}
              className={`rounded-3xl border p-6 shadow-sm transition ${
                unlocked ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${unlocked ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Trophy size={20} />
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${unlocked ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {unlocked ? 'Unlocked' : 'Locked'}
                </span>
              </div>
              <h2 className="mt-4 text-xl font-bold text-slate-900">{achievement.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{achievement.description}</p>
              {threshold ? (
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Reward threshold: {threshold} points
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Live Points Breakdown</h2>
        <p className="mt-2 text-sm text-slate-500">
          This page uses your real course, exam, certificate, forum, and coding activity.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <PointRow label="Completed courses" value={stats.completedCourses} formula="100 pts each" total={stats.completedCourses * 100} />
          <PointRow label="Certificates" value={stats.certificates} formula="75 pts each" total={stats.certificates * 75} />
          <PointRow label="Passed exams" value={stats.passedExams} formula="40 pts each" total={stats.passedExams * 40} />
          <PointRow label="Forum answers" value={stats.forumAnswers} formula="25 pts each" total={stats.forumAnswers * 25} />
          <PointRow label="Playground runs" value={stats.codingRuns} formula="12 pts each" total={stats.codingRuns * 12} />
          <PointRow label="Forum posts" value={stats.forumPosts} formula="used for engagement" total={0} />
        </div>
      </div>
    </div>
  );
};

const PointRow = ({ label, value, formula, total }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-sm font-semibold text-slate-900">{label}</p>
    <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{formula}</p>
    <p className="mt-2 text-sm font-semibold text-emerald-700">{total} pts</p>
  </div>
);

export default SkillBadges;
