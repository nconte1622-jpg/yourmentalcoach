import { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

interface ModeRowProps {
  title: string;
  description: string;
  supportingLine?: string;
  icon: LucideIcon;
  onClick: () => void;
}

export function ModeRow({ title, description, supportingLine, icon: Icon, onClick }: ModeRowProps) {
  return (
    <button
      onClick={onClick}
      className="calm-pro-focus calm-pro-press block w-full text-left"
    >
      <GlassCard className="min-h-11 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[rgba(18,64,47,0.5)] text-[var(--sand-0)]">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium text-[var(--text-0)]">{title}</p>
            <p className="truncate text-sm text-[var(--text-1)]">{description}</p>
            {supportingLine && (
              <p className="mt-1 text-[11px] tracking-[0.08em] text-[var(--sand-0)]">{supportingLine}</p>
            )}
          </div>
          <span className="rounded-full border border-[var(--border)] bg-[rgba(203,184,146,0.12)] px-3 py-1 text-xs font-medium text-[var(--sand-0)]">
            Start
          </span>
        </div>
      </GlassCard>
    </button>
  );
}
