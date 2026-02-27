import React, { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import AlertModal from '../components/AlertModal';

const CertificateBlocks = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('student');
  const [certUpdatingUserId, setCertUpdatingUserId] = useState(null);
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, avatar_url')
      .order('full_name');

    const { data: certData } = await supabase
      .from('certificates')
      .select('user_id, revoked_at');

    const certMap = {};
    (certData || []).forEach(cert => {
      if (!certMap[cert.user_id]) {
        certMap[cert.user_id] = { total: 0, active: 0 };
      }
      certMap[cert.user_id].total += 1;
      if (!cert.revoked_at) certMap[cert.user_id].active += 1;
    });

    const merged = (profileData || []).map(u => ({
      ...u,
      certs: certMap[u.id] || { total: 0, active: 0 }
    }));

    setUsers(merged);
    setLoading(false);
  };

  const updateUserCertificates = async (user, action) => {
    setCertUpdatingUserId(user.id);
    try {
      if (action === 'block') {
        const { error } = await supabase
          .from('certificates')
          .update({ revoked_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .is('revoked_at', null);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('certificates')
          .update({ revoked_at: null })
          .eq('user_id', user.id);
        if (error) throw error;
      }

      await loadUsers();
      setAlertModal({
        show: true,
        title: 'Success',
        message: action === 'block' ? 'Certificates blocked.' : 'Certificates unblocked.',
        type: 'success'
      });
    } catch (err) {
      console.error('Certificate update error:', err);
      setAlertModal({
        show: true,
        title: 'Error',
        message: err.message || 'Failed to update certificates',
        type: 'error'
      });
    } finally {
      setCertUpdatingUserId(null);
    }
  };

  const requestUpdate = (user, action) => {
    const message = action === 'block'
      ? 'Block all active certificates for this user?'
      : 'Unblock all certificates for this user?';
    setConfirmModal({
      show: true,
      title: 'Confirm Action',
      message,
      onConfirm: () => updateUserCertificates(user, action)
    });
  };

  const filtered = users.filter(u => {
    const matchesSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-red-600 to-rose-700 p-6 rounded-xl text-white">
        <h1 className="text-2xl font-bold mb-1">Certificate Blocks</h1>
        <p className="text-rose-100">Block or restore certificates for students and teachers.</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                roleFilter === 'all'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All ({users.length})
            </button>
            <button
              onClick={() => setRoleFilter('student')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                roleFilter === 'student'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Students ({users.filter(u => u.role === 'student').length})
            </button>
            <button
              onClick={() => setRoleFilter('teacher')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                roleFilter === 'teacher'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Teachers ({users.filter(u => u.role === 'teacher').length})
            </button>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="px-3 py-2 border rounded-lg w-full md:w-64"
          />
        </div>

        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Certificates</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center"><LoadingSpinner fullPage={false} message="Loading users..." /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No users found</td></tr>
              ) : (
                filtered.map(u => {
                  const hasCertificates = u.certs?.total > 0;
                  const hasActiveCertificates = u.certs?.active > 0;
                  return (
                    <tr key={u.id} className="border-t">
                      <td className="px-4 py-3 flex items-center gap-2">
                        <img
                          src={u.avatar_url || 'https://via.placeholder.com/32'}
                          alt={u.full_name}
                          className="w-8 h-8 rounded-full object-cover"
                          onError={e => { e.currentTarget.src = 'https://via.placeholder.com/32'; }}
                        />
                        <span className="font-semibold text-slate-800">{u.full_name}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          u.role === 'admin' ? 'bg-red-100 text-red-700' :
                          u.role === 'teacher' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {u.role === 'admin' ? 'Nani' : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {hasCertificates ? (
                          <div className="flex flex-col gap-2">
                            <span className="text-xs text-slate-600">
                              Active {u.certs.active} / Total {u.certs.total}
                            </span>
                            <button
                              onClick={() => requestUpdate(u, hasActiveCertificates ? 'block' : 'unblock')}
                              disabled={certUpdatingUserId === u.id}
                              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                                hasActiveCertificates
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              } disabled:opacity-60`}
                            >
                              {certUpdatingUserId === u.id
                                ? 'Updating...'
                                : hasActiveCertificates
                                ? 'Block Certificates'
                                : 'Unblock Certificates'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">{confirmModal.title}</h3>
            <p className="text-sm text-slate-600">{confirmModal.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmModal({ show: false, title: '', message: '', onConfirm: null })}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const action = confirmModal.onConfirm;
                  setConfirmModal({ show: false, title: '', message: '', onConfirm: null });
                  if (action) await action();
                }}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Confirm
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

export default CertificateBlocks;
