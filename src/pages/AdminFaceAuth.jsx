import React, { useEffect, useRef, useState } from 'react';
import { Camera, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AdminFaceAuth = () => {
  const { profile } = useAuth();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [message, setMessage] = useState('');

  const storageKey = profile?.id ? `admin_face_auth_registered_${profile.id}` : null;
  const [registered, setRegistered] = useState(false);

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

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  };

  const startCamera = async () => {
    setErrorMsg('');
    setMessage('');
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

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const registerFaceForThisDevice = () => {
    if (!storageKey) {
      setErrorMsg('Admin profile not loaded yet. Please refresh and try again.');
      return;
    }
    if (!cameraReady) {
      setErrorMsg('Start camera first, then register face auth.');
      return;
    }
    try {
      localStorage.setItem(storageKey, 'true');
      setRegistered(true);
      setMessage('Face auth registered for this browser/device.');
      setErrorMsg('');
    } catch {
      setErrorMsg('Could not save face auth setting on this device.');
    }
  };

  const removeFaceRegistration = () => {
    if (!storageKey) {
      setErrorMsg('Admin profile not loaded yet. Please refresh and try again.');
      return;
    }
    try {
      localStorage.removeItem(storageKey);
      sessionStorage.removeItem('admin_face_verified');
      setRegistered(false);
      setMessage('Face auth registration removed for this browser/device.');
      setErrorMsg('');
    } catch {
      setErrorMsg('Could not remove face auth registration.');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Face Authentication</h1>
        <p className="text-slate-500 text-sm">
          Optional setup. Register face-auth on this browser/device after MFA.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <ShieldCheck size={18} className={registered ? 'text-emerald-600' : 'text-slate-500'} />
          <span className={registered ? 'text-emerald-700 font-semibold' : 'text-slate-600'}>
            {registered ? 'Registered on this device' : 'Not registered on this device'}
          </span>
        </div>

        {errorMsg ? (
          <div className="border border-red-200 bg-red-50 text-red-700 rounded-lg p-3 text-sm">{errorMsg}</div>
        ) : null}
        {message ? (
          <div className="border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg p-3 text-sm">{message}</div>
        ) : null}

        <div className="rounded-lg bg-slate-900 overflow-hidden max-w-md">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-64 object-cover" />
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
            onClick={registerFaceForThisDevice}
            disabled={!cameraReady}
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
          >
            <ShieldCheck size={16} />
            Register Face Auth
          </button>

          <button
            onClick={removeFaceRegistration}
            className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200"
          >
            <Trash2 size={16} />
            Remove Registration
          </button>
        </div>

        <p className="text-xs text-slate-500">
          This setup is optional and currently stored per browser/device for admin convenience.
        </p>
      </div>
    </div>
  );
};

export default AdminFaceAuth;
