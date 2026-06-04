import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import Link from "../Link";
import Context from "../../Context";
import { supabase } from "../../lib/supabase";

const Landing = () => {
  const { linkToken, backend, linkTokenError, linkExitError, supabaseUser } = useContext(Context);
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#070b14" }}>
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Nav */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.8rem 4rem", zIndex: 50, borderBottom: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(12px)", background: "rgba(7,11,20,0.7)" }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
          <span style={{ fontSize: "1.9rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.04em" }}>
            Plu<span style={{ background: "linear-gradient(135deg, #34d399, #059669)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>tus</span>
          </span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "1.6rem" }}>
          {supabaseUser?.email && (
            <span style={{ fontSize: "1.3rem", color: "#64748b" }}>{supabaseUser.email}</span>
          )}
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.8rem", padding: "0.55rem 1.4rem", fontSize: "1.3rem", fontWeight: 500, color: "#475569", cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit" }}
            onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "#94a3b8"; b.style.borderColor = "rgba(255,255,255,0.18)"; }}
            onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "#475569"; b.style.borderColor = "rgba(255,255,255,0.1)"; }}
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "12rem 2rem 8rem", animation: "fadeUp 0.5s ease-out both" }}>
        <div style={{ maxWidth: "52rem", width: "100%", textAlign: "center" }}>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: "9999px", padding: "0.45rem 1.2rem", fontSize: "1.15rem", fontWeight: 600, color: "#34d399", marginBottom: "2.8rem", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
            <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
            One-time setup
          </div>

          <h1 style={{ fontSize: "5.6rem", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.04em", color: "#f8fafc", margin: "0 0 2rem" }}>
            Connect your bank
          </h1>

          <p style={{ fontSize: "1.7rem", color: "#64748b", lineHeight: 1.7, margin: "0 0 5rem", maxWidth: "38rem", marginLeft: "auto", marginRight: "auto" }}>
            Link your accounts once via Plaid. Your credentials are never stored — only a secure read-only token.
          </p>

          {/* CTA */}
          {!backend ? (
            <div style={{ borderRadius: "1.2rem", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.07)", padding: "1.4rem 2rem", color: "#f87171", fontSize: "1.4rem" }}>
              Backend server is not running. Start the Java server and refresh.
            </div>
          ) : linkToken == null ? (
            <div style={{ borderRadius: "1.2rem", border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.07)", padding: "1.4rem 2rem", color: "#fbbf24", fontSize: "1.4rem" }}>
              Unable to create a link token. Check your .env configuration.
              {linkTokenError?.error_code && (
                <div style={{ marginTop: "0.6rem", fontFamily: "monospace", fontSize: "1.2rem", opacity: 0.7 }}>
                  {linkTokenError.error_code}: {linkTokenError.error_message}
                </div>
              )}
            </div>
          ) : linkToken === "" ? (
            <button disabled style={{ display: "inline-flex", alignItems: "center", gap: "1rem", background: "rgba(5,150,105,0.2)", color: "rgba(255,255,255,0.3)", fontWeight: 700, padding: "1.6rem 4rem", borderRadius: "1.4rem", border: "none", fontSize: "1.7rem", cursor: "not-allowed" }}>
              Loading…
            </button>
          ) : (
            <Link />
          )}

          {linkExitError && (
            <div style={{ marginTop: "1.6rem", borderRadius: "1.2rem", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.07)", padding: "1.4rem 2rem", color: "#f87171", fontSize: "1.4rem" }}>
              <div style={{ fontWeight: 600 }}>Link exited with an error</div>
              <div style={{ marginTop: "0.4rem", fontFamily: "monospace", fontSize: "1.2rem", opacity: 0.65 }}>
                {linkExitError.error_code}: {linkExitError.error_message}
              </div>
            </div>
          )}

          {/* Trust badges */}
          <div style={{ marginTop: "4rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "3.2rem", flexWrap: "wrap" as const }}>
            {([
              { label: "Bank-level encryption", icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )},
              { label: "Read-only access", icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
              )},
              { label: "Never stored", icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              )},
            ] as const).map(({ label, icon }) => (
              <span key={label} style={{ fontSize: "1.3rem", color: "#64748b", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                {icon} {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

Landing.displayName = "Landing";
export default Landing;
