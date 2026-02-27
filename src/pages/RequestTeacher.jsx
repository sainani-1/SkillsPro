import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import AlertModal from '../components/AlertModal';

const RequestTeacher = () => {
  const { user, profile } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });

  useEffect(() => {
    fetchTeachers();
    fetchMyRequests();
  }, []);

  const fetchTeachers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, education_level, study_stream')
        .eq('role', 'teacher')
        .order('full_name');
      
      if (error) throw error;
      setTeachers(data || []);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('teacher_assignment_requests')
        .select(`
          id,
          teacher_id,
          message,
          status,
          created_at
        `)
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      console.log('My requests raw data:', data);
      
      // Fetch teacher profiles separately  
      if (data && data.length > 0) {
        const teacherIds = data.map(r => r.teacher_id).filter(Boolean);
        if (teacherIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', teacherIds);
          
          // Merge profiles with requests
          const enrichedRequests = data.map(req => ({
            ...req,
            profiles: req.teacher_id ? profiles?.find(p => p.id === req.teacher_id) : null
          }));
          setMyRequests(enrichedRequests);
        } else {
          setMyRequests(data);
        }
      } else {
        setMyRequests([]);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const sendRequest = async (teacherId) => {
    if (sendingRequest) return;
    
    // Check if already has a teacher assigned
    if (profile?.assigned_teacher_id) {
      setAlertModal({
        show: true,
        title: 'Already Assigned',
        message: 'You already have a teacher assigned. Contact admin if you need to change.',
        type: 'info'
      });
      return;
    }

    // Check if already sent request to this teacher (if teacher specified)
    if (teacherId) {
      const existingRequest = myRequests.find(
        r => r.teacher_id === teacherId && r.status === 'pending'
      );
      if (existingRequest) {
        setAlertModal({
          show: true,
          title: 'Request Pending',
          message: 'You already have a pending request to this teacher.',
          type: 'info'
        });
        return;
      }
    }

    setSendingRequest(true);
    try {
      const { error } = await supabase
        .from('teacher_assignment_requests')
        .insert([{
          student_id: user.id,
          teacher_id: teacherId || null,
          message: teacherId 
            ? `Hi, I would like to request you as my teacher.`
            : `I would like to be assigned a teacher. Please assign a suitable teacher for me.`,
          status: 'pending'
        }]);
      
      if (error) throw error;
      
      setAlertModal({
        show: true,
        title: 'Success',
        message: teacherId 
          ? 'Request sent successfully! The teacher will be notified.'
          : 'Request sent to admin successfully! You will be assigned a teacher soon.',
        type: 'success'
      });
      
      fetchMyRequests();
    } catch (error) {
      setAlertModal({
        show: true,
        title: 'Error',
        message: error.message,
        type: 'error'
      });
    } finally {
      setSendingRequest(false);
    }
  };

  const getRequestStatus = (teacherId) => {
    const request = myRequests.find(r => r.teacher_id === teacherId);
    return request?.status || null;
  };

  if (loading) {
    return <LoadingSpinner message="Loading teachers..." />;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Request Teacher Assignment</h1>
        <p className="text-slate-600">
          Browse available teachers and send a request, or let admin assign one for you.
        </p>
      </div>

      {profile?.assigned_teacher_id && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800 font-medium">
            ✓ You already have a teacher assigned. Contact admin if you need to change.
          </p>
        </div>
      )}

      {!profile?.assigned_teacher_id && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-blue-800 font-medium mb-1">Can't decide?</p>
            <p className="text-blue-600 text-sm">Let the admin assign a suitable teacher for you.</p>
          </div>
          <button
            onClick={() => sendRequest(null)}
            disabled={sendingRequest || myRequests.some(r => r.status === 'pending' && !r.teacher_id)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            Request Admin Assignment
          </button>
        </div>
      )}

      {/* My Requests */}
      {myRequests.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">My Requests</h2>
          <div className="space-y-3">
            {myRequests.map((request) => (
              <div key={request.id} className="bg-white border rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={request.profiles?.avatar_url || 'https://via.placeholder.com/50'}
                    alt={request.profiles?.full_name || 'Admin Assignment'}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold">
                      {request.profiles?.full_name || 'Admin Assignment Request'}
                    </p>
                    <p className="text-sm text-slate-500">
                      Sent {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div>
                  {request.status === 'pending' && (
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                      Pending
                    </span>
                  )}
                  {request.status === 'accepted' && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      Accepted
                    </span>
                  )}
                  {request.status === 'admin_assigned' && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      Assigned by Admin
                    </span>
                  )}
                  {request.status === 'rejected' && (
                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                      Rejected by {request.profiles?.full_name || 'Teacher'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Teachers */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-4">Available Teachers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teachers.map((teacher) => {
            const status = getRequestStatus(teacher.id);
            return (
              <div key={teacher.id} className="bg-white border rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-4 mb-4">
                  <img
                    src={teacher.avatar_url || 'https://via.placeholder.com/80'}
                    alt={teacher.full_name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="font-bold text-lg">{teacher.full_name}</h3>
                    <p className="text-sm text-slate-500">{teacher.email}</p>
                  </div>
                </div>
                
                {teacher.education_level && (
                  <div className="mb-4">
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">Specialization:</span> {teacher.education_level}
                    </p>
                    {teacher.study_stream && (
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">Stream:</span> {teacher.study_stream}
                      </p>
                    )}
                  </div>
                )}
                
                {status ? (
                  <div className="text-center">
                    {status === 'pending' && (
                      <span className="text-yellow-600 font-medium">Request Pending</span>
                    )}
                    {status === 'accepted' && (
                      <span className="text-green-600 font-medium">✓ Assigned</span>
                    )}
                    {status === 'rejected' && (
                      <span className="text-red-600 font-medium">Rejected by {teacher.full_name}</span>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => sendRequest(teacher.id)}
                    disabled={sendingRequest || profile?.assigned_teacher_id}
                    className="w-full btn-primary py-2 disabled:opacity-50"
                  >
                    Send Request
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {teachers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">No teachers available at the moment.</p>
          </div>
        )}
      </div>

      <AlertModal
        show={alertModal.show}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ show: false, title: '', message: '', type: 'info' })}
      />
    </div>
  );
};

export default RequestTeacher;
