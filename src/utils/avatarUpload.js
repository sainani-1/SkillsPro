import { prepareAvatarFile } from './imageUtils';

export const getPendingAvatarKey = (email) =>
  `pending_registration_avatar_${String(email || '').trim().toLowerCase()}`;

export const uploadAvatarForUser = async (supabase, userId, file) => {
  if (!userId || !file) return null;

  const safeFile = await prepareAvatarFile(file);
  const sourceFile = safeFile || file;
  const fileExt = sourceFile?.name?.split('.').pop() || file.name.split('.').pop() || 'jpg';
  const filePath = `${userId}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, sourceFile, {
      upsert: true,
      contentType: sourceFile?.type || file.type || 'image/jpeg'
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  const publicUrl = data?.publicUrl || null;
  if (!publicUrl) throw new Error('Unable to get profile photo URL.');

  return publicUrl;
};

export const cachePendingRegistrationAvatar = async (email, sourceFile) => {
  if (!email || !sourceFile) return;

  const safeFile = await prepareAvatarFile(sourceFile);
  const fileForCache = safeFile || sourceFile;
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read avatar file'));
    reader.readAsDataURL(fileForCache);
  });

  localStorage.setItem(
    getPendingAvatarKey(email),
    JSON.stringify({
      dataUrl,
      mime: fileForCache.type || 'image/jpeg',
      savedAt: new Date().toISOString()
    })
  );
};
