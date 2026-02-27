import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function AdminMFASetup() {

  const navigate = useNavigate();

  const MFA_NAMES = [
    "SkillPro",
    "StepWithNani",
    "SP Admin",
    "SWN Admin",
    "Nani"
  ];

  const [availableNames, setAvailableNames] = useState([]);
  const [selectedName, setSelectedName] = useState("");
  const [qr, setQr] = useState(null);
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  /* =====================
     LOAD AVAILABLE NAMES
  ====================== */
  useEffect(() => {
    loadAvailableNames();
  }, []);

  const loadAvailableNames = async () => {

    const { data } =
      await supabase.auth.mfa.listFactors();

    const usedNames =
      data.totp.map(f => f.friendly_name);

    const remaining =
      MFA_NAMES.filter(
        n => !usedNames.includes(n)
      );

    setAvailableNames(remaining);
  };

  /* =====================
     CREATE MFA
  ====================== */
  const enrollMFA = async () => {

    if (!selectedName) {
      alert("Select MFA Name");
      return;
    }

    const { data, error } =
      await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: selectedName
      });

    if (error) {
      alert(error.message);
      return;
    }

    setQr(data.totp.qr_code);
    setFactorId(data.id);
  };

  /* =====================
     VERIFY
  ====================== */
  const verify = async () => {

    setLoading(true);

    const { error } =
      await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code
      });

    if (error) {
      alert("Invalid Code");
      setLoading(false);
      return;
    }

    sessionStorage.setItem(
      "admin_mfa_verified",
      "true"
    );

    alert("MFA Enabled ✅");

    navigate("/app/admin/users");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">

      <div className="bg-white p-8 rounded-xl shadow w-96">

        <h2 className="text-xl font-bold mb-4 text-center">
          Setup Admin MFA
        </h2>

        {!qr && (
          <>
            <select
              className="border p-3 w-full mb-4"
              value={selectedName}
              onChange={(e) =>
                setSelectedName(e.target.value)
              }
            >
              <option value="">
                Select MFA Name
              </option>

              {availableNames.map(name => (
                <option key={name}>
                  {name}
                </option>
              ))}
            </select>

            <button
              onClick={enrollMFA}
              className="bg-black text-white w-full py-2"
            >
              Generate QR
            </button>
          </>
        )}

        {qr && (
          <>
            <img
              src={qr}
              className="w-56 mx-auto my-4"
            />

            <input
              placeholder="Enter OTP"
              value={code}
              onChange={(e)=>setCode(e.target.value)}
              className="border p-3 w-full mb-3"
            />

            <button
              disabled={loading}
              onClick={verify}
              className="bg-green-600 text-white w-full py-2"
            >
              Verify
            </button>
          </>
        )}

      </div>

    </div>
  );
}