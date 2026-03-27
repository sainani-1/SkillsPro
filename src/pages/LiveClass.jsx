import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Video, Users, Mic, MicOff, VideoOff, PhoneOff, Settings, Monitor, Star } from 'lucide-react';
import usePopup from '../hooks/usePopup.jsx';
import LoadingSpinner from '../components/LoadingSpinner';
import useDialog from '../hooks/useDialog.jsx';
import LiveKitClassSession from '../components/LiveKitClassSession';
import { getLiveKitTokenForClassSession } from '../lib/livekitSession';

const LiveClass = () => {
  const { sessionId } = useParams();
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const meetingWindowRef = useRef(null);
  const meetingWindowPollRef = useRef(null);
  const suppressNextLeaveRef = useRef(false);
  const { openPopup, popupNode } = usePopup();
  const { confirm, dialogNode } = useDialog();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [meetingStarted, setMeetingStarted] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [liveKitConnection, setLiveKitConnection] = useState(null);
  const [joiningMeeting, setJoiningMeeting] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const isTeacherOwner = profile?.role === 'teacher' && session?.teacher_id === profile?.id;
  const canJoinStartedMeeting = profile?.role === 'student' || profile?.role === 'admin' || isTeacherOwner;
  const sessionStartTime = session ? new Date(session.scheduled_for) : null;
  const isSessionStartReached = sessionStartTime ? new Date() >= sessionStartTime : false;
  const getJitsiRoomName = (sessionRow) => `SkillPro_Session_${sessionRow.id}_${sessionRow.title?.replace(/\s+/g, '_') || 'Class'}`;
  const getJitsiRoomUrl = (sessionRow) => `https://meet.jit.si/${encodeURIComponent(getJitsiRoomName(sessionRow))}`;
  const getMeetingProviderLabel = (sessionRow) => sessionRow?.meeting_type === 'livekit' ? 'LiveKit' : 'SkillPro Live';
  const getAssignedBreakoutRoomId = (sessionRow) => {
    const breakout = sessionRow?.livekit_controls?.breakout;
    if (!breakout?.active) return '';
    if (profile?.role === 'teacher' || profile?.role === 'admin') {
      return breakout.teacher_room_id || '';
    }
    const rooms = Array.isArray(breakout.rooms) ? breakout.rooms : [];
    const matched = rooms.find((room) => Array.isArray(room?.participant_user_ids) && room.participant_user_ids.includes(profile?.id));
    return matched?.id || '';
  };
  const getReturnRoute = () => {
    if (profile?.role === 'student') return '/app/class-schedule';
    if (profile?.role === 'teacher') return '/app/attendance';
    return '/app';
  };

  const getSessionEndTime = (sessionRow) => {
    if (sessionRow?.ends_at) return new Date(sessionRow.ends_at);
    const start = new Date(sessionRow.scheduled_for);
    return new Date(start.getTime() + 60 * 60 * 1000);
  };

  const clearMeetingWindowWatcher = () => {
    if (meetingWindowPollRef.current) {
      clearInterval(meetingWindowPollRef.current);
      meetingWindowPollRef.current = null;
    }
  };

  const redirectBackToApp = () => {
    clearMeetingWindowWatcher();
    navigate(getReturnRoute());
  };

  const cleanupMeetingState = () => {
    clearMeetingWindowWatcher();

    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
    }

    if (meetingWindowRef.current && !meetingWindowRef.current.closed) {
      meetingWindowRef.current.close();
      meetingWindowRef.current = null;
    }

    setLiveKitConnection(null);
    setMeetingStarted(false);
  };

  const openFeedbackPrompt = () => {
    if (profile?.role !== 'student' || feedbackSubmitted) {
      redirectBackToApp();
      return;
    }
    setFeedbackOpen(true);
  };

  const handleLeaveClassroom = () => {
    cleanupMeetingState();
    openFeedbackPrompt();
  };

  const submitFeedbackAndExit = async (skip = false) => {
    if (profile?.role !== 'student') {
      redirectBackToApp();
      return;
    }

    if (!skip && !feedbackRating) {
      openPopup('Feedback required', 'Please select a rating before submitting feedback.', 'warning');
      return;
    }

    if (skip) {
      setFeedbackOpen(false);
      redirectBackToApp();
      return;
    }

    setFeedbackSubmitting(true);
    try {
      const { error } = await supabase.from('class_session_feedback').upsert(
        {
          session_id: Number(sessionId),
          student_id: profile.id,
          rating: feedbackRating,
          feedback_text: feedbackText.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,student_id' },
      );

      if (error) throw error;

      setFeedbackSubmitted(true);
      setFeedbackOpen(false);
      redirectBackToApp();
    } catch (error) {
      openPopup('Feedback failed', error.message || 'Could not submit class feedback.', 'error');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const openJitsiMeetingWindow = (roomUrl) => {
    clearMeetingWindowWatcher();

    const openedWindow = window.open(roomUrl, '_blank', 'noopener,noreferrer');

    if (!openedWindow) {
      openPopup(
        'Popup Blocked',
        'SkillPro Live could not open in a new tab. Please allow popups for this site and try again.',
        'warning'
      );
      return false;
    }

    meetingWindowRef.current = openedWindow;
    setMeetingStarted(true);

    meetingWindowPollRef.current = setInterval(() => {
      if (meetingWindowRef.current?.closed) {
        meetingWindowRef.current = null;
        clearMeetingWindowWatcher();
        redirectBackToApp();
      }
    }, 1000);

    return true;
  };

  useEffect(() => {
    if (authLoading) return;
    if (profile) {
      loadSession();
    } else {
      setLoading(false);
    }
  }, [sessionId, profile, authLoading]);

  useEffect(() => {
    if (!profile || meetingStarted || !['jitsi', 'livekit'].includes(session?.meeting_type || '')) {
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

  useEffect(() => {
    if (!sessionId) return undefined;

    const channel = supabase
      .channel(`class-session-live-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'class_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          if (!payload?.new) return;
          setSession(payload.new);
          if (payload.new.status === 'ended') {
            setSessionEnded(true);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!meetingStarted || session?.meeting_type !== 'livekit' || !profile?.id) return;

    let active = true;
    const refreshRoomToken = async () => {
      try {
        const breakoutRoomId = getAssignedBreakoutRoomId(session);
        const tokenData = await getLiveKitTokenForClassSession({
          sessionId,
          requesterId: profile.id,
          breakoutRoomId,
        });
        if (!active) return;
        setLiveKitConnection((current) => {
          const isRoomSwitch =
            Boolean(current?.roomName) &&
            current.roomName !== tokenData.roomName;
          if (isRoomSwitch) {
            suppressNextLeaveRef.current = true;
          }
          if (
            current?.token === tokenData.token &&
            current?.serverUrl === tokenData.url &&
            current?.roomName === tokenData.roomName
          ) {
            return current;
          }
          return {
            token: tokenData.token,
            serverUrl: tokenData.url,
            roomName: tokenData.roomName,
          };
        });
      } catch (error) {
        if (!active) return;
        openPopup('Class control', error.message || 'Could not switch LiveKit room.', 'warning');
      }
    };

    refreshRoomToken();
    return () => {
      active = false;
    };
  }, [meetingStarted, session?.meeting_type, session?.livekit_controls, sessionId, profile?.id]);

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
    if (!session) {
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

    setJoiningMeeting(true);

    if (isTeacherOwner) {
      const { error } = await supabase
        .from('class_sessions')
        .update({ status: 'live' })
        .eq('id', sessionId);

      if (error) {
        openPopup('Start failed', 'Unable to start the class right now. Please try again.', 'error');
        setJoiningMeeting(false);
        return;
      }

      setSession((prev) => (prev ? { ...prev, status: 'live' } : prev));
    } else if (session.status !== 'live') {
      openPopup('Please Wait', 'Only the teacher can start this SkillPro Live class. You can join after the teacher starts it.', 'info');
      setJoiningMeeting(false);
      return;
    }

    const opened = openJitsiMeetingWindow(getJitsiRoomUrl(session));
    if (!opened) {
      setJoiningMeeting(false);
      return;
    }
    setJoiningMeeting(false);
  };

  const startLiveKitMeeting = async () => {
    if (!session || !profile?.id) {
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

    setJoiningMeeting(true);

    if (isTeacherOwner) {
      const { error } = await supabase
        .from('class_sessions')
        .update({ status: 'live' })
        .eq('id', sessionId);

      if (error) {
        openPopup('Start failed', 'Unable to start the class right now. Please try again.', 'error');
        setJoiningMeeting(false);
        return;
      }

      setSession((prev) => (prev ? { ...prev, status: 'live' } : prev));
    } else if (session.status !== 'live') {
      openPopup('Please Wait', 'Only the teacher can start this LiveKit class. You can join after the teacher starts it.', 'info');
      setJoiningMeeting(false);
      return;
    }

    try {
      const tokenData = await getLiveKitTokenForClassSession({
        sessionId,
        requesterId: profile.id,
        breakoutRoomId: getAssignedBreakoutRoomId(session),
      });

      setLiveKitConnection({
        token: tokenData.token,
        serverUrl: tokenData.url,
        roomName: tokenData.roomName,
      });
      setMeetingStarted(true);
    } catch (error) {
      openPopup('Join failed', error.message || 'Failed to connect LiveKit room.', 'error');
    } finally {
      setJoiningMeeting(false);
    }
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

      // Dispose meeting state
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
      }

      if (meetingWindowRef.current && !meetingWindowRef.current.closed) {
        meetingWindowRef.current.close();
        meetingWindowRef.current = null;
      }

      setLiveKitConnection(null);

      setSessionEnded(true);
      
      // Redirect after 3 seconds
      setTimeout(() => {
        redirectBackToApp();
      }, 3000);
    } catch (error) {
      console.error('Error ending session:', error);
      openPopup('End failed', 'Failed to end session.', 'error');
    }
  };

  useEffect(() => {
    return () => {
      clearMeetingWindowWatcher();
      setLiveKitConnection(null);
    };
  }, []);

  useEffect(() => {
    if (!sessionEnded || profile?.role !== 'student' || feedbackOpen || feedbackSubmitted) return;
    cleanupMeetingState();
    setFeedbackOpen(true);
  }, [sessionEnded, profile?.role, feedbackOpen, feedbackSubmitted]);

  if (loading || authLoading) {
    return <LoadingSpinner message={authLoading ? "Loading profile..." : "Loading class session..."} />;
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
        {feedbackOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 text-white shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200">Class Feedback</p>
              <h3 className="mt-2 text-2xl font-bold">How was this session?</h3>
              <p className="mt-2 text-sm text-slate-300">Your feedback will appear in the teacher and admin feedback panel.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFeedbackRating(value)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      feedbackRating === value ? 'bg-amber-400 text-slate-950' : 'bg-white/8 text-white hover:bg-white/14'
                    }`}
                  >
                    <Star size={15} className={feedbackRating >= value ? 'fill-current' : ''} />
                    <span>{value}</span>
                  </button>
                ))}
              </div>
              <textarea
                value={feedbackText}
                onChange={(event) => setFeedbackText(event.target.value)}
                rows={4}
                placeholder="Tell us what went well and what should improve"
                className="mt-5 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => submitFeedbackAndExit(true)}
                  className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Skip
                </button>
                <button
                  type="button"
                  disabled={feedbackSubmitting}
                  onClick={() => submitFeedbackAndExit(false)}
                  className="rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
                >
                  {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
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
      {feedbackOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 text-white shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200">Class Feedback</p>
            <h3 className="mt-2 text-2xl font-bold">How was this session?</h3>
            <p className="mt-2 text-sm text-slate-300">Your feedback will appear in the teacher and admin feedback panel.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFeedbackRating(value)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    feedbackRating === value ? 'bg-amber-400 text-slate-950' : 'bg-white/8 text-white hover:bg-white/14'
                  }`}
                >
                  <Star size={15} className={feedbackRating >= value ? 'fill-current' : ''} />
                  <span>{value}</span>
                </button>
              ))}
            </div>
            <textarea
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              rows={4}
              placeholder="Tell us what went well and what should improve"
              className="mt-5 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => submitFeedbackAndExit(true)}
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Skip
              </button>
              <button
                type="button"
                disabled={feedbackSubmitting}
                onClick={() => submitFeedbackAndExit(false)}
                className="rounded-2xl bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
              >
                {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
        {!meetingStarted && ['jitsi', 'livekit'].includes(session.meeting_type) && (
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
                      ? `Start the ${getMeetingProviderLabel(session)} meeting for ${session.title}. Students can join once you start it.`
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
                    onClick={session.meeting_type === 'livekit' ? startLiveKitMeeting : startJitsiMeeting}
                    disabled={!isSessionStartReached || joiningMeeting}
                    className={`px-8 py-4 rounded-xl text-lg font-semibold transition shadow-lg ${
                      isSessionStartReached && !joiningMeeting
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-900/30'
                        : 'bg-slate-700 text-slate-300 cursor-not-allowed shadow-none'
                    }`}
                  >
                    {joiningMeeting ? 'Joining...' : isSessionStartReached ? 'Start Class Now' : 'Available at Scheduled Time'}
                  </button>
                </>
              ) : session.status === 'live' && canJoinStartedMeeting ? (
                <>
                  <h2 className="text-white text-2xl font-bold mb-4">Ready to Join?</h2>
                  <p className="text-slate-400 mb-8">
                    The teacher has started this live class. You can join now.
                  </p>
                  <button
                    onClick={session.meeting_type === 'livekit' ? startLiveKitMeeting : startJitsiMeeting}
                    disabled={joiningMeeting}
                    className={`px-8 py-4 rounded-xl text-lg font-semibold transition shadow-lg ${
                      joiningMeeting ? 'bg-slate-700 text-slate-300 cursor-not-allowed shadow-none' : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {joiningMeeting ? 'Joining...' : 'Join Class Now'}
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-white text-2xl font-bold mb-4">Waiting for Teacher</h2>
                  <p className="text-slate-400 mb-3">
                    Only the teacher can start this {getMeetingProviderLabel(session)} meeting.
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
                Your class is now running on the full SkillPro Live meeting page, so it should not hit that 5-minute embedded-session cutoff.
              </p>
              <p className="mb-8 text-slate-400">
                If the meeting did not open, use the button below to go to the SkillPro Live room directly.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <button
                  onClick={() => openJitsiMeetingWindow(getJitsiRoomUrl(session))}
                  className="rounded-2xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
                >
                  Open SkillPro Live
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

        {meetingStarted && session.meeting_type === 'livekit' && liveKitConnection && (
          <LiveKitClassSession
            key={liveKitConnection.roomName || 'main-room'}
            token={liveKitConnection.token}
            serverUrl={liveKitConnection.serverUrl}
            sessionId={sessionId}
            currentRole={profile?.role}
            currentUserProfile={profile}
            classSession={session}
            onToast={(message) => openPopup('Class control', message, 'info')}
            onLeave={() => {
              if (suppressNextLeaveRef.current) {
                suppressNextLeaveRef.current = false;
                return;
              }
              handleLeaveClassroom();
            }}
          />
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
          Powered by {getMeetingProviderLabel(session)}
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
            onClick={handleLeaveClassroom}
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
