import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { CheckSquare, PlayCircle } from 'lucide-react';

export default function StudentWriteTest() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  const isStudent = profile?.role === 'student';

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => String(a.course?.title || '').localeCompare(String(b.course?.title || ''))),
    [rows]
  );

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!profile?.id || !isStudent) {
        if (mounted) setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('student_id', profile.id);
        const courseIds = Array.from(new Set((enrollments || []).map((e) => e.course_id).filter(Boolean)));
        if (courseIds.length === 0) {
          if (mounted) setRows([]);
          return;
        }

        const [{ data: courses }, { data: exams }] = await Promise.all([
          supabase.from('courses').select('id, title, category').in('id', courseIds),
          supabase.from('exams').select('id, course_id, test_name').in('course_id', courseIds),
        ]);

        const examIds = (exams || []).map((e) => e.id);
        const [questionsRes, submissionsRes] = await Promise.all([
          examIds.length ? supabase.from('exam_questions').select('id, exam_id').in('exam_id', examIds) : { data: [] },
          examIds.length
            ? supabase
                .from('exam_submissions')
                .select('id, exam_id, score_percent, passed, submitted_at')
                .eq('user_id', profile.id)
                .in('exam_id', examIds)
                .order('submitted_at', { ascending: false })
            : { data: [] },
        ]);

        const courseMap = {};
        (courses || []).forEach((c) => {
          courseMap[c.id] = c;
        });
        const questionCountByExam = {};
        (questionsRes.data || []).forEach((q) => {
          questionCountByExam[q.exam_id] = (questionCountByExam[q.exam_id] || 0) + 1;
        });
        const latestSubmissionByExam = {};
        (submissionsRes.data || []).forEach((s) => {
          if (!latestSubmissionByExam[s.exam_id]) latestSubmissionByExam[s.exam_id] = s;
        });

        const list = (exams || []).map((e) => ({
          exam: e,
          course: courseMap[e.course_id] || null,
          questionCount: questionCountByExam[e.id] || 0,
          latestSubmission: latestSubmissionByExam[e.id] || null,
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
  }, [profile?.id, isStudent]);

  if (loading) return <LoadingSpinner message="Loading tests..." />;

  if (!isStudent) {
    return <div className="p-6 text-slate-600">Students only.</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <CheckSquare size={22} /> Write Test
        </h1>
        <p className="text-sm text-slate-600 mt-1">Choose a course test and start exam with strict proctoring.</p>
      </div>

      {sortedRows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-500">No tests available yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedRows.map((r) => (
            <div key={r.exam.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <p className="font-semibold text-slate-800">{r.course?.title || 'Untitled Course'}</p>
              {r.exam?.test_name ? <p className="text-xs text-blue-700 font-semibold">{r.exam.test_name}</p> : null}
              <p className="text-xs text-slate-500">{r.course?.category || 'General'}</p>
              <p className="text-sm text-slate-700">Questions: <span className="font-semibold">{r.questionCount}</span></p>
              {r.latestSubmission ? (
                <p className="text-xs text-slate-600">
                  Latest: {Math.round(r.latestSubmission.score_percent || 0)}% ({r.latestSubmission.passed ? 'Passed' : 'Failed'})
                </p>
              ) : (
                <p className="text-xs text-slate-500">Not attempted yet</p>
              )}
              <button
                type="button"
                onClick={() => navigate(`/exam/${r.course?.id}`)}
                disabled={!r.course?.id || r.questionCount === 0}
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
