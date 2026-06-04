import React, { useEffect, useContext } from "react";
import { usePlaidLink } from "react-plaid-link";

import Context from "../../Context";
import { supabase } from "../../lib/supabase";
import { apiFetch } from "../../lib/apiFetch";

const Link = () => {
  const { linkToken, isPaymentInitiation, isCraProductsExclusively, dispatch, supabaseUser } =
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
    async (public_token: string, metadata: any) => {
      const exchangePublicTokenForAccessToken = async () => {
        const response = await apiFetch("/api/set_access_token", {
          method: "POST",
          body: JSON.stringify({
            public_token: public_token,
            user_id: supabaseUser?.id ?? "",
            institution_name: metadata?.institution?.name ?? "",
            institution_id: metadata?.institution?.institution_id ?? "",
          }),
        });
        if (!response.ok) {
          dispatch({
            type: "SET_STATE",
            state: { itemId: null, accessToken: null, isItemAccess: false },
          });
          return;
        }
        const data = await response.json();
        // Write plaid_item_id directly from frontend so checkPlaidConnection works
        // even if the backend's Supabase upsert fails for any reason
        if (supabaseUser?.id && data.item_id) {
          await supabase.from("user_profiles").upsert(
            { id: supabaseUser.id, plaid_item_id: data.item_id },
            { onConflict: "id" }
          );
        }
        dispatch({
          type: "SET_STATE",
          state: {
            itemId: data.item_id,
            isItemAccess: true,
            hasPlaidConnection: true,
            linkSuccess: true,
          },
        });
      };

      if (isPaymentInitiation) {
        dispatch({ type: "SET_STATE", state: { isItemAccess: false, linkSuccess: true } });
      } else if (isCraProductsExclusively) {
        dispatch({ type: "SET_STATE", state: { isItemAccess: false, linkSuccess: true } });
      } else {
        await exchangePublicTokenForAccessToken();
      }

      window.history.pushState("", "", "/dashboard");
    },
    [dispatch, isPaymentInitiation, isCraProductsExclusively, supabaseUser]
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
        background: ready ? "linear-gradient(135deg, #047857 0%, #059669 100%)" : "rgba(5,150,105,0.2)",
        color: ready ? "#fff" : "rgba(255,255,255,0.35)",
        fontWeight: 700,
        padding: "1.6rem 4.4rem",
        borderRadius: "1.4rem",
        border: "none",
        fontSize: "1.8rem",
        cursor: ready ? "pointer" : "not-allowed",
        transition: "all 0.2s",
        boxShadow: ready ? "0 8px 40px rgba(5,150,105,0.45), 0 0 0 1px rgba(255,255,255,0.08) inset" : undefined,
        letterSpacing: "-0.01em",
      }}
      onMouseEnter={(e) => {
        if (ready) {
          (e.currentTarget as HTMLButtonElement).style.opacity = "0.9";
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 16px 56px rgba(5,150,105,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset";
        }
      }}
      onMouseLeave={(e) => {
        if (ready) {
          (e.currentTarget as HTMLButtonElement).style.opacity = "1";
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 40px rgba(5,150,105,0.45), 0 0 0 1px rgba(255,255,255,0.08) inset";
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
