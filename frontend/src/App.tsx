import React, { useEffect, useContext, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Home from "./Components/Home";
import Auth from "./Components/Auth";
import Landing from "./Components/Landing";
import SpendingReview from "./Components/SpendingReview";
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
    linkSuccess, isPaymentInitiation, dispatch,
    supabaseUser, isAuthLoading, hasPlaidConnection,
  } = useContext(Context);

  const getInfo = useCallback(async () => {
    const response = await fetch("/api/info", { method: "POST" });
    if (!response.ok) {
      dispatch({ type: "SET_STATE", state: { backend: false } });
      return { paymentInitiation: false, isUserTokenFlow: false };
    }
    const data = await response.json();
    const paymentInitiation: boolean = data.products.includes("payment_initiation");
    const craProducts = data.products.filter((p: string) => p.startsWith("cra_"));
    const isUserTokenFlow: boolean = craProducts.length > 0;
    const isCraProductsExclusively: boolean =
      craProducts.length > 0 && craProducts.length === data.products.length;
    dispatch({
      type: "SET_STATE",
      state: { products: data.products, isPaymentInitiation: paymentInitiation, isCraProductsExclusively, isUserTokenFlow },
    });
    return { paymentInitiation, isUserTokenFlow };
  }, [dispatch]);

  const generateUserToken = useCallback(async () => {
    const response = await fetch("/api/create_user_token", { method: "POST" });
    if (!response.ok) {
      dispatch({ type: "SET_STATE", state: { userToken: null, userId: null } });
      return;
    }
    const data = await response.json();
    if (data?.error) {
      dispatch({ type: "SET_STATE", state: { linkToken: null, linkTokenError: data.error } });
      return;
    }
    if (data) dispatch({ type: "SET_STATE", state: { userToken: data.user_token || null, userId: data.user_id || null } });
  }, [dispatch]);

  const generateToken = useCallback(async (isPaymentInitiation: boolean) => {
    const path = isPaymentInitiation ? "/api/create_link_token_for_payment" : "/api/create_link_token";
    const response = await apiFetch(path, { method: "POST" });
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

  useEffect(() => {
    const init = async () => {
      const { paymentInitiation, isUserTokenFlow } = await getInfo();
      if (window.location.href.includes("?oauth_state_id=")) {
        dispatch({ type: "SET_STATE", state: { linkToken: localStorage.getItem("link_token") } });
        return;
      }
      if (isUserTokenFlow) await generateUserToken();
      await generateToken(paymentInitiation);
    };
    init();
  }, [dispatch, generateToken, generateUserToken, getInfo]);

  if (isAuthLoading) return <LoadingScreen />;

  return (
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
  );
};

export default App;
