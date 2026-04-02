export const normalizeCheckoutPlanTier = (value) =>
  value === 'premium_plus' ? 'premium_plus' : 'premium';

export const buildPlanCheckoutPath = (planTier = 'premium', extraParams = {}) => {
  const params = new URLSearchParams({
    plan: normalizeCheckoutPlanTier(planTier),
  });

  Object.entries(extraParams || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });

  return `/app/payment?${params.toString()}`;
};
