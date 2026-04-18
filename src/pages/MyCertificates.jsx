import React, { useEffect, useState } from 'react';
import { Award, Download, Eye, Linkedin, MessageCircle, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import usePopup from '../hooks/usePopup.jsx';
import LoadingSpinner from '../components/LoadingSpinner';
import { buildWhatsAppShareUrl, trackPremiumEvent } from '../utils/growth';
import { getCertificateDisplayName, hasApprovedIdentity } from '../utils/identityVerification';

/**
 * MyCertificates Component
 * ========================
 * Displays user certificates with the official SkillPro branding
 * Features:
 * - View certificates in browser
 * - Download certificates as PDF
 * - Share certificates via URL
 * - Verify certificates using UUID or formatted ID
 * 
 * Certificate Format: SkillPro-YYYY-MM-DD-RANDOM12
 * Canvas Size: 1200x900px
 * Logo: Loaded from public/skillpro-logo.png
 */

let jsPdfLoader;
const FOUNDER_SIGNATURE_URL = '/nani-signature-cropped.png';

/**
 * Dynamically loads jsPDF library from local dependency
 * Caches the loader promise to prevent multiple imports
 * Used for PDF generation from canvas
 */
const loadJsPDF = async () => {
  if (!jsPdfLoader) {
    jsPdfLoader = import('jspdf');
  }
  return jsPdfLoader;
};

/**
 * generateDeterministicCode()
 * ===========================
 * Creates a unique 12-character code from certificate ID
 * Uses deterministic hashing so same input = same output
 * Output: Letters A-Z and digits 0-9
 * This ensures consistent certificate IDs across sessions
 */
const generateDeterministicCode = (seed) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  let code = '';
  for (let i = 0; i < 12; i += 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    code += alphabet[hash % alphabet.length];
  }
  return code;
};

/**
 * formatCertificateId()
 * ====================
 * Formats certificate ID in official SkillPro format
 * Format: SkillPro-YYYY-MM-DD-RANDOM12
 * 
 * Example: SkillPro-2026-01-04-PJEEZAML9K2X
 * 
 * Components:
 * - Prefix: "SkillPro" (branding)
 * - Date: Year-Month-Day when certificate was issued
 * - Random: 12-character unique code (deterministic based on certificate ID)
 */
const formatCertificateId = (cert) => {
  const date = cert?.issued_at ? new Date(cert.issued_at) : new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const random = generateDeterministicCode(String(cert?.id ?? `${y}${m}${d}`));
  return `SkillPro-${y}-${m}-${d}-${random}`;
};

const resolveCertificateCourseTitle = (cert) =>
  cert?.generated_course_name || cert?.generated_name || cert?.course?.title || 'General Achievement';

const toSafeFilePart = (value) =>
  String(value || '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * MyCertificates Component
 * Uses: useAuth (profile, isPremium), usePopup (notifications)
 * State: certificates[], loading, downloading
 * 
 * Displays certificates in a card grid with options to:
 * 1. View in browser (opens in new tab)
 * 2. Download as PDF
 * 3. Share via URL (copy shareable link)
 */
const MyCertificates = () => {
  const { profile } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [revokedCount, setRevokedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const { popupNode, openPopup } = usePopup();
  const certificateDisplayName = getCertificateDisplayName(profile);
  const idVerifiedForCertificates = hasApprovedIdentity(profile);

  /**
   * buildCertificateDataUrl()
   * ==========================
   * ASYNC function - generates certificate as HTML5 Canvas
   * 
   * Canvas Layout (1200x900px):
   * 1. Background: Cream color (#f5f1e8)
   * 2. Outer Gold Border: 20px thick (#d4a574)
   * 3. Inner Gold Border: 10px thick (spacing)
   * 4. White Interior: Main certificate content area
   * 5. Logo: Centered at top (520, 60) - 160x120px
  *    - Loads from: import.meta.env.VITE_CERTIFICATE_LOGO (/skillpro-logo.png)
   *    - Uses Promise wrapper for async image loading
   * 6. Heading: "THIS CERTIFICATE IS PROUDLY PRESENTED TO" (32px bold)
   * 7. Student Name Box: White box with gray border, underline
   * 8. Course Name Box: White box with gray border, underline
   * 9. Footer: Completion date, Verification ID, Nani signature
   * 
   * Returns: Promise<DataURL> for PDF generation
   */
  const buildCertificateDataUrl = async (cert, formattedId) => {
    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1800;
    const ctx = canvas.getContext('2d');
    const scale = 2; // 2x resolution for clarity
    ctx.scale(scale, scale);

    // ===== CERTIFICATE BACKGROUND & BORDERS =====
    // Premium background with subtle pattern
    ctx.fillStyle = '#faf8f3';
    ctx.fillRect(0, 0, 1200, 900);

    // Outermost gold border (premium - 30px)
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(10, 10, 1180, 880);

    // Inner spacing line (decorative gold - 2px)
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(40, 40, 1120, 820);

    // White premium background (glossy effect)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(45, 45, 1110, 810);

    // Decorative corner ornaments (top-left and top-right)
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    // Top-left corner ornament
    ctx.beginPath();
    ctx.moveTo(70, 70);
    ctx.lineTo(100, 70);
    ctx.moveTo(70, 70);
    ctx.lineTo(70, 100);
    ctx.stroke();
    // Top-right corner ornament
    ctx.beginPath();
    ctx.moveTo(1130, 70);
    ctx.lineTo(1100, 70);
    ctx.moveTo(1130, 70);
    ctx.lineTo(1130, 100);
    ctx.stroke();
    // Bottom-left corner ornament
    ctx.beginPath();
    ctx.moveTo(70, 830);
    ctx.lineTo(100, 830);
    ctx.moveTo(70, 830);
    ctx.lineTo(70, 800);
    ctx.stroke();
    // Bottom-right corner ornament
    ctx.beginPath();
    ctx.moveTo(1130, 830);
    ctx.lineTo(1100, 830);
    ctx.moveTo(1130, 830);
    ctx.lineTo(1130, 800);
    ctx.stroke();

    // ===== LOGO LOADING (ASYNC) =====
    // Loads SkillPro logo from public folder
    // Uses Promise wrapper to ensure logo loads before canvas is complete
    // If logo fails to load, certificate renders without logo
    let logoLoaded = false;
    try {
      const logoUrl = import.meta.env.VITE_CERTIFICATE_LOGO || '/skillpro-logo.png';
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      await new Promise((resolve) => {
        logoImg.onload = () => {
          // Render logo inside a circular badge instead of a square box.
          const centerX = 600;
          const centerY = 120;
          const radius = 60;
          ctx.save();
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(logoImg, centerX - radius, centerY - radius, radius * 2, radius * 2);
          ctx.restore();
          ctx.strokeStyle = '#d4af37';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 4, 0, Math.PI * 2);
          ctx.stroke();
          logoLoaded = true;
          resolve();
        };
        logoImg.onerror = () => resolve();
        logoImg.src = logoUrl;
      });
    } catch (err) {
      console.warn('Failed to load certificate logo:', err);
    }

    // ===== SIGNATURE IMAGE LOADING (ASYNC) =====
    // Loads founder signature from public folder
    // Uses Promise wrapper to ensure signature loads before canvas is complete
    // If signature fails to load, falls back to text signature
    const footerCenterX = 960;

    try {
      const signatureUrl = FOUNDER_SIGNATURE_URL;
      const signatureImg = new Image();
      signatureImg.crossOrigin = 'anonymous';
      await new Promise((resolve) => {
        signatureImg.onload = () => {
          ctx.drawImage(signatureImg, footerCenterX - 58, 666, 116, 91);
          resolve();
        };
        signatureImg.onerror = () => resolve(); // Continue without signature if image fails
        signatureImg.src = signatureUrl;
      });
    } catch (err) {
      console.warn('Failed to load certificate signature:', err);
    }

    // ===== CERTIFICATE CONTENT =====
    // Main heading
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('WE PROUDLY PRESENT THIS CERTIFICATE TO', 600, 380);

    // ===== STUDENT NAME SECTION =====
    // Student name in elegant blue (centered)
    ctx.fillStyle = '#1565c0';
    ctx.font = 'bold 48px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      getCertificateDisplayName(profile, { placeholder: '________________________' }),
      600,
      460
    );

    // Line below student name
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(250, 475);
    ctx.lineTo(950, 475);
    ctx.stroke();

    // ===== COURSE SECTION =====
    // Recognition text (closer to course)
    ctx.fillStyle = '#1e293b';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('In recognition of successfully completing the requirements of the course:', 600, 520);

    // Course name in elegant styling (centered)
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 32px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(resolveCertificateCourseTitle(cert), 600, 560);

    // ===== LOGO & BRANDING SECTION =====
    // Use the actual logo; fall back to text only if logo fails to load.
    if (!logoLoaded) {
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SkillPro', 600, 130);
      ctx.font = '12px Arial';
      ctx.fillStyle = '#666666';
      ctx.fillText('Empowering Every Learner', 600, 155);
    }

    // ===== CERTIFICATE OF COMPLETION SECTION =====
    // Large "CERTIFICATE" text
    ctx.fillStyle = '#1565c0';
    ctx.font = 'bold 56px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('CERTIFICATE', 600, 280);

    // Line from left (before OF COMPLETION)
    ctx.strokeStyle = '#1565c0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(400, 305);
    ctx.lineTo(520, 305);
    ctx.stroke();

    // "OF COMPLETION" text
    ctx.fillStyle = '#1e293b';
    ctx.font = '18px Arial';
    ctx.fillText('OF COMPLETION', 600, 310);

    // Line from right (after OF COMPLETION)
    ctx.strokeStyle = '#1565c0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(680, 305);
    ctx.lineTo(800, 305);
    ctx.stroke();

    // ===== CERTIFICATE DETAILS SECTION (BOTTOM LEFT) =====
    // Course Completion Date
    ctx.fillStyle = '#1e293b';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    const completionDate = new Date(cert.issued_at).toLocaleDateString();
    ctx.fillText(`Date: ${completionDate}`, 70, 760);

    // Verification ID
    ctx.fillText(`Certificate ID: ${formattedId}`, 70, 790);

    // ===== SIGNATURE SECTION (BOTTOM RIGHT) =====
    // Founder footer block
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(footerCenterX - 78, 760);
    ctx.lineTo(footerCenterX + 78, 760);
    ctx.stroke();
    ctx.font = '14px Arial';
    ctx.fillStyle = '#1e293b';
    ctx.fillText('Founder, SkillPro', footerCenterX, 790);
    ctx.font = '13px Arial';
    ctx.fillText('Issued by SkillPro', footerCenterX, 818);

    return canvas.toDataURL('image/png');
  };

  /**
   * downloadCertificate()
   * =====================
   * Downloads certificate as PDF file
   * Process:
   * 1. Awaits buildCertificateDataUrl to generate canvas
   * 2. Loads jsPDF library from CDN
   * 3. Creates PDF from canvas data URL
  * 4. Sets filename: SkillPro_Certificate_[FormattedID].pdf
   * 5. Triggers browser download
   * 
   * File format: PDF (landscape, 1200x900pt)
   */
  const downloadCertificate = async (cert) => {
    try {
      setDownloading(cert.id);
      const { jsPDF } = await loadJsPDF();
      const formattedId = formatCertificateId(cert);
      const dataUrl = await buildCertificateDataUrl(cert, formattedId);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [2400, 1800] });
      pdf.addImage(dataUrl, 'PNG', 0, 0, 2400, 1800);
      const userName = toSafeFilePart(certificateDisplayName || 'User');
      const courseName = toSafeFilePart(resolveCertificateCourseTitle(cert) || 'Course');
      const fileName = `SkillPro Certificate ${userName} ${courseName}.pdf`;
      pdf.save(fileName);
      setDownloading(null);
    } catch (err) {
      console.error('Download error:', err);
      openPopup('Download failed', 'Failed to download certificate.', 'error');
      setDownloading(null);
    }
  };

  const shareOnLinkedIn = (cert) => {
    try {
      const certId = formatCertificateId(cert);
      const verifyUrl = `${window.location.origin}/verify/${encodeURIComponent(certId)}`;
      const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verifyUrl)}`;
      trackPremiumEvent('certificate_share_linkedin', 'my_certificates', { certId }, profile?.id || null);
      window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('LinkedIn share error:', err);
      openPopup('Share failed', 'Unable to open LinkedIn share.', 'error');
    }
  };

  const shareOnWhatsApp = (cert) => {
    try {
      const certId = formatCertificateId(cert);
      const verifyUrl = `${window.location.origin}/verify/${encodeURIComponent(certId)}`;
      const text = `My SkillPro certificate is verified here: ${verifyUrl}. Join SkillPro to build yours too.`;
      trackPremiumEvent('certificate_share_whatsapp', 'my_certificates', { certId }, profile?.id || null);
      window.open(buildWhatsAppShareUrl(text), '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('WhatsApp share error:', err);
      openPopup('Share failed', 'Unable to open WhatsApp share.', 'error');
    }
  };

  /**
   * useEffect Hook - Fetch User Certificates
   * ==========================================
   * Runs once when profile loads
   * Queries certificates table for current user
   * Joins with courses table to get course details
   * Joins with exam_submissions table to get scores
   * 
   * Data structure:
   * {
   *   id: UUID,
   *   issued_at: timestamp,
   *   course: { title, category },
   *   exam: { score_percent }
   * }
   */
  useEffect(() => {
    const fetchCerts = async () => {
      if (!profile) return;
      try {
        const [
          { data: certData, error: certError },
          { data: passedData, error: passedError },
          { data: generatedData, error: generatedError }
        ] = await Promise.all([
          supabase
          .from('certificates')
          .select(`
            id,
            issued_at,
            revoked_at,
            exam_submission_id,
            course_id,
            course:courses(title, category),
            exam:exam_submissions(score_percent)
          `)
          .eq('user_id', profile.id),
          supabase
            .from('exam_submissions')
            .select(`
              id,
              submitted_at,
              score_percent,
              exam:exams(course_id, course:courses(title, category))
            `)
            .eq('user_id', profile.id)
            .eq('passed', true),
          supabase
            .from('generated_certificates')
            .select(`
              id,
              award_type,
              award_name,
              reason,
              course_name,
              issued_at,
              certificate:certificates(id, issued_at, revoked_at)
            `)
            .eq('user_id', profile.id),
        ]);

        if (certError) throw certError;
        if (passedError) throw passedError;
        if (generatedError) throw generatedError;

        const certRows = certData || [];
        const passedRows = passedData || [];
        const generatedRows = generatedData || [];
        const generatedByCertId = new Map(
          generatedRows
            .filter((g) => g?.certificate?.id)
            .map((g) => [String(g.certificate.id), g])
        );
        const certBySubmission = new Set(
          certRows
            .map(cert => cert.exam_submission_id)
            .filter(Boolean)
            .map(String)
        );
        const certByCourse = new Set(
          certRows
            .map(cert => cert.course_id)
            .filter(Boolean)
            .map(String)
        );

        const fallbackCerts = passedRows
          .filter(sub => !certBySubmission.has(String(sub.id)))
          .filter(sub => {
            const courseId = sub?.exam?.course_id;
            if (!courseId) return true;
            return !certByCourse.has(String(courseId));
          })
          .map(sub => ({
            id: `fallback-${sub.id}`,
            issued_at: sub.submitted_at || new Date().toISOString(),
            revoked_at: null,
            exam_submission_id: sub.id,
            course_id: sub?.exam?.course_id ?? null,
            course: sub?.exam?.course || { title: 'Course', category: '' },
            exam: { score_percent: sub.score_percent },
            _fallback: true,
          }));

        const enrichedCerts = certRows.map((cert) => {
          const g = generatedByCertId.get(String(cert.id));
          if (!g) return cert;
          return {
            ...cert,
            _generated: true,
            generated_id: g.id,
            generated_type: g.award_type,
            generated_name: g.award_name,
            generated_reason: g.reason,
            generated_course_name: g.course_name,
          };
        });

        const generatedWithoutCert = generatedRows
          .filter((g) => !g?.certificate?.id)
          .map((g) => ({
            id: `generated-${g.id}`,
            issued_at: g.issued_at,
            revoked_at: g?.certificate?.revoked_at || null,
            course: { title: g.course_name || g.award_name || 'Generated Certificate', category: '' },
            exam: null,
            _generated: true,
            generated_id: g.id,
            generated_type: g.award_type,
            generated_name: g.award_name,
            generated_reason: g.reason,
            generated_course_name: g.course_name,
          }));

        const merged = [...enrichedCerts, ...fallbackCerts, ...generatedWithoutCert].sort(
          (a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime()
        );
        const revoked = merged.filter(cert => cert.revoked_at).length;
        setRevokedCount(revoked);
        setCertificates(merged);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCerts();
  }, [profile]);

  if (loading) return <div>Loading certificates...</div>;

  /**
   * Certificate Display
   * ===================
   * Shows all user certificates in a grid
   * Each certificate card has:
   * - Course title and icon
   * - Issue date
   * - Three action buttons:
   *   1. Eye icon: View certificate in browser
   *   2. Download icon: Download as PDF
   *   3. Share icon: (future feature)
   */
  return (
    <div className="space-y-6">
      {popupNode}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Certificates</h1>
          <p className="text-slate-500">Certificate name: {certificateDisplayName}</p>
        </div>
      </div>

      {!idVerifiedForCertificates && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4">
          Verify your government ID in `Verify My ID` before certificates can be issued in your name.
        </div>
      )}

      {revokedCount > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">
          One or more certificates are blocked due to cheating/malpractice.
        </div>
      )}

      {!idVerifiedForCertificates ? (
        <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm text-center text-slate-600">
          Your certificate section will unlock after ID verification is approved.
        </div>
      ) : certificates.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm text-center text-slate-600">
          No certificates yet. Complete exams with 70%+ score to earn your first one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {certificates.map(cert => (
            <div
              key={cert.id}
              className={`bg-white border rounded-xl p-4 shadow-sm flex flex-col space-y-3 ${
                cert.revoked_at ? 'border-red-200 bg-red-50/30' : 'border-slate-100'
              }`}
            >
              <div className="flex items-center space-x-3">
                {cert.revoked_at ? (
                  <XCircle className="text-red-600" size={24} />
                ) : (
                  <Award className="text-gold-400" size={24} />
                )}
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">
                    {cert.generated_name || cert.generated_course_name || cert.course?.title || 'Certificate'}
                  </p>
                  <p className="text-xs text-slate-500">Issued on {new Date(cert.issued_at).toLocaleDateString()}</p>
                  <p className="text-xs text-slate-500">Awarded to {certificateDisplayName}</p>
                  <p className="text-xs font-mono text-blue-600 mt-1">ID: {formatCertificateId(cert)}</p>
                  {cert.generated_type && (
                    <p className="text-xs text-indigo-700 mt-1">
                      Type: {cert.generated_type === 'course_completion'
                        ? 'Completion Of Certificate'
                        : cert.generated_type === 'weekly_contest_winner'
                        ? 'Winner Of The Weekly Contest'
                        : 'Custom'}
                    </p>
                  )}
                  {cert.generated_reason && (
                    <p className="text-xs text-slate-700 mt-1">Reason: {cert.generated_reason}</p>
                  )}
                  {cert.revoked_at && (
                    <p className="text-xs text-red-700 mt-1">
                      Blocked due to cheating/malpractice.
                    </p>
                  )}
                </div>
              </div>
              {typeof cert.exam?.score_percent === 'number' ? (
                <div className="inline-flex items-center w-fit px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                  Score: {cert.exam.score_percent.toFixed(1)}%
                </div>
              ) : cert._generated ? (
                <div className="inline-flex items-center w-fit px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700">
                  Admin Generated Certificate
                </div>
              ) : (
                <div className="inline-flex items-center w-fit px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
                  Verified Certificate
                </div>
              )}
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <a
                  href={`/certificate-preview/${encodeURIComponent(formatCertificateId(cert))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`min-w-0 inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 hover:shadow ${
                    cert.revoked_at ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''
                  }`}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                    <Eye size={19} strokeWidth={2.4} />
                  </span>
                  <span className="truncate">View Certificate</span>
                </a>
                <button
                  onClick={() => downloadCertificate(cert)}
                  disabled={downloading === cert.id || !!cert.revoked_at}
                  className="min-w-0 inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 px-3 py-3 text-sm font-semibold text-white shadow-md transition hover:from-slate-800 hover:to-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white">
                    <Download size={19} strokeWidth={2.4} />
                  </span>
                  <span className="truncate">{downloading === cert.id ? 'Downloading...' : 'Download PDF'}</span>
                </button>
                <button
                  onClick={() => shareOnLinkedIn(cert)}
                  disabled={!!cert.revoked_at}
                  className="min-w-0 inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 px-3 py-3 text-sm font-semibold text-white shadow-md transition hover:from-blue-800 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white">
                    <Linkedin size={19} strokeWidth={2.4} />
                  </span>
                  <span className="truncate">Share LinkedIn</span>
                </button>
                <button
                  onClick={() => shareOnWhatsApp(cert)}
                  disabled={!!cert.revoked_at}
                  className="min-w-0 inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-3 py-3 text-sm font-semibold text-white shadow-md transition hover:from-emerald-700 hover:to-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white">
                    <MessageCircle size={19} strokeWidth={2.4} />
                  </span>
                  <span className="truncate">WhatsApp</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyCertificates;
