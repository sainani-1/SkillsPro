import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import LoadingSpinner from '../components/LoadingSpinner';
const LOGO_URL = import.meta.env.VITE_CERTIFICATE_LOGO || '/skillpro-logo.png';
const FOUNDER_SIGNATURE_URL = '/nani-signature.png';
const ISSUED_SIGNATURE_URL = '/skillpro-issued-sign.svg';

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

const formatCertificateId = (cert) => {
  const date = cert?.issued_at ? new Date(cert.issued_at) : new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const random = generateDeterministicCode(String(cert?.id ?? `${y}${m}${d}`));
  return `SkillPro-${y}-${m}-${d}-${random}`;
};

const resolveCourseTitle = (cert) =>
  cert?.generated?.course_name || cert?.generated?.award_name || cert?.course?.title || 'General Achievement';

const buildCertificateDataUrl = async (cert, formattedId) => {
  const canvas = document.createElement('canvas');
  canvas.width = 2400;
  canvas.height = 1800;
  const ctx = canvas.getContext('2d');
  const scale = 2;
  ctx.scale(scale, scale);

  ctx.fillStyle = '#faf8f3';
  ctx.fillRect(0, 0, 1200, 900);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(10, 10, 1180, 880);
  ctx.fillRect(40, 40, 1120, 820);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(45, 45, 1110, 810);

  // Logo (center top in circular badge)
  let logoLoaded = false;
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
      logoImg.onload = () => {
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
      logoImg.src = LOGO_URL;
    });
  } catch (e) {
    // Fallback text below if image is unavailable.
  }

  if (!logoLoaded) {
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SkillPro', 600, 130);
  }

  ctx.fillStyle = '#1565c0';
  ctx.font = 'bold 56px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('CERTIFICATE', 600, 280);

  ctx.strokeStyle = '#1565c0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(400, 305);
  ctx.lineTo(520, 305);
  ctx.stroke();
  ctx.fillStyle = '#1e293b';
  ctx.font = '18px Arial';
  ctx.fillText('OF COMPLETION', 600, 310);
  ctx.beginPath();
  ctx.moveTo(680, 305);
  ctx.lineTo(800, 305);
  ctx.stroke();

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 32px Arial';
  ctx.fillText('WE PROUDLY PRESENT THIS CERTIFICATE TO', 600, 380);
  ctx.fillStyle = '#1565c0';
  ctx.font = 'bold 48px Georgia, serif';
  ctx.fillText(cert.user?.full_name || '________________________', 600, 460);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(250, 475);
  ctx.lineTo(950, 475);
  ctx.stroke();

  ctx.fillStyle = '#1e293b';
  ctx.font = '18px Arial';
  ctx.fillText('In recognition of successfully completing the requirements of the course:', 600, 520);
  ctx.font = 'bold 32px Georgia, serif';
  ctx.fillText(resolveCourseTitle(cert), 600, 560);

  const completionDate = new Date(cert.issued_at).toLocaleDateString();
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1e293b';
  ctx.fillText(`Date: ${completionDate}`, 70, 760);
  ctx.fillText(`Certificate ID: ${formattedId}`, 70, 790);

  try {
    const signatureImg = new Image();
    signatureImg.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
      signatureImg.onload = () => {
        ctx.drawImage(signatureImg, footerCenterX - 75, 692, 150, 72);
        resolve();
      };
      signatureImg.onerror = () => resolve();
      signatureImg.src = FOUNDER_SIGNATURE_URL;
    });
  } catch (e) {
    // Continue without founder signature image.
  }

  ctx.textAlign = 'center';
  ctx.font = '14px Arial';
  ctx.fillStyle = '#1e293b';
  ctx.fillText('Founder, SkillPro', footerCenterX, 792);
  ctx.font = '13px Arial';
  ctx.fillText('Issued by SkillPro', footerCenterX, 818);

  try {
    const issuedSignImg = new Image();
    issuedSignImg.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
      issuedSignImg.onload = () => {
        ctx.drawImage(issuedSignImg, footerCenterX - 70, 828, 140, 38);
        resolve();
      };
      issuedSignImg.onerror = () => resolve();
      issuedSignImg.src = ISSUED_SIGNATURE_URL;
    });
  } catch (e) {
    // Continue without issued-by sign image.
  }

  return canvas.toDataURL('image/png');
};

const CertificatePreview = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setError('Invalid certificate id.');
        setLoading(false);
        return;
      }
      try {
        const decodedId = decodeURIComponent(id);
        const match = decodedId.match(/^SkillPro-(\d{4})-(\d{2})-(\d{2})-([A-Za-z0-9]{12})$/);
        if (!match) throw new Error('Invalid certificate format.');
        const [, y, m, d] = match;
        const baseDate = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
        const start = new Date(baseDate.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const end = new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000 - 1).toISOString();

        const { data, error: certErr } = await supabase
          .from('certificates')
          .select(`
            id,
            issued_at,
            revoked_at,
            user:profiles!certificates_user_id_fkey(full_name, email),
            course:courses!certificates_course_id_fkey(title, category)
          `)
          .gte('issued_at', start)
          .lte('issued_at', end);
        if (certErr) throw certErr;

        const cert = (data || []).find((row) => formatCertificateId(row).toUpperCase() === decodedId.toUpperCase());
        if (!cert) throw new Error('Certificate not found.');
        if (cert.revoked_at) throw new Error('Certificate is blocked.');

        const { data: generated } = await supabase
          .from('generated_certificates')
          .select('award_type, award_name, reason, course_name')
          .eq('certificate_id', cert.id)
          .maybeSingle();
        if (generated) cert.generated = generated;

        const url = await buildCertificateDataUrl(cert, decodedId);
        setPreviewUrl(url);
      } catch (e) {
        setError(e.message || 'Failed to load certificate preview.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <LoadingSpinner message="Loading certificate preview..." />;

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      {error ? (
        <div className="max-w-3xl mx-auto bg-white border border-red-200 rounded-xl p-6 text-red-700">{error}</div>
      ) : (
        <img src={previewUrl} alt="Certificate preview" className="max-w-5xl w-full mx-auto border rounded-xl bg-white shadow" />
      )}
    </div>
  );
};

export default CertificatePreview;
  const footerCenterX = 1025;
