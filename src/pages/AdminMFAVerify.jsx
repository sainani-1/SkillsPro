import React, { useState, useRef, useEffect } from "react";
const LOGO_URL = import.meta.env.VITE_CERTIFICATE_LOGO || "/skillpro-logo.png";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import AlertModal from "../components/AlertModal";
import Toast from "../components/Toast";

export default function AdminMFAVerify() {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, title: "", message: "", type: "error" });
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const inputRefs = useRef([]);
  const navigate = useNavigate();

  const codeStr = code.join("");

  const resetCodeAndFocusFirst = () => {
    setCode(["", "", "", "", "", ""]);
    requestAnimationFrame(() => {
      const first = inputRefs.current[0];
      if (first) {
        first.focus();
        first.select();
      }
    });
  };

  useEffect(() => {
    if (!loading && codeStr.length === 6 && codeStr.split("").every((d) => d)) {
      verify(codeStr);
    }
  }, [codeStr, loading]);

  const handleChange = (e, idx) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 1);
    if (!val) return;

    const newCode = [...code];
    newCode[idx] = val;
    setCode(newCode);

    if (idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === "Backspace") {
      if (code[idx]) {
        const newCode = [...code];
        newCode[idx] = "";
        setCode(newCode);
      } else if (idx > 0) {
        inputRefs.current[idx - 1]?.focus();
        const newCode = [...code];
        newCode[idx - 1] = "";
        setCode(newCode);
      }
    }
  };

  const verify = async (codeValue) => {
    if (loading) return;

    try {
      setLoading(true);
      const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
      if (factorError) throw factorError;

      if (!factors.totp.length) {
        setAlert({ show: true, title: "MFA Not Registered", message: "You must register MFA first.", type: "warning" });
        setTimeout(() => navigate("/admin-mfa-setup"), 1200);
        return;
      }

      const factorId = factors.totp[0].id;
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: codeValue });
      if (verifyError) {
        setToast({ show: true, message: "Invalid MFA code. Try again.", type: "error" });
        resetCodeAndFocusFirst();
        return;
      }

      const { data: userResp } = await supabase.auth.getUser();
      sessionStorage.setItem("admin_mfa_verified", "true");
      if (userResp?.user?.id) {
        sessionStorage.setItem("admin_mfa_verified_user", userResp.user.id);
      }
      setToast({ show: true, message: "MFA Verified! Redirecting...", type: "success" });
      setTimeout(() => navigate("/app"), 1200);
    } catch (err) {
      console.error(err);
      setAlert({ show: true, title: "Verification Failed", message: err.message || "Could not verify MFA code.", type: "error" });
      resetCodeAndFocusFirst();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-200 px-4">
      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />
      <AlertModal show={alert.show} title={alert.title} message={alert.message} type={alert.type} onClose={() => setAlert({ ...alert, show: false })} />
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 rounded-full border-2 border-blue-400/50 bg-white flex items-center justify-center shadow-lg mb-2 overflow-hidden">
          <img src={LOGO_URL} alt="Logo" className="w-16 h-16 object-contain rounded-full" />
        </div>
        <span className="text-2xl font-extrabold text-nani-dark tracking-tight">SkillPro</span>
      </div>
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md flex flex-col items-center gap-6 border-t-8 border-blue-500 animate-fade-in">
        <h2 className="text-2xl font-bold text-blue-700">Verify MFA</h2>
        <p className="text-slate-600 text-center">Enter the 6-digit code from your authenticator app to continue.</p>
        <div className="flex justify-center gap-3 mt-2 w-full">
          {[...Array(6)].map((_, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              className={`w-12 h-14 text-center text-2xl font-mono rounded-lg border-2 transition-all duration-150 outline-none
                ${code[i] ? "border-blue-600 bg-blue-50 text-blue-700 shadow" : "border-slate-300 bg-white text-slate-400"}`}
              value={code[i]}
              onChange={(e) => handleChange(e, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              disabled={loading}
              autoFocus={i === 0}
              style={{ imeMode: "disabled" }}
            />
          ))}
        </div>
        <button
          disabled={loading || codeStr.length !== 6 || !codeStr.split("").every((d) => d)}
          onClick={() => verify(codeStr)}
          className={`w-full py-3 rounded-lg font-bold text-lg text-white transition-colors ${
            loading || codeStr.length !== 6 || !codeStr.split("").every((d) => d) ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Verifying MFA..." : "Verify MFA"}
        </button>
      </div>
    </div>
  );
}
