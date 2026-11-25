import { createContext, useReducer, Dispatch, ReactNode, useEffect, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface QuickstartState {
  linkSuccess: boolean;
  isItemAccess: boolean;
  isPaymentInitiation: boolean;
  isUserTokenFlow: boolean;
  isCraProductsExclusively: boolean;
  linkToken: string | null;
  accessToken: string | null;
  userToken: string | null;
  userId: string | null;
  itemId: string | null;
  isError: boolean;
  backend: boolean;
  products: string[];
  linkTokenError: {
    error_message: string;
    error_code: string;
    error_type: string;
  };
  linkExitError: {
    error_message: string;
    error_code: string;
    error_type: string;
    display_message: string;
    institution_name: string;
  } | null;
  supabaseUser: User | null;
  isAuthLoading: boolean;
  hasPlaidConnection: boolean;
}

const initialState: QuickstartState = {
  linkSuccess: false,
  isItemAccess: true,
  isPaymentInitiation: false,
  isCraProductsExclusively: false,
  isUserTokenFlow: false,
  linkToken: "",
  userToken: null,
  userId: null,
  accessToken: null,
  itemId: null,
  isError: false,
  backend: true,
  products: ["transactions"],
  linkTokenError: {
    error_type: "",
    error_code: "",
    error_message: "",
  },
  linkExitError: null,
  supabaseUser: null,
  isAuthLoading: true,
  hasPlaidConnection: false,
};

type QuickstartAction = {
  type: "SET_STATE";
  state: Partial<QuickstartState>;
};

interface QuickstartContext extends QuickstartState {
  dispatch: Dispatch<QuickstartAction>;
}

const Context = createContext<QuickstartContext>(
  initialState as QuickstartContext
);

const { Provider } = Context;

export const QuickstartProvider: React.FC<{ children: ReactNode }> = (props) => {
  const reducer = (
    state: QuickstartState,
    action: QuickstartAction
  ): QuickstartState => {
    switch (action.type) {
      case "SET_STATE":
        return { ...state, ...action.state };
      default:
        return { ...state };
    }
  };

  const [state, dispatch] = useReducer(reducer, initialState);
  // A restored session fires INITIAL_SESSION and then SIGNED_IN; only check the connection once per user
  const checkedUserRef = useRef<string | null>(null);

  useEffect(() => {
    // INITIAL_SESSION fires on subscribe, so no separate getSession() call is needed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const user = session?.user ?? null;
        if (!user) {
          checkedUserRef.current = null;
          dispatch({ type: "SET_STATE", state: { supabaseUser: null, isAuthLoading: false, linkSuccess: false, hasPlaidConnection: false, linkToken: "" } });
          return;
        }
        // TOKEN_REFRESHED fires periodically — re-querying Supabase here risks
        // setting hasPlaidConnection:false if the read is slow/empty, which
        // bounces the user back to /connect. Only check on actual sign-in events.
        if ((event !== "SIGNED_IN" && event !== "INITIAL_SESSION") || checkedUserRef.current === user.id) {
          dispatch({ type: "SET_STATE", state: { supabaseUser: user } });
          return;
        }
        checkedUserRef.current = user.id;
        // Defer: supabase calls inside this callback can deadlock on the auth lock.
        setTimeout(async () => {
          const has = await checkPlaidConnection(user.id);
          dispatch({ type: "SET_STATE", state: { supabaseUser: user, isAuthLoading: false, ...(has === null ? {} : { hasPlaidConnection: has }) } });
        }, 0);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // null on error — leave hasPlaidConnection as-is rather than kicking the user out
  const checkPlaidConnection = async (userId: string): Promise<boolean | null> => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("plaid_item_id")
        .eq("id", userId)
        .maybeSingle();
      return error ? null : !!data?.plaid_item_id;
    } catch {
      return null;
    }
  };

  return <Provider value={{ ...state, dispatch }}>{props.children}</Provider>;
};

export default Context;
