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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.08)] text-[#2d6a4f]">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium text-[#1a1a1a]">{title}</p>
            <p className="truncate text-sm text-[rgba(26,26,26,0.6)]">{description}</p>
            {supportingLine && (
              <p className="mt-1 text-[11px] tracking-[0.08em] text-[#2d6a4f]">{supportingLine}</p>
            )}
          </div>
          <span className="rounded-full border border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)] px-3 py-1 text-xs font-medium text-[#2d6a4f]">
            Start
          </span>
        </div>
      </GlassCard>
    </button>
  );
}
