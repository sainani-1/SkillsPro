import React, { useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  generateRotatingAccessCode,
  getAccessCodeTimeRemainingMs,
} from '../utils/rotatingAccessCode';

const formatSeconds = (value) => String(Math.max(0, value)).padStart(2, '0');

export default function AdminAccessCodes() {
  const adminSeed = import.meta.env.VITE_ADMIN_ACCESS_KEY || '';
  const teacherSeed = import.meta.env.VITE_TEACHER_ACCESS_KEY || '';
  const [now, setNow] = useState(Date.now());
  const [copiedKey, setCopiedKey] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const adminCode = useMemo(
    () => generateRotatingAccessCode(adminSeed, 'admin'),
    [adminSeed, now]
  );
  const teacherCode = useMemo(
    () => generateRotatingAccessCode(teacherSeed, 'teacher'),
    [teacherSeed, now]
  );
  const remainingSeconds = Math.ceil(getAccessCodeTimeRemainingMs(now) / 1000);

  const copyCode = async (label, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(label);
      window.setTimeout(() => setCopiedKey(''), 1500);
    } catch {
      setCopiedKey('');
    }
  };

  const codeCards = [
    {
      id: 'admin',
      label: 'Admin Protection Code',
      description: 'Use this along with the admin access key when creating an admin account.',
      code: adminCode,
      tone: 'border-rose-200 bg-rose-50 text-rose-800',
    },
    {
      id: 'teacher',
      label: 'Teacher Protection Code',
      description: 'Use this along with the teacher access key when creating a teacher account.',
      code: teacherCode,
      tone: 'border-blue-200 bg-blue-50 text-blue-800',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Extra Protection</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Rotating Access Codes</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              These codes rotate every 1 minute and must be entered together with the existing admin or teacher access key.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Refresh In</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{formatSeconds(remainingSeconds)}s</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {codeCards.map((card) => (
          <div key={card.id} className={`rounded-3xl border p-6 shadow-sm ${card.tone}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <KeyRound size={18} />
                  <h2 className="text-lg font-bold">{card.label}</h2>
                </div>
                <p className="mt-2 text-sm opacity-90">{card.description}</p>
              </div>
              <button
                type="button"
                onClick={() => copyCode(card.id, card.code)}
                className="inline-flex items-center gap-2 rounded-xl border border-current/20 bg-white/70 px-3 py-2 text-xs font-semibold hover:bg-white"
              >
                <Copy size={14} />
                {copiedKey === card.id ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="mt-5 rounded-2xl border border-current/20 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">Current Code</p>
              <p className="mt-3 break-all font-mono text-3xl font-bold tracking-[0.16em]">{card.code || 'Not configured'}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 text-emerald-600" size={20} />
          <div className="space-y-2 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">How it works</p>
            <p>1. Share the normal access key and the current rotating protection code.</p>
            <p>2. The code changes automatically every 60 seconds.</p>
            <p>3. Admin and teacher registration now require both values before account creation is allowed.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
