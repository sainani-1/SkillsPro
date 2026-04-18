import { supabase } from '../supabaseClient';

const invokeUsernameRegistry = async (body) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/username-registry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  let data = {};
  const rawText = await response.text();
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { error: rawText || '' };
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      rawText ||
      `Username service request failed (HTTP ${response.status}).`
    );
  }
  if (data?.error) throw new Error(data.error);
  return data || {};
};

export const ensureUsernamesForUsers = async (users) => {
  const list = Array.isArray(users) ? users.filter((user) => user?.id) : [];
  if (!list.length) return [];

  const response = await invokeUsernameRegistry({
    action: 'ensure',
    users: list.map((user) => ({
      id: user.id,
      full_name: user.full_name || '',
      created_at: user.created_at || null,
    })),
  });

  const usernamesByUserId = response?.usernames || {};
  return list.map((user) => ({
    ...user,
    username: usernamesByUserId[user.id] || '',
  }));
};

export const ensureUsernameForUser = async (user) => {
  const [result] = await ensureUsernamesForUsers(user ? [user] : []);
  return result || user || null;
};

export const updateUsernameForUser = async ({ userId, username }) => {
  const response = await invokeUsernameRegistry({
    action: 'update',
    userId,
    username,
  });
  return response?.username || '';
};
