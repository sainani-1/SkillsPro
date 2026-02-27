import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Save, DollarSign, Clock, Lock } from 'lucide-react';
import usePopup from '../hooks/usePopup';
import LoadingSpinner from '../components/LoadingSpinner';

const AdminSettings = () => {
  const [examDuration, setExamDuration] = useState(60);
  const [minQuestions, setMinQuestions] = useState(25);
  const [premiumCost, setPremiumCost] = useState(199);
  const [registrationPaused, setRegistrationPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { popupNode, openPopup } = usePopup();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['exam_duration', 'premium_cost', 'registration_paused', 'min_questions']);

      if (error) throw error;

      if (data) {
        data.forEach(setting => {
          if (setting.key === 'exam_duration') {
            setExamDuration(parseInt(setting.value) || 60);
          } else if (setting.key === 'premium_cost') {
            setPremiumCost(parseInt(setting.value) || 199);
          } else if (setting.key === 'registration_paused') {
            setRegistrationPaused(setting.value === 'true');
          } else if (setting.key === 'min_questions') {
            setMinQuestions(parseInt(setting.value) || 25);
          }
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      openPopup('Error', `Failed to load settings: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key, value) => {
    const { error } = await supabase
      .from('settings')
      .upsert({ key, value: value.toString() }, { onConflict: 'key' });
    if (error) throw error;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveSetting('exam_duration', examDuration);
      await saveSetting('premium_cost', premiumCost);
      await saveSetting('registration_paused', registrationPaused);
      await saveSetting('min_questions', minQuestions);
      openPopup('Success', 'Settings saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving settings:', error);
      openPopup('Error', `Failed to save settings: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {popupNode}
      <div className="bg-gradient-to-r from-purple-600 to-blue-700 p-6 rounded-xl text-white">
        <h1 className="text-2xl font-bold mb-1">Platform Settings</h1>
        <p className="text-purple-100">Configure exam duration, premium pricing, registration, and admin MFA</p>
      </div>

      {/* MFA Registration Panel */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100 mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Admin MFA Registration</h2>
        <p className="text-sm text-slate-600 mb-4">Secure your admin account with MFA. Once registered, you will be required to enter a code from your authenticator app on every login.</p>
        <div className="mb-4">
          {/* You can import and render <AdminMFARegister /> here if using component-based routing */}
          {/* Or add a button to navigate to the MFA registration page */}
          <a href="/admin-mfa-register" className="btn-gold py-3 px-6 rounded-lg font-bold">Register MFA</a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Exam Settings</h2>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Minimum Questions Per Exam (Global)</label>
            <input
              type="number"
              className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={minQuestions}
              onChange={e => setMinQuestions(parseInt(e.target.value) || 1)}
              min="1"
              max="100"
            />
            <p className="text-xs text-slate-500 mt-1">Default minimum questions required for any exam.</p>
          </div>
        </div>
        {/* ...existing code... */}
      </div>

      {/* ...existing code... */}
    </div>
  );
};

export default AdminSettings;
