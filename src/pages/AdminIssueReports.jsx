import React, { useEffect, useState } from 'react';
import { CheckCircle2, Pencil, ShieldAlert } from 'lucide-react';
import { supabase } from '../supabaseClient';
import usePopup from '../hooks/usePopup';
import LoadingSpinner from '../components/LoadingSpinner';
import { sendAdminNotification } from '../utils/adminNotifications';

const isCompletedStatus = (status) => status === 'resolved' || status === 'closed';
const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const AdminIssueReports = () => {
  const { popupNode, openPopup } = usePopup();
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [reports, setReports] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [editingId, setEditingId] = useState(null);

  const loadReports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('issue_reports')
        .select(`
          id,
          category,
          subject,
          description,
          status,
          admin_note,
          reporter_id,
          reporter_role,
          created_at,
          updated_at,
          resolved_at,
          reporter:profiles!issue_reports_reporter_id_fkey(full_name, email)
        `)
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
  }, []);

  const updateReport = async (report) => {
    try {
      setSavingId(report.id);
      const trimmedNote = String(report.admin_note || '').trim();
      const nextStatus = report.status || 'open';
      const payload = {
        status: nextStatus,
        admin_note: trimmedNote || null,
        updated_at: new Date().toISOString(),
        resolved_at: isCompletedStatus(nextStatus) ? new Date().toISOString() : null
      };
      const { error } = await supabase.from('issue_reports').update(payload).eq('id', report.id);
      if (error) throw error;
      if (isCompletedStatus(nextStatus) && report.reporter_id) {
        await sendAdminNotification({
          target_user_id: report.reporter_id,
          target_role: report.reporter_role || 'student',
          title: 'Your report has been resolved',
          content: `Admin resolved your report: ${report.subject}${trimmedNote ? `\n\nAdmin response: ${trimmedNote}` : ''}`,
          type: 'issue_report_resolved',
        });
      }
      setEditingId(null);
      setActiveTab(isCompletedStatus(nextStatus) ? 'completed' : 'pending');
      openPopup('Saved', 'Issue report updated.', 'success');
      await loadReports();
    } catch (error) {
      openPopup('Error', error.message || 'Failed to update issue report.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <LoadingSpinner message="Loading issue reports..." />;

  const pendingReports = reports.filter((report) => !isCompletedStatus(report.status));
  const completedReports = reports.filter((report) => isCompletedStatus(report.status));
  const visibleReports = activeTab === 'pending' ? pendingReports : completedReports;

  return (
    <div className="space-y-6">
      {popupNode}
      <div className="bg-gradient-to-r from-slate-900 to-slate-700 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3">
          <ShieldAlert size={24} />
          <div>
            <h1 className="text-2xl font-bold">Issue Reports</h1>
            <p className="text-slate-200">Review and resolve problems reported by students and teachers.</p>
          </div>
        </div>
      </div>

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

      <div className="space-y-4">
        {visibleReports.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-slate-500">
            {activeTab === 'pending' ? 'No pending issue reports.' : 'No completed issue reports.'}
          </div>
        ) : visibleReports.map((report) => (
          <div key={report.id} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-bold text-slate-900">{report.subject}</p>
                <p className="text-sm text-slate-500">
                  {report.reporter?.full_name || 'Unknown User'} ({report.reporter_role}) {report.reporter?.email ? `• ${report.reporter.email}` : ''}
                </p>
                <p className="text-xs uppercase tracking-wide text-slate-500 mt-1">{report.category}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isCompletedStatus(report.status) ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                {isCompletedStatus(report.status) ? 'completed' : 'pending'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{report.description}</p>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className="block text-sm font-semibold text-slate-700">Admin Response</label>
                <button
                  type="button"
                  onClick={() => setEditingId(editingId === report.id ? null : report.id)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                >
                  <Pencil size={15} />
                  Edit
                </button>
              </div>
              {editingId === report.id ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                    <select
                      value={report.status || 'open'}
                      onChange={(e) => {
                        const nextStatus = e.target.value;
                        setReports((prev) => prev.map((row) => row.id === report.id ? { ...row, status: nextStatus } : row));
                      }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Admin Note (Optional)</label>
                    <textarea
                      value={report.admin_note || ''}
                      onChange={(e) => {
                        const nextNote = e.target.value;
                        setReports((prev) => prev.map((row) => row.id === report.id ? { ...row, admin_note: nextNote } : row));
                      }}
                      rows={4}
                      className="w-full border border-slate-300 rounded-lg px-3 py-3"
                      placeholder="Add response if needed."
                    />
                  </div>
                </div>
              ) : (
                <div className="min-h-24 border border-slate-200 rounded-lg px-3 py-3 bg-slate-50 text-sm text-slate-700 whitespace-pre-wrap">
                  {report.admin_note || 'No admin response yet.'}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Submitted: {new Date(report.created_at).toLocaleString()}</p>
              {editingId === report.id ? (
                <button
                  type="button"
                  disabled={savingId === report.id}
                  onClick={() => updateReport(report)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
                >
                  <CheckCircle2 size={16} />
                  {savingId === report.id ? 'Saving...' : 'Save'}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminIssueReports;
