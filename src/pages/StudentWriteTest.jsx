import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { CheckSquare, PlayCircle } from 'lucide-react';
import { buildPlanCheckoutPath } from '../utils/planCheckout';

export default function StudentWriteTest() {
  const { profile, isPremium } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  const isStudent = profile?.role === 'student';
  const premiumActive = isPremium(profile);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const aLabel = String(a.exam?.test_name || a.course?.title || '');
        const bLabel = String(b.exam?.test_name || b.course?.title || '');
        return aLabel.localeCompare(bLabel);
      }),
    [rows]
  );

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!profile?.id || !isStudent) {
        if (mounted) setLoading(false);
        return;
      }
      if (!premiumActive) {
        if (mounted) {
          setRows([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        if (!profile?.assigned_teacher_id) {
          if (mounted) setRows([]);
          return;
        }

        const { data: conductedTests } = await supabase
          .from('teacher_conducted_tests')
          .select('exam_id, created_at, audience_mode, target_student_ids')
          .eq('teacher_id', profile.assigned_teacher_id);

        const visibleConductedTests = (conductedTests || []).filter((row) => {
          if ((row.audience_mode || 'all_assigned') === 'all_assigned') return true;
          return Array.isArray(row.target_student_ids) && row.target_student_ids.map(String).includes(String(profile.id));
        });

        const examIds = Array.from(new Set(visibleConductedTests.map((row) => row.exam_id).filter(Boolean)));
        if (examIds.length === 0) {
          if (mounted) setRows([]);
          return;
        }

        const { data: exams } = await supabase
          .from('exams')
          .select('id, course_id, test_name')
          .in('id', examIds);

        const courseIds = Array.from(new Set((exams || []).map((exam) => exam.course_id).filter(Boolean)));
        const { data: courses } = courseIds.length
          ? await supabase.from('courses').select('id, title, category').in('id', courseIds)
          : { data: [] };

        const visibleExams = exams || [];
        if (visibleExams.length === 0) {
          if (mounted) setRows([]);
          return;
        }

        const [{ data: questions }, { data: submissions }] = await Promise.all([
          supabase.from('exam_questions').select('id, exam_id').in('exam_id', examIds),
          supabase
            .from('exam_submissions')
            .select('id, exam_id, score_percent, passed, submitted_at')
            .eq('user_id', profile.id)
            .in('exam_id', examIds)
            .order('submitted_at', { ascending: false }),
        ]);

        const courseMap = {};
        (courses || []).forEach((c) => {
          courseMap[c.id] = c;
        });
        const publishedAtByExam = {};
        visibleConductedTests.forEach((row) => {
          if (!publishedAtByExam[row.exam_id]) {
            publishedAtByExam[row.exam_id] = row.created_at || null;
          }
        });
        const questionCountByExam = {};
        (questions || []).forEach((q) => {
          questionCountByExam[q.exam_id] = (questionCountByExam[q.exam_id] || 0) + 1;
        });
        const latestSubmissionByExam = {};
        (submissions || []).forEach((s) => {
          if (!latestSubmissionByExam[s.exam_id]) latestSubmissionByExam[s.exam_id] = s;
        });

        const list = visibleExams.map((e) => ({
          exam: e,
          course: courseMap[e.course_id] || null,
          questionCount: questionCountByExam[e.id] || 0,
          latestSubmission: latestSubmissionByExam[e.id] || null,
          publishedAt: publishedAtByExam[e.id] || null,
        }));
        if (mounted) setRows(list);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [profile?.id, isStudent, premiumActive]);

  if (loading) return <LoadingSpinner message="Loading tests..." />;

  if (!isStudent) {
    return <div className="p-6 text-slate-600">Students only.</div>;
  }

  if (!premiumActive) {
    return (
      <div className="p-6 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CheckSquare size={22} /> Write Test
          </h1>
          <p className="text-sm text-slate-600 mt-1">Premium is required to access teacher-published tests.</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-semibold text-amber-900">Buy Premium to unlock Write Test.</p>
          <p className="mt-2 text-sm text-amber-800">
            Premium students can access teacher-published tests, continue their practice flow, and keep results in one place.
          </p>
          <button
            type="button"
            onClick={() => navigate(buildPlanCheckoutPath('premium'))}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700"
          >
            Buy Premium
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <CheckSquare size={22} /> Write Test
        </h1>
        <p className="text-sm text-slate-600 mt-1">Choose any test published by your assigned teacher and start it here.</p>
      </div>

      {sortedRows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-500">No tests available yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedRows.map((r) => (
            <div key={r.exam.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <p className="font-semibold text-slate-800">{r.exam?.test_name || 'Teacher Test'}</p>
              <p className="text-xs text-slate-500">{r.course?.title || r.course?.category || 'General Skill Test'}</p>
              <p className="text-sm text-slate-700">Questions: <span className="font-semibold">{r.questionCount}</span></p>
              {r.publishedAt ? (
                <p className="text-xs text-slate-500">Published: {new Date(r.publishedAt).toLocaleString('en-IN')}</p>
              ) : null}
              {r.latestSubmission ? (
                <p className="text-xs text-slate-600">
                  Latest: {Math.round(r.latestSubmission.score_percent || 0)}% ({r.latestSubmission.passed ? 'Passed' : 'Failed'})
                </p>
              ) : (
                <p className="text-xs text-slate-500">Not attempted yet</p>
              )}
              <button
                type="button"
                onClick={() => navigate(`/test-exam/${r.exam.id}`)}
                disabled={!r.exam?.id || r.questionCount === 0}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                <PlayCircle size={14} /> Start Test
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
