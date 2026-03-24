import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ConnectionState, Room, RoomEvent, Track } from 'livekit-client';
import { getLiveKitTokenForSession } from '../lib/livekitSession';

function detachTrack(track, element) {
  try {
    track?.detach?.(element);
  } catch {
    // ignore detach issues
  }
}

export default function LiveExamStreamMonitor({
  session,
  viewerId,
  compact = false,
  large = false,
}) {
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Connecting live preview...');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [debugState, setDebugState] = useState({
    room: '-',
    screen: 'waiting',
    camera: 'waiting',
    mic: 'waiting',
  });
  const roomRef = useRef(null);
  const connectedSessionKeyRef = useRef('');
  const screenVideoRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const audioRef = useRef(null);

  const streamCardClass = compact
    ? 'rounded-2xl border border-slate-800 bg-slate-950 p-2'
    : 'rounded-3xl border border-slate-200 bg-slate-950 p-3';
  const screenHeightClass = compact ? 'h-36' : large ? 'h-[30rem]' : 'h-72';
  const cameraHeightClass = compact ? 'h-36' : large ? 'h-[24rem]' : 'h-72';
  const sessionStatus = String(session?.status || '').toLowerCase();
  const connectionKey = `${viewerId || ''}:${session?.id || ''}`;

  useEffect(() => {
    if (!session?.id || !viewerId || !['active', 'paused', 'scheduled'].includes(sessionStatus)) {
      if (roomRef.current) {
        roomRef.current.disconnect?.();
        roomRef.current = null;
        connectedSessionKeyRef.current = '';
      }
      setStatus('Student is not live right now.');
      setError('');
      setDebugState({
        room: '-',
        screen: 'waiting',
        camera: 'waiting',
        mic: 'waiting',
      });
      return undefined;
    }

    if (roomRef.current && connectedSessionKeyRef.current === connectionKey) {
      return undefined;
    }

    let mounted = true;
    const detachFns = [];

    const cleanup = () => {
      detachFns.forEach((fn) => fn());
      detachFns.length = 0;
      roomRef.current?.disconnect?.();
      roomRef.current = null;
      connectedSessionKeyRef.current = '';
      if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
      if (audioRef.current) audioRef.current.srcObject = null;
    };

    const attachPublication = (publication) => {
      const subscribedTrack = publication?.track;
      if (!subscribedTrack) return;

      if (publication.source === Track.Source.ScreenShare && subscribedTrack.kind === Track.Kind.Video) {
        const element = screenVideoRef.current;
        if (!element) return;
        subscribedTrack.attach(element);
        setDebugState((prev) => ({ ...prev, screen: 'connected' }));
        detachFns.push(() => detachTrack(subscribedTrack, element));
        return;
      }

      if (publication.source === Track.Source.Camera && subscribedTrack.kind === Track.Kind.Video) {
        const element = cameraVideoRef.current;
        if (!element) return;
        subscribedTrack.attach(element);
        setDebugState((prev) => ({ ...prev, camera: 'connected' }));
        detachFns.push(() => detachTrack(subscribedTrack, element));
        return;
      }

      if (publication.source === Track.Source.Microphone && subscribedTrack.kind === Track.Kind.Audio) {
        const element = audioRef.current;
        if (!element) return;
        subscribedTrack.attach(element);
        element.muted = !audioEnabled;
        setDebugState((prev) => ({ ...prev, mic: 'connected' }));
        detachFns.push(() => detachTrack(subscribedTrack, element));
      }
    };

    const connectRoom = async () => {
      try {
        setError('');
        setStatus('Connecting live preview...');
        setDebugState({
          room: 'fetching token',
          screen: 'waiting',
          camera: 'waiting',
          mic: 'waiting',
        });

        const tokenData = await getLiveKitTokenForSession({
          sessionId: session.id,
          mode: 'observer',
          requesterId: viewerId,
        });
        if (!mounted) return;

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;
        connectedSessionKeyRef.current = connectionKey;

        room
          .on(RoomEvent.ConnectionStateChanged, (state) => {
            setDebugState((prev) => ({ ...prev, room: state }));
            setStatus(state === ConnectionState.Connected ? 'Live stream connected.' : 'Connecting live preview...');
          })
          .on(RoomEvent.TrackSubscribed, (track, publication) => {
            attachPublication({ ...publication, track });
          })
          .on(RoomEvent.TrackUnsubscribed, (_, publication) => {
            if (publication.source === Track.Source.ScreenShare) {
              setDebugState((prev) => ({ ...prev, screen: 'waiting' }));
            }
            if (publication.source === Track.Source.Camera) {
              setDebugState((prev) => ({ ...prev, camera: 'waiting' }));
            }
            if (publication.source === Track.Source.Microphone) {
              setDebugState((prev) => ({ ...prev, mic: 'waiting' }));
            }
          });

        await room.connect(tokenData.url, tokenData.token, {
          autoSubscribe: true,
        });
        if (!mounted) return;

        room.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((publication) => {
            attachPublication(publication);
          });
        });

        setStatus('Live stream connected.');
      } catch (connectionError) {
        if (!mounted) return;
        setError(connectionError.message || 'Failed to connect LiveKit preview.');
        setStatus('Live stream unavailable.');
      }
    };

    void connectRoom();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [session?.id, viewerId, connectionKey, sessionStatus]);

  useEffect(() => {
    if (!roomRef.current) return;
    if (['active', 'paused', 'scheduled'].includes(sessionStatus)) return;
    roomRef.current.disconnect?.();
    roomRef.current = null;
    connectedSessionKeyRef.current = '';
    setStatus('Student is not live right now.');
    setDebugState({
      room: '-',
      screen: 'waiting',
      camera: 'waiting',
      mic: 'waiting',
    });
  }, [sessionStatus]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = !audioEnabled;
      const playPromise = audioRef.current.play?.();
      if (playPromise?.catch) {
        playPromise.catch(() => {});
      }
    }
  }, [audioEnabled]);

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
