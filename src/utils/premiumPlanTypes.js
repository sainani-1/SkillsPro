import { supabase } from '../supabaseClient';

const PREMIUM_PLAN_TYPES_KEY = 'premium_plan_types';

const normalizePlanType = (value) => (value === 'premium_plus' ? 'premium_plus' : 'premium');

export const parsePremiumPlanTypeMap = (rawValue) => {
  if (!rawValue) return {};

  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.entries(parsed).reduce((acc, [userId, planType]) => {
      const normalizedUserId = String(userId || '').trim();
      if (!normalizedUserId) return acc;
      acc[normalizedUserId] = normalizePlanType(planType);
      return acc;
    }, {});
  } catch {
    return {};
  }
};

export const fetchPremiumPlanTypeMap = async () => {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', PREMIUM_PLAN_TYPES_KEY)
    .maybeSingle();

  if (error) throw error;
  return parsePremiumPlanTypeMap(data?.value);
};

const savePremiumPlanTypeMap = async (planTypeMap) => {
  const { error } = await supabase
    .from('settings')
    .upsert(
      {
        key: PREMIUM_PLAN_TYPES_KEY,
        value: JSON.stringify(planTypeMap || {}),
      },
      { onConflict: 'key' }
    );

  if (error) throw error;
};

export const fetchUserPremiumPlanType = async (userId) => {
  if (!userId) return 'premium';
  const planTypeMap = await fetchPremiumPlanTypeMap();
  return planTypeMap[userId] || 'premium';
};

export const setUserPremiumPlanType = async (userId, planType) => {
  if (!userId) return {};
  const planTypeMap = await fetchPremiumPlanTypeMap();
  const nextPlanTypeMap = {
    ...planTypeMap,
    [userId]: normalizePlanType(planType),
  };
  await savePremiumPlanTypeMap(nextPlanTypeMap);
  return nextPlanTypeMap;
};

export const clearUserPremiumPlanType = async (userId) => {
  if (!userId) return {};
  const planTypeMap = await fetchPremiumPlanTypeMap();
  const nextPlanTypeMap = { ...planTypeMap };
  delete nextPlanTypeMap[userId];
  await savePremiumPlanTypeMap(nextPlanTypeMap);
  return nextPlanTypeMap;
};
