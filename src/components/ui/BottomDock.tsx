import { memo } from "react";
import { LucideIcon, Bookmark, Brain, TrendingUp, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

type DockItem = {
  label: string;
  icon: LucideIcon;
  to: string;
  isActive: (pathname: string) => boolean;
  dot?: boolean;
};

const ITEMS: DockItem[] = [
  {
    label: "Highlights",
    icon: Bookmark,
    to: "/highlights",
    isActive: (pathname) => pathname === "/highlights",
  },
  {
    label: "Memory Bank",
    icon: Brain,
    to: "/memory-bank",
    isActive: (pathname) => pathname === "/memory-bank",
  },
  {
    label: "Account",
    icon: User,
    to: "/account",
    isActive: (pathname) => pathname === "/account",
  },
  {
    label: "Insights",
    icon: TrendingUp,
    to: "/insights",
    isActive: (pathname) => pathname === "/insights",
  },
];

interface BottomDockProps {
  highlightDot?: boolean;
}

function BottomDockComponent({ highlightDot = false }: BottomDockProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="bottom-dock-region" aria-label="Primary navigation">
      <div className="bottom-dock-inner">
        <div className="grid grid-cols-4 gap-2">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.isActive(location.pathname);
            const showDot = item.label === "Highlights" ? highlightDot : item.dot;

            return (
              <button
                key={item.to}
                type="button"
                onClick={() => {
                  if (location.pathname === item.to) return;
                  triggerHaptic("soft");
                  navigate(item.to);
                }}
                className={cn(
                  "bottom-dock-button",
                  active && "bottom-dock-button-active"
                )}
                aria-current={active ? "page" : undefined}
              >
                <div className="flex flex-col items-center gap-1.5">
                  <Icon className="h-4 w-4" />
                  <span className="text-[11px] leading-none">{item.label}</span>
                  {showDot && <span className="h-1.5 w-1.5 rounded-full bg-[#2d6a4f]" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const BottomDock = memo(BottomDockComponent);
