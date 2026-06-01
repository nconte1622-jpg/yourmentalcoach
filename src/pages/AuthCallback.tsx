import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/PageShell";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase v2 automatically detects hash fragments and exchanges them
    // We just need to wait for the session to be established
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          navigate("/", { replace: true });
        }
      }
    );

    // Also check if session already exists (race condition)
    supabase.auth.getSession().then(({ data: { session }, error: err }) => {
      if (err) {
        setError(err.message);
      } else if (session) {
        navigate("/", { replace: true });
      }
    });

    // Timeout fallback — if no session after 5 s, send back to login
    const timeout = setTimeout(() => {
      navigate("/login", { replace: true });
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  if (error) {
    return (
      <PageShell backgroundVariant="deep">
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="bg-white/15 backdrop-blur-xl border border-white/20 rounded-3xl p-8 w-full max-w-sm text-center space-y-4">
            <h1 className="text-xl font-serif text-white">Login Failed</h1>
            <p className="text-sm text-white/60">{error}</p>
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="text-sm text-white/50 hover:text-white/80 transition-all"
            >
              ← Back to login
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell backgroundVariant="deep">
      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-white/60 text-sm animate-pulse">Signing you in…</p>
      </div>
    </PageShell>
  );
};

export default AuthCallback;
