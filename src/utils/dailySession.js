const LOGIN_STATE_KEY = 'skillpro-login-state';

const getNextMidnightTimestamp = (fromDate = new Date()) => {
  const nextMidnight = new Date(fromDate);
  nextMidnight.setHours(24, 0, 0, 0);
  return nextMidnight.getTime();
};

export const readDailyLoginState = () => {
  try {
    const raw = window.localStorage.getItem(LOGIN_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

export const writeDailyLoginState = (payload = {}) => {
  try {
    const existing = readDailyLoginState() || {};
    const loginAt = existing.loginAt || payload.loginAt || new Date().toISOString();
    const expiresAt = existing.expiresAt || payload.expiresAt || getNextMidnightTimestamp();
    const nextState = {
      ...existing,
      ...payload,
      loginAt,
      expiresAt
    };
    window.localStorage.setItem(LOGIN_STATE_KEY, JSON.stringify(nextState));
    return nextState;
  } catch (error) {
    return null;
  }
};

export const clearDailyLoginState = () => {
  try {
    window.localStorage.removeItem(LOGIN_STATE_KEY);
  } catch (error) {
    // Ignore local storage cleanup failures.
  }
};

export const isDailyLoginExpired = (state = readDailyLoginState()) => {
  const expiresAt = Number(state?.expiresAt || 0);
  return Number.isFinite(expiresAt) && expiresAt > 0 && Date.now() >= expiresAt;
};
