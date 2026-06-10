import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Loader2, Eye } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { AppShell } from "@/components/ui/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { PillButton } from "@/components/ui/pill-button";
import { GlassCard } from "@/components/ui/glass-card";
import { streamCoachResponse, type ChatMessage } from "@/lib/mentalCoachApi";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// "Swing Breakdown" — honest version.
// The AI is NOT doing vision analysis. It reads the golfer's own text description
// and gives mental coaching back. The video upload is purely for the golfer's
// own reference while they write their observations.

type BreakdownStatus = "idle" | "video-selected" | "analyzing" | "complete" | "error";

const SwingAnalysis = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const [status, setStatus] = useState<BreakdownStatus>("idle");
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [userObservations, setUserObservations] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const currentAbortController = useRef<AbortController | null>(null);

  const cancelActiveRequest = useCallback(() => {
    currentAbortController.current?.abort();
    currentAbortController.current = null;
  }, []);

  const handleVideoCapture = () => {
    triggerHaptic("medium");
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }

    triggerHaptic("soft");
    setStatus("video-selected");
    setStreamingText("");

    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);
  };

  const handleGetCoaching = async () => {
    if (!userObservations.trim()) {
      // Scroll the textarea into view and focus it
      const textarea = document.getElementById("swing-observations-textarea");
      if (textarea) {
        textarea.scrollIntoView({ behavior: "smooth", block: "center" });
        (textarea as HTMLTextAreaElement).focus();
      }
      toast.error("Describe what you noticed — even a few words helps");
      return;
    }

    triggerHaptic("medium");
    setStatus("analyzing");
    setStreamingText("");

    const prompt = `You are an expert mental golf coach. A golfer has just watched their swing and described what they observed. Based on their description, provide detailed mental coaching feedback — focused ONLY on the mental side, not swing mechanics.

Cover these areas based on what they described:
- Tempo & Rhythm (rushed vs smooth, controlled pace)
- Pre-Shot Routine (consistency, ritual quality, routine stability)
- Body Language & Tension (tension patterns, confidence in posture, relaxation cues)
- Setup Confidence (trust at address, commitment level, focus quality)
- Post-Shot Reaction (acceptance vs frustration, composure, moving forward)

The golfer described:
"${userObservations}"

Format your response with these exact headers:
**Tempo & Rhythm:**
**Pre-Shot Routine:**
**Body Language & Tension:**
**Setup Confidence:**
**Post-Shot Reaction:**
**Key Mental Focus:**

Be specific, actionable, and grounded in what they described. Don't invent details they didn't mention.`;

    const messages: ChatMessage[] = [{ role: "user", content: prompt }];

    currentAbortController.current = new AbortController();

    streamCoachResponse({
      messages,
      context: "coach",
      signal: currentAbortController.current.signal,
      onDelta: (deltaText) => {
        setStreamingText((prev) => prev + deltaText);
      },
      onDone: () => {
        setStatus("complete");
        currentAbortController.current = null;
        toast.success("Coaching ready");
      },
      onError: (error) => {
        setStatus("error");
        currentAbortController.current = null;
        toast.error(error || "Something went wrong — try again");
      },
    });
  };

  const handleBackClick = () => {
    triggerHaptic("light");
    navigate("/");
  };

  const resetBreakdown = () => {
    triggerHaptic("soft");
    setVideoPreviewUrl(null);
    setUserObservations("");
    setStreamingText("");
    setStatus("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Allow coaching without a video upload — text-only path
  const handleSkipVideo = () => {
    triggerHaptic("soft");
    setStatus("video-selected");
  };

  return (
    <PageShell backgroundVariant="default">
      <AppShell
        className="mx-auto w-full max-w-3xl"
        header={
          <AppHeader
            left={
              <button
                onClick={handleBackClick}
                className="tap-44 flex items-center justify-center text-[var(--text-0)]"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            }
            center={
              <div>
                <h1 className="font-serif text-[23px] leading-tight tracking-wide text-[var(--text-0)]">
                  Swing Breakdown
                </h1>
                <p className="truncate text-[11px] uppercase tracking-[0.14em] text-[var(--text-1)]">
                  Mental coaching
                </p>
              </div>
            }
            right={<div className="tap-44" />}
          />
        }
      >
        <div className="with-bottom-dock space-y-5 overflow-y-auto px-5 pb-8 pt-5">
          {/* Info Card */}
          <GlassCard className="p-4">
            <div className="flex gap-3">
              <Eye className="h-5 w-5 shrink-0 text-[var(--sand-0)]" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-[var(--text-0)]">
                  Describe your swing. Get mental coaching.
                </p>
                <p className="text-xs text-[var(--text-1)]">
                  Watch your swing, note what you observe — tempo, routine, tension, commitment — then your coach gives you mental feedback based on your description.
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Video Upload Section (optional) */}
          {status === "idle" && (
            <div className="space-y-4">
              <button
                onClick={handleVideoCapture}
                className="calm-pro-press group w-full overflow-hidden rounded-2xl border-2 border-dashed border-[rgba(203,184,146,0.3)] bg-[rgba(203,184,146,0.05)] p-8 transition-all hover:border-[rgba(203,184,146,0.5)] hover:bg-[rgba(203,184,146,0.1)]"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(203,184,146,0.2)]">
                    <Upload className="h-6 w-6 text-[var(--sand-0)]" />
                  </div>
                  <div className="space-y-1 text-center">
                    <p className="font-medium text-[var(--text-0)]">Upload a swing video to review</p>
                    <p className="text-xs text-[var(--text-1)]">
                      Watch it back, then describe what you notice below
                    </p>
                  </div>
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelected}
                className="hidden"
              />

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-[rgba(255,255,255,0.08)]" />
                <p className="text-xs text-[var(--text-1)] opacity-50">or</p>
                <div className="flex-1 border-t border-[rgba(255,255,255,0.08)]" />
              </div>

              <button
                onClick={handleSkipVideo}
                className="calm-pro-press w-full rounded-2xl border border-[rgba(203,184,146,0.15)] bg-[rgba(203,184,146,0.05)] px-5 py-4 text-center text-sm text-[var(--text-1)] transition-all hover:bg-[rgba(203,184,146,0.08)]"
              >
                Skip video — describe from memory
              </button>
            </div>
          )}

          {/* Observation form + results */}
          {(status === "video-selected" || status === "analyzing" || status === "complete") && (
            <div className="space-y-5">
              {/* Video Preview */}
              {videoPreviewUrl && (
                <GlassCard className="overflow-hidden p-0">
                  <video
                    ref={videoPreviewRef}
                    src={videoPreviewUrl}
                    controls
                    className="w-full rounded-2xl bg-black"
                    style={{ maxHeight: "300px" }}
                  />
                  <p className="px-4 py-2 text-center text-[10px] uppercase tracking-[0.14em] text-[var(--text-1)] opacity-50">
                    Watch your swing, then describe what you notice below
                  </p>
                </GlassCard>
              )}

              {/* Observations Prompt */}
              {status !== "complete" && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-[var(--text-0)]">
                    What did you notice?
                  </label>
                  <p className="text-xs text-[var(--text-1)]">
                    Focus on feel and mental state, not mechanics. Did the tempo feel rushed? Was your routine consistent? Did you trust the shot? Any tension in your setup?
                  </p>
                  <textarea
                    id="swing-observations-textarea"
                    value={userObservations}
                    onChange={(e) => setUserObservations(e.target.value)}
                    placeholder="I felt rushed on my takeaway, didn't fully commit to the target, felt a little tight in my shoulders..."
                    disabled={status === "analyzing"}
                    className={cn(
                      "w-full rounded-xl border border-[rgba(203,184,146,0.2)] bg-[rgba(5,8,7,0.5)] p-3 text-sm text-[var(--text-0)] placeholder-[var(--text-1)] focus:outline-none focus:ring-2 focus:ring-[var(--sand-0)]",
                      status === "analyzing" && "opacity-60"
                    )}
                    rows={4}
                  />
                </div>
              )}

              {/* Streaming Results */}
              {status === "complete" && streamingText && (
                <GlassCard className="space-y-4 p-5">
                  <div className="space-y-3 whitespace-pre-wrap text-sm leading-6 text-[var(--text-0)]">
                    {streamingText.split("\n").map((line, idx) => (
                      <div key={idx}>
                        {line.startsWith("**") && line.endsWith("**") ? (
                          <p className="font-semibold text-[var(--sand-0)]">{line.replaceAll("**", "")}</p>
                        ) : (
                          <p>{line}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}

              {/* Loading */}
              {status === "analyzing" && (
                <GlassCard className="flex flex-col items-center gap-3 p-6">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--sand-0)]" />
                  <p className="text-sm text-[var(--text-1)]">Writing your coaching…</p>
                </GlassCard>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {status === "analyzing" && (
                  <PillButton tone="sand" onClick={cancelActiveRequest} className="w-full">
                    Cancel
                  </PillButton>
                )}

                {status === "video-selected" && (
                  <>
                    <PillButton
                      tone="green"
                      onClick={handleGetCoaching}
                      className="w-full"
                      disabled={!userObservations.trim()}
                    >
                      Get Mental Coaching
                    </PillButton>
                    {videoPreviewUrl && (
                      <PillButton tone="sand" onClick={resetBreakdown} className="w-full">
                        Choose Different Video
                      </PillButton>
                    )}
                  </>
                )}

                {status === "complete" && (
                  <>
                    <PillButton tone="green" onClick={resetBreakdown} className="w-full">
                      New Breakdown
                    </PillButton>
                    <PillButton tone="sand" onClick={handleBackClick} className="w-full">
                      Back to Home
                    </PillButton>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Error state */}
          {status === "error" && (
            <GlassCard className="flex flex-col items-center gap-3 p-6 text-center">
              <p className="text-sm text-[var(--text-0)]">Something went wrong. Your description is still there.</p>
              <PillButton tone="green" onClick={handleGetCoaching} className="w-full">
                Try Again
              </PillButton>
            </GlassCard>
          )}
        </div>
      </AppShell>
    </PageShell>
  );
};

export default SwingAnalysis;
