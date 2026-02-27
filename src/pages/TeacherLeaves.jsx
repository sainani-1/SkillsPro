import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Calendar, Check, X, AlertCircle, CheckCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const TeacherLeaves = () => {
  const { profile } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (profile?.id) {
      loadLeaves();
    }
  }, [profile?.id]);

  const loadLeaves = async () => {
    try {
      setError('');
      if (profile.role === 'teacher') {
        const { data, error: fetchError } = await supabase
          .from('teacher_leaves')
          .select('*')
          .eq('teacher_id', profile.id)
          .order('created_at', { ascending: false });
        
        if (fetchError) throw fetchError;
        setLeaves(data || []);
      } else if (profile.role === 'admin') {
        const { data, error: fetchError } = await supabase
          .from('teacher_leaves')
          .select('*, teacher:teacher_id(id, full_name, email)')
          .order('created_at', { ascending: false });
        
        if (fetchError) throw fetchError;
        setLeaves(data || []);
      }
    } catch (err) {
      console.error('Error loading leaves:', err);
      setError('Failed to load leave requests');
    }
  };

  const applyLeave = async () => {
    if (!startDate || !endDate || !reason.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before end date');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const { error: insertError } = await supabase
        .from('teacher_leaves')
        .insert({
          teacher_id: profile.id,
          start_date: startDate,
          end_date: endDate,
          reason
        });

      if (insertError) throw insertError;

      setStartDate('');
      setEndDate('');
      setReason('');
      setSuccess('Leave request submitted successfully!');
      setTimeout(() => setSuccess(''), 3000);
      await loadLeaves();
    } catch (err) {
      console.error('Error applying leave:', err);
      setError(err.message || 'Failed to submit leave request');
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async (leaveId, status, comments = '') => {
    try {
      setError('');
      const { error: updateError } = await supabase
        .from('teacher_leaves')
        .update({
          status,
          admin_comments: comments || null,
          decided_at: new Date().toISOString(),
          decided_by: profile.id
        })
        .eq('id', leaveId);

      if (updateError) throw updateError;
      await loadLeaves();
    } catch (err) {
      console.error('Error updating leave:', err);
      setError('Failed to update leave request');
    }
  };

  const revokeLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to revoke this leave?')) return;

    try {
      setError('');
      const { error: updateError } = await supabase
        .from('teacher_leaves')
        .update({
          status: 'revoked',
          decided_at: new Date().toISOString(),
          decided_by: profile.id
        })
        .eq('id', leaveId);

      if (updateError) throw updateError;
      await loadLeaves();
    } catch (err) {
      console.error('Error revoking leave:', err);
      setError('Failed to revoke leave');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Teacher Leave Management</h1>
        <p className="text-slate-500 mt-1">Apply for leave or manage leave requests</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

      {profile?.role === 'teacher' && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Apply for Leave
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
              <input 
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
              <input 
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Reason</label>
            <textarea 
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Explain the reason for your leave..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>
          <button 
            onClick={applyLeave}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
          >
            {loading ? 'Submitting...' : 'Submit Leave Request'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-600" />
          {profile?.role === 'admin' ? 'All Leave Requests' : 'My Leave Requests'}
        </h2>
        
        {leaves.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No leave requests yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaves.map(leave => (
              <div key={leave.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    {profile?.role === 'admin' && leave.teacher && (
                      <p className="font-semibold text-slate-900">{leave.teacher.full_name}</p>
                    )}
                    <p className="text-sm text-slate-600 flex items-center gap-2 mt-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(leave.start_date).toLocaleDateString('en-IN')} to {new Date(leave.end_date).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap ${
                    leave.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    leave.status === 'approved' ? 'bg-green-100 text-green-800' :
                    leave.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                  </span>
                </div>
                
                <p className="text-sm text-slate-700 mb-2"><strong>Reason:</strong> {leave.reason}</p>
                
                {leave.admin_comments && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3 text-sm">
                    <p className="font-medium text-blue-900">Admin Comments:</p>
                    <p className="text-blue-800">{leave.admin_comments}</p>
                  </div>
                )}

                {profile?.role === 'admin' && leave.status === 'pending' && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
                    <button 
                      onClick={() => {
                        const comments = window.prompt('Add comments (optional):');
                        if (comments !== null) {
                          handleLeave(leave.id, 'approved', comments);
                        }
                      }}
                      className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors"
                    >
                      <Check size={16} /> Approve
                    </button>
                    <button 
                      onClick={() => {
                        const comments = window.prompt('Reason for rejection:');
                        if (comments) {
                          handleLeave(leave.id, 'rejected', comments);
                        }
                      }}
                      className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors"
                    >
                      <X size={16} /> Reject
                    </button>
                  </div>
                )}

                {profile?.role === 'admin' && leave.status === 'approved' && (
                  <div className="pt-4 border-t border-slate-200">
                    <button 
                      onClick={() => revokeLeave(leave.id)}
                      className="bg-slate-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition-colors"
                    >
                      Revoke Leave
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherLeaves;
