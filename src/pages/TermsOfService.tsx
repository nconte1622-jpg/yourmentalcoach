import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { AppShell } from "@/components/ui/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { FrostedSandCard } from "@/components/ui/frosted-sand-card";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";

const TermsOfService = () => {
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
            center={<h1 className="truncate text-base md:text-lg font-serif tracking-wide text-foreground">Terms of Service</h1>}
            right={<div className="tap-44" />}
          />
        }
      >
        <main className="legal-shell space-y-5">
          <div className="space-y-2 pt-2">
            <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[rgba(203,184,146,0.16)] bg-[rgba(203,184,146,0.1)] px-3 py-2 text-sm text-[var(--sand-0)]">
              <FileText className="h-4 w-4" />
              Terms & Use
            </div>
            <h1 className="legal-hero-title text-4xl md:text-5xl">Terms of Service</h1>
            <p className="legal-subtitle max-w-2xl">
              The rules and responsibilities for using The Caddie.
            </p>
          </div>

          <FrostedSandCard className="space-y-8 p-6 md:p-8">
            <div className="space-y-3">
              <p className="legal-body font-medium">Last updated: {LEGAL_LAST_UPDATED}</p>
              <p className="legal-body">By using The Caddie, you agree to the following terms.</p>
            </div>

            <section className="space-y-3">
              <h2 className="legal-section-title">1. Purpose of the App</h2>
              <p className="legal-body">
                The Caddie is a mental-performance tool for golfers. It is not medical care, therapy, crisis support, or emergency guidance.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="legal-section-title">2. Use of the App</h2>
              <p className="legal-body">
                You agree to use the app responsibly and lawfully. You may not misuse, reverse engineer, abuse, or attempt to bypass product limits, subscriptions, or protections.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="legal-section-title">3. AI Coaching Responses</h2>
              <p className="legal-body">
                Coaching responses are generated using AI and may not always be perfect or appropriate for every situation. You remain responsible for your own decisions during practice and play.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="legal-section-title">4. Subscriptions</h2>
              <p className="legal-body">If you purchase a subscription:</p>
              <ul className="legal-list">
                <li>Billing is handled by Apple</li>
                <li>Subscriptions renew automatically unless canceled in your Apple subscription settings</li>
                <li>Refunds are handled according to Apple’s policies</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="legal-section-title">5. Account Responsibility</h2>
              <p className="legal-body">You are responsible for activity associated with your account.</p>
            </section>

            <section className="space-y-3">
              <h2 className="legal-section-title">6. Termination</h2>
              <p className="legal-body">
                We may suspend or restrict access in cases of abuse, misuse, or attempts to interfere with the service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="legal-section-title">7. Limitation of Liability</h2>
              <p className="legal-body">
                The Caddie is provided as a performance-support tool. We are not responsible for golf results, decisions made during play, or misuse of the app.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="legal-section-title">8. Changes to These Terms</h2>
              <p className="legal-body">
                We may update these Terms of Service from time to time. Continued use of the app after updates means you accept the revised terms.
              </p>
            </section>
          </FrostedSandCard>

        </main>
      </AppShell>
    </PageShell>
  );
};

export default TermsOfService;
