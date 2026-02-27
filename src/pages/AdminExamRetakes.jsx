import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Unlock, Clock, CheckCircle, XCircle, Search, RefreshCw } from 'lucide-react';
import usePopup from '../hooks/usePopup.jsx';
import LoadingSpinner from '../components/LoadingSpinner';

/**
 * AdminExamRetakes Component
 * ===========================
 * Admin interface to manage locked students and grant exam retake permissions
 * 
 * Features:
 * - View all locked students
 * - See which course they failed and when they get unlocked
 * - Grant immediate retake permission
 * - Clear override permission
 * - Search students by name or email
 */
const AdminExamRetakes = () => {
  const { popupNode, openPopup } = usePopup();
  const [lockedStudents, setLockedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [grantingId, setGrantingId] = useState(null);

  const loadLockedStudents = async () => {
    try {
      setLoading(true);
      
      // Get all students with failed exams that still have cooldown periods
      // OR students who are currently locked
      const { data: submissions, error: submissionsError } = await supabase
        .from('exam_submissions')
        .select(`
          id,
          user_id,
          exam_id,
          passed,
          submitted_at,
          next_attempt_allowed_at,
          exam:exams(
            id,
            course_id,
            course:courses(id, title)
          ),
          user:profiles(
            id,
            full_name,
            email,
            is_locked,
            locked_until
          )
        `)
        .eq('passed', false);

      if (submissionsError) {
        openPopup('Error', 'Failed to load exam data', 'error');
        setLockedStudents([]);
        return;
      }

      // Group by student and filter those with active cooldowns
      const studentMap = new Map();
      const now = new Date();

      (submissions || []).forEach(submission => {
        if (!submission.user) return;
        
        const userId = submission.user.id;
        const nextAttemptDate = submission.next_attempt_allowed_at 
          ? new Date(submission.next_attempt_allowed_at)
          : null;
        
        // Only include if they have an active cooldown OR are currently locked
        const hasActiveCooldown = nextAttemptDate && nextAttemptDate > now;
        const isCurrentlyLocked = submission.user.is_locked;
        
        if (hasActiveCooldown || isCurrentlyLocked) {
          if (!studentMap.has(userId)) {
            studentMap.set(userId, {
              id: submission.user.id,
              full_name: submission.user.full_name,
              email: submission.user.email,
              is_locked: submission.user.is_locked,
              locked_until: submission.user.locked_until,
              failedExams: [],
              overridesMap: {}
            });
          }
          
          const student = studentMap.get(userId);
          student.failedExams.push({
            id: submission.id,
            exam_id: submission.exam_id,
            submitted_at: submission.submitted_at,
            next_attempt_allowed_at: submission.next_attempt_allowed_at,
            exam: submission.exam
          });
        }
      });

      // Get overrides for all students
      const studentIds = Array.from(studentMap.keys());
      if (studentIds.length > 0) {
        const { data: overridesData } = await supabase
          .from('exam_retake_overrides')
          .select('user_id, course_id, allow_retake_at')
          .in('user_id', studentIds);

        if (overridesData) {
          overridesData.forEach(override => {
            const student = studentMap.get(override.user_id);
            if (student) {
              const key = `${override.user_id}_${override.course_id}`;
              student.overridesMap[key] = override.allow_retake_at;
            }
          });
        }
      }

      setLockedStudents(Array.from(studentMap.values()));
    } catch (error) {
      console.error('Error loading locked students:', error);
      openPopup('Error', 'Error loading exam cooldown data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLockedStudents();
  }, []);

  const grantRetakePermission = async (userId, courseId) => {
    try {
      setGrantingId(`${userId}_${courseId}`);
      
      // First, delete any existing override for this student-course combo
      await supabase
        .from('exam_retake_overrides')
        .delete()
        .eq('user_id', userId)
        .eq('course_id', courseId);

      // Then insert new override to allow immediate retake
      const { error } = await supabase
        .from('exam_retake_overrides')
        .insert({
          user_id: userId,
          course_id: courseId,
          allow_retake_at: new Date().toISOString()
        });

      if (error) throw error;

      openPopup('Permission Granted', 'Student can now retake the exam immediately!', 'success');
      loadLockedStudents(); // Refresh list
    } catch (error) {
      console.error('Error granting permission:', error);
      openPopup('Error', `Failed to grant permission: ${error.message}`, 'error');
    } finally {
      setGrantingId(null);
    }
  };

  const revokeRetakePermission = async (userId, courseId) => {
    try {
      setGrantingId(`${userId}_${courseId}`);
      
      // Delete override
      const { error } = await supabase
        .from('exam_retake_overrides')
        .delete()
        .eq('user_id', userId)
        .eq('course_id', courseId);

      if (error) throw error;

      openPopup('Permission Revoked', 'Retake override has been removed', 'success');
      loadLockedStudents(); // Refresh list
    } catch (error) {
      console.error('Error revoking permission:', error);
      openPopup('Error', 'Failed to revoke permission', 'error');
    } finally {
      setGrantingId(null);
    }
  };

  const filteredStudents = lockedStudents.filter(student =>
    student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDaysRemaining = (lockedUntil) => {
    const days = Math.ceil((new Date(lockedUntil) - new Date()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const hasOverride = (student, courseId) => {
    const key = `${student.id}_${courseId}`;
    return student.overridesMap[key];
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {popupNode}
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Exam Cooldown Management</h1>
          <p className="text-slate-500 mt-1">Manage students waiting to retake failed exams and grant immediate access</p>
        </div>
        <button
          onClick={loadLockedStudents}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg transition-colors"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Locked Students List - Table View */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
          <h2 className="text-xl font-bold text-slate-900">No Students with Exam Cooldowns</h2>
          <p className="text-slate-500 mt-2">All students are currently able to take exams</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 bg-slate-100 p-4 font-semibold text-slate-700 border-b border-slate-200">
            <div className="col-span-3">Student Name</div>
            <div className="col-span-3">Course Name</div>
            <div className="col-span-2">Days Remaining</div>
            <div className="col-span-2">Action</div>
            <div className="col-span-2">Status</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-slate-200">
            {filteredStudents.map((student) =>
              student.failedExams.map((submission, idx) => {
                const courseTitle = submission.exam?.course?.title || `Course ${submission.exam?.course_id}`;
                const courseId = submission.exam?.course_id;
                const overrideExists = hasOverride(student, courseId);
                const nextAttemptDate = submission.next_attempt_allowed_at
                  ? new Date(submission.next_attempt_allowed_at)
                  : null;
                const daysRemaining = nextAttemptDate
                  ? Math.ceil((nextAttemptDate - new Date()) / (1000 * 60 * 60 * 24))
                  : 0;
                const hasActiveCooldown = nextAttemptDate && new Date() < nextAttemptDate;

                return (
                  <div
                    key={`${student.id}_${idx}`}
                    className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50 transition-colors"
                  >
                    {/* Student Name */}
                    <div className="col-span-3">
                      <p className="font-semibold text-slate-900">{student.full_name}</p>
                      <p className="text-xs text-slate-500">{student.email}</p>
                    </div>

                    {/* Course Name */}
                    <div className="col-span-3">
                      <p className="font-semibold text-slate-900">{courseTitle}</p>
                      <p className="text-xs text-slate-500">
                        Failed on {new Date(submission.submitted_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Days Remaining */}
                    <div className="col-span-2">
                      {hasActiveCooldown ? (
                        <p className="text-sm font-bold text-red-600">
                          {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
                        </p>
                      ) : (
                        <p className="text-sm text-green-600 font-semibold">Can retry now</p>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="col-span-2">
                      {overrideExists ? (
                        <button
                          onClick={() => revokeRetakePermission(student.id, courseId)}
                          disabled={grantingId === `${student.id}_${courseId}`}
                          className="w-full bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                          {grantingId === `${student.id}_${courseId}` ? 'Processing...' : 'Revoke'}
                        </button>
                      ) : (
                        <button
                          onClick={() => grantRetakePermission(student.id, courseId)}
                          disabled={grantingId === `${student.id}_${courseId}`}
                          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                          <Unlock size={14} />
                          {grantingId === `${student.id}_${courseId}` ? 'Granting...' : 'Release'}
                        </button>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className="col-span-2 text-center">
                      {overrideExists ? (
                        <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-semibold">
                          ✓ Released
                        </span>
                      ) : hasActiveCooldown ? (
                        <span className="bg-red-100 text-red-700 text-xs px-3 py-1 rounded-full font-semibold">
                          ⏱️ Cooldown
                        </span>
                      ) : (
                        <span className="bg-yellow-100 text-yellow-700 text-xs px-3 py-1 rounded-full font-semibold">
                          Ready
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Statistics */}
      {lockedStudents.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-slate-600">Total Locked Students</p>
            <p className="text-3xl font-bold text-red-600">{lockedStudents.length}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-slate-600">Failed Exam Attempts</p>
            <p className="text-3xl font-bold text-blue-600">
              {lockedStudents.reduce((acc, s) => acc + (s.failedExams?.length || 0), 0)}
            </p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-slate-600">With Override Permission</p>
            <p className="text-3xl font-bold text-yellow-600">
              {lockedStudents.reduce((acc, s) => acc + Object.keys(s.overridesMap).length, 0)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminExamRetakes;
