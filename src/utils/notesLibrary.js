const NOTES_LIBRARY_SETTING_KEY = 'premium_plus_notes_library';

const normalizeValue = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

export const getNotesLibrarySettingKey = () => NOTES_LIBRARY_SETTING_KEY;

export const parseNotesLibraryItems = (rawValue) => {
  if (!rawValue) return [];

  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && item.id && item.title)
      .map((item) => ({
        id: String(item.id),
        title: normalizeValue(item.title),
        category: normalizeValue(item.category) || 'Advanced Notes',
        description: normalizeValue(item.description),
        imageUrl: normalizeValue(item.imageUrl),
        notesUrl: normalizeValue(item.notesUrl),
        isActive: item.isActive !== false,
        createdAt: item.createdAt || new Date().toISOString(),
      }));
  } catch {
    return [];
  }
};

const extractIframeSrc = (value) => {
  const srcMatch = String(value || '').match(/src=["']([^"']+)["']/i);
  return srcMatch?.[1] || '';
};

const extractGoogleFileId = (value) => {
  const pathMatch = String(value || '').match(/\/d\/([a-zA-Z0-9_-]+)/i);
  if (pathMatch?.[1]) return pathMatch[1];

  try {
    const url = new URL(value);
    return url.searchParams.get('id');
  } catch {
    return '';
  }
};

const appendPdfViewerFlags = (url) => {
  if (!url || !/\.pdf(\?|#|$)/i.test(url)) return url;
  const [base, hash = ''] = url.split('#');
  const hashParts = hash ? hash.split('&').filter(Boolean) : [];
  const required = ['toolbar=0', 'navpanes=0', 'scrollbar=0', 'view=FitH'];
  required.forEach((part) => {
    if (!hashParts.includes(part)) hashParts.push(part);
  });
  return `${base}#${hashParts.join('&')}`;
};

const normalizeGoogleDrivePreview = (value) => {
  const fileId = extractGoogleFileId(value);
  return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : '';
};

const normalizeGoogleDocsPreview = (value) => {
  const fileId = extractGoogleFileId(value);
  if (!fileId) return '';

  if (value.includes('/document/')) return `https://docs.google.com/document/d/${fileId}/preview`;
  if (value.includes('/presentation/')) return `https://docs.google.com/presentation/d/${fileId}/embed`;
  if (value.includes('/spreadsheets/')) return `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
  return value;
};

export const getProtectedNotesPreview = (rawValue) => {
  const value = normalizeValue(rawValue);
  if (!value) return null;

  if (value.includes('<iframe')) {
    const src = extractIframeSrc(value);
    return src ? getProtectedNotesPreview(src) : null;
  }

  if (value.includes('drive.google.com')) {
    const src = normalizeGoogleDrivePreview(value);
    return src
      ? { type: 'drive', src }
      : { type: 'blocked', message: 'This Google Drive notes link is not a valid file link.' };
  }

  if (value.includes('docs.google.com')) {
    const src = normalizeGoogleDocsPreview(value);
    return src
      ? { type: 'docs', src }
      : { type: 'blocked', message: 'This Google Docs notes link is not a valid document link.' };
  }

  return { type: 'url', src: appendPdfViewerFlags(value) };
};
