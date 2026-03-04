import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import usePopup from '../hooks/usePopup.jsx';
const LOGO_URL = import.meta.env.VITE_CERTIFICATE_LOGO || "/skillpro-logo.png";
const MFA_ISSUER = "SkillPro";

export default function AdminMFASetup() {

  const navigate = useNavigate();
  const { openPopup, popupNode } = usePopup();
  const [step, setStep] = useState("name");
  const [selectedName, setSelectedName] = useState("");
  const [qr, setQr] = useState(null);
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Reserved for future autofill / saved names.
  }, []);

  const buildSkillProOtpUri = (uri, selectedLabel) => {
    if (!uri) return null;
    try {
      const otpUrl = new URL(uri);
      const accountLabel = selectedLabel?.trim() || "Admin";
      otpUrl.pathname = `/${MFA_ISSUER}:${accountLabel}`;
      otpUrl.searchParams.set("issuer", MFA_ISSUER);
      return otpUrl.toString();
    } catch {
      return uri;
    }
  };

  const enrollMFA = async () => {
    if (!selectedName) {
      openPopup('Validation', 'Select MFA Name', 'warning');
      return;
    }

    setLoading(true);
    const { data, error } =
      await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: selectedName
      });

    if (error) {
      openPopup('Error', error.message, 'error');
      setLoading(false);
      return;
    }

    const otpUri = buildSkillProOtpUri(data?.totp?.uri, selectedName);
    setQr(otpUri || data?.totp?.qr_code || null);
    setFactorId(data.id);
    setStep("qr");
    setLoading(false);
  };

  const handleCodeChange = (value, index) => {
    const digit = value.replace(/\D/g, "").slice(0, 1);
    if (!digit) return;
    const next = [...code];
    next[index] = digit;
    setCode(next);
    if (index < 5) {
      const nextInput = document.getElementById(`mfa-setup-digit-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleCodeKeyDown = (e, index) => {
    if (e.key !== "Backspace") return;
    if (code[index]) {
      const next = [...code];
      next[index] = "";
      setCode(next);
      return;
    }
    if (index > 0) {
      const prevInput = document.getElementById(`mfa-setup-digit-${index - 1}`);
      if (prevInput) prevInput.focus();
      const next = [...code];
      next[index - 1] = "";
      setCode(next);
    }
  };

  const verify = async () => {
    const codeValue = code.join("");
    if (codeValue.length !== 6) {
      openPopup('Validation', 'Enter full 6-digit code.', 'warning');
      return;
    }

    setLoading(true);

    const { error } =
      await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: codeValue
      });

    if (error) {
      openPopup('Error', 'Invalid Code', 'error');
      setLoading(false);
      return;
    }

    const { data: userResp } = await supabase.auth.getUser();
    sessionStorage.setItem("admin_mfa_verified", "true");
    if (userResp?.user?.id) {
      sessionStorage.setItem("admin_mfa_verified_user", userResp.user.id);
    }

    openPopup('Success', 'MFA Enabled', 'success');

    setTimeout(() => navigate("/app/admin/mfa-management"), 900);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-200 px-4">
      {popupNode}

      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-8 border-blue-500">
        <h2 className="text-2xl font-bold mb-2 text-center text-blue-700">Setup Admin MFA</h2>
        <p className="text-sm text-slate-500 text-center mb-6">
          {step === "name" && "Step 1 of 3: Enter your MFA name"}
          {step === "qr" && "Step 2 of 3: Scan this QR in your authenticator app"}
          {step === "verify" && "Step 3 of 3: Enter 6-digit MFA code"}
        </p>

        {step === "name" && (
          <div className="space-y-4">
            <input
              className="border border-slate-300 p-3 w-full rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter MFA Name (e.g., Admin Device)"
              value={selectedName}
              onChange={e => setSelectedName(e.target.value)}
            />
            <button
              onClick={enrollMFA}
              disabled={loading}
              className="bg-blue-600 text-white w-full py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Generating..." : "Next: Generate QR"}
            </button>
          </div>
        )}

        {step === "qr" && qr && (
          <div className="space-y-5">
            <div className="relative w-64 h-64 mx-auto rounded-2xl border border-slate-200 p-3 bg-white shadow-sm">
              {qr.startsWith("otpauth://") ? (
                <QRCodeSVG
                  value={qr}
                  size={232}
                  level="M"
                  includeMargin={false}
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <img
                  src={qr}
                  alt="MFA QR"
                  className="w-full h-full object-contain rounded-lg"
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-12 h-12 rounded-full border border-slate-300/60 shadow flex items-center justify-center overflow-hidden">
                  <img src={LOGO_URL} alt="Logo" className="w-9 h-9 object-contain rounded-full mix-blend-multiply" />
                </div>
              </div>
            </div>
            <button
              onClick={() => setStep("verify")}
              className="bg-blue-600 text-white w-full py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              Next: Enter MFA Code
            </button>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-5">
            <div className="flex justify-center gap-2">
              {[...Array(6)].map((_, i) => (
                <input
                  key={i}
                  id={`mfa-setup-digit-${i}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={code[i]}
                  onChange={(e) => handleCodeChange(e.target.value, i)}
                  onKeyDown={(e) => handleCodeKeyDown(e, i)}
                  className={`w-11 h-12 text-center text-xl font-mono rounded-lg border-2 ${
                    code[i] ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300"
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep("qr")}
                className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-lg font-semibold hover:bg-slate-300"
              >
                Back
              </button>
              <button
                disabled={loading}
                onClick={verify}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-60"
              >
                {loading ? "Verifying..." : "Verify & Finish"}
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
