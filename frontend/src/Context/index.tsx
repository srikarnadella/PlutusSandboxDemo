import { createContext, useReducer, Dispatch, ReactNode, useEffect } from "react";
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
  // Supabase auth
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

  useEffect(() => {
    // Restore session on page load
    supabase.auth.getSession().then(({ data: { session } }) => {
      dispatch({
        type: "SET_STATE",
        state: {
          supabaseUser: session?.user ?? null,
          isAuthLoading: false,
        },
      });
      if (session?.user) {
        checkPlaidConnection(session.user.id);
      }
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        dispatch({
          type: "SET_STATE",
          state: {
            supabaseUser: session?.user ?? null,
            isAuthLoading: false,
            // Clear Plaid state on logout
            ...(!session ? {
              linkSuccess: false,
              hasPlaidConnection: false,
              linkToken: "",
            } : {}),
          },
        });
        if (session?.user) {
          checkPlaidConnection(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkPlaidConnection = async (userId: string) => {
    const { data } = await supabase
      .from("user_profiles")
      .select("plaid_item_id")
      .eq("id", userId)
      .maybeSingle();
    dispatch({
      type: "SET_STATE",
      state: { hasPlaidConnection: !!(data?.plaid_item_id) },
    });
  };

  return <Provider value={{ ...state, dispatch }}>{props.children}</Provider>;
};

export default Context;
