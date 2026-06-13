/**
 * Login page — email + password auth with sign in / create account toggle.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { PageShell } from "@/components/PageShell";
import { PUBLIC_LEGAL_URLS } from "@/lib/legal";

type Mode = "signin" | "signup" | "forgot";

const Login = () => {
  const { signIn, signUp, signInWithOAuth, resetPassword, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"apple" | "google" | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setPassword("");
    setConfirmPassword("");
    setPrivacyAccepted(false);
    setTermsAccepted(false);
    clearMessages();
  };

  const openLegalLink = (type: "privacy" | "terms") => {
    navigate(PUBLIC_LEGAL_URLS[type]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (mode === "forgot") {
      setSubmitting(true);
      const { error: err } = await resetPassword(email);
      setSubmitting(false);
      if (err) {
        setError(err.message);
      } else {
        setSuccess("Check your email for a password reset link.");
      }
      return;
    }

    if (!password) {
      setError("Please enter a password.");
      return;
    }

    if (mode === "signup") {
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (!privacyAccepted || !termsAccepted) {
        setError("You must agree to the Privacy Policy and Terms of Service to create an account.");
        return;
      }
      setSubmitting(true);
      const acceptedAt = new Date().toISOString();
      const { error: err } = await signUp(email, password, {
        privacy_accepted_at: acceptedAt,
        terms_accepted_at: acceptedAt,
      });
      setSubmitting(false);
      if (err) {
        setError(err.message);
      } else {
        setSuccess("Account created! Check your email to confirm, then sign in.");
      }
      return;
    }

    // signin
    setSubmitting(true);
    const { error: err } = await signIn(email, password);
    setSubmitting(false);
    if (err) {
      setError(err.message);
    }
    // on success, onAuthStateChange will trigger redirect
  };

  const handleOAuth = async (provider: "apple" | "google") => {
    clearMessages();
    setOauthLoading(provider);
    const { error: err } = await signInWithOAuth(provider);
    setOauthLoading(null);
    if (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    // On success, the redirect/session update handles navigation
  };

  const inputClass =
    "py-6 px-4 text-base rounded-2xl border-white/25 bg-white/10 text-white placeholder:text-white/50 shadow-inner shadow-black/10 focus:border-white/40 focus:ring-2 focus:ring-white/20 focus:bg-white/15";

  const btnClass =
    "w-full py-6 text-base font-medium rounded-2xl bg-white/25 hover:bg-white/35 text-white shadow-md transition-all";

  const canSubmit =
    mode === "signup"
      ? Boolean(
          email.trim() &&
            password &&
            confirmPassword &&
            password.length >= 6 &&
            password === confirmPassword &&
            privacyAccepted &&
            termsAccepted &&
            !submitting
        )
      : !submitting;

  const tabClass = (active: boolean) =>
    `flex-1 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
      active
        ? "bg-white/20 text-white shadow-sm"
        : "text-white/50 hover:text-white/70"
    }`;

  if (isLoading) return null;

  return (
    <PageShell backgroundVariant="deep">
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">

        {/* Social proof — above the card */}
        <div className="w-full max-w-sm mb-5 animate-fade-in">
          <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3.5 text-center">
            <p className="text-xs text-white/55 leading-5 italic">
              "I stopped spiraling on bad holes. This thing actually gets the mental side."
            </p>
            <p className="text-[10px] text-white/30 mt-1.5 uppercase tracking-wider">— Early tester, 14 handicap</p>
          </div>
        </div>

        <div className="bg-white/15 backdrop-blur-xl border border-white/20 shadow-2xl shadow-black/20 rounded-3xl p-8 w-full max-w-sm">
          <div className="mb-6 flex justify-center animate-fade-in">
            <Logo size="lg" variant="light" />
          </div>

          <h1
            className="text-2xl md:text-3xl font-serif text-white tracking-wide mb-1 text-center animate-fade-in"
            style={{ animationDelay: "100ms" }}
          >
            The Caddie
          </h1>

          {/* Credibility tagline */}
          <p
            className="text-[11px] text-white/35 text-center uppercase tracking-[0.18em] mb-0 animate-fade-in"
            style={{ animationDelay: "110ms" }}
          >
            Sports psychology · Built for golf
          </p>

          {mode !== "forgot" && (
            <div
              className="flex gap-1 p-1 rounded-2xl bg-white/10 mb-6 mt-6 animate-fade-in"
              style={{ animationDelay: "200ms" }}
            >
              <button
                type="button"
                className={tabClass(mode === "signin")}
                onClick={() => switchMode("signin")}
              >
                Sign In
              </button>
              <button
                type="button"
                className={tabClass(mode === "signup")}
                onClick={() => switchMode("signup")}
              >
                Create Account
              </button>
            </div>
          )}

          {mode === "forgot" && (
            <p
              className="text-sm text-white/50 tracking-wide mb-6 mt-6 text-center animate-fade-in"
              style={{ animationDelay: "200ms" }}
            >
              Enter your email to receive a reset link.
            </p>
          )}

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 mb-4 text-sm text-red-200 animate-fade-in">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-xl px-4 py-3 mb-4 text-sm text-emerald-200 animate-fade-in">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in" style={{ animationDelay: "300ms" }}>
            <Input
              type="email"
              inputMode="email"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              className={inputClass}
              autoFocus
            />

            {mode !== "forgot" && (
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className={inputClass}
              />
            )}

            {mode === "signup" && (
              <>
                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={submitting}
                  className={inputClass}
                />

                <div className="space-y-3 rounded-2xl border border-white/16 bg-white/8 p-4 shadow-inner shadow-black/10">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="privacy-consent"
                      checked={privacyAccepted}
                      onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                      className="mt-0.5 h-5 w-5 rounded border-white/35 data-[state=checked]:bg-[var(--sand-0)] data-[state=checked]:text-[var(--ink-0)]"
                    />
                    <div className="flex-1 text-sm leading-6 text-white/85">
                      <label htmlFor="privacy-consent" className="cursor-pointer">
                        I agree to the{" "}
                      </label>
                      <button
                        type="button"
                        onClick={() => void openLegalLink("privacy")}
                        className="font-medium text-[var(--sand-0)] underline underline-offset-4"
                      >
                        Privacy Policy
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="terms-consent"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                      className="mt-0.5 h-5 w-5 rounded border-white/35 data-[state=checked]:bg-[var(--sand-0)] data-[state=checked]:text-[var(--ink-0)]"
                    />
                    <div className="flex-1 text-sm leading-6 text-white/85">
                      <label htmlFor="terms-consent" className="cursor-pointer">
                        I agree to the{" "}
                      </label>
                      <button
                        type="button"
                        onClick={() => void openLegalLink("terms")}
                        className="font-medium text-[var(--sand-0)] underline underline-offset-4"
                      >
                        Terms of Service
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            <Button type="submit" disabled={!canSubmit} className={btnClass} size="lg">
              {submitting
                ? "Please wait…"
                : mode === "signin"
                ? "Sign In"
                : mode === "signup"
                ? "Create Account"
                : "Send Reset Link"}
            </Button>
          </form>

          {/* OAuth divider + buttons */}
          {mode !== "forgot" && (
            <div className="mt-6 space-y-3 animate-fade-in" style={{ animationDelay: "350ms" }}>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/15" />
                <span className="text-xs text-white/30 tracking-wider uppercase">or</span>
                <div className="flex-1 h-px bg-white/15" />
              </div>

              <button
                type="button"
                disabled={!!oauthLoading || submitting}
                onClick={() => handleOAuth("apple")}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white text-black font-medium text-sm transition-all hover:bg-white/90 disabled:opacity-50"
              >
                {oauthLoading === "apple" ? (
                  <span className="text-sm">Connecting…</span>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    <span>Continue with Apple</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={!!oauthLoading || submitting}
                onClick={() => handleOAuth("google")}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white/15 border border-white/20 text-white font-medium text-sm transition-all hover:bg-white/25 disabled:opacity-50"
              >
                {oauthLoading === "google" ? (
                  <span className="text-sm">Connecting…</span>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="mt-4 text-center animate-fade-in" style={{ animationDelay: "400ms" }}>
            {mode === "signin" && (
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="text-sm text-white/40 hover:text-white/70 transition-all"
              >
                Forgot password?
              </button>
            )}
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="text-sm text-white/40 hover:text-white/70 transition-all"
              >
                ← Back to sign in
              </button>
            )}
          </div>

          {/* Privacy micro-copy */}
          <p className="mt-5 text-center text-[10px] text-white/25 leading-5 animate-fade-in" style={{ animationDelay: "450ms" }}>
            🔒 Your mental data is private and never shared.
            <br />Mental patterns stay on your device. Coaching is processed securely.
          </p>
        </div>
      </div>
    </PageShell>
  );
};

export default Login;
