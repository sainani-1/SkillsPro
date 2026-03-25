export const isLifetimePremium = (premiumUntil) =>
  Boolean(premiumUntil) && new Date(premiumUntil).getUTCFullYear() >= 9999;

export const formatPremiumLabel = (premiumUntil, locale = 'en-IN') => {
  if (!premiumUntil) return 'Not Premium';
  if (isLifetimePremium(premiumUntil)) return 'Lifetime';
  return new Date(premiumUntil).toLocaleDateString(locale);
};
