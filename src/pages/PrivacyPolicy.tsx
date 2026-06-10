import { useNavigate } from "react-router-dom";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { AppShell } from "@/components/ui/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { FrostedSandCard } from "@/components/ui/frosted-sand-card";
import { LEGAL_LAST_UPDATED, isLegalUrlAvailable, PUBLIC_LEGAL_URLS } from "@/lib/legal";
import { openExternal } from "@/lib/openExternal";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <PageShell backgroundVariant="default">
      <AppShell
        contentClassName="flex flex-col"
        header={
          <AppHeader
            left={
              <button
                type="button"
                onClick={() => navigate("/account")}
                className="header-hit-button tap-44 text-muted-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-all duration-300"
              >
                ← Account
              </button>
            }
            center={<h1 className="truncate text-base md:text-lg font-serif tracking-wide text-foreground">Privacy Policy</h1>}
            right={<div className="tap-44" />}
          />
        }
      >
        <main className="legal-shell space-y-5">
          <div className="space-y-2 pt-2">
            <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[rgba(203,184,146,0.16)] bg-[rgba(203,184,146,0.1)] px-3 py-2 text-sm text-[var(--sand-0)]">
              <ShieldAlert className="h-4 w-4" />
              Privacy & Data
            </div>
            <h1 className="legal-hero-title text-4xl md:text-5xl">Privacy Policy</h1>
            <p className="legal-subtitle max-w-2xl">
              How The Caddie uses and protects your information.
            </p>
          </div>

          <FrostedSandCard className="space-y-8 p-6 md:p-8">
            <div className="space-y-3">
              <p className="legal-body font-medium">Last updated: {LEGAL_LAST_UPDATED}</p>
              <p className="legal-body">
                The Caddie (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) provides a mental-performance coaching app for golfers.
              </p>
            </div>

            <section className="space-y-3">
              <h2 className="legal-section-title">1. Information We Collect</h2>
              <p className="legal-body">We collect information needed to operate the app and provide coaching features, including:</p>
              <ul className="legal-list">
                <li>Account information such as your email address</li>
                <li>Round data such as sessions, inputs, reflections, and saved cues</li>
                <li>User-generated content such as AI chats, notes, and mental-performance responses</li>
                <li>Subscription and entitlement status provided through Apple</li>
                <li>Basic product analytics such as feature usage and app events</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="legal-section-title">2. How We Use Information</h2>
              <p className="legal-body">We use your information to:</p>
              <ul className="legal-list">
                <li>Provide personalized coaching experiences</li>
                <li>Store and recall your performance patterns and saved cues</li>
                <li>Improve product quality and reliability</li>
                <li>Manage subscriptions, entitlements, and account access</li>
                <li>Provide support when requested</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="legal-section-title">3. AI Processing</h2>
              <p className="legal-body">
                Messages you send in the app may be processed by a third-party AI provider to generate coaching responses. We use this only to deliver and improve the coaching experience.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="legal-section-title">4. Payments</h2>
              <p className="legal-body">
                Payments and subscriptions are handled by Apple. We do not store your payment card details.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="legal-section-title">5. Data Storage</h2>
              <p className="legal-body">
                Your data is stored using our backend infrastructure and service providers in order to operate the app securely.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="legal-section-title">6. Your Choices</h2>
              <p className="legal-body">You may:</p>
              <ul className="legal-list">
                <li>Stop using the app at any time</li>
                <li>Cancel subscriptions through your Apple account</li>
                <li>Request account deletion by contacting support</li>
              </ul>
              <p className="legal-body">Support contact: support@thecaddie.app</p>
            </section>

            <section className="space-y-3">
              <h2 className="legal-section-title">7. Children</h2>
              <p className="legal-body">The Caddie is not intended for children under 13.</p>
            </section>

            <section className="space-y-3">
              <h2 className="legal-section-title">8. Changes to This Policy</h2>
              <p className="legal-body">
                We may update this Privacy Policy from time to time. Continued use of the app after updates means you accept the revised policy.
              </p>
            </section>
          </FrostedSandCard>

          {isLegalUrlAvailable(PUBLIC_LEGAL_URLS.privacy) && (
            <FrostedSandCard className="space-y-3 p-4 md:p-5">
              <p className="text-sm font-medium" style={{ color: "var(--ink-0)" }}>
                Public document
              </p>
              <button
                type="button"
                className="legal-link-row"
                onClick={() => void openExternal(PUBLIC_LEGAL_URLS.privacy)}
              >
                <span>Open full Privacy Policy</span>
                <ExternalLink className="h-4 w-4" />
              </button>
            </FrostedSandCard>
          )}
        </main>
      </AppShell>
    </PageShell>
  );
};

export default PrivacyPolicy;
