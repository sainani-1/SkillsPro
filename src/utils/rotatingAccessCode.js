const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{}';
const ACCESS_CODE_LENGTH = 12;
const ACCESS_CODE_WINDOW_MS = 60 * 1000;

function hashString(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getCurrentAccessCodeWindow(timestamp = Date.now()) {
  return Math.floor(timestamp / ACCESS_CODE_WINDOW_MS);
}

export function generateRotatingAccessCode(seed, role, windowValue = getCurrentAccessCodeWindow()) {
  const baseSeed = String(seed || '').trim();
  if (!baseSeed) return '';

  let state = hashString(`${role || 'user'}:${baseSeed}:${windowValue}`);
  let result = '';
  for (let index = 0; index < ACCESS_CODE_LENGTH; index += 1) {
    state = Math.imul(state ^ (state >>> 15), 2246822519) >>> 0;
    state = Math.imul(state ^ (state >>> 13), 3266489917) >>> 0;
    const nextIndex = state % ACCESS_CODE_ALPHABET.length;
    result += ACCESS_CODE_ALPHABET[nextIndex];
  }
  return result;
}

export function validateRotatingAccessCode(seed, role, candidate, timestamp = Date.now()) {
  const normalizedCandidate = String(candidate || '').trim();
  if (!normalizedCandidate) return false;

  const currentWindow = getCurrentAccessCodeWindow(timestamp);
  return [currentWindow - 1, currentWindow, currentWindow + 1].some(
    (windowValue) => generateRotatingAccessCode(seed, role, windowValue) === normalizedCandidate
  );
}

export function getAccessCodeTimeRemainingMs(timestamp = Date.now()) {
  return ACCESS_CODE_WINDOW_MS - (timestamp % ACCESS_CODE_WINDOW_MS);
}
