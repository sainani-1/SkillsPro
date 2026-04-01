import React, { useState } from 'react';
import { useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck, Search, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

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

const formatFallbackCertificateId = (submission) => {
  const issuedAt = submission?.submitted_at ? new Date(submission.submitted_at) : new Date();
  const y = issuedAt.getFullYear();
  const m = String(issuedAt.getMonth() + 1).padStart(2, '0');
  const d = String(issuedAt.getDate()).padStart(2, '0');
  const seed = `fallback-${submission?.id ?? `${y}${m}${d}`}`;
  const random = generateDeterministicCode(seed);
  return `SkillPro-${y}-${m}-${d}-${random}`;
};

const resolveCourseTitle = (cert) =>
  cert?.generated?.course_name || cert?.generated?.award_name || cert?.course?.title || 'General Achievement';
const FOUNDER_SIGNATURE_URL = '/nani-signature.png';
const ISSUED_SIGNATURE_URL = '/skillpro-issued-sign.svg';

const isPermissionError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  return (
    message.includes('permission denied') ||
    message.includes('row-level security') ||
    message.includes('jwt') ||
    details.includes('permission denied') ||
    details.includes('row-level security')
  );
};

const VerifyCertificate = () => {
  const { id: routeCertId } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [certId, setCertId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const shouldShowPublicActions = !user?.id && location.state?.fromHome === true;
  const shouldShowAboutBack = location.state?.fromAbout === true;

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

    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(70, 70);
    ctx.lineTo(100, 70);
    ctx.moveTo(70, 70);
    ctx.lineTo(70, 100);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1130, 70);
    ctx.lineTo(1100, 70);
    ctx.moveTo(1130, 70);
    ctx.lineTo(1130, 100);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(70, 830);
    ctx.lineTo(100, 830);
    ctx.moveTo(70, 830);
    ctx.lineTo(70, 800);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1130, 830);
    ctx.lineTo(1100, 830);
    ctx.moveTo(1130, 830);
    ctx.lineTo(1130, 800);
    ctx.stroke();

    let logoLoaded = false;
    try {
      const logoUrl = import.meta.env.VITE_CERTIFICATE_LOGO || '/skillpro-logo.png';
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      await new Promise((resolve) => {
        logoImg.onload = () => {
          // Render logo in a circular badge for consistency with certificate design.
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

    try {
      const signatureImg = new Image();
      signatureImg.crossOrigin = 'anonymous';
      await new Promise((resolve) => {
        signatureImg.onload = () => {
          ctx.drawImage(signatureImg, 945, 690, 150, 72);
          resolve();
        };
        signatureImg.onerror = () => resolve();
        signatureImg.src = FOUNDER_SIGNATURE_URL;
      });
    } catch (err) {
      console.warn('Failed to load certificate signature:', err);
    }

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

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(950, 755);
    ctx.lineTo(1100, 755);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#1e293b';
    ctx.fillText('Founder, SkillPro', 1100, 795);
    ctx.font = '13px Arial';
    ctx.fillText('Issued by SkillPro', 1100, 818);

    try {
      const issuedSignImg = new Image();
      issuedSignImg.crossOrigin = 'anonymous';
      await new Promise((resolve) => {
        issuedSignImg.onload = () => {
          ctx.drawImage(issuedSignImg, 955, 825, 140, 38);
          resolve();
        };
        issuedSignImg.onerror = () => resolve();
        issuedSignImg.src = ISSUED_SIGNATURE_URL;
      });
    } catch (err) {
      console.warn('Failed to load issued-by signature:', err);
    }

    return canvas.toDataURL('image/png');
  };

  const runVerify = async (rawCertId) => {
    const trimmedSource = rawCertId || certId;
    if (!trimmedSource?.trim()) return;
    setLoading(true);
    setResult(null);
    setPreviewUrl('');
    try {
      const trimmedId = trimmedSource.trim();
      const formattedMatch = trimmedId.match(/^SkillPro-(\d{4})-(\d{2})-(\d{2})-([A-Za-z0-9]{12})$/);

      let data = null;
      let error = null;

      if (formattedMatch) {
        const [, y, m, d] = formattedMatch;
        const baseDate = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
        const start = new Date(baseDate.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const end = new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000 - 1).toISOString();
        const resp = await supabase
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
        error = resp.error;
        if (!resp.error && resp.data) {
          data = resp.data.find((cert) => formatCertificateId(cert).toUpperCase() === trimmedId.toUpperCase()) || null;
        }

        if ((!data || error) && isPermissionError(error)) {
          const basicResp = await supabase
            .from('certificates')
            .select('id, issued_at, revoked_at')
            .gte('issued_at', start)
            .lte('issued_at', end);
          error = basicResp.error;
          if (!basicResp.error && basicResp.data) {
            data = basicResp.data.find((cert) => formatCertificateId(cert).toUpperCase() === trimmedId.toUpperCase()) || null;
          }
        }

        if (!data && !error) {
          const fallbackResp = await supabase
            .from('exam_submissions')
            .select(`
              id,
              submitted_at,
              score_percent,
              passed,
              user:profiles!exam_submissions_user_id_fkey(full_name, email),
              exam:exams(course_id, course:courses(title, category))
            `)
            .eq('passed', true)
            .gte('submitted_at', start)
            .lte('submitted_at', end);

          if (!fallbackResp.error && fallbackResp.data) {
            const matchedSubmission =
              fallbackResp.data.find(
                (sub) => formatFallbackCertificateId(sub).toUpperCase() === trimmedId.toUpperCase()
              ) || null;
            if (matchedSubmission) {
              data = {
                id: `fallback-${matchedSubmission.id}`,
                issued_at: matchedSubmission.submitted_at,
                revoked_at: null,
                user: matchedSubmission.user || null,
                course: matchedSubmission.exam?.course || null,
                _fallback: true,
              };
            }
          }
        }
      } else {
        const resp = await supabase
          .from('certificates')
          .select(`
            id,
            issued_at,
            revoked_at,
            user:profiles!certificates_user_id_fkey(full_name, email),
            course:courses!certificates_course_id_fkey(title, category)
          `)
          .eq('id', trimmedId)
          .single();
        error = resp.error;
        data = resp.data;

        if ((!data || error) && isPermissionError(error)) {
          const basicResp = await supabase
            .from('certificates')
            .select('id, issued_at, revoked_at')
            .eq('id', trimmedId)
            .single();
          error = basicResp.error;
          data = basicResp.data;
        }
      }
      
      if (error || !data) {
        setResult({ valid: false, message: 'Certificate ID not found. This certificate was not issued by SkillPro.' });
      } else if (data.revoked_at) {
        const { data: generatedMeta } = await supabase
          .from('generated_certificates')
          .select('award_type, award_name, reason, course_name')
          .eq('certificate_id', data.id)
          .maybeSingle();
        if (generatedMeta) {
          data.generated = generatedMeta;
        }
        setResult({
          valid: false,
          message: 'Certificate blocked: caught due to cheating/malpractice.',
          data
        });
      } else {
        if (!data._fallback) {
          const { data: generatedMeta } = await supabase
            .from('generated_certificates')
            .select('award_type, award_name, reason, course_name')
            .eq('certificate_id', data.id)
            .maybeSingle();
          if (generatedMeta) {
            data.generated = generatedMeta;
          }
        }
        setResult({ valid: true, message: 'Certificate is valid and authentic!', data });
        if (data.user?.full_name && (data.course?.title || data.generated?.award_name || data.generated?.course_name)) {
          const formattedId = data._fallback ? certId.trim() : formatCertificateId(data);
          const dataUrl = await buildCertificateDataUrl(data, formattedId);
          setPreviewUrl(dataUrl);
        }
        if (!data._fallback) {
          await supabase.from('certificate_verifications').insert({ certificate_id: data.id });
        }
      }
    } catch (err) {
      setResult({ valid: false, message: 'Certificate not present in our records. Not issued by SkillPro.' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    await runVerify(certId);
  };

  useEffect(() => {
    if (!routeCertId) return;
    const decoded = decodeURIComponent(routeCertId);
    setCertId(decoded);
    runVerify(decoded);
  }, [routeCertId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 space-y-6">
        {shouldShowPublicActions ? (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft size={16} />
              Back to Home
            </button>
            <Link to="/register" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
              Create Account
            </Link>
          </div>
        ) : null}

        {shouldShowAboutBack ? (
          <div>
            <button
              type="button"
              onClick={() => navigate('/about')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft size={16} />
              Back to About
            </button>
          </div>
        ) : null}

        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-gold-400 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck size={32} className="text-nani-dark" />
          </div>
          <h1 className="text-3xl font-bold text-nani-dark">Verify Certificate</h1>
          <p className="text-slate-600 mt-2">Enter a certificate ID to validate authenticity</p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={certId}
              onChange={(e) => setCertId(e.target.value)}
              placeholder="Enter Certificate ID (SkillPro-YYYY-MM-DD-XXXXXXXXXXXX or UUID)"
              className="w-full p-4 pr-12 border-2 border-slate-200 rounded-xl focus:border-gold-400 focus:outline-none"
              required
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-gold py-4 font-bold text-lg disabled:opacity-60"
          >
            {loading ? 'Verifying...' : 'Verify Certificate'}
          </button>
        </form>

        {result && (
          <div className={`p-6 rounded-xl border-2 ${
            result.valid 
              ? 'bg-green-50 border-green-500' 
              : 'bg-red-50 border-red-500'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              {result.valid ? (
                <CheckCircle size={28} className="text-green-600" />
              ) : (
                <XCircle size={28} className="text-red-600" />
              )}
              <h3 className="text-xl font-bold">{result.message}</h3>
            </div>
            {result.data && result.valid && (
              <div className="text-sm space-y-1 text-slate-700">
                <p><strong>Student:</strong> {result.data.user?.full_name}</p>
                <p><strong>Course:</strong> {result.data.course?.title}</p>
                <p><strong>Category:</strong> {result.data.course?.category}</p>
                <p><strong>Issued:</strong> {new Date(result.data.issued_at).toLocaleDateString()}</p>
                {result.data.generated?.award_name && <p><strong>Award:</strong> {result.data.generated.award_name}</p>}
                {result.data.generated?.award_type && <p><strong>Type:</strong> {result.data.generated.award_type}</p>}
                {result.data.generated?.reason && <p><strong>Reason:</strong> {result.data.generated.reason}</p>}
                <div className="mt-4 rounded-xl border border-green-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">Build yours on SkillPro</p>
                  <p className="mt-1 text-sm text-slate-600">Courses, mentorship, verified exams, resume builder, and shareable certificates are available from one account.</p>
                  <Link to="/register" className="mt-3 inline-flex items-center rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700">
                    Join SkillPro
                  </Link>
                </div>
              </div>
            )}
            {result.data && !result.valid && result.data.revoked_at && (
              <div className="text-sm space-y-1 text-red-800">
                <p><strong>Student:</strong> {result.data.user?.full_name}</p>
                <p><strong>Course:</strong> {result.data.course?.title}</p>
                <p><strong>Issued:</strong> {new Date(result.data.issued_at).toLocaleDateString()}</p>
                <p><strong>Blocked On:</strong> {new Date(result.data.revoked_at).toLocaleString()}</p>
                <p><strong>Reason:</strong> Caught due to cheating/malpractice.</p>
                {result.data.generated?.award_name && <p><strong>Award:</strong> {result.data.generated.award_name}</p>}
              </div>
            )}
          </div>
        )}

        {previewUrl && result?.valid && (
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">Certificate Preview</p>
            <img src={previewUrl} alt="Certificate preview" className="w-full h-auto border rounded-lg" />
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyCertificate;
