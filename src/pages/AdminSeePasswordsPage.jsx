import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Search, ShieldAlert, Copy } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { logAdminActivity } from '../utils/adminActivityLogger';

const AdminSeePasswordsPage = () => {
  const { realProfile } = useAuth();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const loadPasswords = async () => {
      try {
        const {
          data: refreshed,
          error: refreshError,
        } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;

        let accessToken = refreshed.session?.access_token || '';
        if (!accessToken) {
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          accessToken = session?.access_token || '';
        }
        if (!accessToken) {
          throw new Error('Admin session expired. Please login again.');
        }

        const { data, error } = await supabase.functions.invoke('admin-list-user-passwords', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (error) throw error;
        setRows(Array.isArray(data?.users) ? data.users : []);
        await logAdminActivity({
          adminId: realProfile?.id,
          eventType: 'security',
          action: 'Viewed user password list',
          target: 'admin-user-passwords',
          details: {
            module: 'admin-see-passwords',
            returned_count: Array.isArray(data?.users) ? data.users.length : 0,
          },
        });
      } catch (error) {
        try {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, auth_user_id, full_name, email, role, deleted_at, created_at')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
          if (profilesError) throw profilesError;
          setRows(
            (profiles || []).map((profile) => ({
              id: profile.id,
              auth_user_id: profile.auth_user_id,
              full_name: profile.full_name,
              email: profile.email,
              role: profile.role,
              tracked_password: null,
              password_source: null,
              password_updated_at: null,
            }))
          );
          setMessage({
            type: 'success',
            text: 'Password tracking is unavailable right now, so this page is showing users without stored passwords.',
          });
        } catch (fallbackError) {
          setMessage({
            type: 'error',
            text: fallbackError.message || error.message || 'Failed to load tracked passwords.',
          });
        }
      } finally {
        setLoading(false);
      }
    };

    loadPasswords();
  }, [realProfile?.id]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [row.full_name, row.email, row.role, row.password_source].some((value) =>
        String(value || '').toLowerCase().includes(term)
      )
    );
  }, [rows, search]);

  const copyValue = async (value) => {
    try {
      await navigator.clipboard.writeText(value || '');
      setMessage({ type: 'success', text: 'Copied to clipboard.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Copy failed on this device.' });
    }
  };

  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords((current) => ({
      ...current,
      [userId]: !current[userId],
    }));
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#0f172a,_#020617_55%)] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300">Admin Password Vault</p>
              <h1 className="mt-2 text-3xl font-bold">See User Passwords</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                This shows tracked admin-managed passwords only. Older users or users who changed their own password may show as unavailable.
              </p>
            </div>
            <Link
              to="/app"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Back To Dashboard
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border border-amber-300/20 bg-amber-400/10 p-5 text-amber-50 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5" />
            <p className="text-sm">
              Access is MFA-protected and should be used only for verified support/admin workflows.
            </p>
          </div>
          <p className="text-sm text-amber-100">Use each row's button to show or hide that password.</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-2xl">
          <div className="mb-4 flex items-center gap-3">
            <Search className="h-5 w-5 text-emerald-300" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search users..."
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400"
            />
          </div>

          {message.text ? (
            <div
              className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
                message.type === 'error'
                  ? 'border-red-300/30 bg-red-400/10 text-red-100'
                  : 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
              }`}
            >
              {message.text}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Tracked Password</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Loading tracked passwords...
                    </td>
                  </tr>
                ) : filteredRows.length ? (
                  filteredRows.map((row) => {
                    const trackedPassword = row.tracked_password || '';
                    const isVisible = Boolean(visiblePasswords[row.id]);
                    return (
                      <tr key={row.id} className="border-b border-white/5 align-top">
                        <td className="px-4 py-4 text-white">{row.full_name || 'Unnamed User'}</td>
                        <td className="px-4 py-4 text-slate-300">{row.email || '-'}</td>
                        <td className="px-4 py-4 text-slate-300">{row.role || '-'}</td>
                        <td className="px-4 py-4">
                          {trackedPassword ? (
                            <div className="flex items-center gap-2">
                              <code className="rounded-lg bg-white/5 px-3 py-2 text-emerald-200">
                                {isVisible ? trackedPassword : '••••••••••'}
                              </code>
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(row.id)}
                                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                                title={isVisible ? 'Hide password' : 'Show password'}
                              >
                                {isVisible ? (
                                  <span className="inline-flex items-center gap-1">
                                    <EyeOff className="h-4 w-4" />
                                    Hide
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1">
                                    <Eye className="h-4 w-4" />
                                    Show
                                  </span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyValue(trackedPassword)}
                                className="rounded-lg border border-white/10 p-2 text-slate-300 transition hover:bg-white/10"
                                title="Copy password"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
                              Not available
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-300">{row.password_source || '-'}</td>
                        <td className="px-4 py-4 text-slate-300">
                          {row.password_updated_at ? new Date(row.password_updated_at).toLocaleString('en-IN') : '-'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No users matched your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSeePasswordsPage;
