import React, { useEffect, useRef, useState } from 'react';
import { Camera, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminFaceVerify = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [registered, setRegistered] = useState(false);

  const storageKey = profile?.id ? `admin_face_auth_registered_${profile.id}` : null;

  useEffect(() => {
    if (!storageKey) {
      setRegistered(false);
      return;
    }
    try {
      setRegistered(localStorage.getItem(storageKey) === 'true');
    } catch {
      setRegistered(false);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!loading && profile?.role !== 'admin') {
      navigate('/login', { replace: true });
      return;
    }
    if (!loading && !sessionStorage.getItem('admin_mfa_verified')) {
      navigate('/admin-mfa-verify', { replace: true });
      return;
    }
    if (!loading && profile?.role === 'admin' && !registered) {
      navigate('/app/admin/face-auth', { replace: true });
    }
  }, [loading, profile, registered, navigate]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setErrorMsg('');
    setCameraLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch (error) {
      setErrorMsg(error?.message || 'Unable to access camera.');
    } finally {
      setCameraLoading(false);
    }
  };

  const verifyFace = () => {
    if (!cameraReady) {
      setErrorMsg('Please start camera before verifying face.');
      return;
    }
    if (!videoRef.current || videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      setErrorMsg('Camera feed is empty. Allow camera and try again.');
      return;
    }
    sessionStorage.setItem('admin_face_verified', 'true');
    navigate('/app/admin/users', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Admin Face Verification</h1>
        <p className="text-sm text-slate-600">
          Face Auth is enabled on this device. Complete verification to continue.
        </p>

        {errorMsg ? (
          <div className="border border-red-200 bg-red-50 text-red-700 rounded-lg p-3 text-sm">{errorMsg}</div>
        ) : null}

        <div className="rounded-lg overflow-hidden bg-slate-900">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-72 object-cover" />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={startCamera}
            disabled={cameraLoading}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            <Camera size={16} />
            {cameraLoading ? 'Starting camera...' : cameraReady ? 'Restart Camera' : 'Start Camera'}
          </button>

          <button
            onClick={verifyFace}
            disabled={!cameraReady}
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
          >
            <ShieldCheck size={16} />
            Verify Face
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminFaceVerify;
