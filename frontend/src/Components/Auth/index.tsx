import React, { useState } from "react";
import { supabase } from "../../lib/supabase";

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
    <path d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" fill="#FFC107"/>
    <path d="M6.3 14.7l6.6 4.8C14.6 16.1 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" fill="#FF3D00"/>
    <path d="M24 44c5.4 0 10.3-2 14-5.3l-6.5-5.5C29.6 35 26.9 36 24 36c-5.3 0-9.7-3.3-11.3-8H6.1C9.4 35.7 16.2 44 24 44z" fill="#4CAF50"/>
    <path d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.5 5.5C41.9 36.1 44 30.4 44 24c0-1.2-.1-2.4-.4-3.5z" fill="#1976D2"/>
  </svg>
);

const Auth = () => {
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) { setError(error.message); setGoogleLoading(false); }
  };

  const sendMagicLink = async () => {
    if (!email.trim()) return;
    setEmailLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) { setError(error.message); }
    else { setEmailSent(true); }
    setEmailLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      animation: "fadeSlideUp 0.4s ease-out both",
    }}>
      {/* Wordmark */}
      <div style={{ marginBottom: "4.8rem" }}>
        <span style={{ fontSize: "2.8rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.03em" }}>
          Plaid<span style={{ color: "#818cf8" }}>Connect</span>
        </span>
      </div>

      {/* Card */}
      <div style={{
        width: "100%",
        maxWidth: "42rem",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: "2rem",
        padding: "4rem",
        backdropFilter: "blur(20px)",
      }}>
        {emailSent ? (
          /* Magic link sent state */
          <div style={{ textAlign: "center", animation: "fadeSlideUp 0.3s ease-out both" }}>
            <div style={{
              width: "6.4rem", height: "6.4rem", borderRadius: "50%",
              background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 2.4rem", fontSize: "3rem",
            }}>
              ✉️
            </div>
            <h2 style={{ margin: "0 0 1.2rem", fontSize: "2.4rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em" }}>
              Check your email
            </h2>
            <p style={{ margin: "0 0 2.4rem", fontSize: "1.5rem", color: "#64748b", lineHeight: 1.6 }}>
              We sent a magic link to <strong style={{ color: "#94a3b8" }}>{email}</strong>. Click it to sign in.
            </p>
            <button
              onClick={() => setEmailSent(false)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: "1.4rem", color: "#475569", fontWeight: 500,
              }}
            >
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

            {/* Google */}
            <button
              onClick={signInWithGoogle}
              disabled={googleLoading}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "1.2rem",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: "1.2rem",
                padding: "1.4rem 2.4rem",
                fontSize: "1.6rem",
                fontWeight: 600,
                color: "#f8fafc",
                cursor: googleLoading ? "not-allowed" : "pointer",
                opacity: googleLoading ? 0.6 : 1,
                transition: "background 0.15s, border-color 0.15s",
                fontFamily: "inherit",
                marginBottom: "2rem",
              }}
              onMouseEnter={(e) => {
                if (!googleLoading) {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.11)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.22)";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.14)";
              }}
            >
              <GoogleIcon />
              {googleLoading ? "Redirecting…" : "Continue with Google"}
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "1.6rem", marginBottom: "2rem" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
              <span style={{ fontSize: "1.3rem", color: "#334155", fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
            </div>

            {/* Email magic link */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
                style={{
                  width: "100%",
                  height: "5.6rem",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: "1.2rem",
                  padding: "0 2rem",
                  fontSize: "1.6rem",
                  color: "#f8fafc",
                  outline: "none",
                  fontFamily: "inherit",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.6)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
              />
              <button
                onClick={sendMagicLink}
                disabled={emailLoading || !email.trim()}
                style={{
                  width: "100%",
                  height: "5.6rem",
                  background: email.trim() && !emailLoading ? "#4f46e5" : "rgba(255,255,255,0.07)",
                  border: "none",
                  borderRadius: "1.2rem",
                  fontSize: "1.6rem",
                  fontWeight: 700,
                  color: email.trim() && !emailLoading ? "#fff" : "#334155",
                  cursor: email.trim() && !emailLoading ? "pointer" : "not-allowed",
                  transition: "background 0.15s",
                  fontFamily: "inherit",
                  boxShadow: email.trim() && !emailLoading ? "0 8px 24px rgba(99,102,241,0.35)" : undefined,
                }}
              >
                {emailLoading ? "Sending…" : "Send magic link"}
              </button>
            </div>

            {error && (
              <div style={{
                marginTop: "1.6rem",
                borderRadius: "1rem",
                padding: "1.2rem 1.6rem",
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.2)",
                fontSize: "1.4rem",
                color: "#f87171",
              }}>
                {error}
              </div>
            )}
          </>
        )}
      </div>

      <p style={{ marginTop: "2.4rem", fontSize: "1.3rem", color: "#1e293b", textAlign: "center" }}>
        Your financial data is end-to-end encrypted and never sold.
      </p>
    </div>
  );
};

Auth.displayName = "Auth";
export default Auth;
