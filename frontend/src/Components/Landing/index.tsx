import React, { useContext } from "react";
import Link from "../Link";
import Context from "../../Context";
import { supabase } from "../../lib/supabase";

const Landing = () => {
  const { linkToken, backend, linkTokenError, linkExitError, supabaseUser } = useContext(Context);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "2rem 4rem",
        zIndex: 50,
      }}>
        <span style={{ fontSize: "2.2rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.03em" }}>
          Plaid<span style={{ color: "#818cf8" }}>Connect</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "1.6rem" }}>
          {supabaseUser?.email && (
            <span style={{ fontSize: "1.3rem", color: "#334155" }}>{supabaseUser.email}</span>
          )}
          <button
            onClick={handleSignOut}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "0.8rem",
              padding: "0.6rem 1.4rem",
              fontSize: "1.3rem",
              fontWeight: 600,
              color: "#475569",
              cursor: "pointer",
              transition: "all 0.15s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#475569";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)";
            }}
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "14rem 2rem 8rem",
        animation: "fadeSlideUp 0.5s ease-out both",
      }}>
        <div style={{ maxWidth: "60rem", width: "100%" }}>
          {/* Step indicator */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.7rem",
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.28)",
            borderRadius: "9999px",
            padding: "0.5rem 1.6rem",
            fontSize: "1.2rem",
            fontWeight: 600,
            color: "#a5b4fc",
            marginBottom: "3.2rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}>
            <span style={{ fontSize: "0.7rem" }}>◆</span>
            One more step
          </div>

          <h1 style={{
            fontSize: "5.6rem",
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: "#f8fafc",
            margin: "0 0 2.4rem",
          }}>
            Connect your
            <br />
            <span style={{
              background: "linear-gradient(135deg, #818cf8 0%, #c084fc 55%, #818cf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              bank account
            </span>
          </h1>

          <p style={{
            fontSize: "1.8rem",
            color: "#64748b",
            lineHeight: 1.75,
            maxWidth: "44rem",
            margin: "0 auto 5.6rem",
          }}>
            Link your bank securely via Plaid. Your credentials are never stored — only a read-only access token.
          </p>

          {/* CTA */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.6rem" }}>
            {!backend ? (
              <div style={{
                borderRadius: "1.2rem", border: "1px solid rgba(239,68,68,0.2)",
                background: "rgba(239,68,68,0.08)", padding: "1.4rem 2rem",
                color: "#f87171", fontSize: "1.4rem", maxWidth: "44rem", textAlign: "left",
              }}>
                Backend server is not running. Start the Java server and refresh.
              </div>
            ) : linkToken == null ? (
              <div style={{
                borderRadius: "1.2rem", border: "1px solid rgba(245,158,11,0.2)",
                background: "rgba(245,158,11,0.08)", padding: "1.4rem 2rem",
                color: "#fbbf24", fontSize: "1.4rem", maxWidth: "44rem", textAlign: "left",
              }}>
                <div>Unable to create a link token. Check your .env configuration.</div>
                {linkTokenError?.error_code && (
                  <div style={{ marginTop: "0.6rem", fontFamily: "monospace", fontSize: "1.2rem", color: "rgba(251,191,36,0.6)" }}>
                    {linkTokenError.error_code}: {linkTokenError.error_message}
                  </div>
                )}
              </div>
            ) : linkToken === "" ? (
              <button disabled style={{
                display: "inline-flex", alignItems: "center", gap: "1rem",
                background: "rgba(99,102,241,0.3)", color: "rgba(255,255,255,0.4)",
                fontWeight: 700, padding: "1.6rem 3.6rem", borderRadius: "1.4rem",
                border: "none", fontSize: "1.7rem", cursor: "not-allowed",
              }}>
                Loading…
              </button>
            ) : (
              <Link />
            )}

            {linkExitError && (
              <div style={{
                borderRadius: "1.2rem", border: "1px solid rgba(239,68,68,0.2)",
                background: "rgba(239,68,68,0.08)", padding: "1.4rem 2rem",
                color: "#f87171", fontSize: "1.4rem", maxWidth: "44rem", textAlign: "left",
              }}>
                <div style={{ fontWeight: 600 }}>Link exited with an error</div>
                <div style={{ marginTop: "0.4rem", fontFamily: "monospace", fontSize: "1.2rem", color: "rgba(248,113,113,0.65)" }}>
                  {linkExitError.error_code}: {linkExitError.error_message}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

Landing.displayName = "Landing";
export default Landing;
