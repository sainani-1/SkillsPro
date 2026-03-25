import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ConnectionState, Room, RoomEvent, Track } from 'livekit-client';
import { getLiveKitTokenForSession } from '../lib/livekitSession';
import { supabase } from '../supabaseClient';

const ROOM_IDLE_DISCONNECT_MS = 30000;
const sharedRoomRegistry = new Map();

function detachTrack(track, element) {
  try {
    track?.detach?.(element);
  } catch {
    // ignore detach issues
  }
}

async function playMediaElement(element) {
  if (!element?.play) return;
  try {
    await element.play();
  } catch {
    // autoplay can be blocked; ignore and keep element attached
  }
}

function isTerminalSessionStatus(status) {
  return ['terminated', 'disconnected', 'completed', 'cancelled'].includes(String(status || '').toLowerCase());
}

function resolvePreferredSession(currentSession, nextSession) {
  if (!nextSession) return nextSession;
  if (!currentSession) return nextSession;

  const currentTerminal = isTerminalSessionStatus(currentSession.status);
  const nextTerminal = isTerminalSessionStatus(nextSession.status);
  const sameBooking =
    currentSession.booking_id &&
    nextSession.booking_id &&
    String(currentSession.booking_id) === String(nextSession.booking_id);
  const currentStamp = new Date(currentSession.updated_at || currentSession.started_at || currentSession.created_at || 0).getTime();
  const nextStamp = new Date(nextSession.updated_at || nextSession.started_at || nextSession.created_at || 0).getTime();

  if (sameBooking && !currentTerminal && nextTerminal) {
    return currentSession;
  }
  if (sameBooking && currentTerminal && !nextTerminal) {
    return nextSession;
  }
  if (sameBooking) {
    return nextStamp >= currentStamp ? nextSession : currentSession;
  }
  return nextSession;
}

function createDefaultDebugState(room = '-') {
  return {
    room,
    screen: 'waiting',
    camera: 'waiting',
    mic: 'waiting',
  };
}

function createDefaultSharedState() {
  return {
    debugState: createDefaultDebugState(),
    status: 'Connecting live preview...',
    error: '',
  };
}

function createSharedRoomEntry(connectionKey) {
  return {
    connectionKey,
    room: null,
    connectPromise: null,
    refCount: 0,
    idleTimer: null,
    listenersBound: false,
    state: createDefaultSharedState(),
    subscribers: new Set(),
  };
}

function getSharedRoomEntry(connectionKey) {
  if (!sharedRoomRegistry.has(connectionKey)) {
    sharedRoomRegistry.set(connectionKey, createSharedRoomEntry(connectionKey));
  }
  return sharedRoomRegistry.get(connectionKey);
}

function emitSharedRoomState(entry, nextPartialState) {
  entry.state = {
    ...entry.state,
    ...nextPartialState,
    debugState: {
      ...entry.state.debugState,
      ...(nextPartialState?.debugState || {}),
    },
  };
  entry.subscribers.forEach((subscriber) => subscriber(entry.state));
}

function subscribeToSharedRoom(entry, subscriber) {
  entry.subscribers.add(subscriber);
  subscriber(entry.state);
  return () => {
    entry.subscribers.delete(subscriber);
  };
}

function clearSharedRoomIdleTimer(entry) {
  if (entry.idleTimer) {
    window.clearTimeout(entry.idleTimer);
    entry.idleTimer = null;
  }
}

function scheduleSharedRoomDisconnect(entry) {
  clearSharedRoomIdleTimer(entry);
  entry.idleTimer = window.setTimeout(() => {
    if (entry.refCount > 0) return;
    entry.room?.disconnect?.();
    entry.room = null;
    entry.connectPromise = null;
    entry.listenersBound = false;
    emitSharedRoomState(entry, {
      debugState: createDefaultDebugState('-'),
      status: 'Student is not live right now.',
      error: '',
    });
    sharedRoomRegistry.delete(entry.connectionKey);
  }, ROOM_IDLE_DISCONNECT_MS);
}

function disconnectSharedRoomNow(connectionKey, nextStatus = 'Live session ended.') {
  const entry = sharedRoomRegistry.get(connectionKey);
  if (!entry) return;
  clearSharedRoomIdleTimer(entry);
  entry.room?.disconnect?.();
  entry.room = null;
  entry.connectPromise = null;
  entry.listenersBound = false;
  emitSharedRoomState(entry, {
    debugState: createDefaultDebugState('-'),
    status: nextStatus,
    error: '',
  });
  sharedRoomRegistry.delete(connectionKey);
}

function bindSharedRoomStateListeners(entry) {
  if (!entry.room || entry.listenersBound) return;
  entry.listenersBound = true;

  entry.room.on(RoomEvent.ConnectionStateChanged, (state) => {
    const normalized = String(state || '');
    const isConnected = normalized.toLowerCase() === String(ConnectionState.Connected).toLowerCase();
    emitSharedRoomState(entry, {
      debugState: { room: state },
      status: isConnected ? 'Waiting for student media...' : 'Connecting live preview...',
      error: '',
    });
  });

  entry.room.on(RoomEvent.TrackSubscribed, (track, publication) => {
    if (publication?.source === Track.Source.ScreenShare && track?.kind === Track.Kind.Video) {
      emitSharedRoomState(entry, {
        debugState: { screen: 'connected' },
      });
    }
    if (publication?.source === Track.Source.Camera && track?.kind === Track.Kind.Video) {
      emitSharedRoomState(entry, {
        debugState: { camera: 'connected' },
      });
    }
    if (publication?.source === Track.Source.Microphone && track?.kind === Track.Kind.Audio) {
      emitSharedRoomState(entry, {
        debugState: { mic: 'connected' },
      });
    }
  });

  entry.room.on(RoomEvent.TrackUnsubscribed, (track, publication) => {
    if (publication?.source === Track.Source.ScreenShare) {
      emitSharedRoomState(entry, {
        debugState: { screen: 'waiting' },
      });
    }
    if (publication?.source === Track.Source.Camera) {
      emitSharedRoomState(entry, {
        debugState: { camera: 'waiting' },
      });
    }
    if (publication?.source === Track.Source.Microphone) {
      emitSharedRoomState(entry, {
        debugState: { mic: 'waiting' },
      });
    }
  });
}

export default function LiveExamStreamMonitor({
  session,
  viewerId,
  viewerInstanceId = '',
  compact = false,
  large = false,
}) {
  const [resolvedSession, setResolvedSession] = useState(session);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Connecting live preview...');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [debugState, setDebugState] = useState(createDefaultDebugState());
  const sharedEntryRef = useRef(null);
  const screenVideoRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const audioRef = useRef(null);

  const streamCardClass = compact
    ? 'rounded-2xl border border-slate-800 bg-slate-950 p-2'
    : 'rounded-3xl border border-slate-200 bg-slate-950 p-3';
  const screenHeightClass = compact ? 'h-36' : large ? 'h-[30rem]' : 'h-72';
  const cameraHeightClass = compact ? 'h-36' : large ? 'h-[24rem]' : 'h-72';
  const sessionStatus = String(resolvedSession?.status || '').toLowerCase();
  const hasStartedSession =
    Boolean(resolvedSession?.started_at) || ['active', 'paused'].includes(sessionStatus);
  const connectionKey = `${viewerId || ''}:${resolvedSession?.id || ''}`;

  useEffect(() => {
    setResolvedSession((currentSession) => resolvePreferredSession(currentSession, session));
  }, [session]);

  useEffect(() => {
    if (!session?.booking_id || !isTerminalSessionStatus(session?.status)) {
      return undefined;
    }

    let cancelled = false;
    const recoverLatestSession = async () => {
      const { data, error: sessionError } = await supabase
        .from('exam_live_sessions')
        .select('*')
        .eq('booking_id', session.booking_id)
        .order('updated_at', { ascending: false })
        .limit(10);
      if (cancelled || sessionError || !data?.length) return;
      const recoveredSession = data.find((row) => !isTerminalSessionStatus(row.status));
      if (recoveredSession) {
        setResolvedSession((currentSession) => resolvePreferredSession(currentSession, recoveredSession));
      }
    };

    void recoverLatestSession();
    return () => {
      cancelled = true;
    };
  }, [session?.booking_id, session?.status]);

  useEffect(() => {
    if (!resolvedSession?.id || !viewerId) {
      if (sharedEntryRef.current) {
        sharedEntryRef.current.refCount = Math.max(0, sharedEntryRef.current.refCount - 1);
        scheduleSharedRoomDisconnect(sharedEntryRef.current);
        sharedEntryRef.current = null;
      }
      setStatus('Student is not live right now.');
      setError('');
      setDebugState(createDefaultDebugState());
      return undefined;
    }

    if (!hasStartedSession) {
      if (sharedEntryRef.current) {
        sharedEntryRef.current.refCount = Math.max(0, sharedEntryRef.current.refCount - 1);
        scheduleSharedRoomDisconnect(sharedEntryRef.current);
        sharedEntryRef.current = null;
      }
      setStatus('Student has not joined yet.');
      setError('');
      setDebugState(createDefaultDebugState());
      return undefined;
    }

    let mounted = true;
    const attachedTrackSids = new Set();
    const localDetachFns = [];
    const sharedEntry = getSharedRoomEntry(connectionKey);
    sharedEntryRef.current = sharedEntry;
    sharedEntry.refCount += 1;
    clearSharedRoomIdleTimer(sharedEntry);

    const syncSharedState = (nextState) => {
      if (!mounted) return;
      setError(nextState.error || '');
      setStatus(nextState.status || 'Connecting live preview...');
      setDebugState(nextState.debugState || createDefaultDebugState());
    };
    const unsubscribeSharedState = subscribeToSharedRoom(sharedEntry, syncSharedState);

    const cleanupLocalBindings = () => {
      localDetachFns.forEach((fn) => fn());
      localDetachFns.length = 0;
      attachedTrackSids.clear();
      if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
      if (audioRef.current) audioRef.current.srcObject = null;
    };

    const attachPublication = async (publication) => {
      const subscribedTrack = publication?.track;
      if (!subscribedTrack) return;
      const trackSid = publication?.trackSid || subscribedTrack?.sid || `${publication?.source || 'unknown'}-${subscribedTrack?.kind || 'track'}`;
      if (attachedTrackSids.has(trackSid)) return;

      if (publication.source === Track.Source.ScreenShare && subscribedTrack.kind === Track.Kind.Video) {
        const element = screenVideoRef.current;
        if (!element) return;
        subscribedTrack.setEnabled?.(true);
        publication.setSubscribed?.(true);
        element.srcObject = null;
        element.muted = true;
        subscribedTrack.attach(element);
        await playMediaElement(element);
        attachedTrackSids.add(trackSid);
        localDetachFns.push(() => detachTrack(subscribedTrack, element));
        return;
      }

      if (publication.source === Track.Source.Camera && subscribedTrack.kind === Track.Kind.Video) {
        const element = cameraVideoRef.current;
        if (!element) return;
        subscribedTrack.setEnabled?.(true);
        publication.setSubscribed?.(true);
        element.srcObject = null;
        element.muted = true;
        subscribedTrack.attach(element);
        await playMediaElement(element);
        attachedTrackSids.add(trackSid);
        localDetachFns.push(() => detachTrack(subscribedTrack, element));
        return;
      }

      if (publication.source === Track.Source.Microphone && subscribedTrack.kind === Track.Kind.Audio) {
        const element = audioRef.current;
        if (!element) return;
        subscribedTrack.setEnabled?.(true);
        publication.setSubscribed?.(true);
        element.srcObject = null;
        subscribedTrack.attach(element);
        element.muted = !audioEnabled;
        await playMediaElement(element);
        attachedTrackSids.add(trackSid);
        localDetachFns.push(() => detachTrack(subscribedTrack, element));
      }
    };

    const subscribeParticipantTracks = (participant) => {
      participant?.trackPublications?.forEach?.((publication) => {
        publication.setSubscribed?.(true);
        void attachPublication(publication);
      });
    };

    const connectRoom = async () => {
      try {
        emitSharedRoomState(sharedEntry, {
          error: '',
          status: 'Connecting live preview...',
          debugState: createDefaultDebugState('fetching token'),
        });

        const tokenData = await getLiveKitTokenForSession({
          sessionId: resolvedSession.id,
          mode: 'observer',
          requesterId: viewerId,
          viewerInstanceId,
        });
        if (sharedEntry.refCount <= 0 && sharedEntry.subscribers.size === 0) return;

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        sharedEntry.room = room;
        bindSharedRoomStateListeners(sharedEntry);

        await room.connect(tokenData.url, tokenData.token, {
          autoSubscribe: true,
        });
        if (sharedEntry.refCount <= 0 && sharedEntry.subscribers.size === 0) {
          room.disconnect?.();
          sharedEntry.room = null;
          sharedEntry.listenersBound = false;
          return;
        }

        room.remoteParticipants.forEach((participant) => subscribeParticipantTracks(participant));
      } catch (connectionError) {
        emitSharedRoomState(sharedEntry, {
          error: connectionError.message || 'Failed to connect LiveKit preview.',
          status: 'Live stream unavailable.',
        });
        sharedEntry.room = null;
        sharedEntry.connectPromise = null;
        sharedEntry.listenersBound = false;
      }
    };

    const room = sharedEntry.room;
    const participantConnectedHandler = (participant) => {
      subscribeParticipantTracks(participant);
    };
    const trackPublishedHandler = (_, publication, participant) => {
      publication?.setSubscribed?.(true);
      subscribeParticipantTracks(participant);
    };
    const trackSubscribedHandler = (track, publication) => {
      void attachPublication({ ...publication, track });
    };
    const trackUnsubscribedHandler = (track, publication) => {
      const trackSid = publication?.trackSid || track?.sid || `${publication?.source || 'unknown'}-${track?.kind || 'track'}`;
      attachedTrackSids.delete(trackSid);
    };

    if (room) {
      room.on(RoomEvent.ParticipantConnected, participantConnectedHandler);
      room.on(RoomEvent.TrackPublished, trackPublishedHandler);
      room.on(RoomEvent.TrackSubscribed, trackSubscribedHandler);
      room.on(RoomEvent.TrackUnsubscribed, trackUnsubscribedHandler);
      room.remoteParticipants.forEach((participant) => subscribeParticipantTracks(participant));
    }

    if (!sharedEntry.room && !sharedEntry.connectPromise) {
      sharedEntry.connectPromise = connectRoom().finally(() => {
        sharedEntry.connectPromise = null;
      });
    } else if (sharedEntry.connectPromise) {
      void sharedEntry.connectPromise.then(() => {
        if (!mounted || !sharedEntry.room) return;
        sharedEntry.room.on(RoomEvent.ParticipantConnected, participantConnectedHandler);
        sharedEntry.room.on(RoomEvent.TrackPublished, trackPublishedHandler);
        sharedEntry.room.on(RoomEvent.TrackSubscribed, trackSubscribedHandler);
        sharedEntry.room.on(RoomEvent.TrackUnsubscribed, trackUnsubscribedHandler);
        sharedEntry.room.remoteParticipants.forEach((participant) => subscribeParticipantTracks(participant));
      });
    }

    return () => {
      mounted = false;
      unsubscribeSharedState();
      cleanupLocalBindings();
      if (sharedEntry.room) {
        sharedEntry.room.off(RoomEvent.ParticipantConnected, participantConnectedHandler);
        sharedEntry.room.off(RoomEvent.TrackPublished, trackPublishedHandler);
        sharedEntry.room.off(RoomEvent.TrackSubscribed, trackSubscribedHandler);
        sharedEntry.room.off(RoomEvent.TrackUnsubscribed, trackUnsubscribedHandler);
      }
      sharedEntry.refCount = Math.max(0, sharedEntry.refCount - 1);
      scheduleSharedRoomDisconnect(sharedEntry);
      if (sharedEntryRef.current === sharedEntry) {
        sharedEntryRef.current = null;
      }
    };
  }, [resolvedSession?.id, viewerId, connectionKey, hasStartedSession, viewerInstanceId]);

  useEffect(() => {
    if (!connectionKey) return;
    if (!['terminated', 'disconnected', 'completed', 'cancelled'].includes(sessionStatus)) return;
    disconnectSharedRoomNow(connectionKey, 'Live session ended.');
    setStatus('Live session ended.');
    setDebugState(createDefaultDebugState());
  }, [connectionKey, sessionStatus]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = !audioEnabled;
      const playPromise = audioRef.current.play?.();
      if (playPromise?.catch) {
        playPromise.catch(() => {});
      }
    }
  }, [audioEnabled]);

  useEffect(() => {
    if (error) return;
    if (!resolvedSession?.id || !viewerId) {
      setStatus('Student is not live right now.');
      return;
    }
    if (!hasStartedSession) {
      setStatus('Student has not joined yet.');
      return;
    }
    if (['terminated', 'disconnected', 'completed', 'cancelled'].includes(sessionStatus)) {
      setStatus('Live session ended.');
      return;
    }

    const roomConnected = String(debugState.room).toLowerCase() === String(ConnectionState.Connected).toLowerCase();
    const hasVideoFeed = debugState.screen === 'connected' || debugState.camera === 'connected';

    if (hasVideoFeed) {
      setStatus('Live stream connected.');
      return;
    }
    if (roomConnected) {
      setStatus('Waiting for student camera/screen share...');
      return;
    }
    if (String(debugState.room).toLowerCase() === 'fetching token') {
      setStatus('Connecting live preview...');
      return;
    }
    setStatus('Connecting live preview...');
  }, [debugState.room, debugState.screen, debugState.camera, error, resolvedSession?.id, sessionStatus, viewerId, hasStartedSession]);

  const statusTone = useMemo(() => {
    if (error) return 'text-rose-300';
    if (status.toLowerCase().includes('connected')) return 'text-emerald-300';
    return 'text-slate-300';
  }, [error, status]);

  return (
    <div className="space-y-3">
      <div className={streamCardClass}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Screen Share</p>
          <span className={`text-[11px] ${statusTone}`}>{error || status}</span>
        </div>
        <video
          ref={screenVideoRef}
          autoPlay
          muted
          playsInline
          className={`w-full rounded-2xl bg-black object-contain ${screenHeightClass}`}
        />
        {!compact ? (
          <p className="mt-2 text-[11px] text-slate-400">Room: {debugState.room} | Screen: {debugState.screen}</p>
        ) : null}
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
            muted
            playsInline
            className={`w-full rounded-2xl bg-black object-cover ${cameraHeightClass}`}
          />
          <audio ref={audioRef} autoPlay muted={!audioEnabled} />
          {!compact ? (
            <p className="mt-2 text-[11px] text-slate-400">Camera: {debugState.camera} | Mic: {debugState.mic}</p>
          ) : null}
        </div>

        {!compact ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mic</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {audioEnabled ? 'Live microphone monitoring enabled.' : 'Enable mic listening for this student.'}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              LiveKit is now used for room transport. Make sure the `livekit-token` function is deployed and LiveKit env vars are configured.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
