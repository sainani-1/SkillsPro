const isBrowser = typeof window !== 'undefined';

export const readBrowserState = (key, fallback = null) => {
  if (!isBrowser || !key) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
};

export const writeBrowserState = (key, value) => {
  if (!isBrowser || !key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Ignore storage failures.
  }
};

export const removeBrowserState = (key) => {
  if (!isBrowser || !key) return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    // Ignore storage failures.
  }
};

export const upsertRecentItem = (key, nextItem, maxItems = 8) => {
  if (!nextItem?.id) return [];
  const existing = readBrowserState(key, []);
  const normalized = Array.isArray(existing) ? existing : [];
  const nextList = [
    nextItem,
    ...normalized.filter((item) => item?.id !== nextItem.id),
  ].slice(0, maxItems);
  writeBrowserState(key, nextList);
  return nextList;
};
