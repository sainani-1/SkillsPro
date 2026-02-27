import React, { useEffect, useState } from 'react';
import { Award, Download, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import usePopup from '../hooks/usePopup.jsx';
import LoadingSpinner from '../components/LoadingSpinner';

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

/**
 * Dynamically loads jsPDF library from CDN
 * Caches the loader promise to prevent multiple imports
 * Used for PDF generation from canvas
 */
const loadJsPDF = async () => {
  if (!jsPdfLoader) {
    jsPdfLoader = import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js');
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
  const { profile, isPremium } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [revokedCount, setRevokedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const { popupNode, openPopup } = usePopup();

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
          ctx.drawImage(logoImg, 520, 60, 160, 120);
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
    try {
      const signatureUrl = '/nani-signature.png'; // Place signature image in public folder
      const signatureImg = new Image();
      signatureImg.crossOrigin = 'anonymous';
      await new Promise((resolve) => {
        signatureImg.onload = () => {
          // Draw signature image at bottom right, positioned above the line
          ctx.drawImage(signatureImg, 950, 700, 140, 65);
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
    ctx.fillText(profile?.full_name || '________________________', 600, 460);

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
    ctx.fillText(cert.course?.title || '_______________________________', 600, 560);

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
    // Signature line
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(950, 755);
    ctx.lineTo(1100, 755);
    ctx.stroke();
    
    // Founder title (signature image displayed centered on line via async loading)
    ctx.textAlign = 'right';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#1e293b';
    ctx.fillText('Founder, SkillPro', 1100, 795);

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
      pdf.save(`certificate-${formattedId}.pdf`);
      setDownloading(null);
    } catch (err) {
      console.error('Download error:', err);
      openPopup('Download failed', 'Failed to download certificate.', 'error');
      setDownloading(null);
    }
  };

  /**
   * viewCertificate()
   * =================
   * Opens certificate in new browser window/tab
   * Displays as full-size image without PDF conversion
   * User can screenshot, print, or save from browser
   */
  const viewCertificate = async (cert) => {
    try {
      const formattedId = formatCertificateId(cert);
      const dataUrl = await buildCertificateDataUrl(cert, formattedId);
      const win = window.open();
      win.document.write(`<img src="${dataUrl}" style="max-width:100%;height:auto;" />`);
    } catch (err) {
      console.error('View error:', err);
      openPopup('Preview failed', 'Failed to open certificate preview.', 'error');
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
        const { data } = await supabase
          .from('certificates')
          .select(`
            id,
            issued_at,
            revoked_at,
            course:courses(title, category),
            exam:exam_submissions(score_percent)
          `)
          .eq('user_id', profile.id);
        const revoked = (data || []).filter(cert => cert.revoked_at).length;
        const activeCerts = (data || []).filter(cert => !cert.revoked_at);
        setRevokedCount(revoked);
        setCertificates(activeCerts);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCerts();
  }, [profile]);

  if (!isPremium(profile)) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm text-center">
        <h1 className="text-2xl font-bold text-slate-900">Premium required</h1>
        <p className="text-slate-500 mt-1">Upgrade to earn and download certificates.</p>
      </div>
    );
  }

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
          <p className="text-slate-500">Welcome, {profile?.full_name || 'Learner'} — your name will appear on every certificate.</p>
        </div>
      </div>

      {revokedCount > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">
          You are caught by copying, so we banned your certificate.
        </div>
      )}

      {certificates.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm text-center text-slate-600">
          No certificates yet. Complete exams with 70%+ score to earn your first one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {certificates.map(cert => (
            <div key={cert.id} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex flex-col space-y-3">
              <div className="flex items-center space-x-3">
                <Award className="text-gold-400" size={24} />
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{cert.course?.title}</p>
                  <p className="text-xs text-slate-500">Issued on {new Date(cert.issued_at).toLocaleDateString()}</p>
                  <p className="text-xs text-slate-500">Awarded to {profile?.full_name}</p>
                  <p className="text-xs font-mono text-blue-600 mt-1">ID: {formatCertificateId(cert)}</p>
                </div>
              </div>
              <div className="text-sm text-slate-600">Score: {cert.exam?.score_percent?.toFixed(1)}%</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => viewCertificate(cert)}
                  className="flex items-center justify-center gap-2 border border-slate-200 text-slate-700 py-2 rounded-lg hover:border-nani-accent hover:text-nani-accent transition-colors"
                >
                  <Eye size={16} />
                  View
                </button>
                <button
                  onClick={() => downloadCertificate(cert)}
                  disabled={downloading === cert.id}
                  className="flex items-center justify-center gap-2 bg-nani-dark text-white py-2 rounded-lg hover:bg-nani-accent transition-colors disabled:opacity-60"
                >
                  <Download size={16} />
                  {downloading === cert.id ? 'Downloading...' : 'Download PDF'}
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
