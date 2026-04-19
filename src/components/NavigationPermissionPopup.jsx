import React from 'react';
import { ArrowRight, ShieldCheck, X } from 'lucide-react';

const NavigationPermissionPopup = ({
  open,
  targetLabel = 'the selected page',
  onAllow,
  onDeny,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="bg-slate-950 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gold-400 text-slate-950">
                <ShieldCheck size={22} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">Permission Required</p>
                <h2 className="text-lg font-bold">Allow page switch?</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onDeny}
              className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Close permission popup"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <p className="text-sm leading-6 text-slate-600">
            You are moving to <span className="font-semibold text-slate-950">{targetLabel}</span>. Please allow this
            switch to continue.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This check appears every time you move from one sidebar page to another.
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDeny}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Do Not Allow
          </button>
          <button
            type="button"
            onClick={onAllow}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-gold-300"
          >
            Allow And Open
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationPermissionPopup;
