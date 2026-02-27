import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { Calendar, User, ArrowRight, AlertCircle } from 'lucide-react';

export default function SessionReassignments() {
  const { profile } = useAuth();
  const [reassignments, setReassignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('current'); // current, history

  useEffect(() => {
    if (profile?.id) {
      loadReassignments();
    }
  }, [profile?.id]);

  const loadReassignments = async () => {
    try {
      setLoading(true);
      setError('');

      // Get reassignments where this teacher was the original teacher OR reassigned_to teacher
      let query = supabase
        .from('session_reassignments')
        .select(`
          id,
          session_id,
          original_teacher_id,
          reassigned_to_teacher_id,
          leave_id,
          reason,
          reassigned_at,
          reverted_at,
          class_session:session_id(id, title, scheduled_for, join_link),
          original_teacher:original_teacher_id(id, full_name),
          reassigned_teacher:reassigned_to_teacher_id(id, full_name),
          leave:leave_id(id, start_date, end_date, status)
        `);

      // Filter by current or reverted
      if (filter === 'current') {
        query = query.is('reverted_at', null);
      } else {
        query = query.not('reverted_at', 'is', null);
      }

      const { data, error: fetchError } = await query.order('reassigned_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      // Filter to only show relevant reassignments
      const filtered = data?.filter(r => 
        r.original_teacher_id === profile.id || r.reassigned_to_teacher_id === profile.id
      ) || [];

      setReassignments(filtered);
    } catch (err) {
      console.error('Error loading reassignments:', err);
      setError('Failed to load session reassignments');
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  const isTeacher = profile.role === 'teacher';

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Session Reassignments</h1>
        <p className="text-slate-500 mt-1">
          {isTeacher 
            ? 'View your classes during leave and classes reassigned to you' 
            : 'Track all session reassignments'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('current')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'current'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Active Reassignments
        </button>
        <button
          onClick={() => setFilter('history')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'history'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Reverted / History
        </button>
      </div>

      {/* Reassignments List */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading reassignments...</div>
      ) : reassignments.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-8 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">
            {filter === 'current'
              ? 'No active session reassignments'
              : 'No historical reassignments'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reassignments.map(reassignment => {
            const isMyOriginalClass = reassignment.original_teacher_id === profile.id;
            const isReassignedToMe = reassignment.reassigned_to_teacher_id === profile.id;

            return (
              <div
                key={reassignment.id}
                className="bg-white rounded-xl border shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      {reassignment.class_session?.title || 'Class Session'}
                    </h3>
                    <p className="text-sm text-slate-600 flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4" />
                      {new Date(reassignment.class_session?.scheduled_for).toLocaleDateString('en-IN')} at{' '}
                      {new Date(reassignment.class_session?.scheduled_for).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                      reassignment.reverted_at
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {reassignment.reverted_at ? 'Reverted' : 'Active'}
                  </span>
                </div>

                {/* Teacher Reassignment Info */}
                <div className="bg-slate-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-600 mb-1">Original Teacher</p>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-600" />
                        <p className="font-medium text-slate-900">
                          {reassignment.original_teacher?.full_name}
                        </p>
                        {isMyOriginalClass && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            You
                          </span>
                        )}
                      </div>
                    </div>

                    <ArrowRight className="w-5 h-5 text-slate-400" />

                    <div className="text-right">
                      <p className="text-xs text-slate-600 mb-1">Reassigned To</p>
                      <div className="flex items-center gap-2 justify-end">
                        <p className="font-medium text-slate-900">
                          {reassignment.reassigned_teacher?.full_name}
                        </p>
                        {isReassignedToMe && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Leave Info */}
                {reassignment.leave && (
                  <div className="mb-4 border-l-4 border-amber-400 pl-4">
                    <p className="text-sm text-slate-700 mb-1">
                      <strong>Leave Period:</strong> {new Date(reassignment.leave.start_date).toLocaleDateString('en-IN')} to{' '}
                      {new Date(reassignment.leave.end_date).toLocaleDateString('en-IN')}
                    </p>
                    {reassignment.reason && (
                      <p className="text-sm text-slate-600">
                        <strong>Reason:</strong> {reassignment.reason}
                      </p>
                    )}
                  </div>
                )}

                {/* Join Link */}
                {reassignment.class_session?.join_link && (
                  <div className="mb-4">
                    <a
                      href={reassignment.class_session.join_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Join Class Link →
                    </a>
                  </div>
                )}

                {/* Timestamp Info */}
                <div className="pt-4 border-t border-slate-200 text-xs text-slate-500">
                  <p>Reassigned: {new Date(reassignment.reassigned_at).toLocaleString('en-IN')}</p>
                  {reassignment.reverted_at && (
                    <p>Reverted: {new Date(reassignment.reverted_at).toLocaleString('en-IN')}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
