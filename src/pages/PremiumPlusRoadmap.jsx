import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Pencil, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import PremiumPlusUpgradeGate from '../components/PremiumPlusUpgradeGate';
import { sendAdminNotification } from '../utils/adminNotifications';
import {
  canUseCareerSupport,
  formatCareerCycle,
  generateRoadmapPlan,
  getCareerCycleMonth,
  isCareerStaff,
} from '../utils/careerSupport';

const formatDate = (value) => (value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

const isDuplicateRoadmapError = (error) => {
  const text = String([error?.code, error?.message, error?.details].filter(Boolean).join(' ')).toLowerCase();
  return text.includes('23505') || text.includes('duplicate key') || text.includes('career_roadmaps_student_id_cycle_month_key');
};

const isEmptySingleResultError = (error) => {
  const text = String([error?.code, error?.message, error?.details].filter(Boolean).join(' ')).toLowerCase();
  return text.includes('pgrst116') || text.includes('cannot coerce the result to a single json object');
};

const planToText = (plan) => {
  if (!plan || typeof plan !== 'object') return '';
  return [
    plan.summary || '',
    ...(plan.goals || []).map((goal) => `${goal.title}: ${goal.detail}`),
    ...(plan.weeklyTasks || []),
  ].filter(Boolean).join('\n\n');
};

const textToPlan = (text, title, previousPlan = {}) => ({
  ...previousPlan,
  title,
  summary: text,
  goals: [],
  weeklyTasks: [],
});

const RoadmapCard = ({ roadmap, student, staff, saving, draft, onDraftChange, onSave }) => {
  const plan = roadmap.generated_plan || {};
  const title = plan.title || `${formatCareerCycle(roadmap.cycle_month)} Personal Roadmap`;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{student?.full_name || student?.email || title}</h3>
          <p className="mt-1 text-sm text-slate-500">{formatCareerCycle(roadmap.cycle_month)} • Updated {formatDate(roadmap.updated_at)}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-700">{roadmap.status}</span>
      </div>

      {staff ? (
        <div className="mt-4 space-y-3">
          <textarea
            value={draft ?? planToText(plan)}
            onChange={(event) => onDraftChange(event.target.value)}
            rows={10}
            className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
          />
          <textarea
            value={roadmap.editor_notes || ''}
            readOnly
            rows={2}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500"
            placeholder="Teacher/admin notes appear after saving."
          />
          <button
            type="button"
            onClick={() => onSave(roadmap)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Pencil size={16} /> Save Roadmap
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-bold text-slate-900">{title}</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{plan.summary}</p>
          </div>
          {(plan.goals || []).map((goal) => (
            <div key={goal.title} className="rounded-xl border border-slate-200 p-4">
              <p className="font-bold text-slate-900">{goal.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{goal.detail}</p>
            </div>
          ))}
          {plan.weeklyTasks?.length ? (
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
              <p className="font-bold text-teal-900">Weekly Tasks</p>
              <ul className="mt-3 space-y-2 text-sm text-teal-800">
                {plan.weeklyTasks.map((task) => <li key={task} className="flex gap-2"><CheckCircle size={16} className="mt-0.5 shrink-0" />{task}</li>)}
              </ul>
            </div>
          ) : null}
          {roadmap.editor_notes ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-bold">Teacher Notes</p>
              <p className="mt-2 whitespace-pre-line">{roadmap.editor_notes}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

const PremiumPlusRoadmap = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [roadmaps, setRoadmaps] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [drafts, setDrafts] = useState({});
  const [editorNotes, setEditorNotes] = useState({});
  const [careerGoalsByStudent, setCareerGoalsByStudent] = useState({});
  const [goalForm, setGoalForm] = useState({
    target_role: '',
    preferred_industry: '',
    skill_level: 'beginner',
    expected_placement_month: '',
    weak_areas: '',
  });

  const cycleMonth = getCareerCycleMonth();
  const staff = isCareerStaff(profile);
  const allowed = canUseCareerSupport(profile);

  const loadRoadmaps = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError('');
    try {
      let query = supabase.from('career_roadmaps').select('*').order('updated_at', { ascending: false });
      if (profile.role === 'student') query = query.eq('student_id', profile.id);
      if (profile.role === 'teacher') query = query.eq('teacher_id', profile.id);
      const { data, error: roadmapError } = await query;
      if (roadmapError) throw roadmapError;
      let rows = data || [];

      if (!staff && !rows.some((row) => row.cycle_month === cycleMonth)) {
        const { data: existingRoadmap, error: existingError } = await supabase
          .from('career_roadmaps')
          .select('*')
          .eq('student_id', profile.id)
          .eq('cycle_month', cycleMonth)
          .maybeSingle();
        if (existingError) throw existingError;

        if (existingRoadmap) {
          rows = [existingRoadmap, ...rows.filter((row) => row.id !== existingRoadmap.id)];
        } else {
          const generatedPlan = generateRoadmapPlan(profile, { cycleMonth });
          const { data: inserted, error: insertError } = await supabase
            .from('career_roadmaps')
            .insert({
              student_id: profile.id,
              teacher_id: profile.assigned_teacher_id || null,
              cycle_month: cycleMonth,
              generated_plan: generatedPlan,
              status: 'generated',
            })
            .select('*')
            .single();

          if (insertError && isDuplicateRoadmapError(insertError)) {
            const { data: duplicateRoadmap, error: duplicateLoadError } = await supabase
              .from('career_roadmaps')
              .select('*')
              .eq('student_id', profile.id)
              .eq('cycle_month', cycleMonth)
              .maybeSingle();
            if (duplicateLoadError) throw duplicateLoadError;
            if (duplicateRoadmap) {
              rows = [duplicateRoadmap, ...rows.filter((row) => row.id !== duplicateRoadmap.id)];
            }
          } else if (insertError) {
            throw insertError;
          } else {
            rows = [inserted, ...rows];
          }
        }
      }

      setRoadmaps(rows);
      const profileIds = Array.from(new Set(rows.flatMap((row) => [row.student_id, row.teacher_id]).filter(Boolean)));
      if (profileIds.length) {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .in('id', profileIds);
        if (profileError) throw profileError;
        setProfilesById(Object.fromEntries((profileRows || []).map((row) => [row.id, row])));
        const { data: goalRows, error: goalError } = await supabase
          .from('career_goals')
          .select('*')
          .in('student_id', profileIds);
        if (goalError) throw goalError;
        const goalMap = Object.fromEntries((goalRows || []).map((row) => [row.student_id, row]));
        setCareerGoalsByStudent(goalMap);
        const ownGoal = goalMap[profile.id];
        if (ownGoal && profile.role === 'student') {
          setGoalForm({
            target_role: ownGoal.target_role || '',
            preferred_industry: ownGoal.preferred_industry || '',
            skill_level: ownGoal.skill_level || 'beginner',
            expected_placement_month: ownGoal.expected_placement_month || '',
            weak_areas: ownGoal.weak_areas || '',
          });
        }
      } else {
        setProfilesById({});
        setCareerGoalsByStudent({});
      }
    } catch (loadError) {
      setError(loadError.message || 'Unable to load roadmaps. Apply the career support SQL setup if this is the first run.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoadmaps();
  }, [profile?.id, profile?.role]);

  const currentRoadmap = useMemo(
    () => roadmaps.find((row) => row.student_id === profile?.id && row.cycle_month === cycleMonth),
    [roadmaps, profile?.id, cycleMonth]
  );

  const regenerateRoadmap = async () => {
    if (staff || !currentRoadmap || saving) return;
    setSaving(true);
    setError('');
    try {
      const goal = careerGoalsByStudent[profile.id] || goalForm;
      const generatedPlan = generateRoadmapPlan(profile, {
        cycleMonth,
        targetRole: goal.target_role || profile.core_subject,
        weakAreas: goal.weak_areas,
      });
      const { data, error: updateError } = await supabase
        .from('career_roadmaps')
        .update({ generated_plan: generatedPlan, status: 'generated', updated_at: new Date().toISOString() })
        .eq('id', currentRoadmap.id)
        .select('*')
        .maybeSingle();
      if (updateError && !isEmptySingleResultError(updateError)) throw updateError;

      let nextRoadmap = data;
      if (!nextRoadmap) {
        const { data: existingRoadmap, error: loadError } = await supabase
          .from('career_roadmaps')
          .select('*')
          .eq('student_id', profile.id)
          .eq('cycle_month', cycleMonth)
          .maybeSingle();
        if (loadError) throw loadError;
        nextRoadmap = existingRoadmap ? { ...existingRoadmap, generated_plan: generatedPlan, status: 'generated' } : null;
      }

      if (!nextRoadmap) {
        throw new Error('Roadmap could not be regenerated. Please refresh and try again.');
      }
      setRoadmaps((prev) => prev.map((row) => (row.id === nextRoadmap.id ? nextRoadmap : row)));
      setMessage('Roadmap regenerated for this month.');
    } catch (regenerateError) {
      setError(regenerateError.message || 'Failed to regenerate roadmap.');
    } finally {
      setSaving(false);
    }
  };

  const saveCareerGoal = async () => {
    if (staff || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        student_id: profile.id,
        teacher_id: profile.assigned_teacher_id || null,
        target_role: goalForm.target_role.trim() || null,
        preferred_industry: goalForm.preferred_industry.trim() || null,
        skill_level: goalForm.skill_level || null,
        expected_placement_month: goalForm.expected_placement_month || null,
        weak_areas: goalForm.weak_areas.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { data, error: upsertError } = await supabase
        .from('career_goals')
        .upsert(payload, { onConflict: 'student_id' })
        .select('*')
        .single();
      if (upsertError) throw upsertError;
      setCareerGoalsByStudent((prev) => ({ ...prev, [profile.id]: data }));
      setMessage('Career goal saved. Regenerate your roadmap to apply it.');
    } catch (saveError) {
      setError(saveError.message || 'Failed to save career goal.');
    } finally {
      setSaving(false);
    }
  };

  const saveRoadmap = async (roadmap) => {
    const text = drafts[roadmap.id] ?? planToText(roadmap.generated_plan);
    const notes = editorNotes[roadmap.id] ?? '';
    setSaving(true);
    setError('');
    try {
      const { data, error: updateError } = await supabase
        .from('career_roadmaps')
        .update({
          generated_plan: textToPlan(text, roadmap.generated_plan?.title || `${formatCareerCycle(roadmap.cycle_month)} Personal Roadmap`, roadmap.generated_plan),
          editor_notes: notes || roadmap.editor_notes || null,
          status: 'reviewed',
          edited_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roadmap.id)
        .select('*')
        .maybeSingle();
      if (updateError && !isEmptySingleResultError(updateError)) throw updateError;
      if (!data) throw new Error('Roadmap could not be saved. Please refresh and try again.');
      setRoadmaps((prev) => prev.map((row) => (row.id === data.id ? data : row)));
      setMessage('Roadmap saved.');
      await sendAdminNotification({
        target_user_id: roadmap.student_id,
        target_role: 'student',
        title: 'Your monthly roadmap was updated',
        content: 'Your teacher/admin updated your personal roadmap. Open Personal Roadmap to review the next steps.',
        type: 'roadmap_updated',
      });
    } catch (saveError) {
      setError(saveError.message || 'Failed to save roadmap.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading personal roadmap..." />;

  if (!allowed) {
    return (
      <PremiumPlusUpgradeGate
        profile={profile}
        title="Unlock Personal Roadmap"
        message="Monthly personal roadmap updates are available with Premium Plus. Upgrade to get an auto-generated roadmap that your teacher can edit."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-950 p-6 text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-200">Premium Plus</p>
        <h1 className="mt-2 text-3xl font-bold">Personal Roadmap</h1>
        <p className="mt-2 max-w-3xl text-slate-300">
          A monthly roadmap is generated automatically and can be edited by the assigned teacher or admin.
        </p>
      </section>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}

      {!staff ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Career Goal Setup</h2>
          <p className="mt-1 text-sm text-slate-500">These details personalize your monthly roadmap and interview preparation.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <input
              value={goalForm.target_role}
              onChange={(event) => setGoalForm((prev) => ({ ...prev, target_role: event.target.value }))}
              placeholder="Target role, example Frontend Developer"
              className="rounded-xl border border-slate-300 px-3 py-3 text-sm"
            />
            <input
              value={goalForm.preferred_industry}
              onChange={(event) => setGoalForm((prev) => ({ ...prev, preferred_industry: event.target.value }))}
              placeholder="Preferred industry"
              className="rounded-xl border border-slate-300 px-3 py-3 text-sm"
            />
            <select
              value={goalForm.skill_level}
              onChange={(event) => setGoalForm((prev) => ({ ...prev, skill_level: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-3 text-sm"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <input
              type="month"
              value={goalForm.expected_placement_month}
              onChange={(event) => setGoalForm((prev) => ({ ...prev, expected_placement_month: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-3 text-sm"
            />
            <textarea
              value={goalForm.weak_areas}
              onChange={(event) => setGoalForm((prev) => ({ ...prev, weak_areas: event.target.value }))}
              rows={3}
              placeholder="Weak areas, example communication, DSA, projects, confidence"
              className="rounded-xl border border-slate-300 px-3 py-3 text-sm md:col-span-2"
            />
          </div>
          <button
            type="button"
            onClick={saveCareerGoal}
            disabled={saving}
            className="mt-4 rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Save Career Goal
          </button>
        </section>
      ) : null}

      {!staff && currentRoadmap ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{formatCareerCycle(cycleMonth)} Update</h2>
              <p className="mt-1 text-sm text-slate-500">Your roadmap is ready for this month.</p>
            </div>
            <button
              type="button"
              onClick={regenerateRoadmap}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Sparkles size={16} /> Regenerate
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5">
        {roadmaps.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No roadmaps found yet.
          </p>
        ) : roadmaps.map((roadmap) => (
          <div key={roadmap.id}>
            {staff ? (
              <textarea
                value={editorNotes[roadmap.id] ?? roadmap.editor_notes ?? ''}
                onChange={(event) => setEditorNotes((prev) => ({ ...prev, [roadmap.id]: event.target.value }))}
                rows={2}
                placeholder="Optional teacher/admin note before saving this roadmap"
                className="mb-3 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"
              />
            ) : null}
            <RoadmapCard
              roadmap={roadmap}
              student={profilesById[roadmap.student_id]}
              staff={staff}
              saving={saving}
              draft={drafts[roadmap.id]}
              onDraftChange={(value) => setDrafts((prev) => ({ ...prev, [roadmap.id]: value }))}
              onSave={saveRoadmap}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default PremiumPlusRoadmap;
