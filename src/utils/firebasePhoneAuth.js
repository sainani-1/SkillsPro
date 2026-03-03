import { RecaptchaVerifier, signInWithPhoneNumber, signOut } from 'firebase/auth';
import { firebaseAuth } from '../logicBuilding/firebase';

let recaptchaVerifierInstance = null;
let confirmationResultInstance = null;

const digitsOnly = (value = '') => String(value).replace(/\D/g, '');

export const formatIndianPhoneNumber = (input) => {
  const digits = digitsOnly(input);
  if (digits.startsWith('91') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  return null;
};

const ensureRecaptcha = (containerId = 'firebase-recaptcha-container') => {
  if (recaptchaVerifierInstance) return recaptchaVerifierInstance;

  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error('OTP widget could not load. Please refresh and try again.');
  }

  recaptchaVerifierInstance = new RecaptchaVerifier(
    firebaseAuth,
    containerId,
    { size: 'invisible' }
  );
  return recaptchaVerifierInstance;
};

export const sendOtpToPhone = async (phoneNumber, containerId = 'firebase-recaptcha-container') => {
  const formattedPhone = formatIndianPhoneNumber(phoneNumber);
  if (!formattedPhone) {
    throw new Error('Enter a valid 10-digit mobile number.');
  }

  const verifier = ensureRecaptcha(containerId);
  confirmationResultInstance = await signInWithPhoneNumber(firebaseAuth, formattedPhone, verifier);
  return formattedPhone;
};

export const verifyPhoneOtp = async (otp) => {
  const code = String(otp || '').trim();
  if (!confirmationResultInstance) {
    throw new Error('Please request OTP first.');
  }
  if (!/^\d{6}$/.test(code)) {
    throw new Error('Enter a valid 6-digit OTP.');
  }

  const credential = await confirmationResultInstance.confirm(code);
  await signOut(firebaseAuth);
  return credential;
};

export const resetPhoneOtpSession = () => {
  confirmationResultInstance = null;
  if (recaptchaVerifierInstance) {
    recaptchaVerifierInstance.clear();
    recaptchaVerifierInstance = null;
  }
};
