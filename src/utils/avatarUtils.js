const STORAGE_PUBLIC_MARKER = '/storage/v1/object/public/avatars/';
const STORAGE_SIGNED_MARKER = '/storage/v1/object/sign/avatars/';

export const FALLBACK_AVATAR = 'https://ui-avatars.com/api/?name=User&background=e2e8f0&color=334155&bold=true&size=200';
const DEFAULT_AVATAR_URLS = new Set([
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=200&q=80'
]);

export const isDefaultAvatarUrl = (avatarUrl) => {
  if (!avatarUrl) return true;
  const raw = String(avatarUrl).trim();
  return DEFAULT_AVATAR_URLS.has(raw);
};

export const extractAvatarObjectPath = (avatarUrl) => {
  if (!avatarUrl) return null;
  const raw = String(avatarUrl).trim();
  if (!raw) return null;

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    if (raw.includes(STORAGE_PUBLIC_MARKER)) {
      return decodeURIComponent(raw.split(STORAGE_PUBLIC_MARKER)[1].split('?')[0] || '');
    }
    if (raw.includes(STORAGE_SIGNED_MARKER)) {
      return decodeURIComponent(raw.split(STORAGE_SIGNED_MARKER)[1].split('?')[0] || '');
    }
    return null;
  }

  return raw.replace(/^\/+/, '');
};

export const normalizeAvatarUrl = (avatarUrl) => {
  if (!avatarUrl) return FALLBACK_AVATAR;
  const raw = String(avatarUrl).trim();
  if (!raw) return FALLBACK_AVATAR;
  if (isDefaultAvatarUrl(raw)) return FALLBACK_AVATAR;

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return FALLBACK_AVATAR;

  const cleanPath = raw.replace(/^\/+/, '');
  const objectPath = cleanPath.replace(/^avatars\//, '');
  return `${supabaseUrl}/storage/v1/object/public/avatars/${objectPath}`;
};

export const buildAvatarPublicUrl = (objectPath) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl || !objectPath) return null;
  const clean = String(objectPath).replace(/^\/+/, '');
  const finalPath = clean.replace(/^avatars\//, '');
  return `${supabaseUrl}/storage/v1/object/public/avatars/${finalPath}`;
};
