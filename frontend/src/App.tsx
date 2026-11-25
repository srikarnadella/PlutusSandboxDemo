import React, { useEffect, useContext, useCallback, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Home from "./Components/Home";
import Auth from "./Components/Auth";

const Landing = lazy(() => import("./Components/Landing"));
const SpendingReview = lazy(() => import("./Components/SpendingReview"));
import Context from "./Context";
import { apiFetch } from "./lib/apiFetch";

const LoadingScreen = () => (
  <div style={{
    minHeight: "100vh",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexDirection: "column", gap: "2rem",
    backgroundColor: "#070b14",
  }}>
    <div style={{
      width: "4.8rem", height: "4.8rem", borderRadius: "50%",
      border: "3px solid rgba(5,150,105,0.2)",
      borderTopColor: "#059669",
      animation: "spin 0.8s linear infinite",
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <p style={{ fontSize: "1.5rem", color: "#334155", margin: 0 }}>Loading…</p>
  </div>
);

const App = () => {
  const {
    dispatch,
    supabaseUser, isAuthLoading, hasPlaidConnection,
  } = useContext(Context);

  const generateToken = useCallback(async () => {
    let response: Response;
    try {
      response = await apiFetch("/api/create_link_token", { method: "POST" });
    } catch {
      dispatch({ type: "SET_STATE", state: { backend: false } });
      return;
    }
    if (!response.ok) {
      let errorDetail;
      try {
        const data = await response.json();
        errorDetail = data.error || { error_code: "UNKNOWN", error_type: "API_ERROR", error_message: `Request failed with status ${response.status}` };
      } catch {
        errorDetail = { error_code: "UNKNOWN", error_type: "API_ERROR", error_message: `Request failed with status ${response.status}` };
      }
      dispatch({ type: "SET_STATE", state: { linkToken: null, linkTokenError: errorDetail } });
      return;
    }
    const data = await response.json();
    if (data?.error) { dispatch({ type: "SET_STATE", state: { linkToken: null, linkTokenError: data.error } }); return; }
    if (data) {
      dispatch({ type: "SET_STATE", state: { linkToken: data.link_token } });
      localStorage.setItem("link_token", data.link_token);
    }
  }, [dispatch]);

  const needsLink = !isAuthLoading && !!supabaseUser && !hasPlaidConnection;

  useEffect(() => {
    if (!needsLink) return;
    if (window.location.href.includes("?oauth_state_id=")) {
      dispatch({ type: "SET_STATE", state: { linkToken: localStorage.getItem("link_token") } });
      return;
    }
    generateToken();
  }, [needsLink, dispatch, generateToken]);

  if (isAuthLoading) return <LoadingScreen />;

  return (
    <Suspense fallback={<LoadingScreen />}>
    <Routes>
      {/* Public */}
      <Route path="/"        element={supabaseUser ? <Navigate to="/dashboard" replace /> : <Home />} />
      <Route path="/login"   element={supabaseUser ? <Navigate to="/dashboard" replace /> : <Auth />} />

      {/* Protected — bank connect */}
      <Route path="/connect" element={
        !supabaseUser      ? <Navigate to="/login"     replace /> :
        hasPlaidConnection ? <Navigate to="/dashboard" replace /> :
        <Landing />
      } />

      {/* Protected — main dashboard */}
      <Route path="/dashboard" element={
        !supabaseUser       ? <Navigate to="/login"   replace /> :
        !hasPlaidConnection ? <Navigate to="/connect" replace /> :
        <SpendingReview />
      } />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
};

export default App;
