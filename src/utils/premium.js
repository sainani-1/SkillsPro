export const isLifetimePremium = (premiumUntil) =>
  Boolean(premiumUntil) && new Date(premiumUntil).getUTCFullYear() >= 9999;

export const hasPremiumAccess = (profile) => {
  if (!profile) return false;
  if (profile.role === 'admin' || profile.role === 'teacher') return true;
  if (!profile.premium_until) return false;
  if (isLifetimePremium(profile.premium_until)) return true;
  return new Date(profile.premium_until) > new Date();
};

export const getPremiumPlanType = (profile) => {
  if (!profile) return 'free';
  if (profile.role === 'admin' || profile.role === 'teacher') return 'premium_plus';

  if (!hasPremiumAccess(profile)) return 'free';

  return profile.premium_plan_type === 'premium_plus' ? 'premium_plus' : 'premium';
};

export const getPremiumDaysRemaining = (premiumUntil) => {
  if (!premiumUntil || isLifetimePremium(premiumUntil)) return null;
  return Math.ceil((new Date(premiumUntil) - new Date()) / (1000 * 60 * 60 * 24));
};

export const isPremiumExpiringSoon = (premiumUntil, warningDays = 5) => {
  const daysRemaining = getPremiumDaysRemaining(premiumUntil);
  return daysRemaining !== null && daysRemaining > 0 && daysRemaining <= warningDays;
};

export const formatPremiumLabel = (premiumUntil, locale = 'en-IN') => {
  if (!premiumUntil) return 'Not Premium';
  if (isLifetimePremium(premiumUntil)) return 'Lifetime';
  return new Date(premiumUntil).toLocaleDateString(locale);
};
