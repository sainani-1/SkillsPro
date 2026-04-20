import React from 'react';
import { Link } from 'react-router-dom';
import { Award, X } from 'lucide-react';
import { buildPlanCheckoutPath } from '../utils/planCheckout';
import { getPremiumPlanType } from '../utils/premium';

const PremiumPlusUpgradeGate = ({ profile, title = 'Premium Plus Required', message, onClose = null }) => {
  const planType = getPremiumPlanType(profile);
  const isPremium = planType === 'premium';
  const ctaLabel = isPremium ? 'Upgrade to Premium Plus' : 'Buy Premium Plus';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 text-center shadow-2xl">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            aria-label="Close upgrade popup"
          >
            <X size={18} />
          </button>
        ) : null}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <Award size={28} />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-slate-900">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {message || 'This career support feature is included with Premium Plus.'}
        </p>
        <Link
          to={buildPlanCheckoutPath('premium_plus')}
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
        >
          {ctaLabel}
        </Link>
        {isPremium ? (
          <p className="mt-3 text-xs text-slate-500">Your Premium plan is active. Upgrade to Premium Plus to unlock this feature.</p>
        ) : (
          <p className="mt-3 text-xs text-slate-500">Premium Plus unlocks resume reviews, mock interviews, and monthly roadmaps.</p>
        )}
      </div>
    </div>
  );
};

export default PremiumPlusUpgradeGate;
