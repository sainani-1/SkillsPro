import { supabase } from '../supabaseClient';

export const trackPremiumEvent = async (eventName, source, metadata = {}, userId = null) => {
  try {
    await supabase.from('premium_event_logs').insert({
      user_id: userId || null,
      event_name: eventName,
      source: source || null,
      metadata,
    });
  } catch (error) {
    console.error('Failed to track premium event:', error);
  }
};

export const submitMarketingLead = async (payload) => {
  return supabase.from('marketing_leads').insert(payload);
};

export const buildWhatsAppShareUrl = (text) =>
  `https://wa.me/?text=${encodeURIComponent(text)}`;

export const copyText = async (value) => {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  return false;
};

export const claimPremiumPass = async () => {
  const { data, error } = await supabase.functions.invoke('claim-premium-pass', {
    body: {},
  });
  if (error) {
    throw new Error(error.message || 'Failed to claim premium pass.');
  }
  return data;
};
