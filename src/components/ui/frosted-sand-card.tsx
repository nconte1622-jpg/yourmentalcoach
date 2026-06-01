import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FrostedSandCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "sand" | "deep";
}

export function FrostedSandCard({
  children,
  className,
  tone = "sand",
  style,
  ...props
}: FrostedSandCardProps) {
  const toneStyle =
    tone === "deep"
      ? {
          background:
            "linear-gradient(180deg, rgba(214,197,163,0.18) 0%, rgba(24,39,31,0.24) 100%)",
          borderColor: "rgba(60, 90, 78, 0.16)",
          boxShadow: "0 18px 40px rgba(8, 17, 14, 0.18)",
        }
      : {
          background:
            "linear-gradient(180deg, var(--glass-sand-bg) 0%, rgba(235,222,195,0.66) 100%)",
          borderColor: "var(--glass-sand-border)",
          boxShadow: "var(--glass-sand-shadow)",
        };

  return (
    <div
      className={cn(
        "rounded-3xl border p-5 sm:p-6 backdrop-blur-[14px] supports-[backdrop-filter]:backdrop-saturate-[1.2]",
        className
      )}
      style={{ ...toneStyle, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}
