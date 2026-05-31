import React, { useContext } from "react";
import Link from "../Link";
import Context from "../../Context";
import { supabase } from "../../lib/supabase";

const Landing = () => {
  const { linkToken, backend, linkTokenError, linkExitError, supabaseUser } = useContext(Context);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#070b14" }}>
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Nav */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2rem 4rem", zIndex: 50 }}>
        <span style={{ fontSize: "2rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.03em" }}>
          Plaid<span style={{ color: "#818cf8" }}>Connect</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "1.6rem" }}>
          {supabaseUser?.email && (
            <span style={{ fontSize: "1.3rem", color: "#334155" }}>{supabaseUser.email}</span>
          )}
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.8rem", padding: "0.6rem 1.4rem", fontSize: "1.3rem", fontWeight: 600, color: "#475569", cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit" }}
            onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "#94a3b8"; b.style.borderColor = "rgba(255,255,255,0.2)"; }}
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
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "9999px", padding: "0.5rem 1.4rem", fontSize: "1.2rem", fontWeight: 600, color: "#a5b4fc", marginBottom: "3rem", letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
            <span style={{ fontSize: "0.7rem" }}>◆</span>
            One-time setup
          </div>

          <h1 style={{ fontSize: "5.2rem", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.03em", color: "#f8fafc", margin: "0 0 2rem" }}>
            Connect your bank
          </h1>

          <p style={{ fontSize: "1.7rem", color: "#475569", lineHeight: 1.7, margin: "0 0 5rem", maxWidth: "38rem", marginLeft: "auto", marginRight: "auto" }}>
            Link your accounts once via Plaid. Your credentials are never stored — only a secure read-only token.
          </p>

          {/* CTA */}
          {!backend ? (
            <div style={{ borderRadius: "1.2rem", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", padding: "1.4rem 2rem", color: "#f87171", fontSize: "1.4rem" }}>
              Backend server is not running. Start the Java server and refresh.
            </div>
          ) : linkToken == null ? (
            <div style={{ borderRadius: "1.2rem", border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.08)", padding: "1.4rem 2rem", color: "#fbbf24", fontSize: "1.4rem" }}>
              Unable to create a link token. Check your .env configuration.
              {linkTokenError?.error_code && (
                <div style={{ marginTop: "0.6rem", fontFamily: "monospace", fontSize: "1.2rem", opacity: 0.7 }}>
                  {linkTokenError.error_code}: {linkTokenError.error_message}
                </div>
              )}
            </div>
          ) : linkToken === "" ? (
            <button disabled style={{ display: "inline-flex", alignItems: "center", gap: "1rem", background: "rgba(99,102,241,0.3)", color: "rgba(255,255,255,0.4)", fontWeight: 700, padding: "1.6rem 4rem", borderRadius: "1.4rem", border: "none", fontSize: "1.7rem", cursor: "not-allowed" }}>
              Loading…
            </button>
          ) : (
            <Link />
          )}

          {linkExitError && (
            <div style={{ marginTop: "1.6rem", borderRadius: "1.2rem", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", padding: "1.4rem 2rem", color: "#f87171", fontSize: "1.4rem" }}>
              <div style={{ fontWeight: 600 }}>Link exited with an error</div>
              <div style={{ marginTop: "0.4rem", fontFamily: "monospace", fontSize: "1.2rem", opacity: 0.65 }}>
                {linkExitError.error_code}: {linkExitError.error_message}
              </div>
            </div>
          )}

          {/* Trust badges */}
          <div style={{ marginTop: "4rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "3rem", flexWrap: "wrap" as const }}>
            {["Bank-level encryption", "Read-only access", "Credentials never stored"].map((text) => (
              <span key={text} style={{ fontSize: "1.3rem", color: "#334155", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ color: "#34d399" }}>✓</span> {text}
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
