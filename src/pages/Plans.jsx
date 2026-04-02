import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { CheckCircle, Sparkles, Crown } from 'lucide-react';
import { buildPlanCheckoutPath } from '../utils/planCheckout';

const PLAN_FEATURES = {
  premium: [
    'Courses',
    'Write Test',
    'Certificates',
    'Resume Builder',
    'Live Classes',
    'Normal Support',
  ],
  premium_plus: [
    'Everything in Premium',
    'Ask a Doubt',
    'Mentoring Session Request',
    'Notes Library',
    'Priority Support',
    '2 Resume Reviews per Cycle',
    '1 Mock Interview per Month',
    'Monthly Personal Roadmap Update',
  ],
};

const getPlanFeatureList = (tier) =>
  tier === 'premium_plus' ? PLAN_FEATURES.premium_plus : PLAN_FEATURES.premium;

const Plans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'public_plans')
          .maybeSingle();
        const parsed = data?.value ? JSON.parse(data.value) : [];
        const activePlans = Array.isArray(parsed)
          ? parsed
              .filter((p) => p?.isActive)
              .map((plan) => ({
                ...plan,
                tier: plan?.tier === 'premium_plus' ? 'premium_plus' : 'premium',
                features: Array.isArray(plan?.features) ? plan.features.filter(Boolean) : [],
              }))
          : [];
        setPlans(activePlans);
      } catch {
        setPlans([]);
      } finally {
        setLoading(false);
      }
    };
    loadPlans();
  }, []);

  const orderedPlans = useMemo(() => {
    return [...plans].sort((a, b) => {
      if (a.isLifetimeFree && !b.isLifetimeFree) return -1;
      if (!a.isLifetimeFree && b.isLifetimeFree) return 1;
      return (a.cost || 0) - (b.cost || 0);
    });
  }, [plans]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#fde68a_0%,#fff_35%,#f8fafc_100%)] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-amber-900 text-white px-6 py-10 md:px-10 mb-10 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(251,191,36,0.35),transparent_35%)]" />
          <div className="relative z-10 text-center">
            <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-semibold tracking-wide">
              <Sparkles size={14} /> Flexible Memberships
            </p>
            <h1 className="text-4xl md:text-5xl font-serif font-bold mt-4">Choose Your Plan</h1>
            <p className="text-slate-200 mt-3">Pick the best plan and start your premium learning journey.</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-slate-500 bg-white rounded-2xl border border-slate-200 p-8">Loading plans...</div>
        ) : orderedPlans.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <p className="text-slate-600">No plans are available right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orderedPlans.map((plan) => {
              const featureList = getPlanFeatureList(plan.tier);
              return (
              <div key={plan.id} className="relative bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
                <div className="absolute top-4 right-4">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    plan.tier === 'premium_plus'
                      ? 'bg-indigo-100 text-indigo-700'
                      : plan.isLifetimeFree
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-800'
                  }`}>
                    {plan.tier === 'premium_plus' ? 'Premium Plus' : plan.isLifetimeFree ? 'Best Value' : 'Popular'}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">{plan.name}</h2>
                <p className="mt-3 text-3xl font-extrabold text-amber-700">
                  {plan.isLifetimeFree ? 'Lifetime Free' : `INR ${plan.cost || 0}`}
                </p>
                <p className="text-sm text-slate-600 mt-1">Period: {plan.periodMonths || '-'} month(s)</p>
                {plan.validUntil ? (
                  <p className="text-xs text-slate-500 mt-1">
                    Valid until: {new Date(plan.validUntil).toLocaleDateString('en-IN')}
                  </p>
                ) : null}
                <p className="text-sm text-slate-600 mt-4 min-h-[44px]">
                  {plan.tier === 'premium_plus'
                    ? 'Ask doubts, request mentoring sessions, unlock notes, and get higher-touch support.'
                    : 'Courses, tests, certificates, resume builder, live classes, and normal support.'}
                </p>
                <div className="mt-5 space-y-2 text-sm text-slate-700">
                  {featureList.map((feature, index) => (
                    <p key={`${plan.id}-feature-${index}`} className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-emerald-600" /> {feature}
                    </p>
                  ))}
                </div>
                <Link
                  to={buildPlanCheckoutPath(plan.tier)}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold-400 text-nani-dark font-bold py-2.5 hover:bg-gold-500 transition"
                >
                  <Crown size={16} />
                  {plan.tier === 'premium_plus' ? 'Buy Premium Plus' : 'Buy Premium'}
                </Link>
              </div>
            )})}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link to="/" className="text-slate-600 hover:text-slate-900 font-semibold">Back to Home</Link>
        </div>
      </div>
    </div>
  );
};

export default Plans;
