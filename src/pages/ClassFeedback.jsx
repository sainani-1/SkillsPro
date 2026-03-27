import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Star } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const formatDateTime = (value) => {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const ClassFeedback = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [feedbackRows, setFeedbackRows] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [selectedSessionId, setSelectedSessionId] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!profile?.id || !['teacher', 'admin'].includes(profile?.role)) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let sessionQuery = supabase
          .from('class_sessions')
          .select('id, title, scheduled_for, status, teacher_id')
          .order('scheduled_for', { ascending: false })
          .limit(100);

        if (profile.role === 'teacher') {
          sessionQuery = sessionQuery.eq('teacher_id', profile.id);
        }

        const { data: sessionData, error: sessionError } = await sessionQuery;
        if (sessionError) throw sessionError;

        const nextSessions = sessionData || [];
        setSessions(nextSessions);

        if (!nextSessions.length) {
          setFeedbackRows([]);
          setProfilesById({});
          setSelectedSessionId('');
          setLoading(false);
          return;
        }

        const activeSessionId = selectedSessionId || String(nextSessions[0].id);
        setSelectedSessionId(activeSessionId);

        const { data: feedbackData, error: feedbackError } = await supabase
          .from('class_session_feedback')
          .select('id, session_id, student_id, rating, feedback_text, created_at')
          .eq('session_id', activeSessionId)
          .order('created_at', { ascending: false });

        if (feedbackError) throw feedbackError;

        const rows = feedbackData || [];
        setFeedbackRows(rows);

        const studentIds = [...new Set(rows.map((row) => row.student_id).filter(Boolean))];
        if (studentIds.length) {
          const { data: profileRows, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .in('id', studentIds);
          if (profileError) throw profileError;
          setProfilesById(
            Object.fromEntries((profileRows || []).map((entry) => [entry.id, entry])),
          );
        } else {
          setProfilesById({});
        }
      } catch (error) {
        setSessions([]);
        setFeedbackRows([]);
        setProfilesById({});
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [profile?.id, profile?.role, selectedSessionId]);

  const selectedSession = useMemo(
    () => sessions.find((session) => String(session.id) === String(selectedSessionId)) || null,
    [sessions, selectedSessionId],
  );

  const averageRating = useMemo(() => {
    if (!feedbackRows.length) return 0;
    const total = feedbackRows.reduce((sum, row) => sum + Number(row.rating || 0), 0);
    return (total / feedbackRows.length).toFixed(1);
  }, [feedbackRows]);

  if (loading) {
    return <LoadingSpinner message="Loading class feedback..." />;
  }

  if (!['teacher', 'admin'].includes(profile?.role)) {
    return (
      <div className="p-6 text-slate-700">
        <p>You do not have access to classroom feedback.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-slate-900 px-6 py-6 text-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200">Class Feedback</p>
              <h1 className="mt-2 text-2xl font-bold">Student feedback after class completion</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Review ratings and comments from students after each live session.
              </p>
            </div>
            <div className="grid min-w-[240px] gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Responses</p>
                <p className="mt-2 text-2xl font-bold">{feedbackRows.length}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Average Rating</p>
                <p className="mt-2 text-2xl font-bold">{feedbackRows.length ? `${averageRating}/5` : '0.0/5'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <label className="min-w-[280px] flex-1">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Choose Class Session</span>
              <select
                value={selectedSessionId}
                onChange={(event) => setSelectedSessionId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none"
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title} - {formatDateTime(session.scheduled_for)}
                  </option>
                ))}
              </select>
            </label>
            {selectedSession ? (
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                <p className="font-semibold">{selectedSession.title}</p>
                <p className="mt-1 text-slate-500">{formatDateTime(selectedSession.scheduled_for)}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <MessageSquare className="text-amber-500" size={20} />
            <h2 className="text-lg font-semibold text-slate-900">Responses</h2>
          </div>

          {feedbackRows.length ? (
            <div className="mt-5 grid gap-4">
              {feedbackRows.map((row) => {
                const student = profilesById[row.student_id];
                return (
                  <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {student?.full_name || student?.email || 'Student'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{formatDateTime(row.created_at)}</p>
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
                        <Star size={14} className="fill-current" />
                        <span>{row.rating}/5</span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {row.feedback_text?.trim() || 'Student submitted a rating without a written comment.'}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              No feedback has been submitted for this class yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClassFeedback;
