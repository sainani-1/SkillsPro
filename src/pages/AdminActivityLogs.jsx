import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import usePopup from '../hooks/usePopup';
import { Activity, RefreshCcw, Search } from 'lucide-react';

const toDisplayTime = (ts) => {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString('en-IN');
  } catch {
    return String(ts);
  }
};

export default function AdminActivityLogs() {
  const { popupNode, openPopup } = usePopup();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [missingTable, setMissingTable] = useState(false);

  const isMissingTableError = (error) => {
    const msg = String(error?.message || '').toLowerCase();
    const details = String(error?.details || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    return (
      code === '42p01' ||
      code === 'pgrst204' ||
      msg.includes("could not find the table 'public.admin_activity_logs'") ||
      msg.includes('admin_activity_logs') && msg.includes('schema cache') ||
      details.includes('admin_activity_logs')
    );
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select('id, created_at, event_type, action, target, details, admin_id, admin:profiles!admin_activity_logs_admin_id_fkey(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      setMissingTable(false);
      setRows(data || []);
    } catch (error) {
      if (isMissingTableError(error)) {
        setMissingTable(true);
        setRows([]);
      } else {
        openPopup('Load failed', error?.message || 'Failed to load activity logs.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.event_type, r.action, r.target, r.admin_id, JSON.stringify(r.details || {})]
        .map((v) => String(v || '').toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [rows, search]);

  return (
    <div className="space-y-6">
      {popupNode}
      <div className="bg-gradient-to-r from-indigo-700 to-blue-700 p-6 rounded-xl text-white">
        <h1 className="text-2xl font-bold mb-1">Admin Activity Logs</h1>
        <p className="text-indigo-100">Tracks admin movements and actions with exact timestamps.</p>
      </div>

      <div className="bg-white rounded-xl border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-700">
          <Activity size={18} />
          <span className="font-semibold">Total Logs: {rows.length}</span>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, event, route, admin id..."
              className="w-full pl-10 pr-3 py-2 border rounded-lg"
            />
          </div>
          <button
            type="button"
            onClick={loadLogs}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-x-auto">
        {missingTable ? (
          <div className="p-8 text-center text-amber-700 bg-amber-50">
            <p className="font-semibold">Activity logs table is not created in Supabase yet.</p>
            <p className="text-sm mt-1">
              Run migration <code>supabase/migrations/20260304_admin_activity_logs.sql</code> and refresh this page.
            </p>
          </div>
        ) : loading ? (
          <div className="p-8">
            <LoadingSpinner fullPage={false} message="Loading activity logs..." />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No activity logs found.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Target</th>
                <th className="px-4 py-3 text-left">Admin</th>
                <th className="px-4 py-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{toDisplayTime(r.created_at)}</td>
                  <td className="px-4 py-3 text-slate-700">{r.event_type || '-'}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.action || '-'}</td>
                  <td className="px-4 py-3 text-slate-700 break-all">{r.target || '-'}</td>
                  <td className="px-4 py-3 text-slate-600 break-all">
                    <div className="leading-tight">
                      <p className="font-medium text-slate-700">{r.admin?.full_name || 'Admin'}</p>
                      <p>{r.admin?.email || r.admin_id || '-'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-md">
                    <pre className="whitespace-pre-wrap break-words">
                      {JSON.stringify(r.details || {}, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
