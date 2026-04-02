import React from 'react';
import { Link } from 'react-router-dom';
import { FileBadge2, ShieldCheck } from 'lucide-react';

const VerifierDashboard = () => (
  <div className="space-y-6">
    <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-900 p-6 text-white">
      <h1 className="text-2xl font-bold">Verifier Panel</h1>
      <p className="mt-2 text-sm text-slate-200">
        Review student ID verification requests, then approve the certificate name or reject the request.
      </p>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <Link to="/app/verifier/id-verifications" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
        <ShieldCheck className="text-blue-600" size={28} />
        <h2 className="mt-4 text-lg font-bold text-slate-900">ID Verifications</h2>
        <p className="mt-2 text-sm text-slate-500">Open assigned ID verification requests to approve the name or reject the submission.</p>
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <FileBadge2 className="text-emerald-600" size={28} />
        <h2 className="mt-4 text-lg font-bold text-slate-900">Certificate Name Control</h2>
        <p className="mt-2 text-sm text-slate-500">When you approve a student, the approved name immediately becomes the certificate name used across the app.</p>
      </div>
    </div>
  </div>
);

export default VerifierDashboard;
