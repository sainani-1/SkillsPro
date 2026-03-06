import React, { useMemo, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Award, Search, Clock3 } from 'lucide-react';
import AlertModal from '../components/AlertModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { logAdminActivity } from '../utils/adminActivityLogger';

const LIFETIME_PREMIUM_DATE = '9999-12-31T23:59:59.000Z';

const ManagePremium = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [validUntil, setValidUntil] = useState('');
  const [grantLifetimePremium, setGrantLifetimePremium] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [userToRevoke, setUserToRevoke] = useState(null);
  const [grantHistory, setGrantHistory] = useState([]);
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });

  const isLifetimePremium = (premiumUntil) =>
    Boolean(premiumUntil) && new Date(premiumUntil).getUTCFullYear() >= 9999;

  useEffect(() => {
    loadUsers();
    loadGrantHistory();
  }, []);

  const pushNotification = async (payload) => {
    try {
      const { error } = await supabase.from('admin_notifications').insert(payload);
      if (error && String(error.message || '').includes('target_user_id')) {
        const { target_user_id, ...fallback } = payload;
        const marker = target_user_id ? `[target_user_id:${target_user_id}] ` : '';
        await supabase.from('admin_notifications').insert({
          ...fallback,
          content:
            marker && !String(fallback.content || '').includes('[target_user_id:')
              ? `${marker}${fallback.content || ''}`
              : fallback.content,
        });
      }
    } catch {
      // Keep premium workflow resilient even if notification insert fails.
    }
  };

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('full_name');
    setUsers(data || []);
  };

  const loadGrantHistory = async () => {
    const { data: grants, error } = await supabase
      .from('premium_grants')
      .select('id, user_id, granted_by, valid_until, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error || !grants?.length) {
      setGrantHistory([]);
      return;
    }

    const profileIds = Array.from(
      new Set(
        grants.flatMap((g) => [g.user_id, g.granted_by]).filter(Boolean)
      )
    );

    let profileMap = new Map();
    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', profileIds);
      profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    }

    const mapped = grants.map((g) => {
      const person = profileMap.get(g.user_id);
      const admin = profileMap.get(g.granted_by);
      return {
        ...g,
        user_name: person?.full_name || 'Unknown user',
        user_email: person?.email || '',
        admin_name: admin?.full_name || 'Admin',
      };
    });

    setGrantHistory(mapped);
  };

  const grantPremium = async () => {
    if (!selectedUser || (!grantLifetimePremium && !validUntil)) {
      setAlertModal({
        show: true,
        title: 'Missing Information',
        message: 'Please select a user and set a valid date or choose lifetime premium',
        type: 'warning'
      });
      return;
    }
    if (!reason.trim()) {
      setAlertModal({
        show: true,
        title: 'Missing Reason',
        message: 'Please provide a reason for granting premium.',
        type: 'warning'
      });
      return;
    }
    setShowModal(true);
  };

  const confirmGrant = async () => {
    setLoading(true);
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      const effectiveValidUntil = grantLifetimePremium
        ? LIFETIME_PREMIUM_DATE
        : new Date(`${validUntil}T23:59:59.000Z`).toISOString();
      const reasonText = reason.trim();

      const { error: profileUpdateError } = await supabase.from('profiles').update({
        premium_until: effectiveValidUntil
      }).eq('id', selectedUser.id);
      if (profileUpdateError) throw profileUpdateError;

      const { error: grantInsertError } = await supabase.from('premium_grants').insert({
        user_id: selectedUser.id,
        granted_by: user?.id || null,
        valid_until: effectiveValidUntil,
        reason: reasonText
      });
      if (grantInsertError) throw grantInsertError;

      await pushNotification({
        title: 'Premium Granted',
        content: grantLifetimePremium
          ? `Your premium membership now has lifetime access. Reason: ${reasonText}`
          : `Your premium membership is active until ${new Date(effectiveValidUntil).toLocaleDateString('en-IN')}. Reason: ${reasonText}`,
        type: 'success',
        target_role: 'student',
        target_user_id: selectedUser.id,
        admin_id: user?.id || null,
      });
      await logAdminActivity({
        adminId: user?.id,
        eventType: 'action',
        action: 'Granted premium access',
        target: selectedUser?.id || null,
        details: {
          module: 'manage-premium',
          user_email: selectedUser?.email || null,
          valid_until: effectiveValidUntil,
          reason: reasonText,
        },
      });

      setShowModal(false);
      setAlertModal({
        show: true,
        title: 'Success',
        message: 'Premium access granted successfully.',
        type: 'success'
      });
      setSelectedUser(null);
      setStudentQuery('');
      setValidUntil('');
      setGrantLifetimePremium(false);
      setReason('');
      await loadUsers();
      await loadGrantHistory();
    } catch (error) {
      setAlertModal({
        show: true,
        title: 'Error',
        message: error.message || 'Failed to grant premium access.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  const revokePremium = async (userId) => {
    const user = users.find(u => u.id === userId);
    setUserToRevoke(user);
    setShowRevokeModal(true);
  };

  const confirmRevoke = async () => {
    if (!userToRevoke) return;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    await supabase.from('profiles').update({ premium_until: null }).eq('id', userToRevoke.id);
    await pushNotification({
      title: 'Premium Revoked',
      content: 'Your premium membership was revoked by admin.',
      type: 'warning',
      target_role: 'student',
      target_user_id: userToRevoke.id,
      admin_id: user?.id || null,
    });
    await logAdminActivity({
      adminId: user?.id,
      eventType: 'action',
      action: 'Revoked premium access',
      target: userToRevoke?.id || null,
      details: {
        module: 'manage-premium',
        user_email: userToRevoke?.email || null,
      },
    });
    setShowRevokeModal(false);
    setUserToRevoke(null);
    setAlertModal({
      show: true,
      title: 'Success',
      message: '✅ Premium access revoked successfully!',
      type: 'success'
    });
    await loadUsers();
    await loadGrantHistory();
  };

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );
  const matchedStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return [];
    return users
      .filter(
        (u) =>
          (u.full_name || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [users, studentQuery]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Manage Premium Access</h1>
        <p className="text-slate-500">Grant or revoke premium subscriptions</p>
      </div>

      <div className="bg-white rounded-xl p-6 border">
        <h2 className="text-lg font-bold mb-4">Grant Premium</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Search Student</label>
            <input
              type="text"
              value={studentQuery}
              onChange={(e) => {
                setStudentQuery(e.target.value);
                setSelectedUser(null);
              }}
              placeholder="Type name or email..."
              className="w-full border rounded-lg p-2"
            />
            {matchedStudents.length > 0 && !selectedUser && (
              <div className="mt-2 border rounded-lg max-h-44 overflow-auto">
                {matchedStudents.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelectedUser(u);
                      setStudentQuery(`${u.full_name} (${u.email})`);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b last:border-b-0"
                  >
                    <p className="text-sm font-medium text-slate-800">{u.full_name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </button>
                ))}
              </div>
            )}
            {selectedUser && (
              <p className="mt-2 text-xs text-emerald-700">
                Selected: {selectedUser.full_name} ({selectedUser.email})
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Valid Until</label>
            <label className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={grantLifetimePremium}
                onChange={(e) => setGrantLifetimePremium(e.target.checked)}
              />
              Grant lifetime premium
            </label>
            <input 
              type="date"
              value={validUntil}
              onChange={e => setValidUntil(e.target.value)}
              className="w-full border rounded-lg p-2"
              disabled={grantLifetimePremium}
            />
            {grantLifetimePremium && (
              <p className="mt-2 text-xs text-emerald-700">Lifetime premium will be granted (no expiry).</p>
            )}
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Reason</label>
          <textarea 
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Why granting premium..."
            className="w-full border rounded-lg p-2"
            rows={2}
          />
        </div>
        <button 
          onClick={grantPremium}
          disabled={loading}
          className="bg-gold-600 text-white px-6 py-2 rounded-lg hover:bg-gold-700 disabled:opacity-50"
        >
          {loading ? 'Granting...' : 'Grant Premium'}
        </button>
      </div>

      <div className="bg-white rounded-xl p-6 border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Premium Users</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
        </div>
        <div className="space-y-2">
          {filtered.map(user => {
            const isPremium = user.premium_until && new Date(user.premium_until) > new Date();
            return (
              <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <img 
                    src={user.avatar_url || 'https://via.placeholder.com/40'} 
                    alt={user.full_name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold">{user.full_name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isPremium ? (
                    <>
                      <span className="text-xs bg-gold-100 text-gold-800 px-3 py-1 rounded-full">
                        {isLifetimePremium(user.premium_until)
                          ? 'Premium Lifetime'
                          : `Premium until ${new Date(user.premium_until).toLocaleDateString()}`}
                      </span>
                      <button 
                        onClick={() => revokePremium(user.id)}
                        className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-lg hover:bg-red-200"
                      >
                        Revoke
                      </button>
                    </>
                  ) : (
                    <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                      Free Plan
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border">
        <div className="flex items-center gap-2 mb-4">
          <Clock3 size={18} className="text-slate-600" />
          <h2 className="text-lg font-bold">Premium Grant History</h2>
        </div>
        {grantHistory.length === 0 ? (
          <p className="text-sm text-slate-500">No premium grant history found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Person</th>
                  <th className="text-left py-2">Reason</th>
                  <th className="text-left py-2">Valid Until</th>
                  <th className="text-left py-2">Granted By</th>
                  <th className="text-left py-2">Granted At</th>
                </tr>
              </thead>
              <tbody>
                {grantHistory.map((g) => (
                  <tr key={g.id} className="border-b last:border-b-0">
                    <td className="py-2">
                      <p className="font-medium text-slate-800">{g.user_name}</p>
                      {g.user_email ? <p className="text-xs text-slate-500">{g.user_email}</p> : null}
                    </td>
                    <td className="py-2 text-slate-700">{g.reason || 'No reason'}</td>
                    <td className="py-2 text-slate-700">
                      {isLifetimePremium(g.valid_until)
                        ? 'Lifetime'
                        : (g.valid_until ? new Date(g.valid_until).toLocaleDateString('en-IN') : 'N/A')}
                    </td>
                    <td className="py-2 text-slate-700">{g.admin_name}</td>
                    <td className="py-2 text-slate-500">
                      {g.created_at ? new Date(g.created_at).toLocaleString('en-IN') : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Confirm Premium Grant</h2>
            
            <div className="mb-4 p-3 bg-slate-100 rounded">
              <p className="text-sm">
                <strong>Student:</strong> {selectedUser.full_name}
              </p>
              <p className="text-sm text-slate-600">{selectedUser.email}</p>
            </div>

            <div className="mb-4 p-3 bg-gold-50 rounded">
              <p className="text-sm">
                <strong>Valid Until:</strong>{' '}
                {grantLifetimePremium
                  ? 'Lifetime'
                  : new Date(validUntil).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              {reason && (
                <p className="text-sm mt-2">
                  <strong>Reason:</strong> {reason}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmGrant}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gold-600 text-white rounded-lg hover:bg-gold-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Confirm Grant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {showRevokeModal && userToRevoke && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Revoke Premium Access</h2>
            
            <div className="mb-4 p-3 bg-slate-100 rounded">
              <p className="text-sm">
                <strong>Student:</strong> {userToRevoke.full_name}
              </p>
              <p className="text-sm text-slate-600">{userToRevoke.email}</p>
            </div>

            <div className="mb-4 p-3 bg-red-50 rounded text-sm text-red-800">
              <p>This will immediately revoke premium access for this user.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRevokeModal(false);
                  setUserToRevoke(null);
                }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRevoke}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Revoke Premium
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal
        show={alertModal.show}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ show: false, title: '', message: '', type: 'info' })}
      />
    </div>
  );
};

export default ManagePremium;

