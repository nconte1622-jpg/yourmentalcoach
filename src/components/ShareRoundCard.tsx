/**
 * ShareRoundCard
 *
 * Generates a canvas-rendered share card after round completion.
 * Uses the organic "I kept myself ___ today" format — no spammy
 * "join my app" framing. The AI-generated round word is the hero.
 *
 * Design language:
 *   Dark forest green gradient · Sand/gold accents · Serif for headlines
 *   9:16 Stories / 4:5 Feed format (1080 × 1350 px)
 *
 * Usage:
 *   <ShareRoundCard
 *     score={72}
 *     roundWord="FOCUSED"
 *     streak={4}
 *     onDismiss={() => ...}
 *   />
 */

import { useCallback, useRef, useState } from "react";
import { triggerHaptic } from "@/lib/haptics";
import { Share2, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareRoundCardProps {
  score: number;
  cueWord?: string | null;
  streak?: number;
  /** AI-generated single-word round descriptor */
  roundWord?: string | null;
  onDismiss?: () => void;
}

/* ─── Canvas drawing ─────────────────────────────────────── */

async function drawShareCard(
  canvas: HTMLCanvasElement,
  score: number,
  roundWord: string | null,
  streak: number,
  cueWord: string | null
): Promise<void> {
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // ── Background gradient ──────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#07120d");
  bg.addColorStop(0.45, "#0a1a12");
  bg.addColorStop(1, "#040908");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Radial glow ──────────────────────────────────────────
  const glow = ctx.createRadialGradient(W * 0.5, H * 0.38, 0, W * 0.5, H * 0.38, W * 0.55);
  glow.addColorStop(0, "rgba(12,50,30,0.55)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── THE CADDIE wordmark (top) ────────────────────────────
  ctx.fillStyle = "rgba(203,184,146,0.65)";
  ctx.font = "bold 30px Georgia, serif";
  ctx.letterSpacing = "8px";
  ctx.textAlign = "center";
  ctx.fillText("THE CADDIE", W / 2, 108);

  // ── Top divider ───────────────────────────────────────────
  ctx.strokeStyle = "rgba(203,184,146,0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W * 0.3, 130);
  ctx.lineTo(W * 0.7, 130);
  ctx.stroke();

  // ── "I kept myself" label ────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.font = "400 34px Georgia, serif";
  ctx.letterSpacing = "1px";
  ctx.textAlign = "center";
  ctx.fillText("I kept myself", W / 2, H * 0.26);

  // ── Round word — hero ────────────────────────────────────
  if (roundWord) {
    // Determine font size based on word length
    const wordFontSize = roundWord.length > 9 ? 110 : roundWord.length > 7 ? 140 : 170;
    ctx.fillStyle = "rgba(203,184,146,0.97)";
    ctx.font = `bold ${wordFontSize}px Georgia, serif`;
    ctx.letterSpacing = "4px";
    ctx.textAlign = "center";
    ctx.fillText(roundWord, W / 2, H * 0.45);
  } else {
    // Placeholder when word hasn't loaded
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "bold 140px Georgia, serif";
    ctx.letterSpacing = "4px";
    ctx.textAlign = "center";
    ctx.fillText("—", W / 2, H * 0.45);
  }

  // ── "today" label ─────────────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.font = "400 34px Georgia, serif";
  ctx.letterSpacing = "1px";
  ctx.textAlign = "center";
  ctx.fillText("today.", W / 2, H * 0.53);

  // ── Mid divider ───────────────────────────────────────────
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W * 0.2, H * 0.59);
  ctx.lineTo(W * 0.8, H * 0.59);
  ctx.stroke();

  // ── Mental Handicap row ───────────────────────────────────
  const band =
    score >= 75 ? { color: "rgba(31,180,100,0.95)", label: "STRONG" }
    : score >= 50 ? { color: "rgba(203,184,146,0.9)", label: "BUILDING" }
    : { color: "rgba(255,255,255,0.55)", label: "EARLY" };

  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "500 22px Arial, sans-serif";
  ctx.letterSpacing = "5px";
  ctx.textAlign = "center";
  ctx.fillText("MENTAL HANDICAP", W / 2, H * 0.655);

  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.font = `bold 100px Georgia, serif`;
  ctx.letterSpacing = "-2px";
  ctx.textAlign = "center";
  ctx.fillText(String(score), W / 2, H * 0.745);

  ctx.fillStyle = band.color;
  ctx.font = "700 24px Arial, sans-serif";
  ctx.letterSpacing = "7px";
  ctx.textAlign = "center";
  ctx.fillText(band.label, W / 2, H * 0.785);

  // ── Cue word (if set) ─────────────────────────────────────
  let nextY = H * 0.845;
  if (cueWord) {
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = "500 20px Arial, sans-serif";
    ctx.letterSpacing = "4px";
    ctx.textAlign = "center";
    ctx.fillText(`CUE: ${cueWord.toUpperCase()}`, W / 2, nextY);
    nextY += 56;
  }

  // ── Streak (if 2+) ───────────────────────────────────────
  if (streak >= 2) {
    ctx.fillStyle = "rgba(255,160,60,0.8)";
    ctx.font = "500 24px Arial, sans-serif";
    ctx.letterSpacing = "1px";
    ctx.textAlign = "center";
    ctx.fillText(`🔥 ${streak}-round streak`, W / 2, nextY);
  }

  // ── Tagline (bottom) ──────────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.font = "italic 26px Georgia, serif";
  ctx.letterSpacing = "0.5px";
  ctx.textAlign = "center";
  ctx.fillText("Golf is 90% mental.", W / 2, H * 0.95);

  // ── Bottom border flourish ────────────────────────────────
  ctx.strokeStyle = "rgba(203,184,146,0.12)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W * 0.38, H * 0.968);
  ctx.lineTo(W * 0.62, H * 0.968);
  ctx.stroke();
}

/* ─── Share logic ────────────────────────────────────────── */

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
  });
}

async function shareCard(canvas: HTMLCanvasElement): Promise<"shared" | "downloaded" | "error"> {
  try {
    const blob = await canvasToBlob(canvas);
    if (!blob) return "error";

    const file = new File([blob], "my-round-the-caddie.png", { type: "image/png" });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        // No promotional text — the image speaks for itself
      });
      return "shared";
    }

    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-round-the-caddie.png";
    a.click();
    URL.revokeObjectURL(url);
    return "downloaded";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "shared";
    return "error";
  }
}

/* ─── Component ──────────────────────────────────────────── */

export function ShareRoundCard({
  score,
  cueWord,
  streak = 0,
  roundWord,
  onDismiss,
}: ShareRoundCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "generating" | "ready" | "shared">("idle");

  const handleGenerate = useCallback(async () => {
    triggerHaptic("medium");
    setShareState("generating");
    setIsGenerating(true);

    await new Promise((r) => setTimeout(r, 80));

    const canvas = canvasRef.current;
    if (!canvas) { setShareState("idle"); setIsGenerating(false); return; }

    await drawShareCard(canvas, score, roundWord ?? null, streak, cueWord ?? null);
    const url = canvas.toDataURL("image/png");
    setPreviewUrl(url);
    setShareState("ready");
    setIsGenerating(false);
  }, [score, roundWord, streak, cueWord]);

  const handleShare = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    triggerHaptic("medium");

    const result = await shareCard(canvas);
    if (result === "shared" || result === "downloaded") {
      setShareState("shared");
      setTimeout(() => onDismiss?.(), 1500);
    }
  }, [onDismiss]);

  return (
    <div className="space-y-3">
      {/* Hidden canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Preview */}
      {shareState === "ready" && previewUrl && (
        <div className="relative overflow-hidden rounded-2xl border border-[rgba(203,184,146,0.15)]">
          <img src={previewUrl} alt="Round card" className="w-full rounded-2xl" />
          <button
            type="button"
            onClick={() => { setShareState("idle"); setPreviewUrl(null); }}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(0,0,0,0.6)] text-white/80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        {shareState === "idle" && (
          <button
            type="button"
            onClick={handleGenerate}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[rgba(203,184,146,0.3)] bg-[rgba(203,184,146,0.1)] py-3 text-sm font-medium text-[var(--sand-0)] transition-all active:scale-[0.97]"
          >
            <Share2 className="h-4 w-4" />
            {roundWord
              ? `Share — "${roundWord.slice(0, 12)}${roundWord.length > 12 ? "…" : ""}"`
              : "Share Round"}
          </button>
        )}

        {shareState === "generating" && (
          <div className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[rgba(203,184,146,0.15)] py-3 text-sm text-[var(--text-1)]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[rgba(203,184,146,0.2)] border-t-[var(--sand-0)]" />
            Creating card…
          </div>
        )}

        {shareState === "ready" && (
          <>
            <button
              type="button"
              onClick={handleShare}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[rgba(203,184,146,0.4)] bg-[rgba(203,184,146,0.15)] py-3 text-sm font-medium text-[var(--sand-0)] transition-all active:scale-[0.97]"
            >
              <Share2 className="h-4 w-4" />
              Share to Story / Feed
            </button>
            <button
              type="button"
              onClick={async () => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const blob = await canvasToBlob(canvas);
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "my-round-the-caddie.png";
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-[var(--text-1)] transition-all active:scale-[0.97]"
              aria-label="Download"
            >
              <Download className="h-4 w-4" />
            </button>
          </>
        )}

        {shareState === "shared" && (
          <div
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[rgba(31,180,100,0.3)] bg-[rgba(31,180,100,0.1)] py-3 text-sm font-medium text-[rgba(31,180,100,0.9)]"
            )}
          >
            ✓ Shared
          </div>
        )}
      </div>
    </div>
  );
}
