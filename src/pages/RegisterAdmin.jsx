import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import AlertModal from '../components/AlertModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { prepareAvatarFile } from '../utils/imageUtils';

const RegisterAdmin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', fullName: '', phone: '', accessKey: '' });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '', type: 'info' });

  // Access key from environment variables
  const ADMIN_ACCESS_KEY = import.meta.env.VITE_ADMIN_ACCESS_KEY;

  const validateForm = () => {
    const newErrors = {};
    
    if (!form.accessKey.trim()) {
      newErrors.accessKey = 'Access key is required';
    } else if (form.accessKey !== ADMIN_ACCESS_KEY) {
      newErrors.accessKey = 'Invalid access key';
    }
    if (!form.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    if (!form.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email address';
    }
    if (!form.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (form.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (!file) {
      newErrors.file = 'Profile photo is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: form.fullName.trim(),
            phone: form.phone.trim(),
            role: 'admin'
          }
        }
      });
      if (error) throw error;
      const user = signUpData?.user;
      if (!user) throw new Error('Unable to create user. Please try again.');
      
      // Upload Photo
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
        }
      }
      
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        auth_user_id: user.id,
        email: form.email.trim(),
        full_name: form.fullName.trim(),
        phone: form.phone.trim(),
        avatar_url: avatarUrl,
        role: 'admin'
      }, { onConflict: 'id' });
      if (profileError && !String(profileError.message || '').toLowerCase().includes('row-level security')) {
        throw profileError;
      }
      setAlertModal({
        show: true,
        title: 'Success',
        message: 'Admin registered successfully! Please check your email to confirm your account.',
        type: 'success'
      });
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setAlertModal({
        show: true,
        title: 'Error',
        message: err.message,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg p-8 space-y-4">
        <h1 className="text-2xl font-bold text-center text-nani-dark">Register Admin</h1>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <input className={`w-full p-3 border rounded-lg ${errors.accessKey ? 'border-red-500' : ''}`} 
              type="password"
              placeholder="Access Key" 
              value={form.accessKey}
              onChange={e => {
                setForm({...form, accessKey: e.target.value});
                if (errors.accessKey) setErrors({...errors, accessKey: ''});
              }}
            />
            {errors.accessKey && <p className="text-red-500 text-xs mt-1">{errors.accessKey}</p>}
          </div>

          <div>
            <input className={`w-full p-3 border rounded-lg ${errors.fullName ? 'border-red-500' : ''}`} 
              placeholder="Full name" 
              value={form.fullName}
              onChange={e => {
                setForm({...form, fullName: e.target.value});
                if (errors.fullName) setErrors({...errors, fullName: ''});
              }}
            />
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
          </div>

          <div>
            <input className={`w-full p-3 border rounded-lg ${errors.phone ? 'border-red-500' : ''}`} 
              placeholder="Phone" 
              value={form.phone}
              onChange={e => {
                setForm({...form, phone: e.target.value});
                if (errors.phone) setErrors({...errors, phone: ''});
              }}
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${errors.file ? 'text-red-500' : ''}`}>Profile Photo</label>
            <input type="file" accept="image/*" 
              onChange={e => {
                setFile(e.target.files?.[0] || null);
                if (errors.file) setErrors({...errors, file: ''});
              }} 
              className={`w-full text-sm border rounded-lg p-2 ${errors.file ? 'border-red-500' : ''}`}
            />
            {file && <p className="text-green-600 text-xs mt-1">✓ {file.name}</p>}
            {errors.file && <p className="text-red-500 text-xs mt-1">{errors.file}</p>}
          </div>

          <div>
            <input className={`w-full p-3 border rounded-lg ${errors.email ? 'border-red-500' : ''}`} 
              type="email" 
              placeholder="Email" 
              value={form.email}
              onChange={e => {
                setForm({...form, email: e.target.value});
                if (errors.email) setErrors({...errors, email: ''});
              }}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <input className={`w-full p-3 border rounded-lg ${errors.password ? 'border-red-500' : ''}`} 
              type="password" 
              placeholder="Password" 
              value={form.password}
              onChange={e => {
                setForm({...form, password: e.target.value});
                if (errors.password) setErrors({...errors, password: ''});
              }}
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          <button disabled={loading} className="w-full btn-gold py-3 font-bold">{loading ? 'Creating...' : 'Register Admin'}</button>
        </form>
        <p className="text-center text-sm">Back to <Link className="text-blue-600 font-semibold" to="/login">Login</Link></p>
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

export default RegisterAdmin;
