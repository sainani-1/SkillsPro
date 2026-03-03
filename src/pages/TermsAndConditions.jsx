import React from 'react';
import { Link } from 'react-router-dom';

const terms = [
  'You must provide accurate personal and contact details. Fake or misleading data can lead to permanent account suspension.',
  'Your account is personal. Sharing login, OTP, exam access, or paid content with others is strictly prohibited.',
  'Mobile OTP verification is mandatory for registration and profile completion. Repeated OTP abuse may trigger account lock.',
  'Any cheating, impersonation, screen-sharing, multiple-account usage, or proctoring violation can result in instant disqualification and ban.',
  'Abusive, illegal, hateful, or harmful behavior in chats, classrooms, or submissions is not allowed and may be reported to authorities.',
  'Payments are final unless a refund is explicitly approved under a written policy from the platform administrator.',
  'Course content, recordings, materials, and certificates are protected intellectual property and cannot be copied, sold, or redistributed.',
  'Your profile, attendance, performance, and usage logs may be stored for security, compliance, and academic quality control.',
  'The platform may suspend, restrict, or delete accounts for policy violation without prior notice where risk or abuse is detected.',
  'By creating or using an account, you agree to these Terms and all future updates published on this page.'
];

const TermsAndConditions = () => {
  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow p-6 md:p-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms and Conditions</h1>
        <p className="text-sm text-slate-500 mb-8">Effective date: March 3, 2026</p>

        <div className="space-y-4">
          {terms.map((item, idx) => (
            <div key={item} className="flex gap-3">
              <span className="font-semibold text-slate-700">{idx + 1}.</span>
              <p className="text-slate-700 leading-relaxed">{item}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 flex flex-wrap gap-3">
          <Link to="/register" className="btn-primary px-5 py-2 font-semibold">Back to Register</Link>
          <Link to="/login" className="px-5 py-2 font-semibold rounded border border-slate-300 text-slate-700 hover:bg-slate-50">Back to Login</Link>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
