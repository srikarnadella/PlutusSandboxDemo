import React, { useContext } from "react";
import Link from "../Link";
import Context from "../../Context";

const FEATURES = [
  { icon: "🔒", label: "Bank-level security" },
  { icon: "📊", label: "Real-time insights" },
  { icon: "🎯", label: "Smart spending goals" },
  { icon: "⚡", label: "Anomaly detection" },
];

const Landing = () => {
  const { linkToken, backend, linkTokenError, linkExitError } = useContext(Context);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0,
        display: "flex", alignItems: "center",
        padding: "2rem 4rem",
        zIndex: 50,
      }}>
        <span style={{ fontSize: "2.2rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.03em" }}>
          Plaid<span style={{ color: "#818cf8" }}>Connect</span>
        </span>
      </nav>

      {/* Hero */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "14rem 2rem 8rem",
          animation: "fadeSlideUp 0.5s ease-out both",
        }}
      >
        <div style={{ maxWidth: "64rem", width: "100%" }}>
          {/* Badge */}
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
            Powered by Plaid
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: "6.4rem",
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            color: "#f8fafc",
            margin: "0 0 2.4rem",
          }}>
            Your finances,
            <br />
            <span style={{
              background: "linear-gradient(135deg, #818cf8 0%, #c084fc 55%, #818cf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              intelligently understood.
            </span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: "1.8rem",
            color: "#64748b",
            lineHeight: 1.75,
            maxWidth: "46rem",
            margin: "0 auto 5.6rem",
          }}>
            Connect your bank account in seconds. Get real-time spending insights,
            smart budgeting goals, and automated anomaly detection.
          </p>

          {/* CTA */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.6rem", marginBottom: "6.4rem" }}>
            {!backend ? (
              <div style={{
                borderRadius: "1.2rem",
                border: "1px solid rgba(239,68,68,0.2)",
                background: "rgba(239,68,68,0.08)",
                padding: "1.4rem 2rem",
                color: "#f87171",
                fontSize: "1.4rem",
                maxWidth: "44rem",
                textAlign: "left",
              }}>
                Backend server is not running. Start the server and refresh this page.
              </div>
            ) : linkToken == null ? (
              <div style={{
                borderRadius: "1.2rem",
                border: "1px solid rgba(245,158,11,0.2)",
                background: "rgba(245,158,11,0.08)",
                padding: "1.4rem 2rem",
                color: "#fbbf24",
                fontSize: "1.4rem",
                maxWidth: "44rem",
                textAlign: "left",
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
                background: "rgba(99,102,241,0.3)",
                color: "rgba(255,255,255,0.4)",
                fontWeight: 700,
                padding: "1.6rem 3.6rem",
                borderRadius: "1.4rem",
                border: "none",
                fontSize: "1.7rem",
                cursor: "not-allowed",
              }}>
                Loading…
              </button>
            ) : (
              <Link />
            )}
            {linkExitError && (
              <div style={{
                borderRadius: "1.2rem",
                border: "1px solid rgba(239,68,68,0.2)",
                background: "rgba(239,68,68,0.08)",
                padding: "1.4rem 2rem",
                color: "#f87171",
                fontSize: "1.4rem",
                maxWidth: "44rem",
                textAlign: "left",
              }}>
                <div style={{ fontWeight: 600 }}>Link exited with an error</div>
                <div style={{ marginTop: "0.4rem", fontFamily: "monospace", fontSize: "1.2rem", color: "rgba(248,113,113,0.65)" }}>
                  {linkExitError.error_code}: {linkExitError.error_message}
                </div>
              </div>
            )}
          </div>

          {/* Feature pills */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "3.2rem", flexWrap: "wrap" }}>
            {FEATURES.map(({ icon, label }) => (
              <div key={label} style={{
                display: "flex", alignItems: "center", gap: "0.8rem",
                color: "#334155",
                fontSize: "1.4rem",
                fontWeight: 500,
              }}>
                <span style={{ fontSize: "1.6rem" }}>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

Landing.displayName = "Landing";

export default Landing;
