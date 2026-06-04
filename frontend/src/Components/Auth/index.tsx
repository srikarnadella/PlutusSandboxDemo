import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import ParticleCanvas from "../ParticleCanvas";

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
    <path d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" fill="#FFC107"/>
    <path d="M6.3 14.7l6.6 4.8C14.6 16.1 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" fill="#FF3D00"/>
    <path d="M24 44c5.4 0 10.3-2 14-5.3l-6.5-5.5C29.6 35 26.9 36 24 36c-5.3 0-9.7-3.3-11.3-8H6.1C9.4 35.7 16.2 44 24 44z" fill="#4CAF50"/>
    <path d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.5 5.5C41.9 36.1 44 30.4 44 24c0-1.2-.1-2.4-.4-3.5z" fill="#1976D2"/>
  </svg>
);

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/dashboard" },
      });
      if (error) setError(error.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const sendMagicLink = async () => {
    if (!email.trim()) return;
    setEmailLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + "/dashboard" },
    });
    if (error) { setError(error.message); }
    else { setEmailSent(true); }
    setEmailLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "2rem",
      position: "relative", overflow: "hidden",
      backgroundColor: "#070b14",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        @keyframes _afadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .auth-in { animation: _afadeUp 0.55s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
      `}</style>

      <ParticleCanvas density={7000} speed={0.22} />

      {/* Bottom fade behind card */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 70% 70% at 50% 60%, rgba(7,11,20,0.7) 0%, transparent 100%)",
        pointerEvents: "none", zIndex: 1,
      }} />

      {/* Plutus logo — navigates home */}
      <button onClick={() => navigate("/")} style={{
        position: "fixed", top: "2rem", left: "4rem",
        background: "none", border: "none", cursor: "pointer", padding: 0, zIndex: 50,
      }}>
        <span style={{
          fontFamily: "'Space Grotesk', -apple-system, sans-serif",
          fontSize: "1.85rem", fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.035em",
        }}>
          Plu<span style={{ color: "#34d399" }}>tus</span>
        </span>
      </button>

      {/* Wordmark */}
      <div className="auth-in" style={{ marginBottom: "4rem", textAlign: "center" as const, position: "relative", zIndex: 10 }}>
        <p style={{ margin: 0, fontSize: "1.35rem", color: "#475569" }}>Your personal finance dashboard</p>
      </div>

      {/* Card */}
      <div className="auth-in" style={{
        position: "relative", zIndex: 10,
        width: "100%", maxWidth: "42rem",
        background: "rgba(7,11,20,0.80)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderTop: "1px solid rgba(255,255,255,0.16)",
        borderRadius: "2rem",
        padding: "4rem",
        backdropFilter: "blur(32px)",
      }}>
        {emailSent ? (
          <div style={{ textAlign: "center" as const }}>
            <div style={{
              width: "6.4rem", height: "6.4rem", borderRadius: "50%",
              background: "rgba(5,150,105,0.12)",
              border: "1px solid rgba(5,150,105,0.28)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 2.4rem",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </div>
            <h2 style={{ margin: "0 0 1.2rem", fontSize: "2.4rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em" }}>
              Check your email
            </h2>
            <p style={{ margin: "0 0 2.4rem", fontSize: "1.5rem", color: "#64748b", lineHeight: 1.6 }}>
              We sent a magic link to <strong style={{ color: "#94a3b8" }}>{email}</strong>. Click it to sign in.
            </p>
            <button onClick={() => setEmailSent(false)} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "1.4rem", color: "#475569", fontWeight: 500,
            }}>
              Try a different email
            </button>
          </div>
        ) : (
          <>
            <h2 style={{ margin: "0 0 0.8rem", fontSize: "2.8rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em", textAlign: "center" }}>
              Sign in
            </h2>
            <p style={{ margin: "0 0 3.2rem", fontSize: "1.5rem", color: "#64748b", textAlign: "center", lineHeight: 1.5 }}>
              Connect your bank and take control of your spending.
            </p>

            <button onClick={signInWithGoogle} disabled={googleLoading} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: "1.2rem",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: "1.2rem",
              padding: "1.4rem 2.4rem",
              fontSize: "1.6rem", fontWeight: 600, color: "#f8fafc",
              cursor: googleLoading ? "not-allowed" : "pointer",
              opacity: googleLoading ? 0.6 : 1,
              transition: "background 0.15s, border-color 0.15s",
              fontFamily: "inherit", marginBottom: "2rem",
            }}
              onMouseEnter={(e) => { if (!googleLoading) { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(255,255,255,0.11)"; b.style.borderColor = "rgba(255,255,255,0.22)"; } }}
              onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(255,255,255,0.07)"; b.style.borderColor = "rgba(255,255,255,0.14)"; }}
            >
              <GoogleIcon />
              {googleLoading ? "Redirecting…" : "Continue with Google"}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "1.6rem", marginBottom: "2rem" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
              <span style={{ fontSize: "1.3rem", color: "#64748b", fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <input
                type="email" placeholder="your@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
                style={{
                  width: "100%", height: "5.6rem",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: "1.2rem",
                  padding: "0 2rem",
                  fontSize: "1.6rem", color: "#f8fafc",
                  outline: "none", fontFamily: "inherit",
                  transition: "border-color 0.2s",
                  boxSizing: "border-box" as const,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(5,150,105,0.6)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
              />
              <button
                onClick={sendMagicLink}
                disabled={emailLoading || !email.trim()}
                style={{
                  width: "100%", height: "5.6rem",
                  background: email.trim() && !emailLoading
                    ? "linear-gradient(135deg, #047857 0%, #059669 100%)"
                    : "rgba(255,255,255,0.07)",
                  border: "none", borderRadius: "1.2rem",
                  fontSize: "1.6rem", fontWeight: 700,
                  color: email.trim() && !emailLoading ? "#fff" : "#64748b",
                  cursor: email.trim() && !emailLoading ? "pointer" : "not-allowed",
                  transition: "opacity 0.15s, box-shadow 0.15s",
                  fontFamily: "inherit",
                  boxShadow: email.trim() && !emailLoading ? "0 8px 28px rgba(5,150,105,0.4)" : undefined,
                }}
              >
                {emailLoading ? "Sending…" : "Send magic link"}
              </button>
            </div>

            {error && (
              <div style={{
                marginTop: "1.6rem", borderRadius: "1rem",
                padding: "1.2rem 1.6rem",
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.2)",
                fontSize: "1.4rem", color: "#f87171",
              }}>{error}</div>
            )}
          </>
        )}
      </div>

      <p style={{
        position: "relative", zIndex: 10,
        marginTop: "2.4rem", fontSize: "1.3rem", color: "#334155",
        textAlign: "center", display: "flex", alignItems: "center",
        gap: "0.5rem", justifyContent: "center",
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        Your financial data is end-to-end encrypted and never sold.
      </p>
    </div>
  );
};

Auth.displayName = "Auth";
export default Auth;
