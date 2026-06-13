/**
 * Auth entrypoint — email/password + OAuth (Apple, Google).
 */
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { openExternal } from "@/lib/openExternal";
import { identifyRevenueCatUser, logOutRevenueCatUser } from "@/lib/revenueCat";
import { User, Session } from "@supabase/supabase-js";

/**
 * On iOS (Capacitor), window.location.origin === "capacitor://localhost" which
 * Supabase rejects as an invalid redirect URL. Use the app's deep-link scheme
 * on native, and the real browser origin on web.
 */
const EMAIL_REDIRECT_URL = Capacitor.isNativePlatform()
  ? "com.nconte.thecaddie://auth/callback"
  : `${window.location.origin}/auth/callback`;

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
}

type SignUpMetadata = {
  privacy_accepted_at?: string;
  terms_accepted_at?: string;
};

type OAuthProvider = "google" | "apple";

type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: unknown }>;
  signUp: (email: string, password: string, metadata?: SignUpMetadata) => Promise<{ error: unknown }>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<{ error: unknown }>;
  resetPassword: (email: string) => Promise<{ error: unknown }>;
  signOut: () => Promise<{ error: unknown }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function applySession(session: Session | null) {
  return {
    user: session?.user ?? null,
    session,
    isLoading: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;

    const updateFromSession = (session: Session | null) => {
      if (!isMounted) return;
      setState((current) => {
        const next = applySession(session);
        if (
          current.user?.id === next.user?.id &&
          current.session?.access_token === next.session?.access_token &&
          current.isLoading === next.isLoading
        ) {
          return current;
        }
        return next;
      });
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      updateFromSession(session);
      // Sync RevenueCat user identity so purchase history follows the account
      if (session?.user?.id) {
        void identifyRevenueCatUser(session.user.id);
      } else {
        void logOutRevenueCatUser();
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      updateFromSession(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, metadata?: SignUpMetadata) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: EMAIL_REDIRECT_URL,
        data: metadata,
      },
    });
    return { error };
  }, []);

  const signInWithOAuth = useCallback(async (provider: OAuthProvider) => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          // Deep-link scheme so iOS can return to the app after OAuth
          redirectTo: "com.nconte.thecaddie://auth/callback",
          skipBrowserRedirect: true,
        },
      });
      if (error) return { error };
      if (data?.url) {
        // Opens in SFSafariViewController via @capacitor/browser (falls back to toast)
        await openExternal(data.url);
      }
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: EMAIL_REDIRECT_URL,
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.user,
      session: state.session,
      isLoading: state.isLoading,
      isAuthenticated: !!state.session,
      signIn,
      signUp,
      signInWithOAuth,
      resetPassword,
      signOut,
    }),
    [resetPassword, signIn, signInWithOAuth, signOut, signUp, state.isLoading, state.session, state.user]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
