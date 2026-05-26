import React, { useEffect, useContext } from "react";
import { usePlaidLink } from "react-plaid-link";

import Context from "../../Context";

const Link = () => {
  const { linkToken, isPaymentInitiation, isCraProductsExclusively, dispatch } =
    useContext(Context);

  const onExit = React.useCallback(
    (error: any, metadata: any) => {
      if (error != null) {
        const linkExitError = {
          error_type: error.error_type || "",
          error_code: error.error_code || "",
          error_message: error.error_message || "",
          display_message: error.display_message || "",
          institution_name: metadata?.institution?.name || "",
        };
        dispatch({
          type: "SET_STATE",
          state: { linkExitError },
        });
        fetch("/api/link_exit_error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(linkExitError),
        });
      }
    },
    [dispatch]
  );

  const onSuccess = React.useCallback(
    async (public_token: string) => {
      const exchangePublicTokenForAccessToken = async () => {
        const response = await fetch("/api/set_access_token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: `public_token=${public_token}`,
        });
        if (!response.ok) {
          dispatch({
            type: "SET_STATE",
            state: {
              itemId: `no item_id retrieved`,
              accessToken: `no access_token retrieved`,
              isItemAccess: false,
            },
          });
          return;
        }
        const data = await response.json();
        dispatch({
          type: "SET_STATE",
          state: {
            itemId: data.item_id,
            accessToken: data.access_token,
            isItemAccess: true,
          },
        });
      };

      if (isPaymentInitiation) {
        dispatch({ type: "SET_STATE", state: { isItemAccess: false } });
      } else if (isCraProductsExclusively) {
        dispatch({ type: "SET_STATE", state: { isItemAccess: false } });
      } else {
        await exchangePublicTokenForAccessToken();
      }

      dispatch({ type: "SET_STATE", state: { linkSuccess: true } });
      window.history.pushState("", "", "/");
    },
    [dispatch, isPaymentInitiation, isCraProductsExclusively]
  );

  let isOauth = false;
  const config: Parameters<typeof usePlaidLink>[0] = {
    token: linkToken!,
    onSuccess,
    onExit,
  };

  if (window.location.href.includes("?oauth_state_id=")) {
    // @ts-ignore
    config.receivedRedirectUri = window.location.href;
    isOauth = true;
  }

  const { open, ready } = usePlaidLink(config);

  useEffect(() => {
    if (isOauth && ready) {
      open();
    }
  }, [ready, open, isOauth]);

  return (
    <button
      type="button"
      onClick={() => open()}
      disabled={!ready}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "1rem",
        background: ready ? "#4f46e5" : "rgba(99,102,241,0.3)",
        color: ready ? "#fff" : "rgba(255,255,255,0.4)",
        fontWeight: 700,
        padding: "1.6rem 4rem",
        borderRadius: "1.4rem",
        border: "none",
        fontSize: "1.8rem",
        cursor: ready ? "pointer" : "not-allowed",
        transition: "all 0.2s",
        boxShadow: ready ? "0 8px 40px rgba(99,102,241,0.35)" : undefined,
        letterSpacing: "-0.01em",
      }}
      onMouseEnter={(e) => {
        if (ready) {
          (e.currentTarget as HTMLButtonElement).style.background = "#4338ca";
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 12px 48px rgba(99,102,241,0.45)";
        }
      }}
      onMouseLeave={(e) => {
        if (ready) {
          (e.currentTarget as HTMLButtonElement).style.background = "#4f46e5";
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 40px rgba(99,102,241,0.35)";
        }
      }}
    >
      Connect your bank account
      <span style={{ fontSize: "1.6rem" }}>→</span>
    </button>
  );
};

Link.displayName = "Link";

export default Link;
