import React, { useEffect, useState } from 'react';
import { AlertCircle, Send, Wrench } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import usePopup from '../hooks/usePopup';
import LoadingSpinner from '../components/LoadingSpinner';
import { sendAdminNotification } from '../utils/adminNotifications';

const CATEGORY_OPTIONS = [
  { value: 'technical', label: 'Technical' },
  { value: 'payment', label: 'Payment' },
  { value: 'course', label: 'Course' },
  { value: 'exam', label: 'Exam' },
  { value: 'chat', label: 'Chat' },
  { value: 'account', label: 'Account' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' }
];

const statusTone = {
  open: 'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-100 text-slate-700 border-slate-200'
};

const isCompletedStatus = (status) => status === 'resolved' || status === 'closed';

const ReportIssue = () => {
  const { profile } = useAuth();
  const { popupNode, openPopup } = usePopup();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reports, setReports] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [form, setForm] = useState({
    category: 'technical',
    subject: '',
    description: ''
  });

  const loadReports = async () => {
    if (!profile?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('issue_reports')
        .select('id, category, subject, description, status, admin_note, created_at, updated_at, resolved_at')
        .eq('reporter_id', profile.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      openPopup('Error', error.message || 'Failed to load issue reports.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [profile?.id]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const subject = form.subject.trim();
    const description = form.description.trim();

    if (!subject || !description) {
      openPopup('Missing Details', 'Please enter both subject and description.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        reporter_id: profile.id,
        reporter_role: profile.role,
        category: form.category,
        subject,
        description
      };
      const { error } = await supabase.from('issue_reports').insert(payload);
      if (error) throw error;
      await sendAdminNotification({
        title: 'New Issue Report',
        content: `${profile?.full_name || 'User'} submitted an issue report: ${subject}`,
        admin_id: profile?.id || null,
      });
      setForm({ category: 'technical', subject: '', description: '' });
      setActiveTab('pending');
      openPopup('Submitted', 'Your issue report has been submitted.', 'success');
      await loadReports();
    } catch (error) {
      openPopup('Error', error.message || 'Failed to submit issue report.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading issue reports..." />;

  const pendingReports = reports.filter((report) => !isCompletedStatus(report.status));
  const completedReports = reports.filter((report) => isCompletedStatus(report.status));
  const visibleReports = activeTab === 'pending' ? pendingReports : completedReports;

  return (
    <div className="space-y-6">
      {popupNode}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3">
          <Wrench size={24} />
          <div>
            <h1 className="text-2xl font-bold">Report An Issue</h1>
            <p className="text-orange-100">Students and teachers can report technical problems, payment issues, chat problems, certificate problems, and other blockers here.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-3"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Subject</label>
            <input
              value={form.subject}
              onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="Short title of the problem"
              className="w-full border border-slate-300 rounded-lg px-3 py-3"
              maxLength={160}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Explain the problem clearly. Mention page name, what happened, and what you expected."
            rows={6}
            className="w-full border border-slate-300 rounded-lg px-3 py-3"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60"
        >
          <Send size={18} />
          {submitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-bold text-slate-900">My Reports</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${activeTab === 'pending' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              Pending ({pendingReports.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${activeTab === 'completed' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              Completed ({completedReports.length})
            </button>
          </div>
        </div>

        {visibleReports.length === 0 ? (
          <div className="flex items-center gap-3 text-slate-500">
            <AlertCircle size={18} />
            <p>{activeTab === 'pending' ? 'No pending reports.' : 'No completed reports yet.'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleReports.map((report) => (
              <div key={report.id} className="border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{report.subject}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{report.category}</p>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-semibold border rounded-full ${statusTone[report.status] || statusTone.open}`}>
                    {isCompletedStatus(report.status) ? 'completed' : 'pending'}
                  </span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{report.description}</p>
                {report.admin_note ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-slate-600 mb-1">Admin Response</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{report.admin_note}</p>
                  </div>
                ) : null}
                <p className="text-xs text-slate-500">Submitted: {new Date(report.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportIssue;
