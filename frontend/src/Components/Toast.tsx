import React, { createContext, useCallback, useContext, useState } from "react";

type ToastType = "success" | "error" | "info";

interface Toast { id: number; message: string; type: ToastType; }
interface ToastContextValue { showToast: (message: string, type?: ToastType) => void; }

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

let nextId = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const COLOR: Record<ToastType, { bg: string; border: string; text: string }> = {
    success: { bg: "rgba(5,150,105,0.12)", border: "rgba(5,150,105,0.3)", text: "#34d399" },
    error:   { bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)", text: "#f87171" },
    info:    { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.3)", text: "#818cf8" },
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{ position: "fixed", bottom: "2.4rem", right: "2.4rem", display: "flex", flexDirection: "column", gap: "0.8rem", zIndex: 9999 }}>
        {toasts.map((t) => {
          const c = COLOR[t.type];
          return (
            <div key={t.id} style={{
              background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: "1rem", padding: "1.2rem 1.8rem",
              fontSize: "1.4rem", fontWeight: 500, color: c.text,
              maxWidth: "36rem", backdropFilter: "blur(12px)",
              animation: "fadeSlideUp 0.2s ease-out",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}>
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
