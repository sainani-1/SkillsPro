import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import AlertModal from '../components/AlertModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { prepareAvatarFile } from '../utils/imageUtils';

const Register = () => {
  const [loading, setLoading] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registrationDone, setRegistrationDone] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', fullName: '', phone: '', coreSubject: 'Computer Science', educationLevel: '', studyStream: '', customStudyStream: '', diploma: '' });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [registrationPaused, setRegistrationPaused] = useState(false);

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
    if (!file) {
      newErrors.file = 'Profile photo is required';
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
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
                phone: formData.phone.trim(),
                education_level: formData.educationLevel,
                study_stream: resolvedStudyStream,
                diploma_certificate: formData.diploma || null,
                core_subject: resolvedStudyStream || formData.coreSubject || null,
                role: 'student'
              }
            }
        });
        if (error) throw error;

        if (!user?.id) {
          throw new Error('Unable to create user account. Please try again.');
        }

        // 2. Upload Photo
        let avatarUrl = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80';
        if (file) {
            try {
                const safeFile = await prepareAvatarFile(file);
                const fileExt = file.name.split('.').pop();
                const fileName = `${user.id}.${fileExt}`;
                const filePath = `avatars/${fileName}`;
                
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
            phone: formData.phone.trim(),
            education_level: formData.educationLevel,
            study_stream: resolvedStudyStream,
            diploma_certificate: formData.diploma || null,
            avatar_url: avatarUrl,
            core_subject: resolvedStudyStream || formData.coreSubject || null,
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
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
            <div className="text-center mb-8">
                <h1 className="text-2xl font-serif font-bold text-nani-dark">Join StepWithNani</h1>
                <p className="text-slate-500">Create your account</p>
            </div>
            
            {registrationPaused ? (
              <div className="text-center">
                <div className="text-6xl mb-4">🔒</div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Registrations Paused</h2>
                <p className="text-slate-600 mb-6">Registrations are temporarily paused. Please try again later.</p>
                <Link to="/login" className="text-nani-primary hover:underline font-medium">
                  Go back to login
                </Link>
              </div>
            ) : (
            <>
            <form onSubmit={handleRegister} className="space-y-4">
                <div>
                    <input 
                        className={`w-full p-3 border rounded-lg bg-slate-50 ${errors.fullName ? 'border-red-500' : ''}`}
                        placeholder="Full Name" 
                        value={formData.fullName}
                        onChange={e => {
                          setFormData({...formData, fullName: e.target.value});
                          if (errors.fullName) setErrors({...errors, fullName: ''});
                        }}
                    />
                    {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
                </div>

                <div>
                    <input 
                        className={`w-full p-3 border rounded-lg bg-slate-50 ${errors.phone ? 'border-red-500' : ''}`}
                        placeholder="Phone Number" 
                        value={formData.phone}
                        onChange={e => {
                          setFormData({...formData, phone: e.target.value});
                          if (errors.phone) setErrors({...errors, phone: ''});
                        }}
                    />
                    {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>

                <div>
                    <label className="block text-sm text-slate-600 mb-1 font-medium">Education Level *</label>
                    <select 
                        className={`w-full p-3 border rounded-lg bg-slate-50 ${errors.educationLevel ? 'border-red-500' : ''}`}
                        value={formData.educationLevel}
                        onChange={e => {
                          setFormData({...formData, educationLevel: e.target.value, studyStream: '', customStudyStream: ''});
                          if (errors.educationLevel) setErrors({...errors, educationLevel: ''});
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
                    <label className="block text-sm text-slate-600 mb-1 font-medium">
                      {formData.educationLevel === 'B.Tech' ? 'Branch' : 'Stream'} *
                    </label>
                    <select 
                        className={`w-full p-3 border rounded-lg bg-slate-50 ${errors.studyStream ? 'border-red-500' : ''}`}
                        value={formData.studyStream}
                        onChange={e => {
                          const nextValue = e.target.value;
                          setFormData({
                            ...formData,
                            studyStream: nextValue,
                            customStudyStream: nextValue === 'Others' ? formData.customStudyStream : '',
                          });
                          if (errors.studyStream) setErrors({...errors, studyStream: ''});
                          if (errors.customStudyStream) setErrors({...errors, customStudyStream: ''});
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
                          className={`w-full p-3 border rounded-lg bg-slate-50 ${errors.customStudyStream ? 'border-red-500' : ''}`}
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
                    <label className="block text-sm text-slate-600 mb-1 font-medium">Diploma / Board Details</label>
                    <textarea 
                        className="w-full p-3 border rounded-lg bg-slate-50 resize-none"
                        placeholder="Enter your diploma or board details (e.g., SSC Board, Year, School Name, etc.)"
                        rows="3"
                        value={formData.diploma}
                        onChange={e => setFormData({...formData, diploma: e.target.value})}
                    />\n                  </div>
                )}

                <div>
                    <input 
                        type="email" 
                        className={`w-full p-3 border rounded-lg bg-slate-50 ${errors.email ? 'border-red-500' : ''}`}
                        placeholder="Email Address" 
                        value={formData.email}
                        onChange={e => {
                          setFormData({...formData, email: e.target.value});
                          if (errors.email) setErrors({...errors, email: ''});
                        }}
                    />
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>

                <div>
                    <input 
                        type="password" 
                        className={`w-full p-3 border rounded-lg bg-slate-50 ${errors.password ? 'border-red-500' : ''}`}
                        placeholder="Password" 
                        value={formData.password}
                        onChange={e => {
                          setFormData({...formData, password: e.target.value});
                          if (errors.password) setErrors({...errors, password: ''});
                        }}
                    />
                    {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                </div>

                <div>
                    <label className={`block text-sm text-slate-600 mb-2 font-medium ${errors.file ? 'text-red-500' : ''}`}>Profile Photo</label>
                    <input 
                        type="file" 
                        accept="image/*"
                        onChange={e => {
                          setFile(e.target.files?.[0] || null);
                          if (errors.file) setErrors({...errors, file: ''});
                        }} 
                        className={`w-full text-sm border rounded-lg p-2 ${errors.file ? 'border-red-500' : ''}`}
                    />
                    {file && <p className="text-green-600 text-xs mt-1">✓ {file.name}</p>}
                    {errors.file && <p className="text-red-500 text-xs mt-1">{errors.file}</p>}
                </div>

                <button disabled={loading} className="w-full btn-primary py-3 font-bold mt-6">
                    {loading ? 'Creating Account...' : 'Register Now'}
                </button>
            </form>
            <p className="text-center mt-6 text-sm">
                Already have an account? <Link to="/login" className="text-blue-600 font-bold">Login</Link>
            </p>
            {registrationDone && (
              <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-800 mb-2">
                  Verification email sent to <span className="font-semibold">{registeredEmail}</span>
                </p>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendingVerification}
                  className="w-full bg-blue-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  {resendingVerification ? 'Sending...' : 'Resend verification email'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full mt-2 border border-slate-300 text-slate-700 text-sm font-semibold py-2 rounded-lg hover:bg-slate-50"
                >
                  Go to Login
                </button>
              </div>
            )}
            </>
            )}
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
