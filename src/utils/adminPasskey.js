const PASSKEY_VERIFIED_KEY = 'admin_passkey_verified';
const PASSKEY_VERIFIED_USER_KEY = 'admin_passkey_verified_user';
const PASSKEY_RECORD_PREFIX = 'admin_passkey_record_';

const encoder = new TextEncoder();

const toBase64Url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (value) => {
  const base64 = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(String(value || '').length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const getRecordKey = (userId) => `${PASSKEY_RECORD_PREFIX}${userId}`;

const randomChallenge = (length = 32) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

export const isPasskeySupported = () =>
  typeof window !== 'undefined' &&
  !!window.PublicKeyCredential &&
  typeof navigator !== 'undefined' &&
  !!navigator.credentials;

export const clearAdminVerificationState = () => {
  sessionStorage.removeItem('admin_mfa_verified');
  sessionStorage.removeItem('admin_mfa_verified_user');
  sessionStorage.removeItem('admin_face_verified');
  sessionStorage.removeItem(PASSKEY_VERIFIED_KEY);
  sessionStorage.removeItem(PASSKEY_VERIFIED_USER_KEY);
};

export const markAdminPasskeyVerified = (userId) => {
  sessionStorage.setItem(PASSKEY_VERIFIED_KEY, 'true');
  sessionStorage.setItem(PASSKEY_VERIFIED_USER_KEY, userId);
  // Keep existing guards and sensitive flows compatible.
  sessionStorage.setItem('admin_mfa_verified', 'true');
  sessionStorage.setItem('admin_mfa_verified_user', userId);
};

export const isAdminPasskeyVerifiedForUser = (userId) =>
  sessionStorage.getItem(PASSKEY_VERIFIED_KEY) === 'true' &&
  sessionStorage.getItem(PASSKEY_VERIFIED_USER_KEY) === userId;

export const getStoredAdminPasskey = (userId) => {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(getRecordKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const storeAdminPasskey = (userId, record) => {
  localStorage.setItem(getRecordKey(userId), JSON.stringify(record));
};

export const hasStoredAdminPasskey = (userId) => {
  const record = getStoredAdminPasskey(userId);
  return !!record?.credentialId;
};

export const createAdminPasskey = async ({ userId, email, displayName }) => {
  if (!isPasskeySupported()) {
    throw new Error('This browser does not support passkeys.');
  }

  const existingRecord = getStoredAdminPasskey(userId);
  const userHandle = encoder.encode(String(userId));
  const publicKey = {
    challenge: randomChallenge(),
    rp: {
      name: 'SkillPro Admin',
      id: window.location.hostname,
    },
    user: {
      id: userHandle,
      name: email || String(userId),
      displayName: displayName || email || 'Admin',
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    timeout: 60000,
    attestation: 'none',
    excludeCredentials: existingRecord?.credentialId
      ? [
          {
            id: new Uint8Array(fromBase64Url(existingRecord.credentialId)),
            type: 'public-key',
          },
        ]
      : [],
  };

  const credential = await navigator.credentials.create({ publicKey });
  if (!credential) {
    throw new Error('Passkey creation was canceled.');
  }

  storeAdminPasskey(userId, {
    credentialId: toBase64Url(credential.rawId),
    createdAt: new Date().toISOString(),
    email: email || null,
    displayName: displayName || null,
  });
  markAdminPasskeyVerified(userId);
  return credential;
};

export const verifyAdminPasskey = async ({ userId }) => {
  if (!isPasskeySupported()) {
    throw new Error('This browser does not support passkeys.');
  }

  const record = getStoredAdminPasskey(userId);
  if (!record?.credentialId) {
    throw new Error('No admin passkey is registered on this device yet.');
  }

  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [
        {
          id: new Uint8Array(fromBase64Url(record.credentialId)),
          type: 'public-key',
        },
      ],
      userVerification: 'preferred',
      timeout: 60000,
      rpId: window.location.hostname,
    },
  });

  if (!credential) {
    throw new Error('Passkey verification was canceled.');
  }

  markAdminPasskeyVerified(userId);
  return credential;
};
