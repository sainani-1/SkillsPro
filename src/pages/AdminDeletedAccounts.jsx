import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
import usePopup from '../hooks/usePopup.jsx';
import { Search, Trash2 } from 'lucide-react';

const AdminDeletedAccounts = () => {
  const { popupNode, openPopup } = usePopup();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');

  const loadDeletedAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deleted_accounts')
        .select('id, user_id, full_name, email, role, phone, reason, deleted_at, deleted_by')
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      openPopup('Load failed', error.message || 'Unable to load deleted accounts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeletedAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      [r.full_name, r.email, r.reason, r.role]
        .map((x) => String(x || '').toLowerCase())
        .some((value) => value.includes(q))
    );
  }, [records, search]);

  return (
    <div className="space-y-6">
      {popupNode}
      <div className="bg-gradient-to-r from-rose-600 to-red-600 p-6 rounded-xl text-white">
        <h1 className="text-2xl font-bold mb-1">Deleted Accounts</h1>
        <p className="text-rose-100">Users who deleted their account from settings.</p>
      </div>

      <div className="bg-white rounded-xl border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-700">
          <Trash2 size={18} />
          <span className="font-semibold">Total Deleted: {records.length}</span>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, reason, role..."
            className="w-full pl-10 pr-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-8">
            <LoadingSpinner fullPage={false} message="Loading deleted accounts..." />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No deleted accounts found.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Deleted On</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 text-slate-600">
                    {r.deleted_at ? new Date(r.deleted_at).toLocaleString('en-IN') : '-'}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.full_name || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.email || '-'}</td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{r.role || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.phone || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{r.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminDeletedAccounts;
