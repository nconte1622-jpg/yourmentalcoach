import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

/**
 * InfoHint — a tap-to-reveal info popover that is rendered in a portal with
 * `position: fixed`, anchored to its trigger button.
 *
 * Lovable's original tooltips used `position: absolute`, so they were clipped
 * the moment a parent had `overflow: hidden` / `overflow-y: auto` (which most
 * of our cards and scroll containers do) — the user literally couldn't read
 * them. Portaling to <body> and positioning against the button's bounding rect
 * means the popover always floats above everything, clamped to the viewport.
 */

const POPOVER_WIDTH = 240;
const GAP = 8;
const MARGIN = 12;

interface InfoHintProps {
  /** Optional title shown in small caps above the body. */
  title?: string;
  children: ReactNode;
  /** Accessible label for the trigger button. */
  label?: string;
  className?: string;
}

export function InfoHint({ title, children, label = "More info", className }: InfoHintProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; above: boolean }>({
    top: 0,
    left: 0,
    above: false,
  });

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;

    const place = () => {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Center horizontally on the button, then clamp inside the viewport.
      const half = POPOVER_WIDTH / 2;
      const centerX = rect.left + rect.width / 2;
      const left = Math.min(Math.max(centerX - half, MARGIN), vw - POPOVER_WIDTH - MARGIN);

      // Prefer below; flip above when there isn't room.
      const spaceBelow = vh - rect.bottom;
      const above = spaceBelow < 160 && rect.top > 160;
      const top = above ? rect.top - GAP : rect.bottom + GAP;

      setCoords({ top, left, above });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <span className="relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          className ??
          "ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[rgba(26,26,26,0.6)] opacity-50 transition-opacity hover:opacity-90"
        }
        aria-label={label}
        aria-expanded={open}
      >
        <Info className="h-3 w-3" />
      </button>

      {open &&
        createPortal(
          <>
            {/* Dismiss layer */}
            <div className="fixed inset-0 z-[110]" onClick={() => setOpen(false)} />
            <div
              role="dialog"
              className="fixed z-[111] rounded-2xl border border-[rgba(45,106,79,0.12)] bg-white/95 p-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.1)] backdrop-blur-xl animate-fade-in"
              style={{
                width: POPOVER_WIDTH,
                left: coords.left,
                top: coords.top,
                transform: coords.above ? "translateY(-100%)" : undefined,
              }}
            >
              {title && (
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2d6a4f]">
                  {title}
                </p>
              )}
              <div className="text-xs leading-5 text-[rgba(26,26,26,0.6)]">{children}</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-2 w-full rounded-xl bg-[rgba(45,106,79,0.06)] py-1.5 text-xs text-[rgba(26,26,26,0.6)] transition-colors hover:bg-[rgba(45,106,79,0.1)]"
              >
                Got it
              </button>
            </div>
          </>,
          document.body
        )}
    </span>
  );
}
