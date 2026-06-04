import React from "react";

const LABELS = ["Connected", "Budget", "Goals", "Review"];

interface StepProgressProps {
  current: number;
  total: number;
}

const StepProgress = ({ current, total }: StepProgressProps) => (
  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "2.8rem", paddingBottom: "1.6rem" }}>
    {Array.from({ length: total }, (_, i) => i + 1).map((stepNum, i) => {
      const done = stepNum < current;
      const active = stepNum === current;
      return (
        <React.Fragment key={stepNum}>
          {i > 0 && (
            <div style={{
              width: "4.8rem",
              height: "1px",
              marginTop: "1.35rem",
              flexShrink: 0,
              background: done ? "rgba(5,150,105,0.7)" : "rgba(255,255,255,0.08)",
              transition: "background 0.3s",
            }} />
          )}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem" }}>
            <div style={{
              width: "2.8rem",
              height: "2.8rem",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.1rem",
              fontWeight: 700,
              flexShrink: 0,
              transition: "all 0.3s",
              background: done ? "#047857" : active ? "rgba(5,150,105,0.15)" : "rgba(255,255,255,0.04)",
              border: `2px solid ${done ? "#047857" : active ? "rgba(5,150,105,0.7)" : "rgba(255,255,255,0.08)"}`,
              color: done ? "#fff" : active ? "#6ee7b7" : "rgba(255,255,255,0.18)",
              boxShadow: active ? "0 0 0 5px rgba(5,150,105,0.12)" : undefined,
            }}>
              {done ? "✓" : stepNum}
            </div>
            <span style={{
              fontSize: "1rem",
              fontWeight: active ? 600 : 400,
              color: done ? "#6366f1" : active ? "#6ee7b7" : "rgba(255,255,255,0.15)",
              transition: "color 0.3s",
              whiteSpace: "nowrap",
            }}>
              {LABELS[i] ?? stepNum}
            </span>
          </div>
        </React.Fragment>
      );
    })}
  </div>
);

export default StepProgress;
