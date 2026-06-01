import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Loader2, Zap } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { AppShell } from "@/components/ui/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { PillButton } from "@/components/ui/pill-button";
import { GlassCard } from "@/components/ui/glass-card";
import { streamCoachResponse, type ChatMessage } from "@/lib/mentalCoachApi";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Capacitor, CameraResultType, CameraSource } from "@capacitor/core";

type AnalysisStatus = "idle" | "video-selected" | "analyzing" | "complete" | "error";

interface AnalysisResult {
  tempo: string;
  preShot: string;
  bodyLanguage: string;
  confidence: string;
  postShot: string;
}

const SwingAnalysis = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [userObservations, setUserObservations] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const currentAbortController = useRef<AbortController | null>(null);

  const cancelActiveRequest = useCallback(() => {
    currentAbortController.current?.abort();
    currentAbortController.current = null;
  }, []);

  const handleVideoCapture = async () => {
    triggerHaptic("medium");

    // Try native camera first on iOS/Android
    if (Capacitor.isNativePlatform()) {
      try {
        const Camera = (
          (Capacitor as unknown as { Plugins?: Record<string, unknown> }).Plugins
            ?.Camera as
          | {
              getPhoto?: (options: {
                quality: number;
                resultType: CameraResultType;
                source: CameraSource;
              }) => Promise<{ webPath?: string; path?: string }>;
            }
          | undefined
        );

        if (Camera?.getPhoto) {
          // For native, show file picker or camera options
          // For simplicity, falling back to file input
          fileInputRef.current?.click();
          return;
        }
      } catch {
        // fallback to file input below
      }
    }

    // Fall back to file input on web
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }

    triggerHaptic("soft");
    setVideoFile(file);
    setStatus("video-selected");
    setStreamingText("");
    setAnalysisResult(null);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);
  };

  const handleAnalyzeSwing = async () => {
    if (!userObservations.trim()) {
      toast.error("Please describe what you notice about your swing");
      return;
    }

    triggerHaptic("medium");
    setStatus("analyzing");
    setStreamingText("");
    setAnalysisResult(null);

    const prompt = `You are an expert mental golf coach analyzing a golfer's swing video. Based on the golfer's observations below, provide detailed mental coaching feedback. Focus ONLY on mental aspects - NOT mechanics:

- Tempo & Rhythm (rushed vs smooth, controlled pace)
- Pre-Shot Routine (consistency, ritual quality, routine stability)
- Body Language & Tension (visible tension, confidence in posture, relaxation cues)
- Setup Confidence (trust at address, commitment level, focus quality)
- Post-Shot Reaction (acceptance vs frustration, composure, moving forward mentally)

The golfer reports:
"${userObservations}"

Provide coaching insights for each area. Format your response with these headers:
**Tempo & Rhythm:**
**Pre-Shot Routine:**
**Body Language & Tension:**
**Setup Confidence:**
**Post-Shot Reaction:**
**Mental Coaching Tip:**

Be specific, actionable, and encouraging.`;

    const messages: ChatMessage[] = [
      {
        role: "user",
        content: prompt,
      },
    ];

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
        toast.success("Analysis complete");
      },
      onError: (error) => {
        setStatus("error");
        currentAbortController.current = null;
        toast.error(error || "Failed to analyze swing");
        console.error("Analysis error:", error);
      },
    });
  };

  const handleBackClick = () => {
    triggerHaptic("light");
    navigate("/");
  };

  const resetAnalysis = () => {
    triggerHaptic("soft");
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setUserObservations("");
    setAnalysisResult(null);
    setStreamingText("");
    setStatus("idle");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
                  Swing Analysis
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
              <Zap className="h-5 w-5 shrink-0 text-[var(--sand-0)]" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-[var(--text-0)]">
                  Mental Swing Analysis
                </p>
                <p className="text-xs text-[var(--text-1)]">
                  We analyze tempo, routine, body language, confidence, and composure — not
                  mechanics.
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Video Upload Section */}
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
                  <div className="space-y-1">
                    <p className="font-medium text-[var(--text-0)]">Upload or record a swing</p>
                    <p className="text-xs text-[var(--text-1)]">
                      Select from camera roll or record a new video
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

              <p className="text-center text-xs text-[var(--text-1)] opacity-60">
                Video should be 15–60 seconds and show your full swing from address to finish
              </p>
            </div>
          )}

          {/* Video Selected & Analysis Form */}
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
                </GlassCard>
              )}

              {/* Observations Prompt */}
              {status !== "complete" && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-[var(--text-0)]">
                    What do you notice about your swing?
                  </label>
                  <p className="text-xs text-[var(--text-1)]">
                    Describe your observations: Did the tempo feel rushed or smooth? Was your
                    routine consistent? Notice any tension? Did you trust your setup?
                  </p>
                  <textarea
                    value={userObservations}
                    onChange={(e) => setUserObservations(e.target.value)}
                    placeholder="I felt rushed on my takeaway but stayed committed to my target..."
                    disabled={status === "analyzing"}
                    className={cn(
                      "w-full rounded-xl border border-[rgba(203,184,146,0.2)] bg-[rgba(5,8,7,0.5)] p-3 text-sm text-[var(--text-0)] placeholder-[var(--text-1)] focus:outline-none focus:ring-2 focus:ring-[var(--sand-0)]",
                      status === "analyzing" && "opacity-60"
                    )}
                    rows={4}
                  />
                </div>
              )}

              {/* Analysis Results */}
              {status === "complete" && streamingText && (
                <GlassCard className="space-y-4 p-5">
                  <div className="space-y-3 whitespace-pre-wrap text-sm leading-6 text-[var(--text-0)]">
                    {streamingText.split("\n").map((line, idx) => (
                      <div key={idx}>
                        {line.startsWith("**") && line.endsWith("**") ? (
                          <p className="font-semibold text-[var(--sand-0)]">{line}</p>
                        ) : (
                          <p>{line}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}

              {/* Loading State */}
              {status === "analyzing" && (
                <GlassCard className="flex flex-col items-center gap-3 p-6">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--sand-0)]" />
                  <p className="text-sm text-[var(--text-1)]">Analyzing your swing…</p>
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
                      onClick={handleAnalyzeSwing}
                      className="w-full"
                      disabled={!userObservations.trim()}
                    >
                      Analyze My Swing
                    </PillButton>
                    <PillButton tone="sand" onClick={resetAnalysis} className="w-full">
                      Choose Different Video
                    </PillButton>
                  </>
                )}

                {status === "complete" && (
                  <>
                    <PillButton
                      tone="green"
                      onClick={resetAnalysis}
                      className="w-full"
                    >
                      Analyze Another Swing
                    </PillButton>
                    <PillButton
                      tone="sand"
                      onClick={handleBackClick}
                      className="w-full"
                    >
                      Back to Home
                    </PillButton>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </PageShell>
  );
};

export default SwingAnalysis;
