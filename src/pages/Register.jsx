import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import AlertModal from '../components/AlertModal';
import { prepareAvatarFile } from '../utils/imageUtils';

const Register = () => {
  const [loading, setLoading] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registrationDone, setRegistrationDone] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    coreSubject: 'Computer Science',
    educationLevel: '',
    studyStream: '',
    customStudyStream: '',
    diploma: ''
  });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [registrationPaused, setRegistrationPaused] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Stream options based on education level
  const streamOptions = {
    'B.Tech': ['Computer Science', 'Information Technology', 'Electronics', 'Mechanical', 'Civil', 'Others'],
    '12th': ['MPC', 'BIPC', 'MBIPC', 'Others'],
    '10th': ['State', 'CBSE', 'ICSE', 'Others'],
    'Intermediate': ['MPC', 'BIPC', 'MBIPC', 'Others']
  };
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });
  const navigate = useNavigate();

  // Check if registrations are paused
  useEffect(() => {
    const checkRegistrationStatus = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('key, value')
          .eq('key', 'registration_paused')
          .single();

        if (data && data.value === 'true') {
          setRegistrationPaused(true);
        }
      } catch (error) {
        console.log('Settings check:', error.message);
      }
    };

    checkRegistrationStatus();
  }, []);

  const validateStep = (step) => {
    const stepErrors = {};

    if (step === 1) {
      if (!formData.fullName.trim()) stepErrors.fullName = 'Full name is required';
      if (!formData.phone.trim()) stepErrors.phone = 'Phone number is required';
    }

    if (step === 2) {
      if (!formData.educationLevel) stepErrors.educationLevel = 'Education level is required';
      if (formData.educationLevel && !formData.studyStream) stepErrors.studyStream = 'Please select a stream/branch';
      if (formData.studyStream === 'Others' && !formData.customStudyStream.trim()) {
        stepErrors.customStudyStream = 'Please enter your stream/branch';
      }
    }

    if (step === 3) {
      if (!formData.email.trim()) {
        stepErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        stepErrors.email = 'Invalid email address';
      }
      if (!formData.password.trim()) {
        stepErrors.password = 'Password is required';
      } else if (formData.password.length < 6) {
        stepErrors.password = 'Password must be at least 6 characters';
      }
    }

    if (step === 4 && !termsAccepted) {
      stepErrors.termsAccepted = 'You must accept Terms and Conditions';
    }

    setErrors((prev) => ({ ...prev, ...stepErrors }));
    return Object.keys(stepErrors).length === 0;
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }
    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (!formData.educationLevel) {
      newErrors.educationLevel = 'Education level is required';
    }
    if (formData.educationLevel && !formData.studyStream) {
      newErrors.studyStream = 'Please select a stream/branch';
    }
    if (formData.studyStream === 'Others' && !formData.customStudyStream.trim()) {
      newErrors.customStudyStream = 'Please enter your stream/branch';
    }
    if (!termsAccepted) {
      newErrors.termsAccepted = 'You must accept Terms and Conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goToNextStep = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const goToPreviousStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleResendVerification = async () => {
    const emailToUse = (registeredEmail || formData.email || '').trim();
    if (!emailToUse) {
      setAlertModal({
        show: true,
        title: 'Email Required',
        message: 'Please enter your email address first.',
        type: 'warning'
      });
      return;
    }

    setResendingVerification(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailToUse,
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
      });
      if (error) throw error;

      setAlertModal({
        show: true,
        title: 'Verification Sent',
        message: `Verification email resent to ${emailToUse}. Please check inbox/spam.`,
        type: 'success'
      });
    } catch (error) {
      setAlertModal({
        show: true,
        title: 'Resend Failed',
        message: error.message || 'Unable to resend verification email.',
        type: 'error'
      });
    } finally {
      setResendingVerification(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = formData.phone.trim() || null;
      const resolvedStudyStream =
        formData.studyStream === 'Others'
          ? formData.customStudyStream.trim()
          : formData.studyStream;

      // 1. Sign up auth
      const { data: { user }, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: formData.fullName.trim(),
            phone: formattedPhone,
            terms_accepted: true,
            terms_accepted_at: new Date().toISOString(),
            education_level: formData.educationLevel,
            study_stream: resolvedStudyStream,
            diploma_certificate: formData.diploma || null,
            core_subject: resolvedStudyStream || formData.coreSubject || null,
            auth_provider: 'email',
            role: 'student'
          }
        }
      });
      if (error) throw error;

      if (!user?.id) {
        throw new Error('Unable to create user account. Please try again.');
      }

      // 2. Upload Photo
      let avatarUrl = null;
      if (file) {
        try {
          const safeFile = await prepareAvatarFile(file);
          const fileExt = safeFile?.name?.split('.').pop() || file.name.split('.').pop();
          const fileName = `${user.id}.${fileExt}`;
          const filePath = fileName;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, safeFile, { upsert: true, contentType: safeFile?.type || file.type });

          if (!uploadError) {
            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
            avatarUrl = data?.publicUrl || avatarUrl;
          }
        } catch (photoErr) {
          console.warn('Photo upload warning:', photoErr.message);
          // Continue with default avatar if upload fails
        }
      }

      // 3. Create/Update profile from registration details so user does not need to enter again.
      const { error: profileError } = await supabase.from('profiles').upsert([{
        id: user.id,
        full_name: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formattedPhone,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        google_profile_completed: true,
        education_level: formData.educationLevel,
        study_stream: resolvedStudyStream,
        diploma_certificate: formData.diploma || null,
        avatar_url: avatarUrl,
        core_subject: resolvedStudyStream || formData.coreSubject || null,
        auth_provider: 'email',
        role: 'student',
        updated_at: new Date().toISOString(),
      }], { onConflict: 'id' });
      if (profileError && !String(profileError.message || '').toLowerCase().includes('row-level security')) {
        throw profileError;
      }

      setAlertModal({
        show: true,
        title: 'Success',
        message: 'Registration successful! Please check your email to confirm your account.',
        type: 'success'
      });
      setRegisteredEmail(formData.email.trim());
      setRegistrationDone(true);
    } catch (error) {
      setAlertModal({
        show: true,
        title: 'Registration Error',
        message: error.message,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-amber-50/40 p-4 sm:p-6 md:p-8 flex items-center justify-center">
      <div className="w-full mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-stretch">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 text-white p-8 md:p-10 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.35),transparent_48%),radial-gradient(circle_at_bottom_left,rgba(14,116,144,0.3),transparent_45%)] pointer-events-none" />
          <div className="relative z-10 h-full flex flex-col">
            <img src="/skillpro-logo.png" alt="SkillPro logo" className="w-16 h-16 rounded-full border border-white/30 object-cover shadow-lg" />
            <h1 className="mt-6 text-3xl md:text-4xl font-bold leading-tight">Start your SkillPro journey</h1>
            <p className="mt-3 text-slate-200 text-sm md:text-base max-w-md">
              Create your account to access classes, exams, certificates, and personalized learning updates.
            </p>
            <div className="mt-8 space-y-3 text-sm text-slate-100/90">
              <p className="flex items-start gap-2"><span className="text-amber-300">*</span> Live class and exam notifications</p>
              <p className="flex items-start gap-2"><span className="text-amber-300">*</span> Certificate progress and completion tracking</p>
              <p className="flex items-start gap-2"><span className="text-amber-300">*</span> Education-specific course recommendations</p>
            </div>
            <div className="mt-auto pt-8">
              <p className="text-xs text-slate-300">Already have an account?</p>
              <Link to="/login" className="inline-flex mt-2 text-sm font-semibold text-amber-300 hover:text-amber-200 transition-colors">
                Login to continue
              </Link>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-white/95 backdrop-blur rounded-3xl shadow-2xl border border-white p-6 sm:p-8 md:p-10">
          <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-amber-100/70 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-cyan-100/70 blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">Create Account</h2>
              <p className="text-sm text-slate-500 mt-2">Step {currentStep} of 4</p>
            </div>

            {!registrationPaused && (
              <div className="mb-6 grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className={`h-2 rounded-full ${step <= currentStep ? 'bg-amber-500' : 'bg-slate-200'}`} />
                ))}
              </div>
            )}

            {registrationPaused ? (
              <div className="text-center bg-amber-50 border border-amber-200 rounded-2xl p-8">
                <div className="text-4xl mb-3">Registration Locked</div>
                <h3 className="text-xl font-bold text-amber-900 mb-2">Registrations Paused</h3>
                <p className="text-amber-800 mb-5">Registrations are temporarily paused. Please try again later.</p>
                <Link to="/login" className="inline-flex px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors">
                  Go Back to Login
                </Link>
              </div>
            ) : (
              <>
                <form onSubmit={handleRegister} className="space-y-4">
                  {currentStep === 1 && (
                    <>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1 font-semibold">Full Name *</label>
                        <input
                          className={`w-full p-3 border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition ${errors.fullName ? 'border-red-500' : 'border-slate-200'}`}
                          placeholder="Full Name"
                          value={formData.fullName}
                          onChange={e => {
                            setFormData({ ...formData, fullName: e.target.value });
                            if (errors.fullName) setErrors({ ...errors, fullName: '' });
                          }}
                        />
                        {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
                      </div>

                      <div>
                        <label className="block text-sm text-slate-600 mb-1 font-semibold">Phone Number *</label>
                        <input
                          className={`w-full p-3 border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition ${errors.phone ? 'border-red-500' : 'border-slate-200'}`}
                          placeholder="Phone Number"
                          value={formData.phone}
                          onChange={e => {
                            setFormData({ ...formData, phone: e.target.value });
                            if (errors.phone) setErrors({ ...errors, phone: '' });
                          }}
                        />
                        {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                      </div>
                    </>
                  )}

                  {currentStep === 2 && (
                    <>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1 font-semibold">Education Level *</label>
                        <select
                          className={`w-full p-3 border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition ${errors.educationLevel ? 'border-red-500' : 'border-slate-200'}`}
                          value={formData.educationLevel}
                          onChange={e => {
                            setFormData({ ...formData, educationLevel: e.target.value, studyStream: '', customStudyStream: '' });
                            if (errors.educationLevel) setErrors({ ...errors, educationLevel: '' });
                          }}
                        >
                          <option value="">Select education level</option>
                          <option value="B.Tech">B.Tech</option>
                          <option value="12th">12th Grade</option>
                          <option value="10th">10th Grade</option>
                          <option value="Intermediate">Intermediate</option>
                        </select>
                        {errors.educationLevel && <p className="text-red-500 text-xs mt-1">{errors.educationLevel}</p>}
                      </div>

                      {formData.educationLevel && (
                        <div>
                          <label className="block text-sm text-slate-600 mb-1 font-semibold">
                            {formData.educationLevel === 'B.Tech' ? 'Branch' : 'Stream'} *
                          </label>
                          <select
                            className={`w-full p-3 border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition ${errors.studyStream ? 'border-red-500' : 'border-slate-200'}`}
                            value={formData.studyStream}
                            onChange={e => {
                              const nextValue = e.target.value;
                              setFormData({
                                ...formData,
                                studyStream: nextValue,
                                customStudyStream: nextValue === 'Others' ? formData.customStudyStream : '',
                              });
                              if (errors.studyStream) setErrors({ ...errors, studyStream: '' });
                              if (errors.customStudyStream) setErrors({ ...errors, customStudyStream: '' });
                            }}
                          >
                            <option value="">Select {formData.educationLevel === 'B.Tech' ? 'branch' : 'stream'}</option>
                            {streamOptions[formData.educationLevel]?.map(option => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                          {errors.studyStream && <p className="text-red-500 text-xs mt-1">{errors.studyStream}</p>}
                          {formData.studyStream === 'Others' && (
                            <div className="mt-2">
                              <input
                                type="text"
                                className={`w-full p-3 border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition ${errors.customStudyStream ? 'border-red-500' : 'border-slate-200'}`}
                                placeholder={`Enter your ${formData.educationLevel === 'B.Tech' ? 'branch' : 'stream'}`}
                                value={formData.customStudyStream}
                                onChange={e => {
                                  setFormData({ ...formData, customStudyStream: e.target.value });
                                  if (errors.customStudyStream) setErrors({ ...errors, customStudyStream: '' });
                                }}
                              />
                              {errors.customStudyStream && <p className="text-red-500 text-xs mt-1">{errors.customStudyStream}</p>}
                            </div>
                          )}
                        </div>
                      )}

                      {formData.educationLevel === '12th' && (
                        <div>
                          <label className="block text-sm text-slate-600 mb-1 font-semibold">Diploma / Board Details</label>
                          <textarea
                            className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 resize-none focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition"
                            placeholder="Enter your diploma or board details"
                            rows="3"
                            value={formData.diploma}
                            onChange={e => setFormData({ ...formData, diploma: e.target.value })}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {currentStep === 3 && (
                    <>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1 font-semibold">Email Address *</label>
                        <input
                          type="email"
                          className={`w-full p-3 border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition ${errors.email ? 'border-red-500' : 'border-slate-200'}`}
                          placeholder="Email Address"
                          value={formData.email}
                          onChange={e => {
                            setFormData({ ...formData, email: e.target.value });
                            if (errors.email) setErrors({ ...errors, email: '' });
                          }}
                        />
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                      </div>

                      <div>
                        <label className="block text-sm text-slate-600 mb-1 font-semibold">Password *</label>
                        <input
                          type="password"
                          className={`w-full p-3 border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition ${errors.password ? 'border-red-500' : 'border-slate-200'}`}
                          placeholder="Password"
                          value={formData.password}
                          onChange={e => {
                            setFormData({ ...formData, password: e.target.value });
                            if (errors.password) setErrors({ ...errors, password: '' });
                          }}
                        />
                        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                      </div>

                      <div>
                        <label className="block text-sm text-slate-600 mb-2 font-semibold">Profile Photo (Optional)</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => {
                            setFile(e.target.files?.[0] || null);
                            if (errors.file) setErrors({ ...errors, file: '' });
                          }}
                          className="w-full text-sm border border-slate-200 rounded-xl p-2 bg-slate-50 focus:outline-none"
                        />
                        {file && <p className="text-green-600 text-xs mt-1">Selected: {file.name}</p>}
                      </div>
                    </>
                  )}

                  {currentStep === 4 && (
                    <>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h3 className="text-sm font-bold text-slate-900 mb-2">Review</h3>
                        <p className="text-sm text-slate-700">Name: {formData.fullName || '-'}</p>
                        <p className="text-sm text-slate-700">Phone: {formData.phone || '-'}</p>
                        <p className="text-sm text-slate-700">Education: {formData.educationLevel || '-'}</p>
                        <p className="text-sm text-slate-700">
                          Stream: {formData.studyStream === 'Others' ? (formData.customStudyStream || '-') : (formData.studyStream || '-')}
                        </p>
                        <p className="text-sm text-slate-700">Email: {formData.email || '-'}</p>
                      </div>

                      <label className="flex items-start gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <input
                          type="checkbox"
                          className="mt-1 accent-amber-600"
                          checked={termsAccepted}
                          onChange={e => {
                            setTermsAccepted(e.target.checked);
                            if (errors.termsAccepted) setErrors({ ...errors, termsAccepted: '' });
                          }}
                        />
                        <span>
                          I agree to the{' '}
                          <Link to="/terms-and-conditions" target="_blank" className="text-amber-700 font-semibold underline">
                            Terms and Conditions
                          </Link>.
                        </span>
                      </label>
                      {errors.termsAccepted && <p className="text-red-500 text-xs -mt-2">{errors.termsAccepted}</p>}
                    </>
                  )}

                  <div className="flex gap-3 pt-2">
                    {currentStep > 1 && (
                      <button
                        type="button"
                        onClick={goToPreviousStep}
                        className="w-full py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition"
                      >
                        Back
                      </button>
                    )}
                    {currentStep < 4 ? (
                      <button
                        type="button"
                        onClick={goToNextStep}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold shadow-lg shadow-amber-200/70 hover:from-amber-600 hover:to-amber-700 transition"
                      >
                        Next
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold shadow-lg shadow-amber-200/70 hover:from-amber-600 hover:to-amber-700 transition disabled:opacity-60"
                      >
                        {loading ? 'Creating Account...' : 'Register Now'}
                      </button>
                    )}
                  </div>
                </form>
                <p className="text-center mt-6 text-sm text-slate-600">
                  Already have an account? <Link to="/login" className="text-amber-700 font-bold">Login</Link>
                </p>
                {registrationDone && (
                  <div className="mt-4 p-4 rounded-2xl bg-cyan-50 border border-cyan-200">
                    <p className="text-xs text-cyan-900 mb-2">
                      Verification email sent to <span className="font-semibold">{registeredEmail}</span>
                    </p>
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendingVerification}
                      className="w-full bg-cyan-700 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-cyan-800 disabled:opacity-60 transition"
                    >
                      {resendingVerification ? 'Sending...' : 'Resend verification email'}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="w-full mt-2 border border-slate-300 text-slate-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition"
                    >
                      Go to Login
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <AlertModal
        show={alertModal.show}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ show: false, title: '', message: '', type: 'info' })}
      />
    </div>
  );
};

export default Register;
