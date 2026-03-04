import React, { useEffect, useState } from 'react';
import { Mail, Save } from 'lucide-react';
import { supabase } from '../supabaseClient';
import usePopup from '../hooks/usePopup';
import LoadingSpinner from '../components/LoadingSpinner';

const AdminSupportContact = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { popupNode, openPopup } = usePopup();

  useEffect(() => {
    loadEmail();
  }, []);

  const loadEmail = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'support_contact_email')
        .maybeSingle();
      if (error) throw error;
      setEmail(data?.value || '');
    } catch (error) {
      openPopup('Error', `Failed to load support email: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      openPopup('Missing Email', 'Please enter a support contact email.', 'warning');
      return;
    }
    try {
      setSaving(true);
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'support_contact_email', value: trimmed }, { onConflict: 'key' });
      if (error) throw error;
      setEmail(trimmed);
      openPopup('Saved', 'Support contact email updated successfully.', 'success');
    } catch (error) {
      openPopup('Error', `Failed to save support email: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading support contact..." />;

  return (
    <div className="space-y-6">
      {popupNode}
      <div className="bg-gradient-to-r from-cyan-700 to-blue-700 p-6 rounded-xl text-white">
        <h1 className="text-2xl font-bold mb-1">Support Contact Email</h1>
        <p className="text-cyan-100">Set the email shown wherever users are asked to contact admin/support.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100 space-y-4">
        <label className="block text-sm font-semibold text-slate-700">Contact Email</label>
        <div className="relative">
          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="email"
            className="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg"
            placeholder="support@yourdomain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={saveEmail}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Email'}
        </button>
      </div>
    </div>
  );
};

export default AdminSupportContact;
