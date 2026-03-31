import { supabase } from '../supabaseClient';

const NOTES_IMAGE_TOKEN_PREFIX = '__notes_image__:';

const normalizeAssetValue = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeAssetList = (values, fallbackValue) => {
  const sourceValues = Array.isArray(values)
    ? values
    : typeof fallbackValue === 'string'
      ? [fallbackValue]
      : [];

  const normalized = sourceValues
    .map((value) => normalizeAssetValue(value))
    .filter(Boolean);

  return Array.from(new Set(normalized));
};

const encodeNotesImageToken = (value) => {
  const normalized = normalizeAssetValue(value);
  return normalized ? `${NOTES_IMAGE_TOKEN_PREFIX}${normalized}` : null;
};

const decodeNotesImageToken = (value) => {
  if (typeof value !== 'string' || !value.startsWith(NOTES_IMAGE_TOKEN_PREFIX)) return null;
  return normalizeAssetValue(value.slice(NOTES_IMAGE_TOKEN_PREFIX.length));
};

export const sanitizeCourseProtectedAssets = (assets = {}) => {
  const rawNotes = normalizeAssetList(assets.notes_urls, assets.notes_url);
  const notes_image_url = rawNotes.map((value) => decodeNotesImageToken(value)).find(Boolean) || normalizeAssetValue(assets.notes_image_url);
  const notes_urls = rawNotes.filter((value) => !decodeNotesImageToken(value));

  return {
    video_url: normalizeAssetValue(assets.video_url),
    notes_image_url,
    notes_urls,
    notes_url: notes_urls[0] || null,
  };
};

export const fetchCourseProtectedAssetsMap = async (courseIds = []) => {
  const ids = Array.from(new Set((courseIds || []).filter(Boolean)));
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from('course_protected_assets')
    .select('course_id, video_url, notes_url, notes_urls')
    .in('course_id', ids);

  if (error) {
    throw error;
  }

  return (data || []).reduce((acc, row) => {
    acc[row.course_id] = sanitizeCourseProtectedAssets(row);
    return acc;
  }, {});
};

export const fetchCourseProtectedAssets = async (courseId) => {
  if (!courseId) return null;

  const { data, error } = await supabase
    .from('course_protected_assets')
    .select('course_id, video_url, notes_url, notes_urls')
    .eq('course_id', courseId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? sanitizeCourseProtectedAssets(data) : null;
};

export const upsertCourseProtectedAssets = async (courseId, assets = {}) => {
  if (!courseId) {
    throw new Error('Course ID is required to save protected assets.');
  }

  const payload = sanitizeCourseProtectedAssets(assets);
  const storedNotes = [
    ...(payload.notes_image_url ? [encodeNotesImageToken(payload.notes_image_url)] : []),
    ...payload.notes_urls,
  ];

  const { error } = await supabase
    .from('course_protected_assets')
    .upsert(
      {
        course_id: courseId,
        video_url: payload.video_url,
        notes_urls: storedNotes,
        notes_url: payload.notes_url,
      },
      { onConflict: 'course_id' }
    );

  if (error) {
    throw error;
  }

  return payload;
};

export const mergeCoursesWithProtectedAssets = (courses = [], assetMap = {}) =>
  (courses || []).map((course) => ({
    ...course,
    video_url: assetMap?.[course.id]?.video_url || '',
    notes_url: assetMap?.[course.id]?.notes_url || '',
    notes_urls: assetMap?.[course.id]?.notes_urls || [],
    notes_image_url: assetMap?.[course.id]?.notes_image_url || '',
  }));
