import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ConnectionState, LocalAudioTrack, Room, RoomEvent, Track } from 'livekit-client';
import { getLiveKitTokenForSession } from '../lib/livekitSession';
import {
  LIVE_EXAM_SIGNAL_TABLE,
  buildPeerKey,
  createLiveExamPeer,
  serializeIceCandidate,
  serializeSessionDescription,
} from '../lib/liveExamWebRTC';
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

function getSessionMediaScore(session) {
  return (
    Number(Boolean(session?.screen_share_connected)) +
    Number(Boolean(session?.camera_connected)) +
    Number(Boolean(session?.mic_connected))
  );
}

function getSessionStatusPriority(session) {
  const status = String(session?.status || '').toLowerCase();
  if (status === 'active') return 4;
  if (status === 'paused') return 3;
  if (status === 'scheduled') return 2;
  if (status === 'disconnected') return 1;
  return 0;
}

function getSessionRecency(session) {
  return new Date(session?.updated_at || session?.started_at || session?.created_at || 0).getTime();
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
  if (String(currentSession?.id || '') === String(nextSession?.id || '')) {
    return getSessionRecency(nextSession) >= getSessionRecency(currentSession) ? nextSession : currentSession;
  }
  const currentMediaScore = getSessionMediaScore(currentSession);
  const nextMediaScore = getSessionMediaScore(nextSession);
  if (nextMediaScore !== currentMediaScore) {
    return nextMediaScore > currentMediaScore ? nextSession : currentSession;
  }
  const currentPriority = getSessionStatusPriority(currentSession);
  const nextPriority = getSessionStatusPriority(nextSession);
  if (nextPriority !== currentPriority) {
    return nextPriority > currentPriority ? nextSession : currentSession;
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

  entry.room.on(RoomEvent.Reconnecting, () => {
    emitSharedRoomState(entry, {
      debugState: { room: 'reconnecting' },
      status: 'Reconnecting live preview...',
      error: '',
    });
  });

  entry.room.on(RoomEvent.Reconnected, () => {
    emitSharedRoomState(entry, {
      debugState: { room: ConnectionState.Connected },
      status: 'Waiting for student media...',
      error: '',
    });
  });
}

export default function LiveExamStreamMonitor({
  session,
  viewerId,
  viewerInstanceId = '',
  viewerRole = 'observer',
  compact = false,
  large = false,
}) {
  const [resolvedSession, setResolvedSession] = useState(session);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Connecting live preview...');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [supportTalkActive, setSupportTalkActive] = useState(false);
  const [supportTalkBusy, setSupportTalkBusy] = useState(false);
  const [supportTalkError, setSupportTalkError] = useState('');
  const [roomReconnectNonce, setRoomReconnectNonce] = useState(0);
  const [debugState, setDebugState] = useState(createDefaultDebugState());
  const sharedEntryRef = useRef(null);
  const supportMicTrackRef = useRef(null);
  const lastMediaReconnectSignatureRef = useRef('');
  const mediaReconnectAttemptsRef = useRef(new Map());
  const screenVideoRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const audioRef = useRef(null);
  const webRtcPeersRef = useRef(new Map());
  const webRtcPollTimerRef = useRef(null);
  const processedWebRtcSignalIdsRef = useRef(new Set());

  const streamCardClass = compact
    ? 'rounded-2xl border border-slate-800 bg-slate-950 p-2'
    : 'rounded-3xl border border-slate-200 bg-slate-950 p-3';
  const screenHeightClass = compact ? 'h-36' : large ? 'h-[30rem]' : 'h-72';
  const cameraHeightClass = compact ? 'h-36' : large ? 'h-[24rem]' : 'h-72';
  const sessionStatus = String(resolvedSession?.status || '').toLowerCase();
  const hasStartedSession =
    Boolean(resolvedSession?.started_at) || ['active', 'paused'].includes(sessionStatus);
  const connectionKey = `${viewerId || ''}:${resolvedSession?.id || ''}:${roomReconnectNonce}`;
  const canUseSupportTalk = ['admin', 'teacher', 'instructor'].includes(String(viewerRole || '').toLowerCase());

  const stopSupportTalk = async () => {
    const localTrack = supportMicTrackRef.current;
    supportMicTrackRef.current = null;
    if (localTrack && sharedEntryRef.current?.room) {
      try {
        await sharedEntryRef.current.room.localParticipant.unpublishTrack(localTrack);
      } catch {
        // ignore unpublish errors
      }
    }
    try {
      localTrack?.stop?.();
    } catch {
      // ignore stop errors
    }
    setSupportTalkActive(false);
  };

  const startSupportTalk = async () => {
    if (!canUseSupportTalk || supportTalkBusy) return;
    setSupportTalkBusy(true);
    setSupportTalkError('');
    try {
      const entry = sharedEntryRef.current;
      if (!entry) throw new Error('Live room is not ready yet.');
      if (entry.connectPromise) await entry.connectPromise;
      if (!entry.room) throw new Error('Live room is still connecting. Try again in a moment.');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const [audioTrack] = stream.getAudioTracks?.() || [];
      if (!audioTrack) throw new Error('Microphone was not available.');

      const localTrack = new LocalAudioTrack(audioTrack, { name: 'support-teacher-mic' });
      await entry.room.localParticipant.publishTrack(localTrack, {
        source: Track.Source.Microphone,
      });
      supportMicTrackRef.current = localTrack;
      setSupportTalkActive(true);
    } catch (talkError) {
      const message = talkError.message || 'Unable to start support voice.';
      if (String(message).toLowerCase().includes('insufficient permissions')) {
        disconnectSharedRoomNow(connectionKey, 'Refreshing voice permission. Try Talk To Student again.');
        setRoomReconnectNonce((value) => value + 1);
        setSupportTalkError('Voice permission was refreshed. Click Talk To Student again.');
      } else {
        setSupportTalkError(message);
      }
      await stopSupportTalk();
    } finally {
      setSupportTalkBusy(false);
    }
  };

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
    if (!resolvedSession?.id) return undefined;

    let cancelled = false;
    const refreshSession = async () => {
      let query = supabase
        .from('exam_live_sessions')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (resolvedSession.booking_id) {
        query = query.eq('booking_id', resolvedSession.booking_id);
      } else {
        query = query
          .eq('student_id', resolvedSession.student_id)
          .eq('slot_id', resolvedSession.slot_id);
      }

      const { data, error: sessionError } = await query;
      if (cancelled || sessionError || !data?.length) return;
      const nextSession = data.reduce((bestSession, row) => {
        if (!bestSession) return row;
        return resolvePreferredSession(bestSession, row);
      }, null);
      if (!nextSession) return;
      setResolvedSession((currentSession) => resolvePreferredSession(currentSession, nextSession));
    };

    void refreshSession();
    const timer = window.setInterval(() => {
      void refreshSession();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [resolvedSession?.id]);

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
      const screenElement = screenVideoRef.current;
      const cameraElement = cameraVideoRef.current;
      const audioElement = audioRef.current;

      const attachVideoToElement = async (element, debugPatch) => {
        if (!element) return false;
        subscribedTrack.setEnabled?.(true);
        publication.setSubscribed?.(true);
        element.srcObject = null;
        element.muted = true;
        element.autoplay = true;
        element.playsInline = true;
        element.controls = false;
        element.onloadedmetadata = () => {
          void playMediaElement(element);
        };
        element.oncanplay = () => {
          void playMediaElement(element);
        };
        try {
          subscribedTrack.attach(element);
        } catch {
          if (subscribedTrack?.mediaStreamTrack) {
            element.srcObject = new MediaStream([subscribedTrack.mediaStreamTrack]);
          } else {
            throw new Error('Unable to attach remote video track.');
          }
        }
        await playMediaElement(element);
        attachedTrackSids.add(trackSid);
        localDetachFns.push(() => {
          detachTrack(subscribedTrack, element);
          element.srcObject = null;
        });
        if (debugPatch) {
          emitSharedRoomState(sharedEntry, { debugState: debugPatch });
        }
        return true;
      };

      const attachAudioToElement = async (element, debugPatch) => {
        if (!element) return false;
        subscribedTrack.setEnabled?.(true);
        publication.setSubscribed?.(true);
        element.srcObject = null;
        element.autoplay = true;
        element.onloadedmetadata = () => {
          void playMediaElement(element);
        };
        element.oncanplay = () => {
          void playMediaElement(element);
        };
        try {
          subscribedTrack.attach(element);
        } catch {
          if (subscribedTrack?.mediaStreamTrack) {
            element.srcObject = new MediaStream([subscribedTrack.mediaStreamTrack]);
          } else {
            throw new Error('Unable to attach remote audio track.');
          }
        }
        element.muted = !audioEnabled;
        await playMediaElement(element);
        attachedTrackSids.add(trackSid);
        localDetachFns.push(() => {
          detachTrack(subscribedTrack, element);
          element.srcObject = null;
        });
        if (debugPatch) {
          emitSharedRoomState(sharedEntry, { debugState: debugPatch });
        }
        return true;
      };

      if (publication.source === Track.Source.ScreenShare && subscribedTrack.kind === Track.Kind.Video) {
        await attachVideoToElement(screenElement, { screen: 'connected' });
        return;
      }

      if (publication.source === Track.Source.Camera && subscribedTrack.kind === Track.Kind.Video) {
        await attachVideoToElement(cameraElement, { camera: 'connected' });
        return;
      }

      if (publication.source === Track.Source.Microphone && subscribedTrack.kind === Track.Kind.Audio) {
        await attachAudioToElement(audioElement, { mic: 'connected' });
        return;
      }

      // Fallback: if the incoming track source is unlabeled or unexpected,
      // still render the first available media track instead of leaving blanks.
      if (subscribedTrack.kind === Track.Kind.Video) {
        if (!screenElement?.srcObject) {
          await attachVideoToElement(screenElement, { screen: 'connected' });
          return;
        }
        if (!cameraElement?.srcObject) {
          await attachVideoToElement(cameraElement, { camera: 'connected' });
          return;
        }
      }

      if (subscribedTrack.kind === Track.Kind.Audio) {
        if (!audioElement?.srcObject) {
          await attachAudioToElement(audioElement, { mic: 'connected' });
        }
      }
    };

    const subscribeParticipantTracks = (participant) => {
      participant?.trackPublications?.forEach?.((publication) => {
        publication.setSubscribed?.(true);
        void attachPublication(publication);
      });
    };

    const participantConnectedHandler = (participant) => {
      subscribeParticipantTracks(participant);
    };
    const trackPublishedHandler = (publication, participant) => {
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

    const locallyBoundRooms = new WeakSet();
    const bindLocalRoomHandlers = (room) => {
      if (!room || locallyBoundRooms.has(room)) return;
      locallyBoundRooms.add(room);
      room.on(RoomEvent.ParticipantConnected, participantConnectedHandler);
      room.on(RoomEvent.TrackPublished, trackPublishedHandler);
      room.on(RoomEvent.TrackSubscribed, trackSubscribedHandler);
      room.on(RoomEvent.TrackUnsubscribed, trackUnsubscribedHandler);
    };

    const unbindLocalRoomHandlers = (room) => {
      if (!room || !locallyBoundRooms.has(room)) return;
      room.off(RoomEvent.ParticipantConnected, participantConnectedHandler);
      room.off(RoomEvent.TrackPublished, trackPublishedHandler);
      room.off(RoomEvent.TrackSubscribed, trackSubscribedHandler);
      room.off(RoomEvent.TrackUnsubscribed, trackUnsubscribedHandler);
      locallyBoundRooms.delete(room);
    };

    const connectRoom = async () => {
      const isAbortLikeError = (error) => {
        const message = String(error?.message || error || '').toLowerCase();
        return (
          message.includes('abort handler called') ||
          message.includes('could not establish signal connection') ||
          message.includes('signal connection')
        );
      };
      const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
      const connectOnce = async () => {
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
          adaptiveStream: false,
          dynacast: false,
        });
        sharedEntry.room = room;
        bindLocalRoomHandlers(room);
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

        emitSharedRoomState(sharedEntry, {
          error: '',
          status:
            String(resolvedSession?.status || '').toLowerCase() === 'active'
              ? 'Student is still on the permission/fullscreen steps. Live camera and screen will appear after they allow access.'
              : 'Waiting for student camera/screen share...',
          debugState: { room: ConnectionState.Connected },
        });

        room.remoteParticipants.forEach((participant) => subscribeParticipantTracks(participant));
      };
      const connectWithRetries = async () => {
        const retryDelays = [0, 250, 750, 1500];
        let lastError = null;
        for (const delay of retryDelays) {
          if (delay > 0) {
            await wait(delay);
          }
          try {
            await connectOnce();
            return;
          } catch (attemptError) {
            lastError = attemptError;
            const shouldRetry = isAbortLikeError(attemptError);
            unbindLocalRoomHandlers(sharedEntry.room);
            sharedEntry.room?.disconnect?.();
            sharedEntry.room = null;
            sharedEntry.listenersBound = false;
            if (!shouldRetry) {
              throw attemptError;
            }
          }
        }
        throw lastError || new Error('Failed to connect LiveKit preview.');
      };
      try {
        await connectWithRetries();
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

    if (room) {
      bindLocalRoomHandlers(room);
      room.remoteParticipants.forEach((participant) => subscribeParticipantTracks(participant));
    }

    if (!sharedEntry.room && !sharedEntry.connectPromise) {
      sharedEntry.connectPromise = connectRoom().finally(() => {
        sharedEntry.connectPromise = null;
      });
    } else if (sharedEntry.connectPromise) {
      void sharedEntry.connectPromise.then(() => {
        if (!mounted || !sharedEntry.room) return;
        bindLocalRoomHandlers(sharedEntry.room);
        sharedEntry.room.remoteParticipants.forEach((participant) => subscribeParticipantTracks(participant));
      });
    }

    return () => {
      mounted = false;
      unsubscribeSharedState();
      cleanupLocalBindings();
      if (sharedEntry.room) {
        unbindLocalRoomHandlers(sharedEntry.room);
      }
      sharedEntry.refCount = Math.max(0, sharedEntry.refCount - 1);
      scheduleSharedRoomDisconnect(sharedEntry);
      if (sharedEntryRef.current === sharedEntry) {
        sharedEntryRef.current = null;
      }
      void stopSupportTalk();
    };
  }, [resolvedSession?.id, viewerId, connectionKey, hasStartedSession, viewerInstanceId]);

  useEffect(() => () => {
    void stopSupportTalk();
  }, []);

  useEffect(() => {
    if (!resolvedSession?.id || !resolvedSession?.student_id || !viewerId) return undefined;

    const attachRemoteTrack = (streamType, event) => {
      const remoteStream = event?.streams?.[0];
      const track = event?.track;
      if (!track) return;

      if (streamType === 'screen' && track.kind === 'video' && screenVideoRef.current) {
        const element = screenVideoRef.current;
        element.srcObject = remoteStream || new MediaStream([track]);
        element.muted = true;
        element.autoplay = true;
        element.playsInline = true;
        void playMediaElement(element);
        setDebugState((prev) => ({ ...prev, screen: 'connected' }));
        setStatus('Live stream connected.');
        return;
      }

      if (streamType === 'camera') {
        if (track.kind === 'video' && cameraVideoRef.current) {
          const element = cameraVideoRef.current;
          element.srcObject = remoteStream || new MediaStream([track]);
          element.muted = true;
          element.autoplay = true;
          element.playsInline = true;
          void playMediaElement(element);
          setDebugState((prev) => ({ ...prev, camera: 'connected' }));
          setStatus('Live stream connected.');
        }
        if (track.kind === 'audio' && audioRef.current) {
          const element = audioRef.current;
          element.srcObject = remoteStream || new MediaStream([track]);
          element.muted = !audioEnabled;
          element.autoplay = true;
          void playMediaElement(element);
          setDebugState((prev) => ({ ...prev, mic: 'connected' }));
        }
      }
    };

    const sendSignal = async ({ signalType, streamType, payload }) => {
      await supabase.from(LIVE_EXAM_SIGNAL_TABLE).insert({
        slot_id: resolvedSession.slot_id,
        session_id: resolvedSession.id,
        from_user_id: viewerId,
        from_role: viewerRole,
        to_user_id: resolvedSession.student_id,
        signal_type: signalType,
        stream_type: streamType,
        payload,
      });
    };

    const ensurePeer = async (streamType) => {
      const connectionId = viewerInstanceId || 'default';
      const peerKey = buildPeerKey(resolvedSession.student_id, streamType, connectionId);
      const existingPeer = webRtcPeersRef.current.get(peerKey);
      if (existingPeer) return { peer: existingPeer, connectionId };

      const peer = createLiveExamPeer({
        onIceCandidate: (candidate) =>
          void sendSignal({
            signalType: 'ice-candidate',
            streamType,
            payload: {
              ...serializeIceCandidate(candidate),
              connectionId,
            },
          }),
        onTrack: (event) => attachRemoteTrack(streamType, event),
      });

      webRtcPeersRef.current.set(peerKey, peer);
      return { peer, connectionId };
    };

    const requestStream = async (streamType) => {
      const { peer, connectionId } = await ensurePeer(streamType);
      if (peer.signalingState !== 'stable') return;
      const offer = await peer.createOffer({
        offerToReceiveAudio: streamType === 'camera',
        offerToReceiveVideo: true,
      });
      await peer.setLocalDescription(offer);
      await sendSignal({
        signalType: 'offer',
        streamType,
        payload: {
          ...serializeSessionDescription(peer.localDescription),
          connectionId,
        },
      });
    };

    const handleSignal = async (row) => {
      if (!row || processedWebRtcSignalIdsRef.current.has(String(row.id))) return;
      if (String(row.session_id || '') !== String(resolvedSession.id)) return;
      if (String(row.to_user_id || '') !== String(viewerId)) return;
      if (String(row.from_user_id || '') !== String(resolvedSession.student_id)) return;

      const streamType = row.stream_type === 'screen' ? 'screen' : 'camera';
      const connectionId = String(row.payload?.connectionId || viewerInstanceId || 'default');
      const peerKey = buildPeerKey(resolvedSession.student_id, streamType, connectionId);
      let peer = webRtcPeersRef.current.get(peerKey);
      if (!peer) {
        const ensured = await ensurePeer(streamType);
        peer = ensured.peer;
      }

      if (row.signal_type === 'answer' && row.payload?.sdp) {
        await peer.setRemoteDescription(new RTCSessionDescription(row.payload));
        processedWebRtcSignalIdsRef.current.add(String(row.id));
        return;
      }

      if (row.signal_type === 'ice-candidate' && row.payload?.candidate) {
        await peer.addIceCandidate(new RTCIceCandidate(row.payload));
        processedWebRtcSignalIdsRef.current.add(String(row.id));
      }
    };

    const closePeers = () => {
      if (webRtcPollTimerRef.current) {
        window.clearInterval(webRtcPollTimerRef.current);
        webRtcPollTimerRef.current = null;
      }
      webRtcPeersRef.current.forEach((peer) => {
        try {
          peer.close();
        } catch {
          // ignore peer close errors
        }
      });
      webRtcPeersRef.current.clear();
    };

    const channel = supabase
      .channel(`live-exam-webrtc-viewer-${resolvedSession.id}-${viewerId}-${viewerInstanceId || 'default'}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: LIVE_EXAM_SIGNAL_TABLE },
        (payload) => {
          void handleSignal(payload?.new);
        }
      )
      .subscribe();

    const fetchRecentSignals = async () => {
      const { data, error: signalError } = await supabase
        .from(LIVE_EXAM_SIGNAL_TABLE)
        .select('*')
        .eq('session_id', resolvedSession.id)
        .eq('to_user_id', viewerId)
        .order('created_at', { ascending: false })
        .limit(40);
      if (signalError) return;
      (data || []).reverse().forEach((row) => {
        void handleSignal(row);
      });
    };

    void requestStream('screen');
    void requestStream('camera');
    void fetchRecentSignals();
    webRtcPollTimerRef.current = window.setInterval(() => {
      void fetchRecentSignals();
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
      closePeers();
    };
  }, [audioEnabled, resolvedSession?.id, resolvedSession?.slot_id, resolvedSession?.student_id, viewerId, viewerInstanceId, viewerRole]);

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
    if (!resolvedSession?.id) return;
    const roomConnected =
      String(debugState.room).toLowerCase() === String(ConnectionState.Connected).toLowerCase();
    const sessionMediaConnected =
      Boolean(resolvedSession?.screen_share_connected) ||
      Boolean(resolvedSession?.camera_connected) ||
      Boolean(resolvedSession?.mic_connected);
    const hasVideoFeed =
      debugState.screen === 'connected' ||
      debugState.camera === 'connected';

    if (!roomConnected || !sessionMediaConnected || hasVideoFeed) return;

    const reconnectSignature = [
      resolvedSession.id,
      resolvedSession.updated_at || '',
      resolvedSession.screen_share_connected ? 'screen' : '',
      resolvedSession.camera_connected ? 'camera' : '',
      resolvedSession.mic_connected ? 'mic' : '',
    ].join(':');

    if (lastMediaReconnectSignatureRef.current !== reconnectSignature) {
      lastMediaReconnectSignatureRef.current = reconnectSignature;
      mediaReconnectAttemptsRef.current.set(reconnectSignature, 0);
    }

    const attempts = mediaReconnectAttemptsRef.current.get(reconnectSignature) || 0;
    if (attempts >= 3) return;

    const timer = window.setTimeout(() => {
      mediaReconnectAttemptsRef.current.set(reconnectSignature, attempts + 1);
      disconnectSharedRoomNow(connectionKey, 'Refreshing live preview...');
      setRoomReconnectNonce((value) => value + 1);
    }, 2500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    connectionKey,
    debugState.camera,
    debugState.room,
    debugState.screen,
    resolvedSession?.camera_connected,
    resolvedSession?.id,
    resolvedSession?.mic_connected,
    resolvedSession?.screen_share_connected,
    resolvedSession?.updated_at,
  ]);

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
    const sessionMediaConnected =
      Boolean(resolvedSession?.screen_share_connected) ||
      Boolean(resolvedSession?.camera_connected) ||
      Boolean(resolvedSession?.mic_connected);
    const hasVideoFeed =
      debugState.screen === 'connected' ||
      debugState.camera === 'connected';

    if (hasVideoFeed) {
      setStatus('Live stream connected.');
      return;
    }
    if (roomConnected && sessionMediaConnected) {
      setStatus('Live media was granted. Waiting for the preview stream to attach...');
      return;
    }
    if (roomConnected) {
      setStatus(
        String(sessionStatus).toLowerCase() === 'active'
          ? 'Student is still on the permission/fullscreen steps. Live camera and screen will appear after they allow access.'
          : 'Waiting for student camera/screen share...'
      );
      return;
    }
    if (String(debugState.room).toLowerCase() === 'fetching token') {
      setStatus('Connecting live preview...');
      return;
    }
    setStatus('Connecting live preview...');
  }, [
    debugState.room,
    debugState.screen,
    debugState.camera,
    error,
    resolvedSession?.id,
    resolvedSession?.screen_share_connected,
    resolvedSession?.camera_connected,
    resolvedSession?.mic_connected,
    sessionStatus,
    viewerId,
    hasStartedSession,
  ]);

  const statusTone = useMemo(() => {
    if (error) return 'text-rose-300';
    if (status.toLowerCase().includes('connected')) return 'text-emerald-300';
    return 'text-slate-300';
  }, [error, status]);
  const displayRoomState = debugState.room || '-';
  const displayScreenState =
    debugState.screen === 'connected' || resolvedSession?.screen_share_connected ? 'connected' : debugState.screen;
  const displayCameraState =
    debugState.camera === 'connected' || resolvedSession?.camera_connected ? 'connected' : debugState.camera;
  const displayMicState =
    debugState.mic === 'connected' || resolvedSession?.mic_connected ? 'connected' : debugState.mic;

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
          <p className="mt-2 text-[11px] text-slate-400">Room: {displayRoomState} | Screen: {displayScreenState}</p>
        ) : null}
      </div>

      <div className={compact ? 'grid gap-3' : 'grid gap-3 lg:grid-cols-[1fr_0.36fr]'}>
        <div className={streamCardClass}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Live Camera</p>
            {!compact ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAudioEnabled((prev) => !prev)}
                  className="rounded-xl border border-slate-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
                >
                  {audioEnabled ? 'Mute Student Mic' : 'Listen Student Mic'}
                </button>
                {canUseSupportTalk ? (
                  <button
                    type="button"
                    onClick={() => (supportTalkActive ? stopSupportTalk() : startSupportTalk())}
                    disabled={supportTalkBusy || !hasStartedSession}
                    className={`rounded-xl px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50 ${
                      supportTalkActive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-teal-600 hover:bg-teal-700'
                    }`}
                  >
                    {supportTalkBusy ? 'Starting...' : supportTalkActive ? 'Stop Support Talk' : 'Talk To Student'}
                  </button>
                ) : null}
              </div>
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
            <p className="mt-2 text-[11px] text-slate-400">Camera: {displayCameraState} | Mic: {displayMicState}</p>
          ) : null}
        </div>

        {!compact ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mic</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {displayMicState === 'connected'
                ? (audioEnabled ? 'Live microphone monitoring enabled.' : 'Student microphone is connected. Click Listen Student Mic to hear it.')
                : 'Student mic is waiting, muted, silent, or unavailable.'}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Use Talk To Student for support voice. Students do not get a mute button for this support audio.
            </p>
            {supportTalkError ? <p className="mt-2 text-xs font-semibold text-rose-600">{supportTalkError}</p> : null}
            {supportTalkActive ? <p className="mt-2 text-xs font-semibold text-teal-700">Your microphone is live to this student.</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
