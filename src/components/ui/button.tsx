import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button — luxurious, bubbly, mindfulness-centered design.
 *
 * default   → sand/gold pill with soft glow (primary CTAs)
 * secondary → frosted green glass
 * ghost     → transparent with subtle hover
 * outline   → bordered, no fill
 * destructive → muted red
 * link      → text only
 */
const buttonVariants = cva(
  [
    // Base — shared across all variants
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-medium tracking-wide",
    // Pill shape by default (generous radius)
    "rounded-[28px]",
    // Smooth transitions + press micro-feedback
    "transition-all duration-300 ease-out",
    "active:scale-[0.96] active:brightness-90",
    // Focus state
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(203,184,146,0.5)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
    // Disabled
    "disabled:pointer-events-none disabled:opacity-40 disabled:active:scale-100",
    // Icon children
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        /** Primary CTA — warm sand/gold, glowing */
        default: [
          "bg-[rgba(45,106,79,0.06)] border border-[rgba(45,106,79,0.12)]",
          "text-[#2d6a4f] hover:bg-[rgba(45,106,79,0.1)]",
          "shadow-[0_6px_24px_rgba(203,184,146,0.14)] hover:shadow-[0_8px_32px_rgba(203,184,146,0.22)]",
        ].join(" "),
        /** Destructive — muted warm red */
        destructive: [
          "bg-[rgba(220,80,80,0.16)] border border-[rgba(220,80,80,0.28)]",
          "text-red-300 hover:bg-[rgba(220,80,80,0.26)]",
        ].join(" "),
        /** Outline — bordered, no fill */
        outline: [
          "border border-[rgba(45,106,79,0.12)] bg-transparent",
          "text-foreground/70 hover:border-[rgba(45,106,79,0.12)] hover:text-foreground",
        ].join(" "),
        /** Secondary — frosted green */
        secondary: [
          "bg-[rgba(16,40,28,0.55)] border border-[rgba(45,106,79,0.12)]",
          "text-foreground/80 hover:bg-[rgba(16,40,28,0.72)]",
          "backdrop-blur-sm",
        ].join(" "),
        /** Ghost — no background, subtle hover */
        ghost: [
          "bg-transparent border-transparent",
          "text-foreground/60 hover:bg-[rgba(45,106,79,0.04)] hover:text-foreground",
        ].join(" "),
        /** Link — text only */
        link: [
          "bg-transparent border-transparent underline-offset-4",
          "text-[#2d6a4f] hover:underline",
        ].join(" "),
      },
      size: {
        default: "h-12 px-6 py-3 text-sm",
        sm:      "h-9 px-4 py-2 text-xs rounded-[20px]",
        lg:      "h-14 px-8 py-4 text-base rounded-[32px]",
        icon:    "h-10 w-10 rounded-full p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
