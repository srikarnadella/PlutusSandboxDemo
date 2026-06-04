import React from "react";
import { useNavigate } from "react-router-dom";
import ParticleCanvas from "../ParticleCanvas";

const Home: React.FC = () => {
  const navigate = useNavigate();

  const FEATURES = [
    { value: "$0 /mo",    label: "Free forever"        },
    { value: "Plaid",     label: "Bank-grade security"  },
    { value: "Read-only", label: "Zero write access"    },
    { value: "Live",      label: "Real-time analysis"   },
  ];

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden", backgroundColor: "#070b14" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');

        @keyframes _hfadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .h-a0 { animation: _hfadeUp 0.75s cubic-bezier(0.16,1,0.3,1) 0.20s both; }
        .h-a1 { animation: _hfadeUp 0.75s cubic-bezier(0.16,1,0.3,1) 0.38s both; }
        .h-a2 { animation: _hfadeUp 0.75s cubic-bezier(0.16,1,0.3,1) 0.54s both; }
        .h-a3 { animation: _hfadeUp 0.75s cubic-bezier(0.16,1,0.3,1) 0.68s both; }
        .h-a4 { animation: _hfadeUp 0.75s cubic-bezier(0.16,1,0.3,1) 0.82s both; }
        .h-a5 { animation: _hfadeUp 0.75s cubic-bezier(0.16,1,0.3,1) 0.96s both; }
        .h-a6 { animation: _hfadeUp 0.75s cubic-bezier(0.16,1,0.3,1) 1.10s both; }

        .h-btn-primary { transition: background 0.15s, box-shadow 0.15s, transform 0.1s; }
        .h-btn-primary:hover { background: #047857 !important; box-shadow: 0 0 0 4px rgba(5,150,105,0.22), 0 10px 36px rgba(5,150,105,0.42) !important; }
        .h-btn-primary:active { transform: scale(0.97); }

        .h-btn-ghost { transition: all 0.15s; }
        .h-btn-ghost:hover { color: #f8fafc !important; border-color: rgba(255,255,255,0.28) !important; background: rgba(255,255,255,0.05) !important; }

        .h-stat-cell { transition: background 0.15s, border-color 0.15s; }
        .h-stat-cell:hover { background: rgba(16,185,129,0.05) !important; border-color: rgba(16,185,129,0.18) !important; }

        .h-feat-card { transition: border-color 0.2s, background 0.2s, transform 0.2s; }
        .h-feat-card:hover { border-color: rgba(16,185,129,0.22) !important; background: rgba(16,185,129,0.04) !important; transform: translateY(-3px); }

        .h-nav-btn { transition: all 0.15s; }
        .h-nav-btn:hover { color: #f8fafc !important; border-color: rgba(255,255,255,0.28) !important; background: rgba(255,255,255,0.06) !important; }

        .h-myth-rule { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 0; }
      `}</style>

      {/* Particle canvas — higher density */}
      <ParticleCanvas density={5500} speed={0.26} />

      {/* Bottom fade */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: "60%",
        background: "linear-gradient(to top, #070b14 0%, rgba(7,11,20,0.9) 35%, transparent 100%)",
        pointerEvents: "none", zIndex: 1,
      }} />

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1.8rem 4rem",
        zIndex: 50,
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        backdropFilter: "blur(14px)",
        background: "rgba(7,11,20,0.55)",
      }}>
        <button
          onClick={() => navigate("/")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <span style={{
            fontFamily: "'Space Grotesk', -apple-system, sans-serif",
            fontSize: "1.9rem", fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.035em",
          }}>
            Plu<span style={{ color: "#34d399" }}>tus</span>
          </span>
        </button>

        <button onClick={() => navigate("/login")} className="h-nav-btn" style={{
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "0.8rem",
          padding: "0.75rem 2rem",
          fontSize: "1.35rem", fontWeight: 600,
          color: "#64748b", cursor: "pointer", fontFamily: "inherit",
        }}>
          Sign in
        </button>
      </nav>

      {/* ── Hero ── */}
      <div style={{
        position: "relative", zIndex: 10,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "100vh",
        padding: "10rem 2rem 4rem",
        textAlign: "center",
      }}>

        {/* Badge */}
        <div className="h-a0" style={{
          display: "inline-flex", alignItems: "center", gap: "0.6rem",
          background: "rgba(16,185,129,0.07)",
          border: "1px solid rgba(16,185,129,0.28)",
          borderRadius: "9999px",
          padding: "0.5rem 1.5rem",
          fontSize: "1.05rem", fontWeight: 600,
          color: "#34d399",
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          marginBottom: "3rem",
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", flexShrink: 0 }} />
          Personal Finance · Reimagined
        </div>

        {/* Headline */}
        <h1 className="h-a1" style={{
          fontFamily: "'Space Grotesk', -apple-system, sans-serif",
          fontSize: "clamp(4.8rem, 10.5vw, 10rem)",
          fontWeight: 700,
          lineHeight: 0.94,
          letterSpacing: "-0.045em",
          margin: "0 0 2.4rem",
          maxWidth: "860px",
        }}>
          <span style={{
            background: "linear-gradient(180deg, #ffffff 10%, rgba(255,255,255,0.62) 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            Your money,
          </span>
          <br />
          <span style={{
            background: "linear-gradient(135deg, #34d399 0%, #059669 55%, #6ee7b7 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            finally clear.
          </span>
        </h1>

        {/* Sub */}
        <p className="h-a2" style={{
          fontSize: "1.8rem", color: "#64748b", lineHeight: 1.65,
          maxWidth: "500px", margin: "0 0 4.4rem", fontWeight: 400,
        }}>
          Connect your bank once via Plaid. Plutus tracks every transaction,
          surfaces overspending, and shows your full financial picture — live.
        </p>

        {/* CTAs */}
        <div className="h-a3" style={{
          display: "flex", alignItems: "center", gap: "1.4rem",
          flexWrap: "wrap" as const, justifyContent: "center",
          marginBottom: "5.6rem",
        }}>
          <button onClick={() => navigate("/login")} className="h-btn-primary" style={{
            display: "inline-flex", alignItems: "center", gap: "0.9rem",
            background: "#059669", border: "none", borderRadius: "0.9rem",
            padding: "1.45rem 3.4rem",
            fontSize: "1.6rem", fontWeight: 700, color: "#fff",
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 6px 28px rgba(5,150,105,0.38)",
            letterSpacing: "-0.01em",
          }}>
            Get started free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>

          <button onClick={() => navigate("/login")} className="h-btn-ghost" style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.11)",
            borderRadius: "0.9rem",
            padding: "1.45rem 3rem",
            fontSize: "1.6rem", fontWeight: 600,
            color: "#64748b", cursor: "pointer", fontFamily: "inherit",
            letterSpacing: "-0.01em",
          }}>
            Sign in
          </button>
        </div>

        {/* Stat strip */}
        <div className="h-a4" style={{
          display: "flex", alignItems: "stretch",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "1.2rem",
          background: "rgba(255,255,255,0.022)",
          backdropFilter: "blur(20px)",
          overflow: "hidden",
          marginBottom: "10rem",
        }}>
          {FEATURES.map((f, i) => (
            <div key={f.label} className="h-stat-cell" style={{
              padding: "2rem 3rem", textAlign: "center" as const,
              borderRight: i < FEATURES.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none",
            }}>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "1.85rem", fontWeight: 700, color: "#f8fafc",
                letterSpacing: "-0.03em", marginBottom: "0.25rem",
              }}>{f.value}</div>
              <div style={{
                fontSize: "1.05rem", fontWeight: 600, color: "#475569",
                letterSpacing: "0.07em", textTransform: "uppercase" as const,
              }}>{f.label}</div>
            </div>
          ))}
        </div>

        {/* ── Plutus Mythology Section ── */}
        <div className="h-a5" style={{ width: "100%", maxWidth: "860px", marginBottom: "8rem" }}>

          <hr className="h-myth-rule" style={{ marginBottom: "6rem" }} />

          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6rem",
            textAlign: "left" as const,
          }}>
            {/* Left — the myth */}
            <div>
              <p style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "1.05rem", fontWeight: 600,
                color: "#334155",
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                marginBottom: "2rem",
                margin: "0 0 2rem",
              }}>
                The myth
              </p>

              <h2 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "3.6rem", fontWeight: 700,
                lineHeight: 1.1, letterSpacing: "-0.03em",
                color: "#f8fafc",
                margin: "0 0 2.4rem",
              }}>
                Plutus was<br />
                <span style={{ color: "#34d399" }}>struck blind.</span>
              </h2>

              <p style={{
                fontSize: "1.55rem", color: "#475569",
                lineHeight: 1.75, margin: "0 0 1.8rem",
              }}>
                In Roman mythology, Plutus was the god of wealth. But Zeus,
                fearing that riches would favor only the virtuous, struck him
                blind — so that wealth would fall without reason, without
                pattern, without justice.
              </p>

              <p style={{
                fontSize: "1.55rem", color: "#475569",
                lineHeight: 1.75, margin: 0,
              }}>
                And so it did. For millennia, money has felt arbitrary.
                Invisible. Impossible to follow.
              </p>
            </div>

            {/* Right — the solution */}
            <div>
              <p style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "1.05rem", fontWeight: 600,
                color: "#334155",
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                margin: "0 0 2rem",
              }}>
                The app
              </p>

              <h2 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "3.6rem", fontWeight: 700,
                lineHeight: 1.1, letterSpacing: "-0.03em",
                color: "#f8fafc",
                margin: "0 0 2.4rem",
              }}>
                We give him<br />
                <span style={{ color: "#34d399" }}>sight.</span>
              </h2>

              <p style={{
                fontSize: "1.55rem", color: "#475569",
                lineHeight: 1.75, margin: "0 0 1.8rem",
              }}>
                Plutus the app connects to your real accounts and shows you
                exactly where every dollar goes — by category, by merchant,
                by month. No more guessing. No more wondering.
              </p>

              <p style={{
                fontSize: "1.55rem", color: "#475569",
                lineHeight: 1.75, margin: "0 0 3rem",
              }}>
                For the first time, wealth has eyes.
              </p>

              <button onClick={() => navigate("/login")} className="h-btn-primary" style={{
                display: "inline-flex", alignItems: "center", gap: "0.8rem",
                background: "#059669", border: "none", borderRadius: "0.9rem",
                padding: "1.2rem 2.8rem",
                fontSize: "1.5rem", fontWeight: 700, color: "#fff",
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 4px 20px rgba(5,150,105,0.32)",
                letterSpacing: "-0.01em",
              }}>
                Start seeing clearly
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>

          <hr className="h-myth-rule" style={{ marginTop: "6rem" }} />
        </div>

        {/* Feature cards */}
        <div className="h-a6" style={{ width: "100%", maxWidth: "960px" }}>
          <p style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "1.05rem", fontWeight: 600,
            color: "#334155",
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            marginBottom: "2.8rem",
          }}>
            Everything you need
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1.2rem" }}>
            {([
              { icon: "⬡", head: "All accounts, one view",  body: "Checking, savings, credit, investments — unified net worth at a glance." },
              { icon: "◈", head: "Spending, dissected",      body: "Category breakdowns, merchant rankings, and subscription radar every month." },
              { icon: "◇", head: "Goals that stick",         body: "Set targets, track progress, and see exactly how many months you're away." },
            ] as const).map((card) => (
              <div key={card.head} className="h-feat-card" style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "1.2rem",
                padding: "2.8rem 2.6rem",
                textAlign: "left" as const,
              }}>
                <div style={{ fontSize: "2rem", color: "#34d399", marginBottom: "1.6rem", lineHeight: 1 }}>{card.icon}</div>
                <h3 style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: "1.6rem", fontWeight: 700,
                  color: "#f8fafc",
                  letterSpacing: "-0.02em",
                  margin: "0 0 0.9rem", lineHeight: 1.2,
                }}>{card.head}</h3>
                <p style={{ fontSize: "1.4rem", color: "#475569", lineHeight: 1.65, margin: 0 }}>{card.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div style={{
          marginTop: "5.6rem",
          fontSize: "1.25rem", color: "#1e293b",
          display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Your data is encrypted and never sold.
        </div>
      </div>
    </div>
  );
};

Home.displayName = "Home";
export default Home;
