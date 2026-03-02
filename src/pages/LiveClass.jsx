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

  const loadSession = async () => {
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

      setSession(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading session:', error);
      openPopup('Load failed', 'Failed to load class session.', 'error');
      navigate('/app');
    }
  };

  const startJitsiMeeting = () => {
    console.log('startJitsiMeeting called');
    console.log('Session:', session);
    console.log('jitsiContainerRef.current:', jitsiContainerRef.current);
    
    if (!session || !jitsiContainerRef.current) {
      console.error('Missing session or container ref');
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

    // Check if Jitsi script is loaded
    if (!window.JitsiMeetExternalAPI) {
      console.log('Loading Jitsi script...');
      // Load Jitsi script dynamically
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = () => {
        console.log('Jitsi script loaded successfully');
        initializeJitsi();
      };
      script.onerror = () => {
        console.error('Failed to load Jitsi script');
        openPopup('Connection issue', 'Failed to load Jitsi. Please check your internet connection.', 'error');
      };
      document.body.appendChild(script);
    } else {
      console.log('Jitsi API already loaded, initializing...');
      initializeJitsi();
    }
  };

  const initializeJitsi = () => {
    console.log('initializeJitsi called');
    const domain = 'meet.jit.si';
    const roomName = `SkillPro_Session_${session.id}_${session.title?.replace(/\s+/g, '_') || 'Class'}`;
    
    console.log('Room name:', roomName);
    console.log('Domain:', domain);
    
    try {
      const options = {
        roomName: roomName,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerRef.current,
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          enableWelcomePage: false,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DEFAULT_BACKGROUND: '#1e293b',
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
            'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
            'videoquality', 'filmstrip', 'stats', 'shortcuts',
            'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
          ],
        },
        userInfo: {
          displayName: profile?.full_name || 'Guest',
          email: profile?.email || ''
        }
      };

      console.log('Creating Jitsi API with options:', options);
      const api = new window.JitsiMeetExternalAPI(domain, options);
      jitsiApiRef.current = api;
      setMeetingStarted(true);
      console.log('Jitsi meeting started successfully');

      // Event listeners
      api.on('readyToClose', () => {
        console.log('Meeting ended by user');
        api.dispose();
        navigate('/app');
      });

      api.on('participantLeft', (data) => {
        console.log('Participant left:', data);
      });
    } catch (error) {
      console.error('Error initializing Jitsi:', error);
      openPopup('Meeting error', `Failed to start meeting: ${error.message}`, 'error');
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
        {/* Jitsi Container - always rendered but hidden when not started */}
        <div 
          ref={jitsiContainerRef} 
          className={`absolute inset-0 ${meetingStarted ? 'block' : 'hidden'}`}
        />
        
        {/* Ready to Join Screen */}
        {!meetingStarted && session.meeting_type === 'jitsi' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Video className="mx-auto mb-6 text-blue-400" size={80} />
              <h2 className="text-white text-2xl font-bold mb-4">Ready to Join?</h2>
              <p className="text-slate-400 mb-8">
                Join the live class: {session.title}
              </p>
              <button
                onClick={startJitsiMeeting}
                className="bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-700 transition shadow-lg"
              >
                Join Class Now
              </button>
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
