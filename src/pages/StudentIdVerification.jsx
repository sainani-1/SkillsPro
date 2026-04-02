import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
  fetchLatestIdentityVerification,
  fetchLatestNameChangeRequest,
  getCertificateDisplayName,
  getIdentityVerificationStatus,
  GOVERNMENT_ID_OPTIONS,
  hasApprovedIdentity,
  ID_VERIFICATION_STATUS,
  NAME_CHANGE_STATUS,
  submitCertificateNameChangeRequest,
  submitIdentityVerification,
} from '../utils/identityVerification';

const STATUS_STYLES = {
  [ID_VERIFICATION_STATUS.NOT_SUBMITTED]: 'bg-slate-100 text-slate-700',
  [ID_VERIFICATION_STATUS.PENDING]: 'bg-amber-100 text-amber-700',
  [ID_VERIFICATION_STATUS.APPROVED]: 'bg-emerald-100 text-emerald-700',
  [ID_VERIFICATION_STATUS.REJECTED]: 'bg-red-100 text-red-700',
};

const StatusCard = ({ icon, title, value, description }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
      {icon}
      {title}
    </div>
    <p className="mt-3 text-lg font-bold text-slate-900">{value}</p>
    <p className="mt-2 text-sm text-slate-500">{description}</p>
  </div>
);

const StudentIdVerification = () => {
  const { profile, fetchProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingNameChange, setSubmittingNameChange] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [latestVerification, setLatestVerification] = useState(null);
  const [latestNameChange, setLatestNameChange] = useState(null);
  const [showNameChangeForm, setShowNameChangeForm] = useState(false);
  const [form, setForm] = useState({
    submittedName: '',
    idType: GOVERNMENT_ID_OPTIONS[0],
    idNumber: '',
    file: null,
  });
  const [nameChangeForm, setNameChangeForm] = useState({
    requestedName: '',
    reason: '',
  });

  const status = getIdentityVerificationStatus(profile, latestVerification);
  const approvedName = getCertificateDisplayName({
    certificate_name: latestVerification?.approved_name || profile?.certificate_name,
    full_name: latestVerification?.submitted_name || profile?.full_name,
    status,
  });
  const canRequestNameChange =
    hasApprovedIdentity(profile, latestVerification) &&
    latestNameChange?.status !== NAME_CHANGE_STATUS.PENDING;

  const loadData = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const [verification, nameChange] = await Promise.all([
        fetchLatestIdentityVerification(supabase, profile.id),
        fetchLatestNameChangeRequest(supabase, profile.id),
      ]);
      setLatestVerification(verification);
      setLatestNameChange(nameChange);
      setForm((prev) => ({
        ...prev,
        submittedName: verification?.submitted_name || profile?.certificate_name || profile?.full_name || '',
        idType: verification?.id_type || GOVERNMENT_ID_OPTIONS[0],
        idNumber: verification?.id_number || '',
      }));
      setNameChangeForm((prev) => ({
        ...prev,
        requestedName: profile?.certificate_name || verification?.approved_name || profile?.full_name || '',
      }));
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Could not load verification status.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.id]);

  const uploadIdImage = async (file) => {
    const extension = file.name.split('.').pop() || 'jpg';
    const filePath = `${profile.id}/${Date.now()}.${extension}`;
    const { error } = await supabase.storage
      .from('id-verifications')
      .upload(filePath, file, { upsert: true, contentType: file.type || 'image/jpeg' });
    if (error) throw error;
    const { data } = supabase.storage.from('id-verifications').getPublicUrl(filePath);
    if (!data?.publicUrl) throw new Error('Could not create ID image URL.');
    return data.publicUrl;
  };

  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    if (!profile?.id) return;
    if (!form.submittedName.trim() || !form.idNumber.trim() || !form.file) {
      setMessage({ type: 'error', text: 'Please enter name, ID number, and upload the ID image.' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const imageUrl = await uploadIdImage(form.file);
      await submitIdentityVerification({
        supabase,
        userId: profile.id,
        submittedName: form.submittedName.trim(),
        idType: form.idType,
        idNumber: form.idNumber.trim(),
        idImageUrl: imageUrl,
      });
      await fetchProfile(profile.id, { background: true });
      await loadData();
      setForm((prev) => ({ ...prev, file: null }));
      setMessage({ type: 'success', text: 'Your verification request was submitted and sent for review.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Could not submit the verification request.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNameChangeSubmit = async (e) => {
    e.preventDefault();
    if (!profile?.id) return;
    if (!nameChangeForm.requestedName.trim()) {
      setMessage({ type: 'error', text: 'Please enter the corrected name.' });
      return;
    }

    setSubmittingNameChange(true);
    setMessage({ type: '', text: '' });
    try {
      await submitCertificateNameChangeRequest({
        supabase,
        userId: profile.id,
        currentName: approvedName,
        requestedName: nameChangeForm.requestedName.trim(),
        reason: nameChangeForm.reason.trim(),
      });
      await loadData();
      setShowNameChangeForm(false);
      setMessage({ type: 'success', text: 'Your name change request was submitted to admin.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Could not submit the name change request.' });
    } finally {
      setSubmittingNameChange(false);
    }
  };

  const statusCopy = useMemo(() => {
    if (status === ID_VERIFICATION_STATUS.PENDING) return 'Submitted for review. Your approved name will appear on certificates after verification.';
    if (status === ID_VERIFICATION_STATUS.APPROVED) return 'Approved. This verified name will be used on certificates.';
    if (status === ID_VERIFICATION_STATUS.REJECTED) return 'Rejected. Fix the issue and submit a new request.';
    return 'Verify your government ID before certificates can be issued in your name.';
  }, [status]);

  if (!profile) return <div className="p-6">Loading verification...</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Verify My ID</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200">
              Submit one clear government-issued ID and the exact name you want printed on certificates.
            </p>
          </div>
          <div className={`rounded-full px-4 py-2 text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.not_submitted}`}>
            {status.replace('_', ' ').toUpperCase()}
          </div>
        </div>
      </div>

      {message.text ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard icon={<ShieldCheck className="text-blue-600" size={20} />} title="Current Status" value={status.replace('_', ' ')} description={statusCopy} />
        <StatusCard icon={<CheckCircle2 className="text-emerald-600" size={20} />} title="Certificate Name" value={approvedName} description="This is the name we will use when certificates are shown or downloaded." />
        <StatusCard
          icon={<Clock3 className="text-amber-600" size={20} />}
          title="Last Update"
          value={latestVerification?.updated_at ? new Date(latestVerification.updated_at).toLocaleString('en-IN') : 'Not submitted'}
          description={latestVerification?.verifier?.full_name ? `Assigned verifier: ${latestVerification.verifier.full_name}` : 'Waiting for submission'}
        />
      </div>

      {status === ID_VERIFICATION_STATUS.REJECTED && latestVerification?.rejection_reason ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Reason for rejection</p>
          <p className="mt-1">{latestVerification.rejection_reason}</p>
        </div>
      ) : null}

      {(status === ID_VERIFICATION_STATUS.NOT_SUBMITTED || status === ID_VERIFICATION_STATUS.REJECTED) && (
        <form onSubmit={handleVerificationSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <Upload className="text-blue-600" size={20} />
            <div>
              <h2 className="text-lg font-bold text-slate-900">{status === ID_VERIFICATION_STATUS.REJECTED ? 'Submit New Verification' : 'Submit Verification'}</h2>
              <p className="text-sm text-slate-500">Upload a proper ID image and enter the exact legal name.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Name on certificate</span>
              <input value={form.submittedName} onChange={(e) => setForm((prev) => ({ ...prev, submittedName: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3" placeholder="Enter your full name exactly as on the ID" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Government ID type</span>
              <select value={form.idType} onChange={(e) => setForm((prev) => ({ ...prev, idType: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3">
                {GOVERNMENT_ID_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Government ID number</span>
              <input value={form.idNumber} onChange={(e) => setForm((prev) => ({ ...prev, idNumber: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3" placeholder="Enter the ID number" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Upload ID photo</span>
              <input type="file" accept="image/*" onChange={(e) => setForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))} className="w-full rounded-xl border border-slate-300 px-4 py-3" />
            </label>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500">Use one clear image only. Blurry, cropped, or mismatched names may be rejected.</p>
            <button type="submit" disabled={submitting} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {submitting ? 'Submitting...' : 'Submit Verification'}
            </button>
          </div>
        </form>
      )}

      {status === ID_VERIFICATION_STATUS.PENDING && latestVerification ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-bold text-amber-900">Verification submitted</h2>
          <p className="mt-2 text-sm text-amber-800">Name submitted: <strong>{latestVerification.submitted_name}</strong></p>
          <p className="mt-3 text-sm text-amber-800">After approval, certificates will use this verified name. If you uploaded the wrong document, wait for rejection and resubmit.</p>
        </div>
      ) : null}

      {status === ID_VERIFICATION_STATUS.APPROVED ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <h2 className="text-lg font-bold text-emerald-900">ID verified</h2>
            <p className="mt-2 text-sm text-emerald-800">Approved name: <strong>{approvedName}</strong></p>
            <p className="mt-3 text-sm text-emerald-800">Your certificates will show the approved name above. If the name is wrong, send a name change request below.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Certificate Name Change</h2>
                <p className="text-sm text-slate-500">Use this only if the approved certificate name is wrong.</p>
              </div>
              {canRequestNameChange && !showNameChangeForm ? (
                <button type="button" onClick={() => setShowNameChangeForm(true)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  Submit Request for Name Change
                </button>
              ) : null}
            </div>

            {latestNameChange ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">Latest request</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    latestNameChange.status === NAME_CHANGE_STATUS.APPROVED ? 'bg-emerald-100 text-emerald-700' : latestNameChange.status === NAME_CHANGE_STATUS.REJECTED ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {String(latestNameChange.status || '').toUpperCase()}
                  </span>
                </div>
                <p className="mt-2">Requested name: <strong>{latestNameChange.requested_name}</strong></p>
                {latestNameChange.reason ? <p className="mt-1">Reason: {latestNameChange.reason}</p> : null}
                {latestNameChange.admin_notes ? <p className="mt-1">Admin note: {latestNameChange.admin_notes}</p> : null}
              </div>
            ) : null}

            {showNameChangeForm ? (
              <form onSubmit={handleNameChangeSubmit} className="mt-4 space-y-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Corrected certificate name</span>
                  <input value={nameChangeForm.requestedName} onChange={(e) => setNameChangeForm((prev) => ({ ...prev, requestedName: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3" placeholder="Enter the correct name" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Reason</span>
                  <textarea value={nameChangeForm.reason} onChange={(e) => setNameChangeForm((prev) => ({ ...prev, reason: e.target.value }))} className="min-h-[96px] w-full rounded-xl border border-slate-300 px-4 py-3" placeholder="Explain what is wrong in the approved name" />
                </label>
                <div className="flex gap-3">
                  <button type="submit" disabled={submittingNameChange} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                    {submittingNameChange ? 'Submitting...' : 'Send Request'}
                  </button>
                  <button type="button" onClick={() => setShowNameChangeForm(false)} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button type="button" onClick={loadData} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw size={16} />
          Refresh Status
        </button>
      </div>
    </div>
  );
};

export default StudentIdVerification;
