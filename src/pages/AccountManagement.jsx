import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Lock, Unlock, Award, Trash2, Search, Filter, AlertTriangle } from 'lucide-react';
import AlertModal from '../components/AlertModal';
import LoadingSpinner from '../components/LoadingSpinner';

const AccountManagement = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, locked, premium, no-premium
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [action, setAction] = useState(''); // unlock, grant-premium, revoke-premium, disable, delete
  const [premiumDate, setPremiumDate] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(''); // For double confirmation of delete
  const [loading, setLoading] = useState(false);
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');
    setUsers(data || []);
  };

  const getFilteredUsers = () => {
    let filtered = users.filter(u =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    );

    if (filterType === 'locked') {
      filtered = filtered.filter(u => u.is_locked);
    } else if (filterType === 'premium') {
      filtered = filtered.filter(u => u.premium_until && new Date(u.premium_until) > new Date());
    } else if (filterType === 'no-premium') {
      filtered = filtered.filter(u => !u.premium_until || new Date(u.premium_until) <= new Date());
    }

    return filtered;
  };

  const executeAction = async () => {
    if (!selectedUser) return;
    setLoading(true);

    try {
      let updatePayload = null;
      let successMsg = '';

      if (action === 'unlock') {
        updatePayload = { is_locked: false, locked_until: null };
        successMsg = '✅ Account unlocked successfully!';
      } else if (action === 'lock') {
        const lockedUntil = new Date();
        lockedUntil.setDate(lockedUntil.getDate() + 60);
        updatePayload = { is_locked: true, locked_until: lockedUntil.toISOString() };
        successMsg = '✅ Account locked for 60 days.';
      } else if (action === 'grant-premium') {
        if (!premiumDate) {
          setAlertModal({
            show: true,
            title: 'Missing Date',
            message: 'Please select a valid premium expiration date',
            type: 'warning'
          });
          return;
        }
        updatePayload = { premium_until: premiumDate };
        successMsg = '✅ Premium granted!';
      } else if (action === 'revoke-premium') {
        updatePayload = { premium_until: null };
        successMsg = '✅ Premium revoked!';
      } else if (action === 'disable') {
        updatePayload = { is_disabled: true };
        successMsg = '✅ Account disabled! User cannot login.';
      } else if (action === 'enable') {
        updatePayload = { is_disabled: false };
        successMsg = '✅ Account enabled!';
      } else if (action === 'delete') {
        // Delete account permanently
        console.log('Attempting to delete user:', selectedUser.id);
        
        try {
          const { error: deleteError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', selectedUser.id);
          
          if (deleteError) {
            console.error('Delete error:', deleteError);
            throw deleteError;
          }
          
          console.log('Delete successful');
          // Show success message
          setAlertModal({
            show: true,
            title: 'Success',
            message: '✅ Account permanently deleted!',
            type: 'success'
          });
          await loadUsers();
          setShowModal(false);
          setDeleteConfirm('');
          setLoading(false);
          return;
        } catch (err) {
          console.error('Delete operation failed:', err);
          throw err;
        }
      }

      if (!updatePayload) return;

      console.log('Executing action:', action, 'with payload:', updatePayload);

      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', selectedUser.id)
        .select('id, full_name, email, role, is_locked, locked_until, premium_until, avatar_url, is_disabled')
        .single();

      if (error) {
        console.error('Update error:', error);
        throw error;
      }
      if (!data) throw new Error('Update failed — no rows returned');

      // Show success message
      setAlertModal({
        show: true,
        title: 'Success',
        message: successMsg,
        type: 'success'
      });
      setSelectedUser(data);
      await loadUsers();
      setShowModal(false);
      setPremiumDate('');
      setDeleteConfirm('');
    } catch (error) {
      console.error('Action failed:', error);
      // Only show error alerts, not success
      setAlertModal({
        show: true,
        title: 'Error',
        message: 'Error: ' + error.message,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const openModal = (user, actionType) => {
    setSelectedUser(user);
    setAction(actionType);
    setShowModal(true);
  };

  const filteredUsers = getFilteredUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Account Management</h1>
        <p className="text-slate-500">Unlock accounts, manage premium access, and account status</p>
      </div>

      {/* Search and Filter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-gold-400 outline-none"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-gold-400 outline-none"
        >
          <option value="all">All Users</option>
          <option value="locked">Locked Accounts</option>
          <option value="premium">Active Premium</option>
          <option value="no-premium">No Premium</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Role</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Premium</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Account</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.id} className="border-b hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatar_url || 'https://via.placeholder.com/40'}
                        alt={user.full_name}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={e => e.currentTarget.src = 'https://via.placeholder.com/40'}
                      />
                      <span className="font-medium">{user.full_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.role === 'admin' ? 'bg-red-100 text-red-800' :
                      user.role === 'teacher' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {user.role === 'admin' ? 'Nani' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.is_locked ? (
                      <div className="flex items-center gap-2">
                        <Lock size={16} className="text-red-600" />
                        <span className="text-sm text-red-600 font-semibold">Locked</span>
                        {user.locked_until && (
                          <span className="text-xs text-red-500">
                            until {new Date(user.locked_until).toLocaleDateString('en-IN')}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-green-600 font-semibold">Active</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.premium_until && new Date(user.premium_until) > new Date() ? (
                      <div className="flex items-center gap-2">
                        <Award size={16} className="text-gold-400" />
                        <span className="text-sm font-semibold text-gold-600">
                          Until {new Date(user.premium_until).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500">No Premium</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.is_disabled ? (
                      <span className="text-xs font-semibold px-2 py-1 bg-red-100 text-red-700 rounded">
                        Disabled
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {user.is_locked ? (
                        <button
                          onClick={() => openModal(user, 'unlock')}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs font-semibold flex items-center gap-1"
                        >
                          <Unlock size={14} /> Unlock
                        </button>
                      ) : (
                        <button
                          onClick={() => openModal(user, 'lock')}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs font-semibold flex items-center gap-1"
                        >
                          <Lock size={14} /> Lock 60d
                        </button>
                      )}
                      <button
                        onClick={() => openModal(user, 'grant-premium')}
                        className="px-3 py-1 bg-gold-100 text-gold-700 rounded hover:bg-gold-200 text-xs font-semibold flex items-center gap-1"
                      >
                        <Award size={14} /> Premium
                      </button>
                      {user.premium_until && new Date(user.premium_until) > new Date() && (
                        <button
                          onClick={() => openModal(user, 'revoke-premium')}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs font-semibold"
                        >
                          Revoke
                        </button>
                      )}
                      {user.is_disabled ? (
                        <button
                          onClick={() => openModal(user, 'enable')}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-semibold flex items-center gap-1"
                        >
                          <Unlock size={14} /> Enable
                        </button>
                      ) : (
                        <button
                          onClick={() => openModal(user, 'disable')}
                          className="px-3 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 text-xs font-semibold flex items-center gap-1"
                        >
                          <AlertTriangle size={14} /> Disable
                        </button>
                      )}
                      <button
                        onClick={() => openModal(user, 'delete')}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs font-semibold flex items-center gap-1"
                        title="Permanently delete account"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            No users found
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">
              {action === 'unlock' && 'Unlock Account'}
              {action === 'lock' && 'Lock Account (60 days)'}
              {action === 'grant-premium' && 'Grant Premium Access'}
              {action === 'revoke-premium' && 'Revoke Premium Access'}
              {action === 'disable' && 'Disable Account'}
              {action === 'enable' && 'Enable Account'}
              {action === 'delete' && 'Delete Account Permanently'}
            </h2>

            <div className="mb-4 p-3 bg-slate-100 rounded">
              <p className="text-sm">
                <strong>User:</strong> {selectedUser.full_name}
              </p>
              <p className="text-sm text-slate-600">{selectedUser.email}</p>
            </div>

            {action === 'grant-premium' && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Valid Until</label>
                <input
                  type="date"
                  value={premiumDate}
                  onChange={e => setPremiumDate(e.target.value)}
                  className="w-full border rounded-lg p-2"
                />
              </div>
            )}

            {action === 'unlock' && (
              <div className="mb-4 p-3 bg-yellow-50 rounded text-sm text-yellow-800">
                <p>This will unlock the account immediately.</p>
                {selectedUser.locked_until && (
                  <p className="text-xs mt-1">
                    Originally locked until: {new Date(selectedUser.locked_until).toLocaleDateString('en-IN')}
                  </p>
                )}
              </div>
            )}

            {action === 'lock' && (
              <div className="mb-4 p-3 bg-red-50 rounded text-sm text-red-800">
                <p>This will lock the account for 60 days and block all access.</p>
              </div>
            )}

            {action === 'revoke-premium' && (
              <div className="mb-4 p-3 bg-red-50 rounded text-sm text-red-800">
                This will immediately revoke premium access.
              </div>
            )}

            {action === 'disable' && (
              <div className="mb-4 p-3 bg-orange-50 rounded text-sm text-orange-800">
                <p className="font-medium">This account will be disabled.</p>
                <p className="text-xs mt-1">The user cannot login until you enable it again.</p>
              </div>
            )}

            {action === 'enable' && (
              <div className="mb-4 p-3 bg-blue-50 rounded text-sm text-blue-800">
                <p>This will enable the account and allow login access.</p>
              </div>
            )}

            {action === 'delete' && (
              <div className="mb-4">
                <div className="p-3 bg-red-50 rounded text-sm text-red-800 mb-4">
                  <p className="font-bold text-red-900">⚠️ WARNING: This action is permanent!</p>
                  <p className="text-xs mt-2">This will permanently delete the account and all associated data. This cannot be undone.</p>
                </div>
                <label className="block text-sm font-medium mb-2 text-slate-700">
                  Type the user's name to confirm deletion:
                </label>
                <input
                  type="text"
                  placeholder={selectedUser.full_name}
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-red-400 outline-none"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Must match: <strong>{selectedUser.full_name}</strong>
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setDeleteConfirm('');
                  setPremiumDate('');
                }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                disabled={loading || (action === 'grant-premium' && !premiumDate) || (action === 'delete' && deleteConfirm !== selectedUser.full_name)}
                className={`flex-1 px-4 py-2 rounded-lg text-white font-medium ${
                  action === 'delete' 
                    ? 'bg-red-600 hover:bg-red-700 disabled:opacity-50' 
                    : 'bg-nani-dark hover:bg-nani-dark/90 disabled:opacity-50'
                }`}
              >
                {loading ? 'Processing...' : 'Confirm'}
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

export default AccountManagement;
