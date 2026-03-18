import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Video, Users, Mic, MicOff, VideoOff, PhoneOff, Settings, Monitor } from 'lucide-react';
import usePopup from '../hooks/usePopup.jsx';
import LoadingSpinner from '../components/LoadingSpinner';
import useDialog from '../hooks/useDialog.jsx';

const LiveClass = () => {
  const { sessionId } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const { openPopup, popupNode } = usePopup();
  const { confirm, dialogNode } = useDialog();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [meetingStarted, setMeetingStarted] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const isTeacherOwner = profile?.role === 'teacher' && session?.teacher_id === profile?.id;
  const canJoinStartedMeeting = profile?.role === 'student' || profile?.role === 'admin' || isTeacherOwner;
  const sessionStartTime = session ? new Date(session.scheduled_for) : null;
  const isSessionStartReached = sessionStartTime ? new Date() >= sessionStartTime : false;
  const getJitsiRoomName = (sessionRow) => `SkillPro_Session_${sessionRow.id}_${sessionRow.title?.replace(/\s+/g, '_') || 'Class'}`;
  const getJitsiRoomUrl = (sessionRow) => `https://meet.jit.si/${encodeURIComponent(getJitsiRoomName(sessionRow))}`;

  const getSessionEndTime = (sessionRow) => {
    if (sessionRow?.ends_at) return new Date(sessionRow.ends_at);
    const start = new Date(sessionRow.scheduled_for);
    return new Date(start.getTime() + 60 * 60 * 1000);
  };

  useEffect(() => {
    console.log('LiveClass component mounted');
    console.log('Session ID from params:', sessionId);
    console.log('Profile:', profile);
    
    if (profile) {
      loadSession();
    }
  }, [sessionId, profile]);

  useEffect(() => {
    if (!profile || meetingStarted || session?.meeting_type !== 'jitsi') {
      return undefined;
    }

    if (isTeacherOwner || session?.status === 'live' || session?.status === 'ended') {
      return undefined;
    }

    const interval = setInterval(() => {
      loadSession({ silent: true });
    }, 5000);

    return () => clearInterval(interval);
  }, [profile, meetingStarted, session?.meeting_type, session?.status, isTeacherOwner]);

  const loadSession = async ({ silent = false } = {}) => {
    console.log('loadSession called');
    
    if (!profile) {
      console.error('No profile found');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('class_sessions')
        .select('*, class_session_participants(student_id)')
        .eq('id', sessionId)
        .single();

      console.log('Session query result:', { data, error });

      if (error) throw error;

      // Check if user is allowed to join
      const isTeacher = profile.role === 'teacher' || profile.role === 'admin';
      const isParticipant = data.class_session_participants?.some(p => p.student_id === profile.id);
      const noParticipants = !data.class_session_participants || data.class_session_participants.length === 0;

      console.log('Permission check:', { isTeacher, isParticipant, noParticipants });

      if (!isTeacher && !isParticipant && !noParticipants) {
        openPopup('Access denied', 'You are not invited to this session.', 'error');
        navigate('/app');
        return;
      }

      // Students can join only at or after scheduled time.
      const isStudent = profile.role === 'student';
      const scheduledAt = new Date(data.scheduled_for);
      const endsAt = getSessionEndTime(data);
      if (isStudent && new Date() < scheduledAt) {
        openPopup(
          'Too Early',
          `You can join only at scheduled time: ${scheduledAt.toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
          })}`,
          'warning'
        );
        navigate('/app/class-schedule');
        return;
      }
      if (new Date() >= endsAt) {
        openPopup('Session Completed', 'This class session is over.', 'info');
        navigate('/app/class-schedule');
        return;
      }

      if (data.status === 'ended') {
        setSession(data);
        setSessionEnded(true);
        setLoading(false);
        return;
      }

      setSession(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading session:', error);
      if (!silent) {
        openPopup('Load failed', 'Failed to load class session.', 'error');
        navigate('/app');
      }
    }
  };

  const startJitsiMeeting = async () => {
    console.log('startJitsiMeeting called');
    console.log('Session:', session);
    
    if (!session) {
      console.error('Missing session');
      return;
    }

    if (profile?.role === 'student' && new Date() < new Date(session.scheduled_for)) {
      openPopup('Too Early', 'You can join this class only at scheduled time.', 'warning');
      return;
    }
    if (new Date() >= getSessionEndTime(session)) {
      openPopup('Session Completed', 'This class session is over.', 'info');
      return;
    }

    const meetingWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!meetingWindow) {
      openPopup('Popup Blocked', 'Please allow popups for this site so the Jitsi meeting can open in a new tab.', 'warning');
      return;
    }

    if (isTeacherOwner) {
      const { error } = await supabase
        .from('class_sessions')
        .update({ status: 'live' })
        .eq('id', sessionId);

      if (error) {
        meetingWindow.close();
        console.error('Error updating session live status:', error);
        openPopup('Start failed', 'Unable to start the class right now. Please try again.', 'error');
        return;
      }

      setSession((prev) => (prev ? { ...prev, status: 'live' } : prev));
    } else if (session.status !== 'live') {
      meetingWindow.close();
      openPopup('Please Wait', 'Only the teacher can start this Jitsi class. You can join after the teacher starts it.', 'info');
      return;
    }

    meetingWindow.location.href = getJitsiRoomUrl(session);
    setMeetingStarted(true);
  };

  const handleExternalLink = () => {
    if (profile?.role === 'student' && new Date() < new Date(session?.scheduled_for)) {
      openPopup('Too Early', 'You can open this link only at scheduled time.', 'warning');
      return;
    }
    if (new Date() >= getSessionEndTime(session)) {
      openPopup('Session Completed', 'This class session is over.', 'info');
      return;
    }
    if (session?.meeting_link) {
      window.open(session.meeting_link, '_blank');
    }
  };

  const endSession = async () => {
    const ok = await confirm('Are you sure you want to end this session for all participants?', 'End Session');
    if (!ok) {
      return;
    }

    try {
      // Mark session as ended by updating a status or deleting it
      const { error } = await supabase
        .from('class_sessions')
        .update({ status: 'ended' })
        .eq('id', sessionId);

      if (error) {
        console.error('Error ending session:', error);
      }

      // Dispose Jitsi meeting
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
      }

      setSessionEnded(true);
      
      // Redirect after 3 seconds
      setTimeout(() => {
        navigate('/app');
      }, 3000);
    } catch (error) {
      console.error('Error ending session:', error);
      openPopup('End failed', 'Failed to end session.', 'error');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading class session..." />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-center">
          <LoadingSpinner message="Loading profile..." fullPage={false} />
        </div>
      </div>
    );
  }

  if (sessionEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-center">
          <div className="bg-green-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <PhoneOff size={40} />
          </div>
          <h2 className="text-2xl font-bold mb-4">Session Ended</h2>
          <p className="text-slate-400">This session has been ended by the instructor.</p>
          <p className="text-slate-500 text-sm mt-2">Redirecting...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Session Not Found</h1>
          <button 
            onClick={() => navigate('/app')}
            className="bg-blue-600 px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col">
      {popupNode}
      {dialogNode}
      {/* Header */}
      <div className="bg-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-red-500 w-3 h-3 rounded-full animate-pulse"></div>
          <div>
            <h1 className="text-white font-bold text-lg">{session.title}</h1>
            <p className="text-slate-400 text-sm">
              {new Date(session.scheduled_for).toLocaleString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Asia/Kolkata'
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-700 px-4 py-2 rounded-lg">
            <Users className="text-green-400" size={20} />
            <span className="text-white text-sm font-semibold">Live</span>
          </div>
          {session.meeting_type === 'external' && session.meeting_link && (
            <button
              onClick={handleExternalLink}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
            >
              Open External Link
            </button>
          )}
        </div>
      </div>

      {/* Meeting Area */}
      <div className="flex-1 relative">
        {/* Ready to Join Screen */}
        {!meetingStarted && session.meeting_type === 'jitsi' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center max-w-xl px-6">
              <Video className="mx-auto mb-6 text-blue-400" size={80} />
              {isTeacherOwner ? (
                <>
                  <h2 className="text-white text-2xl font-bold mb-4">
                    {isSessionStartReached ? 'Start Live Class' : 'Class Not Started Yet'}
                  </h2>
                  <p className="text-slate-400 mb-3">
                    {isSessionStartReached
                      ? `Start the Jitsi meeting for ${session.title}. Students can join once you start it.`
                      : `You can start this class only at the scheduled time: ${sessionStartTime?.toLocaleString('en-IN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                          timeZone: 'Asia/Kolkata'
                        })}`}
                  </p>
                  {!isSessionStartReached && (
                    <p className="text-slate-500 mb-8">
                      The start button will be available once the class time begins.
                    </p>
                  )}
                  <button
                    onClick={startJitsiMeeting}
                    disabled={!isSessionStartReached}
                    className={`px-8 py-4 rounded-xl text-lg font-semibold transition shadow-lg ${
                      isSessionStartReached
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-900/30'
                        : 'bg-slate-700 text-slate-300 cursor-not-allowed shadow-none'
                    }`}
                  >
                    {isSessionStartReached ? 'Start Class Now' : 'Available at Scheduled Time'}
                  </button>
                </>
              ) : session.status === 'live' && canJoinStartedMeeting ? (
                <>
                  <h2 className="text-white text-2xl font-bold mb-4">Ready to Join?</h2>
                  <p className="text-slate-400 mb-8">
                    The teacher has started this live class. You can join now.
                  </p>
                  <button
                    onClick={startJitsiMeeting}
                    className="bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-700 transition shadow-lg"
                  >
                    Join Class Now
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-white text-2xl font-bold mb-4">Waiting for Teacher</h2>
                  <p className="text-slate-400 mb-3">
                    Only the teacher can start this Jitsi meeting.
                  </p>
                  <p className="text-slate-500 mb-8">
                    This page will refresh automatically and let you join once the class starts.
                  </p>
                  <button
                    onClick={() => loadSession()}
                    className="bg-slate-700 text-white px-6 py-3 rounded-xl text-base font-semibold hover:bg-slate-600 transition"
                  >
                    Refresh Status
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {meetingStarted && session.meeting_type === 'jitsi' && (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="max-w-2xl rounded-3xl border border-slate-700 bg-slate-800/95 p-10 text-center shadow-2xl">
              <Video className="mx-auto mb-6 text-blue-400" size={72} />
              <h2 className="mb-4 text-3xl font-bold text-white">Meeting Opened in New Tab</h2>
              <p className="mb-4 text-slate-300">
                Your class is now running on the full Jitsi page, not the demo embed, so it should not hit that 5-minute embedded-session cutoff.
              </p>
              <p className="mb-8 text-slate-400">
                If the tab did not open, use the button below to open the Jitsi room again.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <button
                  onClick={() => window.open(getJitsiRoomUrl(session), '_blank', 'noopener,noreferrer')}
                  className="rounded-2xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
                >
                  Open Jitsi Meeting
                </button>
                <a
                  href={getJitsiRoomUrl(session)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-slate-600 px-6 py-3 font-semibold text-slate-200 transition hover:bg-slate-700"
                >
                  Open in Browser
                </a>
              </div>
            </div>
          </div>
        )}
        
        {/* External Meeting Screen */}
        {session.meeting_type === 'external' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Monitor className="mx-auto mb-6 text-purple-400" size={80} />
              <h2 className="text-white text-2xl font-bold mb-4">External Meeting</h2>
              <p className="text-slate-400 mb-8">
                This class is hosted on an external platform
              </p>
              <button
                onClick={handleExternalLink}
                className="bg-purple-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-purple-700 transition shadow-lg"
              >
                Open Meeting Link
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-slate-800 px-6 py-3 flex items-center justify-between">
        <p className="text-slate-400 text-sm">
          Powered by Jitsi Meet
        </p>
        <div className="flex items-center gap-3">
          {(profile.role === 'teacher' || profile.role === 'admin') && meetingStarted && (
            <button
              onClick={endSession}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 transition"
            >
              <PhoneOff size={18} />
              <span>End Session for All</span>
            </button>
          )}
          <button
            onClick={() => {
              if (jitsiApiRef.current) {
                jitsiApiRef.current.dispose();
              }
              navigate('/app');
            }}
            className="text-red-400 hover:text-red-300 flex items-center gap-2"
          >
            <PhoneOff size={18} />
            <span>Leave Class</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveClass;
