import React, { useEffect, useMemo, useState } from 'react';
import { Search, User } from 'lucide-react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import AvatarImage from '../components/AvatarImage';
import usePopup from '../hooks/usePopup.jsx';
import { ensureUsernamesForUsers, updateUsernameForUser } from '../utils/usernames';
import { logAdminActivity } from '../utils/adminActivityLogger';

const ROLE_OPTIONS = ['all', 'student', 'teacher', 'mentor', 'admin', 'instructor', 'verifier'];

const AdminUsernames = () => {
  const { openPopup, popupNode } = usePopup();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingUserId, setEditingUserId] = useState('');
  const [draftUsername, setDraftUsername] = useState('');
  const [savingUserId, setSavingUserId] = useState('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, phone, avatar_url, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const hydratedUsers = await ensureUsernamesForUsers(data || []);
      setUsers(hydratedUsers);
    } catch (error) {
      openPopup('Error', error.message || 'Failed to load usernames.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesRole = roleFilter === 'all' || String(user.role || '').toLowerCase() === roleFilter;
      const matchesSearch =
        !query ||
        String(user.full_name || '').toLowerCase().includes(query) ||
        String(user.email || '').toLowerCase().includes(query) ||
        String(user.username || '').toLowerCase().includes(query) ||
        String(user.phone || '').toLowerCase().includes(query);
      return matchesRole && matchesSearch;
    });
  }, [users, search, roleFilter]);

  const beginEdit = (user) => {
    setEditingUserId(user.id);
    setDraftUsername(user.username || '');
  };

  const cancelEdit = () => {
    setEditingUserId('');
    setDraftUsername('');
  };

  const saveUsername = async (user) => {
    if (!user?.id || !draftUsername.trim()) {
      openPopup('Error', 'Username is required.', 'error');
      return;
    }

    try {
      setSavingUserId(user.id);
      const savedUsername = await updateUsernameForUser({
        userId: user.id,
        username: draftUsername.trim(),
      });

      const {
        data: { user: adminUser },
      } = await supabase.auth.getUser();

      await logAdminActivity({
        adminId: adminUser?.id,
        eventType: 'action',
        action: 'Updated username',
        target: user.id,
        details: {
          module: 'admin-usernames',
          previous_username: user.username || null,
          new_username: savedUsername,
        },
      });

      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? { ...item, username: savedUsername } : item))
      );
      openPopup('Updated', 'Username updated successfully.', 'success');
      cancelEdit();
    } catch (error) {
      openPopup('Error', error.message || 'Failed to update username.', 'error');
    } finally {
      setSavingUserId('');
    }
  };

  return (
    <div className="space-y-6">
      {popupNode}

      <div className="rounded-xl bg-gradient-to-r from-slate-900 via-cyan-900 to-blue-900 p-6 text-white">
        <div className="flex items-center gap-3">
          <User size={24} />
          <div>
            <h1 className="text-2xl font-bold">Username Directory</h1>
            <p className="text-cyan-100">Search every account by username, check profile details, and edit usernames from one place.</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username, name, email, or phone"
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setRoleFilter(role)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                  roleFilter === role ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <LoadingSpinner fullPage={false} message="Loading usernames..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Username</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No users found for this search.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const isEditing = editingUserId === user.id;
                    const isSaving = savingUserId === user.id;

                    return (
                      <tr key={user.id} className="border-t border-slate-200 align-top">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <AvatarImage
                              userId={user.id}
                              avatarUrl={user.avatar_url}
                              alt={user.full_name}
                              fallbackName={user.full_name || 'User'}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-800">{user.full_name || 'User'}</p>
                              <p className="truncate text-xs text-slate-500">{user.email || '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                value={draftUsername}
                                onChange={(e) => setDraftUsername(e.target.value)}
                                className="w-full min-w-[220px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveUsername(user)}
                                  disabled={isSaving}
                                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                >
                                  {isSaving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={isSaving}
                                  className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="font-mono text-xs text-slate-700 break-all">{user.username || '-'}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{user.role || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{user.phone || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {!isEditing ? (
                            <button
                              type="button"
                              onClick={() => beginEdit(user)}
                              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                            >
                              Edit Username
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsernames;
