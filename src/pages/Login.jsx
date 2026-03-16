import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, ShieldCheck, UserRoundCheck } from 'lucide-react';
import AlertModal from '../components/AlertModal';
import Toast from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import AuthShell from '../components/AuthShell';
import { claimSingleSession, takeSingleSessionNotice } from '../utils/singleSession';
import { attachPendingReferral } from '../utils/referrals';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });
  const [loggingIn, setLoggingIn] = useState(false);
  const [, setGoogleSigningIn] = useState(false);
  const [processingOAuth, setProcessingOAuth] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [takeoverModalOpen, setTakeoverModalOpen] = useState(false);
  const [inlineNotice, setInlineNotice] = useState('');
  const [supportContactEmail, setSupportContactEmail] = useState('');
  const takeoverResolverRef = useRef(null);
  const navigate = useNavigate();
  const getPendingAvatarKey = (email) => `pending_registration_avatar_${String(email || '').trim().toLowerCase()}`;

  const applyPendingAvatarIfAny = async (userId, userEmail) => {
    if (!userId || !userEmail) return null;
    const storageKey = getPendingAvatarKey(userEmail);
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.dataUrl) return null;

      const mime = parsed.mime || 'image/jpeg';
      const extension = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      const filePath = `${userId}.${extension}`;

      const blob = await fetch(parsed.dataUrl).then((r) => r.blob());
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { upsert: true, contentType: mime });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = data?.publicUrl || null;
      if (!publicUrl) return null;

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (profileUpdateError) throw profileUpdateError;

      localStorage.removeItem(storageKey);
      return publicUrl;
    } catch (err) {
      console.warn('Pending avatar apply failed:', err.message || err);
      return null;
    }
  };

  useEffect(() => {
    // Always require fresh MFA verification when admin starts a new login flow.
    sessionStorage.removeItem('admin_mfa_verified');
    sessionStorage.removeItem('admin_mfa_verified_user');
    sessionStorage.removeItem('admin_face_verified');

    const notice = takeSingleSessionNotice();
    if (notice) {
      setInlineNotice(notice);
    }

    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
    const confirmedByQuery =
      params.get('confirmed') === 'true' ||
      params.get('email_confirmed') === 'true' ||
      params.get('type') === 'signup' ||
      params.get('message') === 'confirmed';
    const confirmedByHash = hashParams.get('type') === 'signup';
    if (confirmedByQuery || confirmedByHash) {
      setToast({
        show: true,
        message: 'Email confirmed. Now you can login.',
        type: 'success'
      });
      const cleanUrl = `${window.location.origin}/login`;
      window.history.replaceState({}, '', cleanUrl);
    }

    const loadSupportEmail = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'support_contact_email')
          .maybeSingle();
        setSupportContactEmail(data?.value || '');
      } catch {
        setSupportContactEmail('');
      }
    };
    loadSupportEmail();
  }, []);

  const getSupportLine = () =>
    supportContactEmail
      ? `Please contact ${supportContactEmail}.`
      : 'Please contact support.';

  const askTakeoverConfirmation = () =>
    new Promise((resolve) => {
      takeoverResolverRef.current = resolve;
      setTakeoverModalOpen(true);
    });

  const closeTakeoverModal = (accepted) => {
    setTakeoverModalOpen(false);
    const resolver = takeoverResolverRef.current;
    takeoverResolverRef.current = null;
    if (resolver) resolver(accepted);
  };

  const ensureSingleActiveSession = async (userId) => {
    const initial = await claimSingleSession(userId, { forceTakeover: false, deviceLabel: 'Web Login' });
    if (initial.status === 'requires_takeover') {
      const ok = await askTakeoverConfirmation();
      if (!ok) return { allowed: false, message: 'Login canceled. Account is active on another device.' };

      const takeover = await claimSingleSession(userId, { forceTakeover: true, deviceLabel: 'Web Login' });
      if (takeover.status !== 'claimed') {
        return {
          allowed: false,
          message: 'Could not transfer active session. Please try again.'
        };
      }
      return { allowed: true, message: 'Previous device was logged out. You are now logged in here.' };
    }

    if (initial.status === 'claimed' || initial.status === 'unavailable') {
      // unavailable => DB feature not ready; allow login without blocking.
      return { allowed: true, message: '' };
    }

    return { allowed: false, message: 'Could not validate active session. Please try again.' };
  };

  const routeGoogleUser = async (oauthUser) => {
    let { data: profile } = await supabase
      .from('profiles')
      .select('id, role, is_disabled, is_locked, locked_until, terms_accepted, google_profile_completed, auth_provider')
      .eq('id', oauthUser.id)
      .maybeSingle();

    if (!profile) {
      const meta = oauthUser.user_metadata || {};
      const bootstrapProfile = {
        id: oauthUser.id,
        auth_user_id: oauthUser.id,
        role: 'student',
        email: oauthUser.email || null,
        full_name: meta.full_name || meta.name || '',
        auth_provider: 'google',
        terms_accepted: false,
        google_profile_completed: false,
        updated_at: new Date().toISOString()
      };
      const { error: upsertError } = await supabase.from('profiles').upsert(bootstrapProfile, { onConflict: 'id' });
      if (upsertError) throw upsertError;
      profile = bootstrapProfile;
    }

    if (profile.is_disabled) {
        await supabase.auth.signOut();
        setAlertModal({
          show: true,
          title: 'Account Disabled',
          message: `Your account has been disabled by an administrator. ${getSupportLine()}`,
          type: 'error'
        });
        return;
    }

    if (profile.is_locked && (!profile.locked_until || new Date(profile.locked_until) > new Date())) {
      await supabase.auth.signOut();
      const lockText = profile.locked_until
        ? `Lock expires on ${new Date(profile.locked_until).toLocaleDateString('en-IN')}.`
        : 'Your account is currently locked.';
      setAlertModal({
        show: true,
        title: 'Account Locked',
        message: `${lockText} ${getSupportLine()}`,
        type: 'error'
      });
      return;
    }

    if (!profile.terms_accepted || !profile.google_profile_completed) {
      navigate('/complete-profile');
      return;
    }

    const sessionCheck = await ensureSingleActiveSession(oauthUser.id);
    if (!sessionCheck.allowed) {
      await supabase.auth.signOut();
      setAlertModal({
        show: true,
        title: 'Login Blocked',
        message: sessionCheck.message,
        type: 'warning'
      });
      return;
    }

    navigate('/app');
  };

  useEffect(() => {
    let isMounted = true;
    const searchParams = new URLSearchParams(window.location.search);
    const hasOAuthError = !!searchParams.get('error');

    const handleOAuthReturn = async () => {
      try {
        if (hasOAuthError) {
          const description = searchParams.get('error_description') || searchParams.get('error');
          setAlertModal({
            show: true,
            title: 'Google Sign-in Error',
            message: decodeURIComponent(description || 'OAuth sign-in failed.'),
            type: 'error'
          });
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        const provider = session?.user?.app_metadata?.provider;
        if (!session?.user || provider !== 'google') return;
        await routeGoogleUser(session.user);
      } catch (error) {
        if (!isMounted) return;
        setAlertModal({
          show: true,
          title: 'Google Sign-in Error',
          message: error.message || 'Unable to complete Google sign-in.',
          type: 'error'
        });
      } finally {
        if (isMounted) setProcessingOAuth(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (event !== 'SIGNED_IN') return;
      const provider = session?.user?.app_metadata?.provider;
      if (provider === 'google' && session?.user) {
        setProcessingOAuth(true);
        await routeGoogleUser(session.user);
        setProcessingOAuth(false);
      }
    });

    handleOAuthReturn();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setInlineNotice('');
    setLoggingIn(true);
    try {
      // First, sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !signInData?.user) {
        const signInMessage = signInError?.message || 'No user returned from sign in. Please try again.';
        setAlertModal({
          show: true,
          title: 'Login Error',
          message: signInMessage.includes('Email not confirmed')
            ? 'Email not verified. Please verify your email first, then login.'
            : signInMessage,
          type: 'error'
        });
        setLoggingIn(false);
        return;
      }

      const isEmailVerified = !!(signInData.user.email_confirmed_at || signInData.user.confirmed_at);
      if (!isEmailVerified) {
        await supabase.auth.signOut();
        setAlertModal({
          show: true,
          title: 'Email Not Verified',
          message: 'Please verify your email before logging in. Use "Resend verification email" if needed.',
          type: 'warning'
        });
        setLoggingIn(false);
        return;
      }

      // Fetch user profile
      let { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, is_disabled, is_locked, locked_until, deleted_at, deleted_reason, email, full_name, phone, education_level, study_stream, diploma_certificate, core_subject')
        .eq('id', signInData.user.id)
        .single();

      if (profileError || !userProfile) {
        // If this account was deleted earlier, block profile recreation and login.
        const { data: deletedRecord } = await supabase
          .from('deleted_accounts')
          .select('id, reason, deleted_at')
          .eq('user_id', signInData.user.id)
          .order('deleted_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (deletedRecord) {
          await supabase.auth.signOut();
          setAlertModal({
            show: true,
            title: 'Account Deleted',
            message: deletedRecord.reason
              ? `Your account was deleted. Reason: ${deletedRecord.reason}`
              : 'Your account was deleted. Please contact support if needed.',
            type: 'error'
          });
          setLoggingIn(false);
          return;
        }

        // Create profile on first verified login using auth metadata
        const meta = signInData.user.user_metadata || {};
        const { error: createProfileError } = await supabase.from('profiles').upsert({
          id: signInData.user.id,
          auth_user_id: signInData.user.id,
          email: signInData.user.email || email.trim(),
          full_name: meta.full_name || 'Student',
          phone: meta.phone || null,
          avatar_url: meta.avatar_url || null,
          education_level: meta.education_level || null,
          study_stream: meta.study_stream || null,
          diploma_certificate: meta.diploma_certificate || null,
          core_subject: meta.core_subject || null,
          role: meta.role || 'student',
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

        if (createProfileError) {
          setAlertModal({
            show: true,
            title: 'Profile Error',
            message: createProfileError.message || 'Could not create user profile.',
            type: 'error'
          });
          setLoggingIn(false);
          return;
        }

        const profileFetchRetry = await supabase
          .from('profiles')
          .select('id, role, is_disabled, is_locked, locked_until')
          .eq('id', signInData.user.id)
          .single();
        userProfile = profileFetchRetry.data;
        profileError = profileFetchRetry.error;

        if (profileError || !userProfile) {
          setAlertModal({
            show: true,
            title: 'Profile Error',
            message: 'User profile not found or could not be loaded. Please contact support or try again.',
            type: 'error'
          });
          setLoggingIn(false);
          return;
        }
      } else {
        // Backfill missing profile fields from signup metadata so users don't re-enter details manually.
        const meta = signInData.user.user_metadata || {};
        const profilePatch = { updated_at: new Date().toISOString() };

        if (!userProfile.email && (signInData.user.email || email.trim())) {
          profilePatch.email = signInData.user.email || email.trim();
        }
        if (!userProfile.full_name && meta.full_name) {
          profilePatch.full_name = meta.full_name;
        }
        if (!userProfile.phone && meta.phone) {
          profilePatch.phone = meta.phone;
        }
        if (!userProfile.education_level && meta.education_level) {
          profilePatch.education_level = meta.education_level;
        }
        if (!userProfile.study_stream && meta.study_stream) {
          profilePatch.study_stream = meta.study_stream;
        }
        if (!userProfile.diploma_certificate && meta.diploma_certificate) {
          profilePatch.diploma_certificate = meta.diploma_certificate;
        }
        if (!userProfile.core_subject && meta.core_subject) {
          profilePatch.core_subject = meta.core_subject;
        }

        if (Object.keys(profilePatch).length > 1) {
          const { error: backfillError } = await supabase
            .from('profiles')
            .update(profilePatch)
            .eq('id', signInData.user.id);

          if (backfillError) {
            setAlertModal({
              show: true,
              title: 'Profile Sync Error',
              message: backfillError.message || 'Could not sync registration details to profile.',
              type: 'error'
            });
            setLoggingIn(false);
            return;
          }
        }
      }

      // Apply cached registration photo on first verified login if avatar was not stored earlier.
      if (!userProfile?.avatar_url) {
        const restoredAvatar = await applyPendingAvatarIfAny(
          signInData.user.id,
          signInData.user.email || email
        );
        if (restoredAvatar) {
          userProfile = { ...userProfile, avatar_url: restoredAvatar };
        }
      }

      try {
        await attachPendingReferral(signInData.user.id, signInData.user.email || email.trim());
      } catch (referralError) {
        console.warn('Referral attach failed after login:', referralError.message || referralError);
      }

      // Check if account is disabled
      if (userProfile.is_disabled) {
        await supabase.auth.signOut();
        setAlertModal({
          show: true,
            title: userProfile.deleted_at ? 'Account Deleted' : 'Account Disabled',
            message: userProfile.deleted_at
              ? (userProfile.deleted_reason
                ? `Your account was deleted. Reason: ${userProfile.deleted_reason}`
                : `Your account was deleted. ${getSupportLine()}`)
            : `Your account has been disabled by an administrator. ${getSupportLine()}`,
            type: 'error'
          });
        setLoggingIn(false);
        return;
      }

      if (userProfile.is_locked && (!userProfile.locked_until || new Date(userProfile.locked_until) > new Date())) {
        await supabase.auth.signOut();
        setAlertModal({
          show: true,
          title: 'Account Locked',
          message: userProfile.locked_until
            ? `Your account is locked until ${new Date(userProfile.locked_until).toLocaleDateString('en-IN')}. ${getSupportLine()}`
            : `Your account is locked. ${getSupportLine()}`,
          type: 'error'
        });
        setLoggingIn(false);
        return;
      }

      // Check for admin role and MFA
      const sessionCheck = await ensureSingleActiveSession(signInData.user.id);
      if (!sessionCheck.allowed) {
        await supabase.auth.signOut();
        setInlineNotice(sessionCheck.message || 'Login blocked. Account is active on another device.');
        setLoggingIn(false);
        return;
      }

      if (userProfile.role === 'admin') {
        sessionStorage.removeItem('admin_mfa_verified');
        sessionStorage.removeItem('admin_mfa_verified_user');
        sessionStorage.removeItem('admin_face_verified');
        // Check if MFA is enabled for admin
        const { data: factors, error: mfaError } = await supabase.auth.mfa.listFactors();
        if (mfaError) {
          setAlertModal({
            show: true,
            title: 'MFA Error',
            message: 'Could not check MFA status. Please contact support.',
            type: 'error'
          });
          setLoggingIn(false);
          return;
        }
        const hasMFA = factors?.totp && factors.totp.length > 0;
        if (!hasMFA) {
          setLoggingIn(false);
          navigate('/admin-mfa-setup');
          return;
        }
        setLoggingIn(false);
        setToast({
          show: true,
          message: sessionCheck.message || 'Logged in successfully!',
          type: 'success'
        });
        navigate('/admin-mfa-verify');
        return;
      }

      // Account is active, proceed to app
      setLoggingIn(false);
      setToast({
        show: true,
        message: sessionCheck.message || 'Logged in successfully!',
        type: 'success'
      });
      setInlineNotice('');
      navigate('/app');
    } catch (error) {
      console.error('Error during login:', error);
      setAlertModal({
        show: true,
        title: 'Error',
        message: 'Failed to login. Please try again.',
        type: 'error'
      });
      setLoggingIn(false);
      await supabase.auth.signOut();
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login?provider=google`
        }
      });
      if (error) throw error;
    } catch (error) {
      setAlertModal({
        show: true,
        title: 'Google Sign-in Error',
        message: error.message || 'Unable to continue with Google.',
        type: 'error'
      });
      setGoogleSigningIn(false);
    }
  };

  if (authLoading) {
    return <LoadingSpinner message="Checking session..." />;
  }

  if (processingOAuth) {
    return <LoadingSpinner message="Finishing Google sign-in..." />;
  }

  if (user?.id && !loggingIn && !takeoverModalOpen) {
    return <Navigate to="/app" replace />;
  }

  return (
    <>
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ show: false, message: '', type: 'success' })}
      />
      <AuthShell
        title="Continue your SkillPro learning"
        subtitle="Sign in to access courses, exams, certificates, mentor support, and your full student dashboard."
        highlights={[
          { icon: UserRoundCheck, text: 'Resume your learning from the same account across courses and assessments.' },
          { icon: ShieldCheck, text: 'Protected login flow with session checks and account safety controls.' },
          { icon: KeyRound, text: 'Reset your password anytime if you lose access to your email login.' },
        ]}
        footerLabel="New to SkillPro?"
        footerLinkTo="/register"
        footerLinkText="Create your account"
        rightTitle="Welcome Back"
        rightSubtitle="Use your registered email and password to continue."
      >
        <AlertModal
          show={alertModal.show}
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => setAlertModal({ show: false, title: '', message: '', type: 'info' })}
        />
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60 sm:p-6">
          <div className="mb-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-amber-700 px-4 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">Account Access</p>
            <p className="mt-2 text-sm text-slate-100">Use the same email you used during registration to open your dashboard.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {inlineNotice ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {inlineNotice}
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Email</label>
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <label className="block text-xs font-semibold text-slate-600">Password</label>
                <Link to="/reset-password" className="text-xs font-semibold text-amber-700 hover:text-amber-800">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                placeholder="Enter your password"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 font-bold text-white shadow-lg shadow-amber-200/70 transition hover:from-amber-600 hover:to-amber-700 disabled:opacity-60"
              disabled={loggingIn}
            >
              {loggingIn ? 'Logging in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
          >
            Create Account
          </Link>
          <Link
            to="/reset-password"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Reset Password
          </Link>
        </div>

        <div className="mt-4">
          <Link
            to="/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={18} />
            Back to Home Page
          </Link>
        </div>
      </AuthShell>

      {takeoverModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-7 py-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              <p className="text-xs uppercase tracking-widest font-semibold text-amber-100">Session Protection</p>
              <h3 className="text-2xl font-bold mt-1">Already Logged In</h3>
              <p className="text-sm text-amber-50 mt-1">This account is currently active on another device.</p>
            </div>
            <div className="px-7 py-6 space-y-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-slate-800 text-sm font-medium">
                  Continue here and securely end the previous session?
                </p>
                <p className="text-xs text-slate-600 mt-2">
                  If you choose continue, the other device will be logged out immediately.
                </p>
              </div>
              <p className="text-xs text-slate-500">
                If this was not you, choose cancel and reset your password.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => closeTakeoverModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => closeTakeoverModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700"
                >
                  Logout There and Login Here
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Login;
