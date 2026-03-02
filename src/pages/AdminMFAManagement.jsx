import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import usePopup from '../hooks/usePopup.jsx';
import useDialog from '../hooks/useDialog.jsx';

const AdminMFAManagement = () => {
  const navigate = useNavigate();
  const { openPopup, popupNode } = usePopup();
  const { confirm, dialogNode } = useDialog();
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState([]);
  const [processingId, setProcessingId] = useState('');

  const loadFactors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setFactors(data?.totp || []);
    } catch (error) {
      openPopup('Load failed', error.message || 'Unable to load MFA factors.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFactors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUnregister = async (factorId) => {
    const ok = await confirm('Are you sure you want to unregister this MFA factor?', 'Unregister MFA');
    if (!ok) return;

    try {
      setProcessingId(factorId);
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      openPopup('Unregistered', 'MFA factor removed successfully.', 'success');
      await loadFactors();
    } catch (error) {
      openPopup('Action failed', error.message || 'Failed to unregister MFA.', 'error');
    } finally {
      setProcessingId('');
    }
  };

  return (
    <div className="space-y-6">
      {popupNode}
      {dialogNode}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-xl text-white">
        <h1 className="text-2xl font-bold mb-1">Admin MFA Management</h1>
        <p className="text-slate-300">Unregister old MFA and register again when needed.</p>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-bold text-slate-900">Registered Factors</h2>
          <button
            onClick={() => navigate('/admin-mfa-setup')}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Register / Register Again
          </button>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading MFA factors...</p>
        ) : factors.length === 0 ? (
          <div className="border rounded-lg p-4 bg-amber-50 text-amber-800">
            No MFA factor registered. Click <strong>Register / Register Again</strong> to set up new MFA.
          </div>
        ) : (
          <div className="divide-y border rounded-lg">
            {factors.map((factor) => (
              <div key={factor.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{factor.friendly_name || 'Authenticator App'}</p>
                  <p className="text-xs text-slate-500">Factor ID: {factor.id}</p>
                  <p className="text-xs text-slate-500">
                    Created: {factor.created_at ? new Date(factor.created_at).toLocaleString() : '-'}
                  </p>
                </div>
                <button
                  onClick={() => handleUnregister(factor.id)}
                  disabled={processingId === factor.id}
                  className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {processingId === factor.id ? 'Removing...' : 'Unregister'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMFAManagement;
