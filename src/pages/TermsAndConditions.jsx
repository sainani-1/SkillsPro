import React from 'react';
import { Link } from 'react-router-dom';

const sections = [
  {
    title: '1. Acceptance of Terms',
    points: [
      'By creating an account, logging in, enrolling, or using any platform feature, you legally agree to these Terms and all platform policies.',
      'If you do not agree, you must immediately stop using the platform and discontinue registration.',
    ],
  },
  {
    title: '2. Eligibility and Accurate Information',
    points: [
      'You must provide true, complete, and current information including name, email, phone, and academic details.',
      'Fake identity, impersonation, forged documents, or misleading profile data may result in permanent account termination.',
    ],
  },
  {
    title: '3. Account Security and Single-User Access',
    points: [
      'Your account is personal and non-transferable. Sharing credentials, OTP, or exam links is strictly prohibited.',
      'The platform may enforce one active session per account and may force logout of previous sessions for security reasons.',
      'You are fully responsible for activity from your account until unauthorized access is formally reported.',
    ],
  },
  {
    title: '4. Exam Integrity and Proctoring Compliance',
    points: [
      'Any cheating, impersonation, screen sharing, tab switching abuse, remote assistance, or unauthorized tools is a major violation.',
      'You consent to automated and manual proctoring checks, including activity logs, risk flags, and exam behavior review.',
      'Violation may lead to exam cancellation, certificate block, score nullification, suspension, or permanent ban without refund.',
    ],
  },
  {
    title: '5. Live Classes, Chat, and Conduct',
    points: [
      'Abusive, threatening, hateful, sexually explicit, illegal, defamatory, or disruptive behavior is strictly prohibited.',
      'Harassment of students, teachers, or staff in class, chat, or submissions can lead to immediate disciplinary action.',
      'The platform may mute, remove, suspend, or report users to authorities when required by law.',
    ],
  },
  {
    title: '6. Payments, Plans, and Refunds',
    points: [
      'Paid enrollments, subscriptions, and upgrades are final unless an explicit written refund policy applies.',
      'Chargeback abuse, payment fraud, or unauthorized payment reversal can result in account lock and legal recovery action.',
      'Pricing, offers, and coupon terms may change at any time without retroactive adjustment.',
    ],
  },
  {
    title: '7. Certificates and Verification',
    points: [
      'Certificates are issued only when completion and integrity checks are satisfied.',
      'The platform may revoke or block certificates upon malpractice, disputed identity, or policy breach discovered later.',
      'Any tampering, forgery, resale, or false representation of a certificate is strictly prohibited.',
    ],
  },
  {
    title: '8. Intellectual Property and Content Use',
    points: [
      'All platform content including videos, notes, assessments, logos, and certificates is protected intellectual property.',
      'Copying, recording, redistributing, resale, scraping, reverse engineering, or unauthorized public sharing is prohibited.',
      'Limited personal learning access does not grant transfer, publishing, or commercial rights.',
    ],
  },
  {
    title: '9. Data, Privacy, and Monitoring',
    points: [
      'You authorize collection and processing of profile data, usage data, attendance, exam logs, and security events.',
      'Data may be used for platform operations, fraud prevention, quality assurance, legal compliance, and dispute resolution.',
      'Security records and policy evidence may be retained as required for audits and enforcement.',
    ],
  },
  {
    title: '10. Suspension, Termination, and Appeals',
    points: [
      'The platform may restrict, suspend, or terminate access at its sole discretion for suspected abuse, risk, or policy violations.',
      'Urgent risk cases may be actioned without prior notice; restoration is not guaranteed.',
      'Appeals, if allowed, must include verifiable proof and may be rejected if evidence confirms violation.',
    ],
  },
  {
    title: '11. Liability Limitation',
    points: [
      'Platform services are provided on an as-available basis; uninterrupted access is not guaranteed.',
      'The platform is not liable for indirect, incidental, consequential, or third-party losses arising from service usage.',
    ],
  },
  {
    title: '12. Updates to Terms',
    points: [
      'These Terms may be revised anytime. Continued usage after updates means renewed acceptance.',
      'Users are responsible for periodically reviewing this page for the latest version.',
    ],
  },
];

const TermsAndConditions = () => {
  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow p-6 md:p-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms and Conditions</h1>
        <p className="text-sm text-slate-500 mb-8">Effective date: March 3, 2026</p>

        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.title} className="rounded-xl border border-slate-200 p-4 md:p-5 bg-slate-50/60">
              <h2 className="text-base md:text-lg font-bold text-slate-900 mb-3">{section.title}</h2>
              <div className="space-y-2">
                {section.points.map((point, idx) => (
                  <div key={point} className="flex gap-3">
                    <span className="font-semibold text-slate-700">{idx + 1}.</span>
                    <p className="text-slate-700 leading-relaxed">{point}</p>
                  </div>
                ))}
              </div>
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
