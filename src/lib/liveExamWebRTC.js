export const LIVE_EXAM_SIGNAL_TABLE = 'exam_live_webrtc_signals';

export const LIVE_EXAM_ICE_SERVERS = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
    ],
  },
];

export const buildPeerKey = (userId, streamType, connectionId = 'default') =>
  `${userId}:${streamType}:${connectionId}`;

export const createLiveExamPeer = ({ onIceCandidate, onTrack } = {}) => {
  const peer = new RTCPeerConnection({ iceServers: LIVE_EXAM_ICE_SERVERS });
  peer.onicecandidate = (event) => {
    if (event.candidate && onIceCandidate) {
      onIceCandidate(event.candidate);
    }
  };
  if (onTrack) {
    peer.ontrack = onTrack;
  }
  return peer;
};

export const serializeSessionDescription = (description) => {
  if (!description) return null;
  return {
    type: description.type,
    sdp: description.sdp,
  };
};

export const serializeIceCandidate = (candidate) => {
  if (!candidate) return null;
  if (typeof candidate.toJSON === 'function') {
    return candidate.toJSON();
  }
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
    usernameFragment: candidate.usernameFragment,
  };
};
