import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Search, ShieldCheck, XCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { ID_VERIFICATION_STATUS } from '../utils/identityVerification';

const AdminIdVerifications = () => {
  const { profile } = useAuth();
  const isVerifierView = profile?.role === 'verifier';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ID_VERIFICATION_STATUS.PENDING);
  const [drafts, setDrafts] = useState({});

  const loadRows = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('student_id_verifications')
        .select(`
          id,
          user_id,
          submitted_name,
          approved_name,
          id_type,
          id_number,
          id_image_url,
          status,
          rejection_reason,
          assigned_verifier_id,
          reviewed_by,
          reviewed_at,
          created_at,
          updated_at,
          user:profiles!student_id_verifications_user_id_fkey(id, full_name, email, certificate_name, identity_verification_status),
          reviewer:profiles!student_id_verifications_reviewed_by_fkey(id, full_name, email),
          verifier:profiles!student_id_verifications_assigned_verifier_id_fkey(id, full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (isVerifierView) query = query.eq('assigned_verifier_id', profile.id);

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      setRows(data || []);
      setDrafts(
        Object.fromEntries(
          (data || []).map((row) => [
            row.id,
            {
              approvedName: row.approved_name || row.submitted_name || row.user?.certificate_name || row.user?.full_name || '',
              rejectionReason: row.rejection_reason || '',
            },
          ])
        )
      );
    } catch (err) {
      setError(err.message || 'Could not load ID verification requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, [profile?.id, isVerifierView]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      const matchesSearch =
        !q ||
        String(row.user?.full_name || '').toLowerCase().includes(q) ||
        String(row.user?.email || '').toLowerCase().includes(q) ||
        String(row.submitted_name || '').toLowerCase().includes(q) ||
        String(row.id_number || '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [rows, search, statusFilter]);

  const handleApprove = async (row) => {
    const approvedName = String(drafts[row.id]?.approvedName || '').trim();
    if (!approvedName) {
      setError('Approved name is required.');
      return;
    }
    setSavingId(row.id);
    setError('');
    try {
      const now = new Date().toISOString();
      const { error: reviewError } = await supabase
        .from('student_id_verifications')
        .update({
          status: ID_VERIFICATION_STATUS.APPROVED,
          approved_name: approvedName,
          rejection_reason: null,
          reviewed_by: profile.id,
          reviewed_at: now,
          updated_at: now,
        })
        .eq('id', row.id);
      if (reviewError) throw reviewError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          certificate_name: approvedName,
          identity_verification_status: ID_VERIFICATION_STATUS.APPROVED,
          identity_verified_at: now,
          identity_verified_by: profile.id,
          identity_rejection_reason: null,
          updated_at: now,
        })
        .eq('id', row.user_id);
      if (profileError) throw profileError;

      await loadRows();
    } catch (err) {
      setError(err.message || 'Could not approve the request.');
    } finally {
      setSavingId('');
    }
  };

  const handleReject = async (row) => {
    const rejectionReason = String(drafts[row.id]?.rejectionReason || '').trim();
    if (!rejectionReason) {
      setError('Rejection reason is required.');
      return;
    }
    setSavingId(row.id);
    setError('');
    try {
      const now = new Date().toISOString();
      const { error: reviewError } = await supabase
        .from('student_id_verifications')
        .update({
          status: ID_VERIFICATION_STATUS.REJECTED,
          rejection_reason: rejectionReason,
          reviewed_by: profile.id,
          reviewed_at: now,
          updated_at: now,
        })
        .eq('id', row.id);
      if (reviewError) throw reviewError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          identity_verification_status: ID_VERIFICATION_STATUS.REJECTED,
          identity_rejection_reason: rejectionReason,
          updated_at: now,
        })
        .eq('id', row.user_id);
      if (profileError) throw profileError;

      await loadRows();
    } catch (err) {
      setError(err.message || 'Could not reject the request.');
    } finally {
      setSavingId('');
    }
  };

  const handleSaveNameOnly = async (row) => {
    const approvedName = String(drafts[row.id]?.approvedName || '').trim();
    if (!approvedName) {
      setError('Name cannot be empty.');
      return;
    }
    setSavingId(row.id);
    setError('');
    try {
      const now = new Date().toISOString();
      const { error: rowError } = await supabase
        .from('student_id_verifications')
        .update({
          approved_name: approvedName,
          updated_at: now,
        })
        .eq('id', row.id);
      if (rowError) throw rowError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          certificate_name: approvedName,
          updated_at: now,
        })
        .eq('id', row.user_id);
      if (profileError) throw profileError;

      await loadRows();
    } catch (err) {
      setError(err.message || 'Could not update the approved name.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900 p-6 text-white">
        <h1 className="text-2xl font-bold">{isVerifierView ? 'Verifier Panel' : 'ID Verifications'}</h1>
        <p className="mt-2 text-sm text-slate-200">
          {isVerifierView
            ? 'Review the student ID verification requests assigned to you and approve the name or reject the request.'
            : 'Review all submitted government IDs, edit approved names, and keep certificate names correct.'}
        </p>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {['all', ID_VERIFICATION_STATUS.PENDING, ID_VERIFICATION_STATUS.APPROVED, ID_VERIFICATION_STATUS.REJECTED].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${statusFilter === status ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                {status === 'all' ? 'All' : status.replace('_', ' ')}
              </button>
            ))}
          </div>
          <label className="relative block w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student, email, or ID number" className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4" />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading requests...</div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">No verification requests found.</div>
      ) : (
        <div className="space-y-4">
          {filteredRows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-900">{row.user?.full_name || row.submitted_name}</h2>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      row.status === ID_VERIFICATION_STATUS.APPROVED ? 'bg-emerald-100 text-emerald-700' : row.status === ID_VERIFICATION_STATUS.REJECTED ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {String(row.status || '').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">{row.user?.email || 'No email'}</p>
                  <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                    <p><strong>Submitted name:</strong> {row.submitted_name}</p>
                    <p><strong>ID type:</strong> {row.id_type}</p>
                    <p><strong>ID number:</strong> {row.id_number}</p>
                    <p><strong>Submitted:</strong> {new Date(row.created_at).toLocaleString('en-IN')}</p>
                    {!isVerifierView ? <p><strong>Assigned verifier:</strong> {row.verifier?.full_name || 'Not assigned'}</p> : null}
                    {row.reviewer?.full_name ? <p><strong>Reviewed by:</strong> {row.reviewer.full_name}</p> : null}
                  </div>
                </div>

                <a href={row.id_image_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
                  View ID Image
                </a>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Approved certificate name</span>
                  <input
                    value={drafts[row.id]?.approvedName || ''}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], approvedName: e.target.value } }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Reason if rejecting</span>
                  <textarea
                    value={drafts[row.id]?.rejectionReason || ''}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], rejectionReason: e.target.value } }))}
                    className="min-h-[96px] w-full rounded-xl border border-slate-300 px-4 py-3"
                    placeholder="Explain what is wrong with the submission"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => handleApprove(row)} disabled={savingId === row.id} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                  <CheckCircle2 size={18} />
                  Approve
                </button>
                <button type="button" onClick={() => handleReject(row)} disabled={savingId === row.id} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                  <XCircle size={18} />
                  Reject
                </button>
                {(profile?.role === 'admin' || row.status === ID_VERIFICATION_STATUS.APPROVED) ? (
                  <button type="button" onClick={() => handleSaveNameOnly(row)} disabled={savingId === row.id} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                    <ShieldCheck size={18} />
                    Save Name Only
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminIdVerifications;
