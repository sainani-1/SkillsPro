import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Save, Plus, Trash2 } from 'lucide-react';
import usePopup from '../hooks/usePopup';
import LoadingSpinner from '../components/LoadingSpinner';

const DEFAULT_PLAN_FORM = {
  name: '',
  cost: '',
  isLifetimeFree: false,
  periodMonths: '6',
  validUntil: '',
  description: '',
  isActive: true,
};

const AdminSettings = () => {
  const [examDuration, setExamDuration] = useState(60);
  const [minQuestions, setMinQuestions] = useState(25);
  const [premiumCost, setPremiumCost] = useState(199);
  const [resumeBuilderAccess, setResumeBuilderAccess] = useState('premium');
  const [supportContactEmail, setSupportContactEmail] = useState('');
  const [registrationPaused, setRegistrationPaused] = useState(false);
  const [plans, setPlans] = useState([]);
  const [planForm, setPlanForm] = useState(DEFAULT_PLAN_FORM);
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingPlans, setSavingPlans] = useState(false);
  const { popupNode, openPopup } = usePopup();

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
    [plans]
  );

  useEffect(() => {
    loadSettings();
  }, []);

  const parsePlans = (raw) => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((p) => p && p.id && p.name);
    } catch {
      return [];
    }
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['exam_duration', 'premium_cost', 'registration_paused', 'min_questions', 'public_plans', 'support_contact_email', 'resume_builder_access']);

      if (error) throw error;

      (data || []).forEach((setting) => {
        if (setting.key === 'exam_duration') setExamDuration(parseInt(setting.value, 10) || 60);
        if (setting.key === 'premium_cost') setPremiumCost(parseInt(setting.value, 10) || 199);
        if (setting.key === 'registration_paused') setRegistrationPaused(setting.value === 'true');
        if (setting.key === 'min_questions') setMinQuestions(parseInt(setting.value, 10) || 25);
        if (setting.key === 'public_plans') setPlans(parsePlans(setting.value));
        if (setting.key === 'support_contact_email') setSupportContactEmail(setting.value || '');
        if (setting.key === 'resume_builder_access') setResumeBuilderAccess(setting.value === 'free' ? 'free' : 'premium');
      });
    } catch (error) {
      openPopup('Error', `Failed to load settings: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key, value) => {
    const { error } = await supabase
      .from('settings')
      .upsert({ key, value: String(value) }, { onConflict: 'key' });
    if (error) throw error;
  };

  const handleSaveGeneral = async () => {
    try {
      setSavingGeneral(true);
      await saveSetting('exam_duration', examDuration);
      await saveSetting('premium_cost', premiumCost);
      await saveSetting('registration_paused', registrationPaused);
      await saveSetting('min_questions', minQuestions);
      await saveSetting('support_contact_email', supportContactEmail.trim());
      await saveSetting('resume_builder_access', resumeBuilderAccess);
      openPopup('Success', 'General settings saved successfully.', 'success');
    } catch (error) {
      openPopup('Error', `Failed to save settings: ${error.message}`, 'error');
    } finally {
      setSavingGeneral(false);
    }
  };

  const persistPlans = async (nextPlans) => {
    setSavingPlans(true);
    try {
      await saveSetting('public_plans', JSON.stringify(nextPlans));
      setPlans(nextPlans);
    } finally {
      setSavingPlans(false);
    }
  };

  const addPlan = async () => {
    if (!planForm.name.trim()) {
      openPopup('Missing Plan Name', 'Please enter a plan name.', 'warning');
      return;
    }
    if (!planForm.isLifetimeFree && (!planForm.cost || Number(planForm.cost) < 0)) {
      openPopup('Invalid Cost', 'Please enter a valid cost for this plan.', 'warning');
      return;
    }

    const newPlan = {
      id: `plan_${Date.now()}`,
      name: planForm.name.trim(),
      cost: planForm.isLifetimeFree ? 0 : Number(planForm.cost),
      isLifetimeFree: !!planForm.isLifetimeFree,
      periodMonths: planForm.periodMonths ? Number(planForm.periodMonths) : null,
      validUntil: planForm.validUntil || null,
      description: planForm.description.trim() || null,
      isActive: !!planForm.isActive,
      createdAt: new Date().toISOString(),
    };

    const nextPlans = [newPlan, ...plans];
    try {
      await persistPlans(nextPlans);
      setPlanForm(DEFAULT_PLAN_FORM);
      openPopup('Success', 'Plan added successfully.', 'success');
    } catch (error) {
      openPopup('Error', `Failed to add plan: ${error.message}`, 'error');
    }
  };

  const togglePlanActive = async (id) => {
    const nextPlans = plans.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p));
    try {
      await persistPlans(nextPlans);
    } catch (error) {
      openPopup('Error', `Failed to update plan: ${error.message}`, 'error');
    }
  };

  const removePlan = async (id) => {
    const nextPlans = plans.filter((p) => p.id !== id);
    try {
      await persistPlans(nextPlans);
      openPopup('Removed', 'Plan removed successfully.', 'success');
    } catch (error) {
      openPopup('Error', `Failed to remove plan: ${error.message}`, 'error');
    }
  };

  if (loading) return <LoadingSpinner message="Loading settings..." />;

  return (
    <div className="space-y-6">
      {popupNode}

      <div className="bg-gradient-to-r from-slate-900 to-slate-700 p-6 rounded-xl text-white">
        <h1 className="text-2xl font-bold mb-1">Platform Settings</h1>
        <p className="text-slate-200">Manage core settings and public pricing plans.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
        <h2 className="text-xl font-bold text-slate-900 mb-4">General Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Exam Duration (minutes)</label>
            <input
              type="number"
              min="15"
              className="w-full p-3 border border-slate-300 rounded-lg"
              value={examDuration}
              onChange={(e) => setExamDuration(parseInt(e.target.value, 10) || 60)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Minimum Questions</label>
            <input
              type="number"
              min="1"
              className="w-full p-3 border border-slate-300 rounded-lg"
              value={minQuestions}
              onChange={(e) => setMinQuestions(parseInt(e.target.value, 10) || 25)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Default Premium Cost (INR)</label>
            <input
              type="number"
              min="0"
              className="w-full p-3 border border-slate-300 rounded-lg"
              value={premiumCost}
              onChange={(e) => setPremiumCost(parseInt(e.target.value, 10) || 199)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Support Contact Email</label>
            <input
              type="email"
              className="w-full p-3 border border-slate-300 rounded-lg"
              placeholder="support@yourdomain.com"
              value={supportContactEmail}
              onChange={(e) => setSupportContactEmail(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={registrationPaused}
                onChange={(e) => setRegistrationPaused(e.target.checked)}
              />
              Pause New Registrations
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Resume Builder Access</label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setResumeBuilderAccess('free')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  resumeBuilderAccess === 'free'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                Free For Everyone
              </button>
              <button
                type="button"
                onClick={() => setResumeBuilderAccess('premium')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  resumeBuilderAccess === 'premium'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                Premium Only
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              If set to free, every logged-in user can use Resume Builder. If set to premium, only premium users can access it.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSaveGeneral}
          disabled={savingGeneral}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-60"
        >
          <Save size={16} />
          {savingGeneral ? 'Saving...' : 'Save General Settings'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Plan Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Plan Name</label>
            <input
              type="text"
              className="w-full p-3 border border-slate-300 rounded-lg"
              placeholder="Example: Premium 6 Months"
              value={planForm.name}
              onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Cost (INR)</label>
            <input
              type="number"
              min="0"
              className="w-full p-3 border border-slate-300 rounded-lg"
              placeholder="199"
              value={planForm.cost}
              onChange={(e) => setPlanForm((p) => ({ ...p, cost: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Period (Months)</label>
            <input
              type="number"
              min="1"
              disabled={planForm.isLifetimeFree}
              className="w-full p-3 border border-slate-300 rounded-lg disabled:bg-slate-100"
              placeholder="6"
              value={planForm.periodMonths}
              onChange={(e) => setPlanForm((p) => ({ ...p, periodMonths: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Valid Until (optional)</label>
            <input
              type="date"
              className="w-full p-3 border border-slate-300 rounded-lg"
              value={planForm.validUntil}
              onChange={(e) => setPlanForm((p) => ({ ...p, validUntil: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              className="w-full p-3 border border-slate-300 rounded-lg"
              placeholder="Plan details shown on home page..."
              value={planForm.description}
              onChange={(e) => setPlanForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-6">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={planForm.isLifetimeFree}
                onChange={(e) =>
                  setPlanForm((p) => ({
                    ...p,
                    isLifetimeFree: e.target.checked,
                    periodMonths: e.target.checked ? '' : p.periodMonths || '6',
                  }))
                }
              />
              Lifetime Free
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={planForm.isActive}
                onChange={(e) => setPlanForm((p) => ({ ...p, isActive: e.target.checked }))}
              />
              Active
            </label>
          </div>
        </div>
        <button
          type="button"
          onClick={addPlan}
          disabled={savingPlans}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
        >
          <Plus size={16} />
          {savingPlans ? 'Adding...' : 'Add Plan'}
        </button>

        <div className="mt-6 space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Current Plans</h3>
          {sortedPlans.length === 0 ? (
            <p className="text-slate-500 text-sm">No plans added yet.</p>
          ) : (
            sortedPlans.map((plan) => (
              <div key={plan.id} className="border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{plan.name}</p>
                  <p className="text-sm text-slate-600">
                    {plan.isLifetimeFree ? 'Lifetime Free' : `INR ${plan.cost || 0}`} | Period: {plan.periodMonths || '-'} month(s)
                    {plan.validUntil ? ` | Valid until: ${new Date(plan.validUntil).toLocaleDateString('en-IN')}` : ''}
                  </p>
                  {plan.description ? <p className="text-xs text-slate-500 mt-1">{plan.description}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => togglePlanActive(plan.id)}
                    className={`px-3 py-1.5 rounded text-sm font-semibold ${plan.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}
                  >
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removePlan(plan.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm font-semibold bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
