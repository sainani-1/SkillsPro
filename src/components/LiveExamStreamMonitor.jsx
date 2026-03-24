import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  LIVE_EXAM_SIGNAL_TABLE,
  buildPeerKey,
  createLiveExamPeer,
  serializeIceCandidate,
  serializeSessionDescription,
} from '../lib/liveExamWebRTC';

function attachStream(element, stream, { muted = false } = {}) {
  if (!element) return;
  if (element.srcObject !== stream) {
    element.srcObject = stream;
  }
  element.muted = muted;
  const playPromise = element.play?.();
  if (playPromise?.catch) {
    playPromise.catch(() => {});
  }
}

export default function LiveExamStreamMonitor({
  slotId,
  session,
  viewerId,
  viewerRole,
  compact = false,
  showOnlyActive = true,
}) {
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Connecting live preview...');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const screenVideoRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const audioRef = useRef(null);
  const peersRef = useRef(new Map());
  const processedSignalIdsRef = useRef(new Set());
  const connectionIdRef = useRef(`monitor-${Math.random().toString(36).slice(2, 10)}`);
  const remoteStreamsRef = useRef({
    screen: new MediaStream(),
    camera: new MediaStream(),
  });

  const active = Boolean(session?.id && slotId && viewerId && (!showOnlyActive || session?.status === 'active'));
  const sessionId = session?.id || null;
  const studentId = session?.student_id || null;

  const streamCardClass = compact
    ? 'rounded-2xl border border-slate-800 bg-slate-950 p-2'
    : 'rounded-3xl border border-slate-200 bg-slate-950 p-3';

  useEffect(() => {
    attachStream(screenVideoRef.current, remoteStreamsRef.current.screen, { muted: true });
    attachStream(cameraVideoRef.current, remoteStreamsRef.current.camera, { muted: !audioEnabled });
    attachStream(audioRef.current, remoteStreamsRef.current.camera, { muted: !audioEnabled });
  }, [audioEnabled]);

  useEffect(() => {
    const closePeers = () => {
      peersRef.current.forEach((peer) => peer.close());
      peersRef.current.clear();
      remoteStreamsRef.current = {
        screen: new MediaStream(),
        camera: new MediaStream(),
      };
      if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
      if (audioRef.current) audioRef.current.srcObject = null;
    };

    if (!active || !studentId) {
      setStatus(session?.status === 'active' ? 'Waiting for live stream...' : 'Student is not live right now.');
      setError('');
      closePeers();
      return undefined;
    }

    let cancelled = false;
    processedSignalIdsRef.current = new Set();
    setError('');
    setStatus('Connecting live preview...');

    const sendSignal = async ({ signalType, streamType, payload }) => {
      const { error: signalError } = await supabase.from(LIVE_EXAM_SIGNAL_TABLE).insert({
        slot_id: slotId,
        session_id: sessionId,
        from_user_id: viewerId,
        from_role: viewerRole,
        to_user_id: studentId,
        signal_type: signalType,
        stream_type: streamType,
        payload: {
          ...payload,
          connectionId: connectionIdRef.current,
        },
      });
      if (signalError && !cancelled) {
        setError(signalError.message || 'Failed to send live-monitor signal.');
      }
    };

    const setRemoteStream = (streamType, incomingStream) => {
      const nextStream = remoteStreamsRef.current[streamType];
      const trackIds = new Set(nextStream.getTracks().map((track) => track.id));
      incomingStream.getTracks().forEach((track) => {
        if (!trackIds.has(track.id)) {
          nextStream.addTrack(track);
        }
      });
      if (streamType === 'screen') {
        attachStream(screenVideoRef.current, nextStream, { muted: true });
      } else {
        attachStream(cameraVideoRef.current, nextStream, { muted: !audioEnabled });
        attachStream(audioRef.current, nextStream, { muted: !audioEnabled });
      }
    };

    const ensurePeer = async (streamType) => {
      const existing = peersRef.current.get(streamType);
      if (existing) return existing;

      const peer = createLiveExamPeer({
        onIceCandidate: (candidate) =>
          void sendSignal({
            signalType: 'ice-candidate',
            streamType,
            payload: serializeIceCandidate(candidate),
          }),
        onTrack: (event) => {
          const remoteStream =
            event.streams?.[0] || new MediaStream([event.track]);
          setRemoteStream(streamType, remoteStream);
          setStatus('Live stream connected.');
        },
      });

      peer.addTransceiver('video', { direction: 'recvonly' });
      if (streamType === 'camera') {
        peer.addTransceiver('audio', { direction: 'recvonly' });
      }

      peersRef.current.set(streamType, peer);
      const offer = await peer.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: streamType === 'camera',
      });
      await peer.setLocalDescription(offer);
      await sendSignal({
        signalType: 'offer',
        streamType,
        payload: serializeSessionDescription(peer.localDescription),
      });
      return peer;
    };

    const handleSignal = async (row) => {
      if (!row || processedSignalIdsRef.current.has(row.id)) return;
      if (String(row.session_id) !== String(sessionId)) return;
      if (String(row.to_user_id || '') !== String(viewerId)) return;
      if (String(row.from_user_id || '') !== String(studentId)) return;
      if (String(row.payload?.connectionId || '') !== String(connectionIdRef.current)) return;
      processedSignalIdsRef.current.add(row.id);

      const streamType = row.stream_type === 'screen' ? 'screen' : 'camera';
      const peer = peersRef.current.get(streamType);
      if (!peer) return;

      if (row.signal_type === 'answer' && row.payload?.sdp) {
        await peer.setRemoteDescription(new RTCSessionDescription(row.payload));
        setStatus('Live stream connected.');
        return;
      }

      if (row.signal_type === 'ice-candidate' && row.payload?.candidate) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(row.payload));
        } catch {
          // ignore out-of-order candidates
        }
      }
    };

    const channel = supabase
      .channel(`live-exam-monitor-${sessionId}-${viewerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: LIVE_EXAM_SIGNAL_TABLE },
        (payload) => {
          void handleSignal(payload?.new);
        }
      )
      .subscribe();

    const bootstrapSignals = async () => {
      try {
        await Promise.all([ensurePeer('screen'), ensurePeer('camera')]);
        const { data: recentSignals, error: recentError } = await supabase
          .from(LIVE_EXAM_SIGNAL_TABLE)
          .select('*')
          .eq('session_id', sessionId)
          .eq('to_user_id', viewerId)
          .eq('from_user_id', studentId)
          .order('created_at', { ascending: false })
          .limit(40);
        if (recentError) throw recentError;
        (recentSignals || []).reverse().forEach((row) => {
          void handleSignal(row);
        });
      } catch (connectionError) {
        if (!cancelled) {
          setError(connectionError.message || 'Failed to connect live stream.');
          setStatus('Live stream is unavailable.');
        }
      }
    };

    void bootstrapSignals();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      closePeers();
    };
  }, [active, audioEnabled, session?.status, sessionId, slotId, studentId, viewerId, viewerRole]);

  const statusTone = useMemo(() => {
    if (error) return 'text-rose-300';
    if (status.toLowerCase().includes('connected')) return 'text-emerald-300';
    return 'text-slate-300';
  }, [error, status]);

  return (
    <div className="space-y-3">
      <div className={`${streamCardClass}`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Screen Share</p>
          <span className={`text-[11px] ${statusTone}`}>{error || status}</span>
        </div>
        <video
          ref={screenVideoRef}
          autoPlay
          muted
          playsInline
          className={`w-full rounded-2xl bg-black object-contain ${compact ? 'h-36' : 'h-72'}`}
        />
      </div>

      <div className={compact ? 'grid gap-3' : 'grid gap-3 lg:grid-cols-[1fr_0.36fr]'}>
        <div className={streamCardClass}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Live Camera</p>
            {!compact ? (
              <button
                type="button"
                onClick={() => setAudioEnabled((prev) => !prev)}
                className="rounded-xl border border-slate-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
              >
                {audioEnabled ? 'Mute Mic' : 'Listen Mic'}
              </button>
            ) : null}
          </div>
          <video
            ref={cameraVideoRef}
            autoPlay
            muted={!audioEnabled}
            playsInline
            className={`w-full rounded-2xl bg-black object-cover ${compact ? 'h-36' : 'h-72'}`}
          />
          <audio ref={audioRef} autoPlay muted={!audioEnabled} />
        </div>

        {!compact ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mic</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {audioEnabled ? 'Live microphone monitoring enabled.' : 'Enable mic listening for this student.'}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              This free WebRTC monitor uses browser media directly. Without a paid TURN server, some restrictive networks may block the live feed.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
