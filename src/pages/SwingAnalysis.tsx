import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Loader2, Eye, Crosshair, RotateCcw, Play, Pause } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { AppShell } from "@/components/ui/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { PillButton } from "@/components/ui/pill-button";
import { GlassCard } from "@/components/ui/glass-card";
import { streamCoachResponse, type ChatMessage } from "@/lib/mentalCoachApi";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// SwingAnalysis — Honest plane-line overlay + mental coaching
//
// The app does NOT fake computer vision. Instead:
// 1. User uploads/records swing video
// 2. User pauses it and taps 4 positions:
//    Address → Top of Backswing → Impact → Follow-Through
// 3. App draws the swing plane line through those points + shows angle
// 4. AI uses the coordinate/angle data + user description to give
//    specific mental coaching on tempo, commitment, routine, plane tendencies

type BreakdownStatus =
  | "idle"
  | "video-selected"
  | "drawing"
  | "drawn"
  | "analyzing"
  | "complete"
  | "error";

type SwingPoint = {
  label: "Address" | "Top" | "Impact" | "Follow-Through";
  x: number; // 0–1 relative to canvas
  y: number;
  color: string;
};

const SWING_POINT_SEQUENCE: SwingPoint["label"][] = [
  "Address",
  "Top",
  "Impact",
  "Follow-Through",
];

const POINT_COLORS: Record<SwingPoint["label"], string> = {
  "Address": "#CBB892",
  "Top": "#4ECDC4",
  "Impact": "#1FB464",
  "Follow-Through": "#F97316",
};

const POINT_LABELS: Record<SwingPoint["label"], string> = {
  "Address": "Address position",
  "Top": "Top of backswing",
  "Impact": "Impact zone",
  "Follow-Through": "Follow-through",
};

const SwingAnalysis = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState<BreakdownStatus>("idle");
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [userObservations, setUserObservations] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [markedPoints, setMarkedPoints] = useState<SwingPoint[]>([]);
  const [nextPointIndex, setNextPointIndex] = useState(0);
  const [planeAngle, setPlaneAngle] = useState<number | null>(null);
  const currentAbortController = useRef<AbortController | null>(null);

  const cancelActiveRequest = useCallback(() => {
    currentAbortController.current?.abort();
    currentAbortController.current = null;
  }, []);

  // ── Video controls ────────────────────────────────────
  const togglePlayPause = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) { vid.play(); setIsPlaying(true); }
    else { vid.pause(); setIsPlaying(false); }
  };

  // ── Canvas rendering ──────────────────────────────────
  const drawOverlay = useCallback((pts: SwingPoint[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Points
    pts.forEach((pt, i) => {
      const px = pt.x * W;
      const py = pt.y * H;

      ctx.beginPath();
      ctx.arc(px, py, 16, 0, Math.PI * 2);
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = pt.color;
      ctx.fill();

      ctx.font = "bold 11px system-ui";
      ctx.fillStyle = pt.color;
      ctx.textAlign = "center";
      ctx.fillText(String(i + 1), px, py - 22);

      ctx.font = "10px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(pt.label, px, py + 26);
    });

    // Best-fit swing plane line
    if (pts.length >= 2) {
      const points = pts.map((p) => ({ x: p.x * W, y: p.y * H }));
      const n = points.length;
      const sumX = points.reduce((s, p) => s + p.x, 0);
      const sumY = points.reduce((s, p) => s + p.y, 0);
      const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
      const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
      const denom = n * sumX2 - sumX * sumX;
      let slope = 0;
      let intercept = sumY / n;
      if (Math.abs(denom) > 0.001) {
        slope = (n * sumXY - sumX * sumY) / denom;
        intercept = (sumY - slope * sumX) / n;
      }

      const x0 = 0; const y0 = intercept;
      const x1 = W; const y1 = slope * W + intercept;

      ctx.shadowColor = "rgba(203,184,146,0.5)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = "rgba(203,184,146,0.85)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      const angleDeg = Math.round(Math.abs(Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI));
      setPlaneAngle(angleDeg);

      if (pts.length === 4) {
        const midX = W / 2;
        const midY = slope * (W / 2) + intercept;
        ctx.fillStyle = "rgba(8,19,13,0.85)";
        ctx.beginPath();
        const bx = midX - 38; const by = midY - 28;
        ctx.roundRect?.(bx, by, 76, 22, 6);
        ctx.fill();
        ctx.font = "bold 12px system-ui";
        ctx.fillStyle = "rgba(203,184,146,0.95)";
        ctx.textAlign = "center";
        ctx.fillText(`${angleDeg}° plane`, midX, midY - 12);
      }
    }
  }, []);

  useEffect(() => {
    drawOverlay(markedPoints);
  }, [markedPoints, drawOverlay]);

  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const rect = video.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      canvas.width = rect.width;
      canvas.height = rect.height;
      drawOverlay(markedPoints);
    }
  }, [drawOverlay, markedPoints]);

  useEffect(() => {
    const obs = new ResizeObserver(syncCanvasSize);
    if (videoRef.current) obs.observe(videoRef.current);
    return () => obs.disconnect();
  }, [syncCanvasSize]);

  // ── Canvas tap handler ────────────────────────────────
  const handleCanvasTap = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (status !== "drawing" || nextPointIndex >= 4) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;
      if ("touches" in e) {
        const t = e.touches[0] || e.changedTouches[0];
        clientX = t.clientX; clientY = t.clientY;
      } else {
        clientX = e.clientX; clientY = e.clientY;
      }

      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      const label = SWING_POINT_SEQUENCE[nextPointIndex];
      const newPt: SwingPoint = { label, x, y, color: POINT_COLORS[label] };

      triggerHaptic("medium");
      const updated = [...markedPoints, newPt];
      setMarkedPoints(updated);
      const newIdx = nextPointIndex + 1;
      setNextPointIndex(newIdx);

      if (newIdx >= 4) {
        setStatus("drawn");
        toast.success("Plane mapped — ready for coaching");
      } else {
        toast(`Tap: ${POINT_LABELS[SWING_POINT_SEQUENCE[newIdx]]}`, { duration: 2000 });
      }
    },
    [status, nextPointIndex, markedPoints]
  );

  // ── File handling ─────────────────────────────────────
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) { toast.error("Please select a video file"); return; }
    triggerHaptic("soft");
    setStatus("video-selected");
    setStreamingText("");
    setMarkedPoints([]);
    setNextPointIndex(0);
    setPlaneAngle(null);
    setVideoPreviewUrl(URL.createObjectURL(file));
  };

  const handleStartDrawing = () => {
    videoRef.current?.pause();
    setIsPlaying(false);
    triggerHaptic("medium");
    setMarkedPoints([]);
    setNextPointIndex(0);
    setPlaneAngle(null);
    setStatus("drawing");
    setTimeout(syncCanvasSize, 50);
    toast("Tap your Address position on the video", { duration: 3000 });
  };

  const handleUndoLastPoint = () => {
    if (markedPoints.length === 0) return;
    triggerHaptic("light");
    const updated = markedPoints.slice(0, -1);
    setMarkedPoints(updated);
    setNextPointIndex(updated.length);
    if (status === "drawn") setStatus("drawing");
  };

  // ── AI coaching ───────────────────────────────────────
  const buildSwingPrompt = (): string => {
    const planeInfo = markedPoints.length >= 2 ? `
SWING PLANE DATA (from canvas overlay):
Positions marked on paused video frame (0% = top/left, 100% = bottom/right):
- Address: x=${(markedPoints[0].x * 100).toFixed(0)}%, y=${(markedPoints[0].y * 100).toFixed(0)}%
${markedPoints[1] ? `- Top of Backswing: x=${(markedPoints[1].x * 100).toFixed(0)}%, y=${(markedPoints[1].y * 100).toFixed(0)}%` : ""}
${markedPoints[2] ? `- Impact: x=${(markedPoints[2].x * 100).toFixed(0)}%, y=${(markedPoints[2].y * 100).toFixed(0)}%` : ""}
${markedPoints[3] ? `- Follow-Through: x=${(markedPoints[3].x * 100).toFixed(0)}%, y=${(markedPoints[3].y * 100).toFixed(0)}%` : ""}
Computed swing plane angle from best-fit line: ${planeAngle ?? "N/A"}° from horizontal.

Interpretation guide:
- If Impact X is notably lower than Address X (club moved leftward), suggests over-the-top path.
- Steep plane (>35°): choppy, arms-dominant, often leads to pulls and fat shots mentally tied to overthinking.
- Flat plane (<15°): arms-only, limited shoulder rotation.
- On-plane (15-35°): solid range, typically more consistent delivery.
- High Y at Top means hands went deep; Low Y suggests flat backswing.
` : "";

    return `You are an expert mental golf coach and swing analyst. A golfer has reviewed their swing${markedPoints.length >= 2 ? " using plane tracking" : ""}.
${planeInfo}
${userObservations.trim() ? `What the golfer described: "${userObservations.trim()}"` : ""}

Provide focused coaching with these exact headers:
**Swing Plane Assessment:**
**Tempo & Commitment:**
**Pre-Shot Routine:**
**Mental Cue for This Pattern:**
**One Change to Try:**

Be specific about what the data or description reveals. Reference the plane angle where relevant. Keep it actionable and mentally focused. Under 300 words total.`;
  };

  const handleGetCoaching = async () => {
    if (markedPoints.length < 2 && !userObservations.trim()) {
      toast.error("Mark at least 2 swing positions, or describe your swing below");
      return;
    }
    triggerHaptic("medium");
    setStatus("analyzing");
    setStreamingText("");

    const messages: ChatMessage[] = [{ role: "user", content: buildSwingPrompt() }];
    currentAbortController.current = new AbortController();

    streamCoachResponse({
      messages,
      context: "coach",
      signal: currentAbortController.current.signal,
      onDelta: (delta) => setStreamingText((prev) => prev + delta),
      onDone: () => { setStatus("complete"); currentAbortController.current = null; triggerHaptic("soft"); },
      onError: (error) => { setStatus("error"); currentAbortController.current = null; toast.error(error || "Something went wrong"); },
    });
  };

  const resetBreakdown = () => {
    cancelActiveRequest();
    triggerHaptic("soft");
    setVideoPreviewUrl(null);
    setUserObservations("");
    setStreamingText("");
    setMarkedPoints([]);
    setNextPointIndex(0);
    setPlaneAngle(null);
    setStatus("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const nextLabel = SWING_POINT_SEQUENCE[nextPointIndex];

  const renderCoachingResult = () => {
    if (!streamingText) return null;
    return (
      <GlassCard className="space-y-3 p-5">
        <div className="space-y-2 text-sm leading-6 text-[var(--text-0)]">
          {streamingText.split("\n").map((line, idx) => {
            if (line.startsWith("**") && line.endsWith("**")) {
              return <p key={idx} className="mt-3 font-semibold text-[var(--sand-0)] first:mt-0">{line.replaceAll("**", "")}</p>;
            }
            return line.trim() ? <p key={idx}>{line}</p> : null;
          })}
        </div>
      </GlassCard>
    );
  };

  return (
    <PageShell backgroundVariant="default">
      <AppShell
        className="mx-auto w-full max-w-3xl"
        header={
          <AppHeader
            left={
              <button onClick={() => { triggerHaptic("light"); navigate("/"); }} className="tap-44 flex items-center justify-center text-[var(--text-0)]">
                <ArrowLeft className="h-5 w-5" />
              </button>
            }
            center={
              <div>
                <h1 className="font-serif text-[23px] leading-tight tracking-wide text-[var(--text-0)]">Swing Breakdown</h1>
                <p className="truncate text-[11px] uppercase tracking-[0.14em] text-[var(--text-1)]">Plane analysis · mental coaching</p>
              </div>
            }
            right={<div className="tap-44" />}
          />
        }
      >
        <div className="with-bottom-dock space-y-5 overflow-y-auto px-5 pb-8 pt-5">

          {/* ── IDLE ─────────────────────────────────── */}
          {status === "idle" && (
            <div className="space-y-4">
              <GlassCard className="p-4">
                <div className="flex gap-3">
                  <Eye className="h-5 w-5 shrink-0 text-[var(--sand-0)]" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[var(--text-0)]">Map your swing plane. Get real coaching.</p>
                    <p className="text-xs text-[var(--text-1)]">Upload a swing video, pause it, then tap 4 positions to draw your plane line. The AI uses the angle data to give targeted mental coaching.</p>
                  </div>
                </div>
              </GlassCard>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="calm-pro-press group w-full overflow-hidden rounded-2xl border-2 border-dashed border-[rgba(203,184,146,0.3)] bg-[rgba(203,184,146,0.05)] p-8 transition-all hover:border-[rgba(203,184,146,0.5)]"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(203,184,146,0.2)]">
                    <Upload className="h-6 w-6 text-[var(--sand-0)]" />
                  </div>
                  <div className="space-y-1 text-center">
                    <p className="font-medium text-[var(--text-0)]">Upload swing video</p>
                    <p className="text-xs text-[var(--text-1)]">From camera roll, or record new</p>
                  </div>
                </div>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-[rgba(255,255,255,0.08)]" />
                <p className="text-xs text-[var(--text-1)] opacity-50">or</p>
                <div className="flex-1 border-t border-[rgba(255,255,255,0.08)]" />
              </div>

              <button
                onClick={() => { triggerHaptic("soft"); setStatus("video-selected"); }}
                className="calm-pro-press w-full rounded-2xl border border-[rgba(203,184,146,0.15)] bg-[rgba(203,184,146,0.05)] px-5 py-4 text-center text-sm text-[var(--text-1)]"
              >
                Skip video — describe from memory
              </button>
            </div>
          )}

          {/* ── VIDEO + CANVAS ─────────────────────── */}
          {(status === "video-selected" || status === "drawing" || status === "drawn") && (
            <div className="space-y-4">
              {videoPreviewUrl && (
                <>
                  {/* Video with canvas overlay */}
                  <div className="relative overflow-hidden rounded-2xl bg-black" style={{ maxHeight: 300 }}>
                    <video
                      ref={videoRef}
                      src={videoPreviewUrl}
                      className="w-full"
                      style={{ maxHeight: 300, display: "block" }}
                      onLoadedMetadata={syncCanvasSize}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      playsInline
                    />
                    <canvas
                      ref={canvasRef}
                      className={cn(
                        "absolute inset-0 h-full w-full",
                        status === "drawing" ? "cursor-crosshair" : "pointer-events-none"
                      )}
                      style={{ touchAction: status === "drawing" ? "none" : "auto" }}
                      onClick={handleCanvasTap}
                      onTouchEnd={(e) => { e.preventDefault(); handleCanvasTap(e); }}
                    />
                    {/* Play/pause — hidden while drawing */}
                    {status !== "drawing" && (
                      <button
                        onClick={togglePlayPause}
                        className="absolute bottom-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm"
                      >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                    )}
                  </div>

                  {/* Drawing mode UI */}
                  {status === "drawing" && (
                    <GlassCard className="p-4">
                      <div className="space-y-3">
                        {/* Progress dots */}
                        <div className="flex items-center justify-between gap-1">
                          {SWING_POINT_SEQUENCE.map((label, i) => (
                            <div key={label} className="flex flex-1 flex-col items-center gap-1">
                              <div
                                className={cn(
                                  "h-2.5 w-2.5 rounded-full border-2 transition-all",
                                  i < markedPoints.length ? "border-transparent" :
                                  i === markedPoints.length ? "border-[var(--sand-0)] animate-pulse" :
                                  "border-white/20"
                                )}
                                style={{ backgroundColor: i < markedPoints.length ? POINT_COLORS[label] : undefined }}
                              />
                              <p className={cn("text-[9px] text-center leading-tight", i === markedPoints.length ? "text-[var(--sand-0)] font-medium" : "text-[var(--text-1)] opacity-40")}>
                                {label}
                              </p>
                            </div>
                          ))}
                        </div>
                        <p className="text-center text-sm font-medium text-[var(--sand-0)]">
                          {nextPointIndex < 4 ? `Tap: ${POINT_LABELS[nextLabel]}` : "All 4 points marked"}
                        </p>
                        <p className="text-center text-xs text-[var(--text-1)]">Pause the video first, then tap each position</p>
                        {markedPoints.length > 0 && (
                          <button onClick={handleUndoLastPoint} className="flex w-full items-center justify-center gap-1.5 py-1 text-xs text-[var(--text-1)]">
                            <RotateCcw className="h-3 w-3" /> Undo last point
                          </button>
                        )}
                      </div>
                    </GlassCard>
                  )}

                  {/* Plane angle display after 4 points */}
                  {status === "drawn" && planeAngle !== null && (
                    <GlassCard className="flex items-center justify-between gap-4 p-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-1)]">Swing plane angle</p>
                        <p className="text-2xl font-serif text-[var(--sand-0)]">{planeAngle}°</p>
                        <p className="text-xs text-[var(--text-1)]">
                          {planeAngle > 35 ? "Steep — over-the-top tendency" : planeAngle < 15 ? "Flat — limited shoulder turn" : "On-plane — solid range"}
                        </p>
                      </div>
                      <button onClick={handleStartDrawing} className="rounded-xl border border-[rgba(203,184,146,0.2)] px-3 py-2 text-xs text-[var(--text-1)]">
                        Redo
                      </button>
                    </GlassCard>
                  )}

                  {/* Draw plane CTA */}
                  {status === "video-selected" && (
                    <PillButton tone="sand" onClick={handleStartDrawing} className="w-full">
                      <Crosshair className="mr-2 h-4 w-4" />
                      Draw Swing Plane (4 taps)
                    </PillButton>
                  )}
                </>
              )}

              {/* Observations */}
              {(status === "video-selected" || status === "drawn") && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[var(--text-0)]">What did you notice? <span className="text-[var(--text-1)] font-normal">(optional)</span></label>
                  <textarea
                    value={userObservations}
                    onChange={(e) => setUserObservations(e.target.value)}
                    placeholder="Felt rushed on takeaway, lost commitment through impact, tension in shoulders..."
                    className="w-full rounded-xl border border-[rgba(203,184,146,0.2)] bg-[rgba(5,8,7,0.5)] p-3 text-sm text-[var(--text-0)] placeholder-[var(--text-1)] focus:outline-none focus:ring-2 focus:ring-[var(--sand-0)]"
                    rows={4}
                  />
                </div>
              )}

              {/* Text-only path (no video) */}
              {!videoPreviewUrl && status === "video-selected" && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[var(--text-0)]">Describe your swing from memory</label>
                  <textarea
                    value={userObservations}
                    onChange={(e) => setUserObservations(e.target.value)}
                    placeholder="Rushed takeaway, didn't commit fully, felt tight in shoulders at impact..."
                    className="w-full rounded-xl border border-[rgba(203,184,146,0.2)] bg-[rgba(5,8,7,0.5)] p-3 text-sm text-[var(--text-0)] placeholder-[var(--text-1)] focus:outline-none focus:ring-2 focus:ring-[var(--sand-0)]"
                    rows={5}
                  />
                </div>
              )}

              {(status === "video-selected" || status === "drawn") && (
                <PillButton
                  tone="green"
                  onClick={handleGetCoaching}
                  className="w-full"
                  disabled={markedPoints.length < 2 && !userObservations.trim()}
                >
                  Get Mental Coaching
                </PillButton>
              )}

              <PillButton tone="sand" onClick={resetBreakdown} className="w-full">Start Over</PillButton>
            </div>
          )}

          {/* ── ANALYZING ─────────────────────────── */}
          {status === "analyzing" && (
            <div className="space-y-4">
              {planeAngle !== null && (
                <GlassCard className="flex items-center gap-3 p-4">
                  <div className="h-2 w-2 rounded-full bg-[var(--sand-0)] opacity-70" />
                  <p className="text-sm text-[var(--text-1)]">Analyzing {planeAngle}° plane…</p>
                </GlassCard>
              )}
              <GlassCard className="flex flex-col items-center gap-3 p-6">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--sand-0)]" />
                <p className="text-sm text-[var(--text-1)]">Writing your coaching…</p>
              </GlassCard>
              <PillButton tone="sand" onClick={cancelActiveRequest} className="w-full">Cancel</PillButton>
            </div>
          )}

          {/* ── COMPLETE ──────────────────────────── */}
          {status === "complete" && (
            <div className="space-y-4">
              {planeAngle !== null && (
                <div className="flex items-center gap-2 rounded-xl border border-[rgba(203,184,146,0.2)] bg-[rgba(203,184,146,0.06)] px-4 py-2.5">
                  <Crosshair className="h-4 w-4 text-[var(--sand-0)]" />
                  <p className="text-sm text-[var(--text-0)]">
                    Swing plane: <span className="font-medium text-[var(--sand-0)]">{planeAngle}°</span>
                    {" — "}{planeAngle > 35 ? "steep" : planeAngle < 15 ? "flat" : "on-plane"}
                  </p>
                </div>
              )}
              {renderCoachingResult()}
              <PillButton tone="green" onClick={resetBreakdown} className="w-full">New Breakdown</PillButton>
              <PillButton tone="sand" onClick={() => { triggerHaptic("light"); navigate("/"); }} className="w-full">Back to Home</PillButton>
            </div>
          )}

          {/* ── ERROR ─────────────────────────────── */}
          {status === "error" && (
            <GlassCard className="flex flex-col items-center gap-3 p-6 text-center">
              <p className="text-sm text-[var(--text-0)]">Something went wrong. Your plane data is still saved.</p>
              <PillButton tone="green" onClick={handleGetCoaching} className="w-full">Try Again</PillButton>
              <PillButton tone="sand" onClick={resetBreakdown} className="w-full">Start Over</PillButton>
            </GlassCard>
          )}

          <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileSelected} className="hidden" />
        </div>
      </AppShell>
    </PageShell>
  );
};

export default SwingAnalysis;
