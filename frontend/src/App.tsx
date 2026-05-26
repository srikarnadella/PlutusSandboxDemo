import React, { useEffect, useContext, useCallback, useState } from "react";

import Landing from "./Components/Landing";
import Header from "./Components/Headers";
import Products from "./Components/ProductTypes/Products";
import Items from "./Components/ProductTypes/Items";
import SpendingReview from "./Components/SpendingReview";
import Context from "./Context";

import styles from "./App.module.css";

const App = () => {
  const { linkSuccess, isPaymentInitiation, itemId, dispatch } =
    useContext(Context);

  const [postLinkView, setPostLinkView] = useState<"connected" | "review">("connected");
  const [showDashboard, setShowDashboard] = useState(false);

  const getInfo = useCallback(async () => {
    const response = await fetch("/api/info", { method: "POST" });
    if (!response.ok) {
      dispatch({ type: "SET_STATE", state: { backend: false } });
      return { paymentInitiation: false, isUserTokenFlow: false };
    }
    const data = await response.json();
    const paymentInitiation: boolean = data.products.includes("payment_initiation");
    const craProducts = data.products.filter((product: string) =>
      product.startsWith("cra_")
    );
    const isUserTokenFlow: boolean = craProducts.length > 0;
    const isCraProductsExclusively: boolean =
      craProducts.length > 0 && craProducts.length === data.products.length;

    dispatch({
      type: "SET_STATE",
      state: {
        products: data.products,
        isPaymentInitiation: paymentInitiation,
        isCraProductsExclusively,
        isUserTokenFlow,
      },
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
    if (data) {
      if (data.error != null) {
        dispatch({
          type: "SET_STATE",
          state: { linkToken: null, linkTokenError: data.error },
        });
        return;
      }
      dispatch({
        type: "SET_STATE",
        state: { userToken: data.user_token || null, userId: data.user_id || null },
      });
      return data.user_token || data.user_id;
    }
  }, [dispatch]);

  const generateToken = useCallback(
    async (isPaymentInitiation: boolean) => {
      const path = isPaymentInitiation
        ? "/api/create_link_token_for_payment"
        : "/api/create_link_token";
      const response = await fetch(path, { method: "POST" });
      if (!response.ok) {
        let errorDetail;
        try {
          const data = await response.json();
          errorDetail = data.error || {
            error_code: data.error_code || "UNKNOWN",
            error_type: data.error_type || "API_ERROR",
            error_message:
              data.error_message || `Request failed with status ${response.status}`,
          };
        } catch {
          errorDetail = {
            error_code: "UNKNOWN",
            error_type: "API_ERROR",
            error_message: `Request failed with status ${response.status}`,
          };
        }
        dispatch({
          type: "SET_STATE",
          state: { linkToken: null, linkTokenError: errorDetail },
        });
        return;
      }
      const data = await response.json();
      if (data) {
        if (data.error != null) {
          dispatch({
            type: "SET_STATE",
            state: { linkToken: null, linkTokenError: data.error },
          });
          return;
        }
        dispatch({ type: "SET_STATE", state: { linkToken: data.link_token } });
      }
      localStorage.setItem("link_token", data.link_token);
    },
    [dispatch]
  );

  useEffect(() => {
    const init = async () => {
      const { paymentInitiation, isUserTokenFlow } = await getInfo();
      if (window.location.href.includes("?oauth_state_id=")) {
        dispatch({
          type: "SET_STATE",
          state: { linkToken: localStorage.getItem("link_token") },
        });
        return;
      }
      if (isUserTokenFlow) await generateUserToken();
      generateToken(paymentInitiation);
    };
    init();
  }, [dispatch, generateToken, generateUserToken, getInfo]);

  // Pre-login: full-screen landing page
  if (!linkSuccess) {
    return <Landing />;
  }

  // API dashboard view (also payment_initiation always uses this)
  if (isPaymentInitiation || showDashboard) {
    return (
      <div className={styles.App}>
        <button className={styles.navButton} onClick={() => setShowDashboard(false)}>
          ← Back to App
        </button>
        <div className={styles.container}>
          <Products />
          {!isPaymentInitiation && itemId && <Items />}
        </div>
      </div>
    );
  }

  // Step 1: connected success screen
  if (postLinkView === "connected") {
    return (
      <div className={styles.App}>
        <button className={styles.navButton} onClick={() => setShowDashboard(true)}>
          API Dashboard
        </button>
        <Header onContinue={() => setPostLinkView("review")} />
      </div>
    );
  }

  // Steps 2–4: spending review flow
  return (
    <div className={styles.App}>
      <button className={styles.navButton} onClick={() => setShowDashboard(true)}>
        API Dashboard
      </button>
      <SpendingReview />
    </div>
  );
};

export default App;
