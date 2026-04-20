import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle, Link as LinkIcon, MessageSquare, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import PremiumPlusUpgradeGate from '../components/PremiumPlusUpgradeGate';
import { sendAdminNotification } from '../utils/adminNotifications';
import {
  MOCK_INTERVIEW_LIMIT,
  canUseCareerSupport,
  formatCareerCycle,
  getCareerCycleMonth,
  isCareerStaff,
  notifyCareerTeacher,
} from '../utils/careerSupport';

const formatDate = (value) => (value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

const PremiumPlusMockInterviews = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [interviews, setInterviews] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [preferredTime, setPreferredTime] = useState('');
  const [studentNote, setStudentNote] = useState('');
  const [drafts, setDrafts] = useState({});
  const [teacherFilter, setTeacherFilter] = useState('pending');

  const cycleMonth = getCareerCycleMonth();
  const staff = isCareerStaff(profile);
  const allowed = canUseCareerSupport(profile);

  const loadInterviews = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError('');
    try {
      let query = supabase.from('career_mock_interviews').select('*').order('created_at', { ascending: false });
      if (profile.role === 'student') query = query.eq('student_id', profile.id);
      if (profile.role === 'teacher') query = query.eq('teacher_id', profile.id);
      const { data, error: interviewError } = await query;
      if (interviewError) throw interviewError;

      const rows = data || [];
      setInterviews(rows);
      const profileIds = Array.from(new Set(rows.flatMap((row) => [row.student_id, row.teacher_id]).filter(Boolean)));
      if (profileIds.length) {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .in('id', profileIds);
        if (profileError) throw profileError;
        setProfilesById(Object.fromEntries((profileRows || []).map((row) => [row.id, row])));
      } else {
        setProfilesById({});
      }
    } catch (loadError) {
      setError(loadError.message || 'Unable to load mock interviews. Apply the career support SQL setup if this is the first run.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInterviews();
  }, [profile?.id, profile?.role]);

  const currentCycleInterviews = useMemo(
    () => interviews.filter((row) => row.student_id === profile?.id && row.cycle_month === cycleMonth),
    [interviews, profile?.id, cycleMonth]
  );
  const usedThisCycle = currentCycleInterviews.length;
  const remaining = Math.max(MOCK_INTERVIEW_LIMIT - usedThisCycle, 0);
  const visibleInterviews = useMemo(() => {
    if (!staff) return interviews;
    if (teacherFilter === 'pending') {
      return interviews.filter((row) => String(row.status || '').toLowerCase() !== 'completed');
    }
    if (teacherFilter === 'completed') {
      return interviews.filter((row) => String(row.status || '').toLowerCase() === 'completed');
    }
    return interviews;
  }, [interviews, staff, teacherFilter]);
  const teacherCounts = useMemo(() => ({
    pending: interviews.filter((row) => String(row.status || '').toLowerCase() !== 'completed').length,
    completed: interviews.filter((row) => String(row.status || '').toLowerCase() === 'completed').length,
    all: interviews.length,
  }), [interviews]);

  const requestInterview = async () => {
    if (!allowed || staff || remaining <= 0 || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const teacherId = profile.assigned_teacher_id || null;
      const payload = {
        student_id: profile.id,
        teacher_id: teacherId,
        cycle_month: cycleMonth,
        preferred_time: preferredTime ? new Date(preferredTime).toISOString() : null,
        student_note: studentNote.trim() || null,
        status: 'requested',
      };
      const { data, error: insertError } = await supabase
        .from('career_mock_interviews')
        .insert(payload)
        .select('*')
        .single();
      if (insertError) throw insertError;
      setInterviews((prev) => [data, ...prev]);
      setPreferredTime('');
      setStudentNote('');
      setMessage('Mock interview request sent to your teacher.');
      await notifyCareerTeacher({
        teacherId,
        title: 'Mock interview request needs scheduling',
        message: `${profile.full_name || profile.email || 'A student'} requested a mock interview. Open Mock Interviews to schedule it and complete the report card after the interview.`,
        source: 'mock_interview',
      });
    } catch (requestError) {
      setError(requestError.message || 'Failed to request mock interview.');
    } finally {
      setSaving(false);
    }
  };

  const updateInterview = async (interview, nextStatus = 'scheduled') => {
    const draft = drafts[interview.id] || {};
    setSaving(true);
    setError('');
    try {
      const payload = {
        scheduled_at: draft.scheduled_at ? new Date(draft.scheduled_at).toISOString() : interview.scheduled_at,
        meeting_link: draft.meeting_link ?? interview.meeting_link,
        teacher_feedback: draft.teacher_feedback ?? interview.teacher_feedback,
        rating: draft.rating ? Number(draft.rating) : interview.rating,
        communication_score: draft.communication_score ? Number(draft.communication_score) : interview.communication_score,
        technical_score: draft.technical_score ? Number(draft.technical_score) : interview.technical_score,
        confidence_score: draft.confidence_score ? Number(draft.confidence_score) : interview.confidence_score,
        project_explanation_score: draft.project_explanation_score ? Number(draft.project_explanation_score) : interview.project_explanation_score,
        improvement_notes: draft.improvement_notes ?? interview.improvement_notes,
        final_recommendation: draft.final_recommendation ?? interview.final_recommendation,
        status: nextStatus,
        completed_at: nextStatus === 'completed' ? new Date().toISOString() : interview.completed_at,
        updated_at: new Date().toISOString(),
      };
      const { data, error: updateError } = await supabase
        .from('career_mock_interviews')
        .update(payload)
        .eq('id', interview.id)
        .select('*')
        .single();
      if (updateError) throw updateError;
      setInterviews((prev) => prev.map((row) => (row.id === interview.id ? data : row)));
      setMessage(nextStatus === 'completed' ? 'Interview marked completed.' : 'Mock interview updated.');
      await sendAdminNotification({
        target_user_id: interview.student_id,
        target_role: 'student',
        title: nextStatus === 'completed' ? 'Mock interview report card is ready' : 'Mock interview scheduled',
        content: nextStatus === 'completed'
          ? 'Your teacher completed your mock interview report card. Open Mock Interviews to read the feedback.'
          : 'Your teacher updated your mock interview schedule. Open Mock Interviews to check the meeting details.',
        type: nextStatus === 'completed' ? 'mock_interview_report_ready' : 'mock_interview_scheduled',
      });
    } catch (updateError) {
      setError(updateError.message || 'Failed to update mock interview.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading mock interviews..." />;

  if (!allowed) {
    return (
      <PremiumPlusUpgradeGate
        profile={profile}
        title="Unlock Mock Interviews"
        message="Mock interviews are available with Premium Plus. Upgrade to request 1 teacher-led mock interview every calendar month."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-950 p-6 text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-200">Premium Plus</p>
        <h1 className="mt-2 text-3xl font-bold">Mock Interviews</h1>
        <p className="mt-2 max-w-3xl text-slate-300">
          Students can request 1 teacher-led mock interview every calendar month.
        </p>
      </section>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      {!staff ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{formatCareerCycle(cycleMonth)} Interview Credit</h2>
              <p className="mt-1 text-sm text-slate-500">{usedThisCycle} of {MOCK_INTERVIEW_LIMIT} used this month.</p>
            </div>
            <span className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700">{remaining} available</span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Preferred Date and Time
              <input
                type="datetime-local"
                value={preferredTime}
                onChange={(event) => setPreferredTime(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 md:col-span-2">
              Preparation Note
              <textarea
                value={studentNote}
                onChange={(event) => setStudentNote(event.target.value)}
                rows={4}
                placeholder="Mention your target role, weak areas, or interview type."
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={requestInterview}
            disabled={saving || remaining <= 0}
            className="mt-5 rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {remaining <= 0 ? 'Monthly Interview Used' : saving ? 'Requesting...' : 'Request Mock Interview'}
          </button>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-bold text-slate-900">{staff ? 'Teacher Interview Queue' : 'My Mock Interviews'}</h2>
          {staff ? (
            <div className="flex flex-wrap gap-2">
              {[
                ['pending', `Pending (${teacherCounts.pending})`],
                ['completed', `Completed (${teacherCounts.completed})`],
                ['all', `All (${teacherCounts.all})`],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTeacherFilter(value)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    teacherFilter === value
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="mt-5 grid gap-4">
          {visibleInterviews.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              {staff ? `No ${teacherFilter === 'all' ? '' : teacherFilter} mock interviews found.` : 'No mock interviews yet.'}
            </p>
          ) : visibleInterviews.map((interview) => {
            const student = profilesById[interview.student_id];
            const draft = drafts[interview.id] || {};
            return (
              <div key={interview.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">{student?.full_name || student?.email || 'Mock Interview'}</h3>
                    <p className="mt-1 text-sm text-slate-500">{formatCareerCycle(interview.cycle_month)} • Requested {formatDate(interview.created_at)}</p>
                    <p className="mt-2 text-sm text-slate-600"><CalendarClock size={16} className="mr-1 inline" /> Preferred: {formatDate(interview.preferred_time)}</p>
                    <p className="mt-1 text-sm text-slate-600">{interview.student_note || 'No preparation note added.'}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-700">{interview.status}</span>
                </div>

                {staff ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input
                      type="datetime-local"
                      value={draft.scheduled_at ?? (interview.scheduled_at ? interview.scheduled_at.slice(0, 16) : '')}
                      onChange={(event) => setDrafts((prev) => ({ ...prev, [interview.id]: { ...draft, scheduled_at: event.target.value } }))}
                      className="rounded-xl border border-slate-300 px-3 py-3 text-sm"
                    />
                    <input
                      value={draft.meeting_link ?? interview.meeting_link ?? ''}
                      onChange={(event) => setDrafts((prev) => ({ ...prev, [interview.id]: { ...draft, meeting_link: event.target.value } }))}
                      placeholder="Meeting link"
                      className="rounded-xl border border-slate-300 px-3 py-3 text-sm"
                    />
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={draft.rating ?? interview.rating ?? ''}
                      onChange={(event) => setDrafts((prev) => ({ ...prev, [interview.id]: { ...draft, rating: event.target.value } }))}
                      placeholder="Rating out of 5"
                      className="rounded-xl border border-slate-300 px-3 py-3 text-sm"
                    />
                    {[
                      ['communication_score', 'Communication score'],
                      ['technical_score', 'Technical score'],
                      ['confidence_score', 'Confidence score'],
                      ['project_explanation_score', 'Project explanation score'],
                    ].map(([field, placeholder]) => (
                      <input
                        key={field}
                        type="number"
                        min="1"
                        max="5"
                        value={draft[field] ?? interview[field] ?? ''}
                        onChange={(event) => setDrafts((prev) => ({ ...prev, [interview.id]: { ...draft, [field]: event.target.value } }))}
                        placeholder={`${placeholder} out of 5`}
                        className="rounded-xl border border-slate-300 px-3 py-3 text-sm"
                      />
                    ))}
                    <textarea
                      value={draft.teacher_feedback ?? interview.teacher_feedback ?? ''}
                      onChange={(event) => setDrafts((prev) => ({ ...prev, [interview.id]: { ...draft, teacher_feedback: event.target.value } }))}
                      rows={3}
                      placeholder="Overall feedback after interview"
                      className="rounded-xl border border-slate-300 px-3 py-3 text-sm md:col-span-2"
                    />
                    <textarea
                      value={draft.improvement_notes ?? interview.improvement_notes ?? ''}
                      onChange={(event) => setDrafts((prev) => ({ ...prev, [interview.id]: { ...draft, improvement_notes: event.target.value } }))}
                      rows={3}
                      placeholder="Improvement notes"
                      className="rounded-xl border border-slate-300 px-3 py-3 text-sm md:col-span-2"
                    />
                    <textarea
                      value={draft.final_recommendation ?? interview.final_recommendation ?? ''}
                      onChange={(event) => setDrafts((prev) => ({ ...prev, [interview.id]: { ...draft, final_recommendation: event.target.value } }))}
                      rows={3}
                      placeholder="Final recommendation"
                      className="rounded-xl border border-slate-300 px-3 py-3 text-sm md:col-span-2"
                    />
                    <div className="flex flex-wrap gap-2 md:col-span-2">
                      <button type="button" onClick={() => updateInterview(interview, 'scheduled')} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Schedule / Save</button>
                      <button type="button" onClick={() => updateInterview(interview, 'completed')} disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Mark Completed</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
                    <p><CheckCircle size={16} className="mr-1 inline" /> Scheduled: {formatDate(interview.scheduled_at)}</p>
                    <p><Star size={16} className="mr-1 inline" /> Rating: {interview.rating || '-'}/5</p>
                    <p>Communication: {interview.communication_score || '-'}/5</p>
                    <p>Technical: {interview.technical_score || '-'}/5</p>
                    <p>Confidence: {interview.confidence_score || '-'}/5</p>
                    <p>Project Explanation: {interview.project_explanation_score || '-'}/5</p>
                    {interview.meeting_link ? (
                      <a href={interview.meeting_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-blue-700">
                        <LinkIcon size={16} /> Join Meeting
                      </a>
                    ) : (
                      <p className="inline-flex items-center gap-2 text-slate-500"><MessageSquare size={16} /> Waiting for teacher schedule</p>
                    )}
                    {interview.teacher_feedback ? <p className="whitespace-pre-line md:col-span-2"><b>Feedback:</b> {interview.teacher_feedback}</p> : null}
                    {interview.improvement_notes ? <p className="whitespace-pre-line md:col-span-2"><b>Improvement:</b> {interview.improvement_notes}</p> : null}
                    {interview.final_recommendation ? <p className="whitespace-pre-line md:col-span-2"><b>Recommendation:</b> {interview.final_recommendation}</p> : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default PremiumPlusMockInterviews;
