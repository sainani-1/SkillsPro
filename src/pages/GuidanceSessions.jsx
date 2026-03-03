import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import AlertModal from '../components/AlertModal';
import { Calendar, MessageSquare, Plus, AlertCircle, CheckCircle, Clock, Link as LinkIcon, Trash2 } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import useDialog from '../hooks/useDialog.jsx';

const GuidanceSessions = () => {
  const { confirm, dialogNode } = useDialog();
  const { profile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [mentorStudentQuery, setMentorStudentQuery] = useState('');
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionDateTime, setSessionDateTime] = useState('');
  const [sessionMeetLink, setSessionMeetLink] = useState('');
  const [sessionLinkActiveUntil, setSessionLinkActiveUntil] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (profile.role === 'student') {
        // Fetch student's guidance requests
        const { data: reqs, error: reqError } = await supabase
          .from('guidance_requests')
          .select('*')
          .eq('student_id', profile.id)
          .order('created_at', { ascending: false });
        
        if (reqError) {
          console.error('Error fetching student requests:', reqError);
          setAlertModal({
            show: true,
            title: 'Error',
            message: 'Error loading your requests: ' + reqError.message,
            type: 'error'
          });
        }
        
        setRequests(reqs || []);

        // Resolve assigned teacher IDs to readable names for student view.
        const assignedTeacherIds = Array.from(
          new Set((reqs || []).map((r) => r.assigned_to_teacher_id).filter(Boolean))
        );
        // Fetch sessions for this student's requests
        let fetchedSessions = [];
        if (reqs && reqs.length > 0) {
          const { data: sess, error: sessError } = await supabase
            .from('guidance_sessions')
            .select('*')
            .in('request_id', reqs.map(r => r.id))
            .order('scheduled_for', { ascending: false });
          
          if (sessError) console.error('Error fetching sessions:', sessError);
          fetchedSessions = sess || [];
          setSessions(fetchedSessions);
        } else {
          setSessions([]);
        }

        const sessionTeacherIds = fetchedSessions.map((s) => s.teacher_id).filter(Boolean);
        const allTeacherIds = Array.from(new Set([...assignedTeacherIds, ...sessionTeacherIds]));

        if (allTeacherIds.length > 0) {
          const { data: assignedTeachers, error: teacherErr } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', allTeacherIds);
          if (teacherErr) {
            console.error('Error fetching assigned teachers:', teacherErr);
            setTeachers([]);
          } else {
            setTeachers(assignedTeachers || []);
          }
        } else {
          setTeachers([]);
        }
      } else if (profile.role === 'admin' || profile.role === 'teacher') {
        // For teachers: fetch only requests assigned to them
        // For admins: fetch all requests
        let query = supabase.from('guidance_requests').select('*');
        
        if (profile.role === 'teacher') {
          query = query.eq('assigned_to_teacher_id', profile.id);
        }
        
        const { data: reqs, error: reqError } = await query.order('created_at', { ascending: false });
        
        if (reqError) {
          console.error('Error fetching requests:', reqError);
          setAlertModal({
            show: true,
            title: 'Error',
            message: 'Error loading requests: ' + reqError.message,
            type: 'error'
          });
        }
        
        setRequests(reqs || []);

        // Fetch all sessions
        const { data: sess, error: sessError } = await supabase
          .from('guidance_sessions')
          .select('*')
          .order('scheduled_for', { ascending: false });
        
        if (sessError) console.error('Error fetching sessions:', sessError);
        setSessions(sess || []);

        // Fetch available teachers for assignment (admin only)
        if (profile.role === 'admin') {
          const { data: tchs, error: tchError } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('role', 'teacher');
          
          if (tchError) console.error('Error fetching teachers:', tchError);
          setTeachers(tchs || []);

          // Fetch all students
          const { data: stds, error: stdError } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('role', 'student');
          
          if (stdError) console.error('Error fetching students:', stdError);
          setStudents(stds || []);

          // Fetch mentor assignments
          const { data: mentorData, error: mentorError } = await supabase
            .from('teacher_assignments')
            .select('*')
            .eq('active', true);
          
          if (mentorError) console.error('Error fetching mentors:', mentorError);
          setMentors(mentorData || []);
        }
      }
    } catch (error) {
      console.error('Error loading guidance data:', error);
      setAlertModal({
        show: true,
        title: 'Error',
        message: 'Error: ' + error.message,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return <LoadingSpinner message="Loading guidance sessions..." />;
  }

  if (loading) {
    return <LoadingSpinner message="Loading guidance sessions..." />;
  }

  const isSessionCompleted = (session) => {
    if (!session) return false;
    if (session.status === 'completed') return true;
    if (session.link_active_until) return new Date(session.link_active_until).getTime() < Date.now();
    if (!session.scheduled_for) return false;
    return new Date(session.scheduled_for).getTime() < Date.now();
  };

  const submitRequest = async () => {
    if (!topic.trim()) {
      setAlertModal({
        show: true,
        title: 'Missing Topic',
        message: 'Please enter a topic for your mentorship request',
        type: 'warning'
      });
      return;
    }
    try {
      const { data, error } = await supabase.from('guidance_requests').insert({
        student_id: profile.id,
        topic,
        notes,
        status: 'pending'
      });
      
      if (error) {
        console.error('Submit error:', error);
        setAlertModal({
          show: true,
          title: 'Submission Error',
          message: 'Error submitting request: ' + error.message,
          type: 'error'
        });
        return;
      }
      
      setTopic('');
      setNotes('');
      await loadData();
      setAlertModal({
        show: true,
        title: 'Success',
        message: 'Request submitted! Admin will assign a teacher soon.',
        type: 'success'
      });
    } catch (err) {
      console.error('Submit error:', err);
      setAlertModal({
        show: true,
        title: 'Error',
        message: 'Error submitting request: ' + (err.message || 'Unknown error'),
        type: 'error'
      });
    }
  };

  const assignTeacher = async () => {
    if (!selectedRequest || !selectedTeacher) {
      setAlertModal({
        show: true,
        title: 'Missing Selection',
        message: 'Please select a request and a teacher',
        type: 'warning'
      });
      return;
    }
    try {
      const { error } = await supabase.from('guidance_requests').update({
        assigned_to_teacher_id: selectedTeacher,
        status: 'assigned',
        assigned_at: new Date().toISOString()
      }).eq('id', selectedRequest.id);
      
      if (error) {
        console.error('Assign teacher error:', error);
        setAlertModal({
          show: true,
          title: 'Error',
          message: 'Error assigning teacher: ' + error.message,
          type: 'error'
        });
        return;
      }
      
      setShowAssignModal(false);
      setSelectedTeacher(null);
      setSelectedRequest(null);
      await loadData();
      setAlertModal({
        show: true,
        title: 'Success',
        message: 'Teacher assigned successfully!',
        type: 'success'
      });
    } catch (err) {
      console.error('Assign teacher error:', err);
      setAlertModal({
        show: true,
        title: 'Error',
        message: 'Error assigning teacher: ' + (err.message || 'Unknown error'),
        type: 'error'
      });
    }
  };

  const openSessionModal = (req) => {
    setSelectedRequest(req);
    setSessionDateTime('');
    setSessionMeetLink('');
    setSessionLinkActiveUntil('');
    setShowSessionModal(true);
  };

  const deleteSession = async (sessionId) => {
    const ok = await confirm('Are you sure you want to delete this scheduled session? This action cannot be undone.', 'Delete Session');
    if (!ok) {
      return;
    }

    try {
      // Get the session to find related request
      const { data: sessionData } = await supabase
        .from('guidance_sessions')
        .select('request_id')
        .eq('id', sessionId)
        .single();

      // Delete the session
      const { error: deleteError } = await supabase
        .from('guidance_sessions')
        .delete()
        .eq('id', sessionId);

      if (deleteError) {
        console.error('Delete session error:', deleteError);
        setAlertModal({
          show: true,
          title: 'Error',
          message: 'Error deleting session: ' + deleteError.message,
          type: 'error'
        });
        return;
      }

      // Update the related request status back to 'assigned' if exists
      if (sessionData?.request_id) {
        await supabase
          .from('guidance_requests')
          .update({ status: 'assigned' })
          .eq('id', sessionData.request_id);
      }

      await loadData();
      setAlertModal({
        show: true,
        title: 'Success',
        message: 'Session deleted successfully',
        type: 'success'
      });
    } catch (err) {
      console.error('Delete session error:', err);
      setAlertModal({
        show: true,
        title: 'Error',
        message: 'Error deleting session: ' + (err.message || 'Unknown error'),
        type: 'error'
      });
    }
  };

  const assignMentor = async () => {
    if (!selectedStudent || !selectedMentor) {
      setAlertModal({
        show: true,
        title: 'Missing Selection',
        message: 'Please select a student and a mentor',
        type: 'warning'
      });
      return;
    }
    try {
      const { error } = await supabase.from('teacher_assignments').insert({
        teacher_id: selectedMentor,
        student_id: selectedStudent,
        assigned_by: profile.id,
        assigned_at: new Date().toISOString(),
        active: true
      });
      
      if (error) {
        console.error('Assign mentor error:', error);
        setAlertModal({
          show: true,
          title: 'Error',
          message: 'Error assigning mentor: ' + error.message,
          type: 'error'
        });
        return;
      }
      
      setShowMentorModal(false);
      setSelectedStudent(null);
      setMentorStudentQuery('');
      setSelectedMentor(null);
      await loadData();
      setAlertModal({
        show: true,
        title: 'Success',
        message: 'Mentor assigned successfully!',
        type: 'success'
      });
    } catch (err) {
      console.error('Assign mentor error:', err);
      setAlertModal({
        show: true,
        title: 'Error',
        message: 'Error assigning mentor: ' + (err.message || 'Unknown error'),
        type: 'error'
      });
    }
  };

  return (
    <div className="space-y-6">
      {dialogNode}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Career Mentorship Sessions</h1>
        <p className="text-slate-500">Request and schedule one-on-one mentorship</p>
      </div>

      {/* STUDENT VIEW */}
      {profile.role === 'student' && (
        <>
          {/* Request Form */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold mb-4">Request Mentorship Session</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-2">Topic</label>
                <input 
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g., Career path in web development"
                  className="w-full border border-slate-200 rounded-lg p-3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Notes (optional)</label>
                <textarea 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Additional details..."
                  className="w-full border border-slate-200 rounded-lg p-3"
                  rows={3}
                />
              </div>
              <button 
                onClick={submitRequest}
                className="bg-nani-dark text-white px-6 py-2 rounded-lg hover:bg-nani-accent transition-colors"
              >
                Submit Request
              </button>
            </div>
          </div>

          {/* Request History */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold mb-4">Your Requests</h2>
            {requests.length === 0 ? (
              <p className="text-slate-500 text-sm">No requests yet</p>
            ) : (
              <div className="space-y-3">
                {requests.map(req => (
                  <div key={req.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-slate-900">{req.topic}</h3>
                        <p className="text-xs text-slate-500">
                          {new Date(req.created_at).toLocaleDateString()} • Status: <span className="font-medium">{req.status}</span>
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        req.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                        req.status === 'scheduled' ? 'bg-purple-100 text-purple-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                    {req.notes && <p className="text-sm text-slate-600 mb-2">{req.notes}</p>}
                    
                    {/* Show assigned teacher */}
                    {req.assigned_to_teacher_id && (
                      <div className="bg-blue-50 rounded-lg p-3 mt-2">
                        <p className="text-sm text-slate-600">
                          <strong>Assigned Teacher:</strong>{' '}
                          {(() => {
                            const assignedTeacher = teachers.find((t) => t.id === req.assigned_to_teacher_id);
                            return assignedTeacher?.full_name || req.assigned_to_teacher_id;
                          })()}
                        </p>
                        {(() => {
                          const assignedTeacher = teachers.find((t) => t.id === req.assigned_to_teacher_id);
                          return assignedTeacher?.email ? (
                            <p className="text-xs text-slate-500 mt-1">Email: {assignedTeacher.email}</p>
                          ) : null;
                        })()}
                        <p className="text-xs text-slate-500 mt-1">Teacher will schedule the session with you</p>
                      </div>
                    )}
                    {req.status === 'pending' && (
                      <div className="bg-yellow-50 rounded-lg p-3 mt-2">
                        <p className="text-xs text-yellow-700">
                          ⏳ Waiting for admin to assign a teacher...
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scheduled Sessions */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold mb-4">Your Scheduled Sessions</h2>
            {sessions.length === 0 ? (
              <p className="text-slate-500 text-sm">No sessions scheduled yet</p>
            ) : (
              <div className="space-y-3">
                {sessions.map(sess => {
                  const completed = isSessionCompleted(sess);
                  const teacher = teachers.find((t) => t.id === sess.teacher_id);
                  return (
                    <div key={sess.id} className="border border-slate-200 rounded-lg p-4 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <Calendar className="text-nani-dark flex-shrink-0 mt-1" size={20} />
                        <div>
                          <p className="font-semibold text-slate-900">Mentorship Session</p>
                          <p className="text-sm text-slate-600">{teacher?.full_name || sess.teacher_id || 'Teacher'}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(sess.scheduled_for).toLocaleString()}
                          </p>
                          {sess.link_active_until && (
                            <p className="text-xs text-slate-500 mt-1">
                              Link active until: {new Date(sess.link_active_until).toLocaleString()}
                            </p>
                          )}
                          <span className={`inline-block mt-2 px-2.5 py-1 rounded-full text-xs font-medium ${
                            completed ? 'bg-slate-100 text-slate-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {completed ? 'Completed' : 'Upcoming'}
                          </span>
                        </div>
                      </div>
                      {completed ? (
                        <span className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm flex items-center gap-2 flex-shrink-0 cursor-not-allowed">
                          Session Completed
                        </span>
                      ) : (
                        <a
                          href={sess.join_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-nani-dark text-white px-4 py-2 rounded-lg text-sm hover:bg-nani-accent transition-colors flex items-center gap-2 flex-shrink-0"
                        >
                          <LinkIcon size={16} /> Join
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* TEACHER VIEW - Only assigned requests */}
      {profile.role === 'teacher' && (
        <>
          {/* Teacher's Assigned Requests */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold mb-4">Your Assigned Guidance Requests ({requests.length})</h2>
            {requests.length === 0 ? (
              <p className="text-slate-500 text-sm">No guidance requests assigned to you yet</p>
            ) : (
              <div className="space-y-3">
                {requests.map(req => (
                  <div key={req.id} className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">{req.topic}</h3>
                        <p className="text-sm text-slate-600 mt-2 font-mono">
                          <strong>Student UUID:</strong> {req.student_id}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                          <strong>Notes:</strong> {req.notes || 'No additional notes'}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                          📅 Requested: {new Date(req.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-2 ${
                        req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        req.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                        req.status === 'scheduled' ? 'bg-purple-100 text-purple-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                    {req.status === 'assigned' && (
                      <button
                        onClick={() => openSessionModal(req)}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 transition-colors mt-3 w-full"
                      >
                        📅 Schedule Session
                      </button>
                    )}
                    {req.status === 'scheduled' && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                        <p className="text-xs text-green-700">✅ Session scheduled - waiting for student to join</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Teacher's Scheduled Sessions with Join Links */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold mb-4">Your Scheduled Sessions ({sessions.filter(s => s.teacher_id === profile.id).length})</h2>
            {sessions.filter(s => s.teacher_id === profile.id).length === 0 ? (
              <p className="text-slate-500 text-sm">No sessions scheduled yet</p>
            ) : (
              <div className="space-y-3">
                {sessions.filter(s => s.teacher_id === profile.id).map(sess => {
                  const relatedRequest = requests.find(r => r.id === sess.request_id);
                  const completed = isSessionCompleted(sess);
                  return (
                    <div key={sess.id} className="border border-purple-200 bg-purple-50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">{relatedRequest?.topic || 'Guidance Session'}</h3>
                          <p className="text-sm text-slate-600 mt-1 font-mono">
                            <strong>Student UUID:</strong> {relatedRequest?.student_id}
                          </p>
                          <p className="text-sm text-slate-600 mt-1">
                            📅 <strong>Scheduled:</strong> {new Date(sess.scheduled_for).toLocaleString()}
                          </p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {sess.status}
                        </span>
                      </div>
                      {!completed && (
                        <>
                          <div className="bg-white border border-purple-200 rounded-lg p-3 mt-3">
                            <p className="text-xs text-slate-600 mb-2"><strong>Meeting Link:</strong></p>
                            <a 
                              href={sess.join_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline break-all"
                            >
                              {sess.join_link}
                            </a>
                          </div>
                          <a
                            href={sess.join_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2 w-full"
                          >
                            🎥 Join Meeting
                          </a>
                        </>
                      )}
                      {completed && (
                        <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 mt-3 text-sm text-slate-700">
                          Session completed. Join link is hidden.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </>
      )}

      {/* ADMIN VIEW */}
      {profile.role === 'admin' && (
        <>
          {/* Pending Requests */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold mb-4">Pending Guidance Requests ({requests.filter(r => r.status === 'pending').length})</h2>
            {requests.filter(r => r.status === 'pending').length === 0 ? (
              <p className="text-slate-500 text-sm">No pending requests</p>
            ) : (
              <div className="space-y-3">
                {requests.filter(r => r.status === 'pending').map(req => (
                  <div key={req.id} className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-slate-900">{req.topic}</h3>
                        <p className="text-sm text-slate-600">
                          <strong>Student ID:</strong> {req.student_id}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(req.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>
                    </div>
                    {req.notes && <p className="text-sm text-slate-600 mb-3 italic">{req.notes}</p>}
                    <button 
                      onClick={() => {
                        setSelectedRequest(req);
                        setShowAssignModal(true);
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                    >
                      Assign Teacher
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assigned Requests (Admin) */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold mb-4">Assigned Guidance Requests ({requests.filter(r => r.status === 'assigned').length})</h2>
            {requests.filter(r => r.status === 'assigned').length === 0 ? (
              <p className="text-slate-500 text-sm">No assigned requests</p>
            ) : (
              <div className="space-y-3">
                {requests.filter(r => r.status === 'assigned').map(req => {
                  const assignedTeacher = teachers.find(t => t.id === req.assigned_to_teacher_id);
                  return (
                    <div key={req.id} className="border border-green-200 bg-green-50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">{req.topic}</h3>
                          <p className="text-sm text-slate-600 mt-1">
                            <strong>Student ID:</strong> {req.student_id}
                          </p>
                          <p className="text-sm text-slate-600 mt-1">
                            <strong>Assigned to:</strong> {assignedTeacher?.full_name || req.assigned_to_teacher_id || 'Unknown'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Assigned: {req.assigned_at ? new Date(req.assigned_at).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Assigned</span>
                      </div>
                      <button 
                        onClick={() => openSessionModal(req)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors"
                      >
                        Schedule Session
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scheduled Sessions */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-lg font-bold mb-4">Scheduled Sessions</h2>
            {sessions.length === 0 ? (
              <p className="text-slate-500 text-sm">No sessions scheduled yet</p>
            ) : (
              <div className="space-y-3">
                {sessions.map(sess => {
                  const relatedRequest = requests.find(r => r.id === sess.request_id);
                  const completed = isSessionCompleted(sess);
                  const teacher = teachers.find((t) => t.id === sess.teacher_id);
                  return (
                    <div key={sess.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <Calendar className="text-nani-dark flex-shrink-0 mt-1" size={20} />
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">{relatedRequest?.topic || 'Guidance Session'}</p>
                            <p className="text-sm text-slate-600 mt-1">
                              <strong>Teacher:</strong> {teacher?.full_name || sess.teacher_id}
                            </p>
                            <p className="text-sm text-slate-600 mt-1">
                              <strong>Student ID:</strong> {relatedRequest?.student_id || 'N/A'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              📅 {new Date(sess.scheduled_for).toLocaleString()}
                            </p>
                            {!completed && (
                              <a 
                                href={sess.join_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline break-all mt-2 inline-block"
                              >
                                {sess.join_link}
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          {completed ? (
                            <span className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm text-center cursor-not-allowed">
                              Completed
                            </span>
                          ) : (
                            <a 
                              href={sess.join_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-nani-dark text-white px-4 py-2 rounded-lg text-sm hover:bg-nani-accent transition-colors text-center"
                            >
                              Join Link
                            </a>
                          )}
                          <button
                            onClick={() => deleteSession(sess.id)}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                          >
                            <Trash2 size={16} /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mentor Assignment Section */}
          <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Student Mentors ({mentors.length})</h2>
              <button
                onClick={() => setShowMentorModal(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <Plus size={16} /> Assign Mentor
              </button>
            </div>
            
            {mentors.length === 0 ? (
              <p className="text-slate-500 text-sm">No mentor assignments yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs">Student UUID</th>
                      <th className="px-4 py-2 text-left">Mentor</th>
                      <th className="px-4 py-2 text-left">Assigned On</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {mentors.map(assignment => {
                      const mentor = teachers.find(t => t.id === assignment.teacher_id);
                      return (
                        <tr key={assignment.id}>
                          <td className="px-4 py-3 font-mono text-xs">{assignment.student_id}</td>
                          <td className="px-4 py-3">{mentor?.full_name || assignment.teacher_id}</td>
                          <td className="px-4 py-3">{new Date(assignment.assigned_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {assignment.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={async () => {
                                const { error } = await supabase.from('teacher_assignments')
                                  .update({ active: false })
                                  .eq('id', assignment.id);
                                if (!error) {
                                  await loadData();
                                  setAlertModal({
                                    show: true,
                                    title: 'Mentor updated',
                                    message: 'Mentor assignment deactivated.',
                                    type: 'success'
                                  });
                                }
                              }}
                              className="text-red-600 hover:text-red-700 text-xs hover:underline"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Teacher Assignment Modal */}\n          {showAssignModal && selectedRequest && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-bold mb-4">Assign Teacher</h3>
                <p className="text-sm text-slate-600 mb-2">
                  <strong>Topic:</strong> {selectedRequest.topic}
                </p>
                <p className="text-sm text-slate-600 mb-4">
                  <strong>Student ID:</strong> {selectedRequest.student_id}
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Select Teacher</label>
                  <select 
                    value={selectedTeacher || ''}
                    onChange={e => setSelectedTeacher(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2"
                  >
                    <option value="">-- Choose a teacher --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={assignTeacher}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Assign
                  </button>
                  <button 
                    onClick={() => {
                      setShowAssignModal(false);
                      setSelectedRequest(null);
                      setSelectedTeacher(null);
                    }}
                    className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mentor Assignment Modal */}
          {showMentorModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-bold mb-4">Assign Mentor to Student</h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Select Student</label>
                  <input
                    type="text"
                    value={mentorStudentQuery}
                    onChange={(e) => {
                      setMentorStudentQuery(e.target.value);
                      setSelectedStudent(null);
                    }}
                    placeholder="Search student by name..."
                    className="w-full border border-slate-200 rounded-lg p-2"
                  />
                  {mentorStudentQuery.trim().length > 0 && !selectedStudent && (
                    <div className="mt-2 border rounded-lg max-h-44 overflow-auto">
                      {students
                        .filter(
                          (s) =>
                            (s.full_name || '').toLowerCase().includes(mentorStudentQuery.trim().toLowerCase()) ||
                            (s.email || '').toLowerCase().includes(mentorStudentQuery.trim().toLowerCase())
                        )
                        .slice(0, 10)
                        .map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedStudent(s.id);
                              setMentorStudentQuery(`${s.full_name}${s.email ? ` (${s.email})` : ''}`);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b last:border-b-0"
                          >
                            <p className="text-sm font-medium text-slate-800">{s.full_name}</p>
                            {s.email && <p className="text-xs text-slate-500">{s.email}</p>}
                          </button>
                        ))}
                    </div>
                  )}
                  {selectedStudent && (
                    <p className="mt-2 text-xs text-emerald-700">
                      Selected: {students.find((s) => s.id === selectedStudent)?.full_name || selectedStudent}
                    </p>
                  )}
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Select Mentor (Teacher)</label>
                  <select 
                    value={selectedMentor || ''}
                    onChange={e => setSelectedMentor(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2"
                  >
                    <option value="">-- Choose a mentor --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={assignMentor}
                    className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Assign Mentor
                  </button>
                  <button 
                    onClick={() => {
                      setShowMentorModal(false);
                      setSelectedStudent(null);
                      setMentorStudentQuery('');
                      setSelectedMentor(null);
                    }}
                    className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {showSessionModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Schedule Guidance Session</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-900 mb-1">Request Topic</p>
                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded">{selectedRequest.topic}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 mb-1">Student UUID</p>
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded font-mono break-all">{selectedRequest.student_id}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Date & Time for Session</label>
                <input
                  type="datetime-local"
                  value={sessionDateTime}
                  onChange={e => setSessionDateTime(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Meeting Link</label>
                <input
                  type="url"
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  value={sessionMeetLink}
                  onChange={e => setSessionMeetLink(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
                <p className="text-xs text-slate-500 mt-1">Provide your Google Meet, Zoom, or other meeting link</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Link Active Upto</label>
                <input
                  type="datetime-local"
                  value={sessionLinkActiveUntil}
                  onChange={e => setSessionLinkActiveUntil(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Optional. If not provided, link will stay active for 1 hour from session start.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={async () => {
                  if (!sessionDateTime) {
                    setAlertModal({
                      show: true,
                      title: 'Missing Information',
                      message: 'Please select date and time',
                      type: 'warning'
                    });
                    return;
                  }
                  if (!sessionMeetLink || !sessionMeetLink.startsWith('http')) {
                    setAlertModal({
                      show: true,
                      title: 'Invalid Meeting Link',
                      message: 'Please provide a valid meeting link (must start with http:// or https://)',
                      type: 'warning'
                    });
                    return;
                  }
                  const scheduledAt = new Date(sessionDateTime);
                  if (Number.isNaN(scheduledAt.getTime())) {
                    setAlertModal({
                      show: true,
                      title: 'Invalid Date',
                      message: 'Please provide a valid session date and time.',
                      type: 'warning'
                    });
                    return;
                  }
                  let linkActiveUntilIso = new Date(scheduledAt.getTime() + (60 * 60 * 1000)).toISOString();
                  if (sessionLinkActiveUntil) {
                    const linkActiveUntilDate = new Date(sessionLinkActiveUntil);
                    if (Number.isNaN(linkActiveUntilDate.getTime())) {
                      setAlertModal({
                        show: true,
                        title: 'Invalid Time',
                        message: 'Please provide a valid link active upto time.',
                        type: 'warning'
                      });
                      return;
                    }
                    if (linkActiveUntilDate.getTime() <= scheduledAt.getTime()) {
                      setAlertModal({
                        show: true,
                        title: 'Invalid Time',
                        message: 'Link active upto time should be after session start.',
                        type: 'warning'
                      });
                      return;
                    }
                    linkActiveUntilIso = linkActiveUntilDate.toISOString();
                  }
                  const teacherId = profile.role === 'admin'
                    ? selectedRequest.assigned_to_teacher_id
                    : profile.id;
                  if (!teacherId) {
                    setAlertModal({
                      show: true,
                      title: 'Missing Teacher',
                      message: 'No teacher is assigned to this request yet.',
                      type: 'warning'
                    });
                    return;
                  }

                  setScheduling(true);
                  const { error: sessionError } = await supabase.from('guidance_sessions').insert({
                    request_id: selectedRequest.id,
                    teacher_id: teacherId,
                    scheduled_for: new Date(sessionDateTime).toISOString(),
                    join_link: sessionMeetLink,
                    link_active_until: linkActiveUntilIso,
                    status: 'scheduled'
                  });
                  if (sessionError) {
                    console.error('Session error:', sessionError);
                    setAlertModal({
                      show: true,
                      title: 'Error',
                      message: 'Error: ' + sessionError.message,
                      type: 'error'
                    });
                    setScheduling(false);
                    return;
                  }
                  const { error: updateError } = await supabase.from('guidance_requests').update({
                    status: 'scheduled'
                  }).eq('id', selectedRequest.id);
                  if (updateError) {
                    console.error('Update error:', updateError);
                    setAlertModal({
                      show: true,
                      title: 'Update failed',
                      message: 'Error: ' + updateError.message,
                      type: 'error'
                    });
                    setScheduling(false);
                    return;
                  }
                  setShowSessionModal(false);
                  setSelectedRequest(null);
                  setSessionLinkActiveUntil('');
                  setScheduling(false);
                  await loadData();
                  setAlertModal({
                    show: true,
                    title: 'Session scheduled',
                    message: `Join link active until ${new Date(linkActiveUntilIso).toLocaleString()}`,
                    type: 'success'
                  });
                }}
                disabled={scheduling}
                className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-60"
              >
                {scheduling ? 'Scheduling...' : 'Schedule'}
              </button>
              <button
                onClick={() => {
                  setShowSessionModal(false);
                  setSelectedRequest(null);
                  setSessionLinkActiveUntil('');
                  setScheduling(false);
                }}
                className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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

export default GuidanceSessions;
