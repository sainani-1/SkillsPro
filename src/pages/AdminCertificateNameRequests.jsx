import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Search, XCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { NAME_CHANGE_STATUS } from '../utils/identityVerification';

const AdminCertificateNameRequests = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(NAME_CHANGE_STATUS.PENDING);
  const [drafts, setDrafts] = useState({});

  const loadRows = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await supabase
        .from('certificate_name_change_requests')
        .select(`
          id,
          user_id,
          current_name,
          requested_name,
          reason,
          status,
          admin_notes,
          reviewed_by,
          reviewed_at,
          created_at,
          updated_at,
          user:profiles!certificate_name_change_requests_user_id_fkey(id, full_name, email, certificate_name),
          reviewer:profiles!certificate_name_change_requests_reviewed_by_fkey(id, full_name, email)
        `)
        .order('created_at', { ascending: false });
      if (queryError) throw queryError;
      setRows(data || []);
      setDrafts(Object.fromEntries((data || []).map((row) => [row.id, { requestedName: row.requested_name || '', adminNotes: row.admin_notes || '' }])));
    } catch (err) {
      setError(err.message || 'Could not load name change requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      const matchesSearch =
        !q ||
        String(row.user?.full_name || '').toLowerCase().includes(q) ||
        String(row.user?.email || '').toLowerCase().includes(q) ||
        String(row.current_name || '').toLowerCase().includes(q) ||
        String(row.requested_name || '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [rows, search, statusFilter]);

  const updateRequest = async (row, nextStatus) => {
    const requestedName = String(drafts[row.id]?.requestedName || '').trim();
    if (nextStatus === NAME_CHANGE_STATUS.APPROVED && !requestedName) {
      setError('Requested name cannot be empty.');
      return;
    }

    setSavingId(row.id);
    setError('');
    try {
      const now = new Date().toISOString();
      const { data: authData } = await supabase.auth.getUser();
      const reviewerId = authData?.user?.id || null;

      const { error: requestError } = await supabase
        .from('certificate_name_change_requests')
        .update({
          requested_name: requestedName || row.requested_name,
          admin_notes: drafts[row.id]?.adminNotes || null,
          status: nextStatus,
          reviewed_by: reviewerId,
          reviewed_at: now,
          updated_at: now,
        })
        .eq('id', row.id);
      if (requestError) throw requestError;

      if (nextStatus === NAME_CHANGE_STATUS.APPROVED) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            certificate_name: requestedName,
            updated_at: now,
          })
          .eq('id', row.user_id);
        if (profileError) throw profileError;
      }

      await loadRows();
    } catch (err) {
      setError(err.message || 'Could not update the name change request.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-fuchsia-900 to-indigo-900 p-6 text-white">
        <h1 className="text-2xl font-bold">Certificate Name Requests</h1>
        <p className="mt-2 text-sm text-slate-200">Review requests for wrong approved names and update the certificate name from here.</p>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {['all', NAME_CHANGE_STATUS.PENDING, NAME_CHANGE_STATUS.APPROVED, NAME_CHANGE_STATUS.REJECTED].map((status) => (
              <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`rounded-full px-4 py-2 text-sm font-semibold ${statusFilter === status ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {status === 'all' ? 'All' : status}
              </button>
            ))}
          </div>
          <label className="relative block w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student or requested name" className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4" />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading requests...</div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">No name change requests found.</div>
      ) : (
        <div className="space-y-4">
          {filteredRows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-900">{row.user?.full_name || 'Student'}</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    row.status === NAME_CHANGE_STATUS.APPROVED ? 'bg-emerald-100 text-emerald-700' : row.status === NAME_CHANGE_STATUS.REJECTED ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {String(row.status || '').toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-slate-500">{row.user?.email || 'No email'}</p>
                <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                  <p><strong>Current certificate name:</strong> {row.current_name}</p>
                  <p><strong>Requested name:</strong> {row.requested_name}</p>
                  <p><strong>Submitted:</strong> {new Date(row.created_at).toLocaleString('en-IN')}</p>
                  {row.reviewer?.full_name ? <p><strong>Reviewed by:</strong> {row.reviewer.full_name}</p> : null}
                </div>
                {row.reason ? <p className="mt-2 text-sm text-slate-700"><strong>Reason:</strong> {row.reason}</p> : null}
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Final certificate name</span>
                  <input value={drafts[row.id]?.requestedName || ''} onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], requestedName: e.target.value } }))} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Admin note</span>
                  <textarea value={drafts[row.id]?.adminNotes || ''} onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], adminNotes: e.target.value } }))} className="min-h-[96px] w-full rounded-xl border border-slate-300 px-4 py-3" placeholder="Optional note for approval or rejection" />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => updateRequest(row, NAME_CHANGE_STATUS.APPROVED)} disabled={savingId === row.id} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                  <CheckCircle2 size={18} />
                  Approve & Change Name
                </button>
                <button type="button" onClick={() => updateRequest(row, NAME_CHANGE_STATUS.REJECTED)} disabled={savingId === row.id} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                  <XCircle size={18} />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminCertificateNameRequests;
