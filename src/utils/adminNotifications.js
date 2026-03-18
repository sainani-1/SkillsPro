import { supabase } from '../supabaseClient';

export async function sendAdminNotification(payload) {
  try {
    const normalizedPayload = {
      type: 'info',
      target_role: 'admin',
      ...payload,
    };

    const { error } = await supabase.from('admin_notifications').insert(normalizedPayload);
    if (
      error &&
      String(error.message || '').includes('target_user_id')
    ) {
      const { target_user_id, ...fallback } = normalizedPayload;
      const marker = target_user_id ? `[target_user_id:${target_user_id}] ` : '';
      await supabase.from('admin_notifications').insert({
        ...fallback,
        content:
          marker && !String(fallback.content || '').includes('[target_user_id:')
            ? `${marker}${fallback.content || ''}`
            : fallback.content,
      });
    } else if (error) {
      throw error;
    }
  } catch (error) {
    console.warn('Admin notification failed:', error?.message || error);
  }
}
