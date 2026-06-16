/**
 * MentalGPS — GPS Rangefinder + Mental Pattern Tracker
 *
 * Two panels:
 * 1. Rangefinder: yardage to pin (manual input + device GPS) + wind + club suggestion
 * 2. Shot Logger: tap-to-log tee shot, lie, putt result, emotional tag per hole
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Navigation,
  Wind,
  Target,
  ChevronLeft,
  ChevronRight,
  Check,
  MapPin,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { AppShell } from "@/components/ui/AppShell";
import { AppHeader } from "@/components/ui/AppHeader";
import { GlassCard } from "@/components/ui/glass-card";
import { PillButton } from "@/components/ui/pill-button";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  logHoleShot,
  getHoleShot,
  loadActivePatternRound,
  startPatternRound,
  completePatternRound,
  type TeeResult,
  type PuttResult,
  type EmotionalTag,
  type LieType,
} from "@/lib/gpsPatternStorage";
import { loadRoundContext } from "@/lib/roundContext";
import { loadActiveRoundSession } from "@/lib/roundSession";

/* ─── Club distances (baseline at sea level, no wind) ──── */
const CLUB_SUGGESTIONS: { club: string; min: number; max: number }[] = [
  { club: "Driver", min: 220, max: 320 },
  { club: "3-wood", min: 190, max: 260 },
  { club: "5-wood", min: 175, max: 230 },
  { club: "3-hybrid", min: 165, max: 215 },
  { club: "4-iron", min: 155, max: 200 },
  { club: "5-iron", min: 145, max: 185 },
  { club: "6-iron", min: 135, max: 170 },
  { club: "7-iron", min: 125, max: 158 },
  { club: "8-iron", min: 115, max: 148 },
  { club: "9-iron", min: 105, max: 138 },
  { club: "PW", min: 90, max: 120 },
  { club: "GW/AW", min: 75, max: 105 },
  { club: "SW", min: 55, max: 85 },
  { club: "LW", min: 40, max: 70 },
  { club: "Putter", min: 0, max: 30 },
];

function suggestClub(yards: number, windMph: number, windDir: "headwind" | "tailwind" | "crosswind" | "none"): string {
  // Adjust yardage for wind
  let adjusted = yards;
  if (windDir === "headwind") adjusted += Math.round(windMph * 0.8);
  if (windDir === "tailwind") adjusted -= Math.round(windMph * 0.7);

  const match = CLUB_SUGGESTIONS.find((c) => adjusted >= c.min && adjusted <= c.max);
  if (!match) return adjusted > 300 ? "Driver" : "Putter";
  return match.club;
}

/* ─── Wind directions ────────────────────────────────────── */
type WindDir = "none" | "headwind" | "tailwind" | "crosswind";
const WIND_DIRS: { id: WindDir; label: string; icon: string }[] = [
  { id: "none", label: "Calm", icon: "—" },
  { id: "headwind", label: "Into", icon: "↑" },
  { id: "tailwind", label: "With", icon: "↓" },
  { id: "crosswind", label: "Cross", icon: "→" },
];

/* ─── Tap-to-log option sets ─────────────────────────────── */
const TEE_OPTIONS: { value: TeeResult; label: string; color: string }[] = [
  { value: "great", label: "Great drive", color: "rgba(31,180,100,0.9)" },
  { value: "fairway", label: "Fairway", color: "rgba(31,180,100,0.7)" },
  { value: "left-rough", label: "Left rough", color: "rgba(203,184,146,0.8)" },
  { value: "right-rough", label: "Right rough", color: "rgba(203,184,146,0.8)" },
  { value: "ob", label: "OB", color: "rgba(220,80,60,0.9)" },
];

const PUTT_OPTIONS: { value: PuttResult; label: string; color: string }[] = [
  { value: "made", label: "Made it", color: "rgba(31,180,100,0.9)" },
  { value: "rolled-past", label: "Rolled past", color: "rgba(203,184,146,0.8)" },
  { value: "short", label: "Left it short", color: "rgba(203,184,146,0.8)" },
  { value: "3-putt", label: "3-putt", color: "rgba(220,80,60,0.85)" },
  { value: "4-putt", label: "4-putt", color: "rgba(220,60,40,0.9)" },
];

const EMOTION_OPTIONS: { value: EmotionalTag; label: string; emoji: string }[] = [
  { value: "confident", label: "Confident", emoji: "💪" },
  { value: "focused", label: "Focused", emoji: "🎯" },
  { value: "nervous", label: "Nervous", emoji: "😬" },
  { value: "frustrated", label: "Frustrated", emoji: "😤" },
  { value: "distracted", label: "Distracted", emoji: "💭" },
];

/* ─── GPS hook ───────────────────────────────────────────── */
function useDeviceGPS() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError("GPS not available on this device");
      return;
    }
    setWatching(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setError(null);
      },
      (err) => {
        setError(err.message);
        setWatching(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWatching(false);
  }, []);

  useEffect(() => () => stopWatching(), [stopWatching]);

  return { coords, error, watching, startWatching, stopWatching };
}

/* ─── Main component ─────────────────────────────────────── */
const MentalGPS = () => {
  const navigate = useNavigate();
  const { coords, error: gpsError, watching, startWatching } = useDeviceGPS();

  // Current hole
  const [currentHole, setCurrentHole] = useState(1);
  // Active tab: rangefinder vs logger
  const [tab, setTab] = useState<"range" | "log">("range");

  // Rangefinder state
  const [yardageInput, setYardageInput] = useState("");
  const [windDir, setWindDir] = useState<WindDir>("none");
  const [windMph, setWindMph] = useState(0);
  // Pin coords (stored per-hole)
  const [pinCoords, setPinCoords] = useState<Record<number, { lat: number; lng: number }>>({});

  // Shot logger state — reads from gpsPatternStorage
  const [holeShot, setHoleShot] = useState(() => getHoleShot(1));
  const [selectedTee, setSelectedTee] = useState<TeeResult | null>(null);
  const [selectedPutt, setSelectedPutt] = useState<PuttResult | null>(null);
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionalTag | null>(null);

  // Ensure a pattern round is active
  useEffect(() => {
    if (!loadActivePatternRound()) {
      const session = loadActiveRoundSession();
      const ctx = loadRoundContext();
      startPatternRound(
        session?.roundId ?? `gps-${Date.now()}`,
        ctx?.location
      );
    }
  }, []);

  // Reload hole data when hole changes
  useEffect(() => {
    const shot = getHoleShot(currentHole);
    setHoleShot(shot);
    setSelectedTee(shot?.teeResult ?? null);
    setSelectedPutt(shot?.puttResult ?? null);
    setSelectedEmotion(shot?.emotionalTag ?? null);
  }, [currentHole]);

  // ── Rangefinder math ────────────────────────────────
  const yardage = parseInt(yardageInput, 10);
  const validYardage = !isNaN(yardage) && yardage > 0;

  // Distance from GPS to saved pin
  const gpsDistanceToPin = useCallback((): number | null => {
    const pin = pinCoords[currentHole];
    if (!pin || !coords) return null;
    const R = 6371000; // meters
    const dLat = ((pin.lat - coords.lat) * Math.PI) / 180;
    const dLng = ((pin.lng - coords.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((coords.lat * Math.PI) / 180) *
        Math.cos((pin.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round((R * c) / 0.9144); // convert meters → yards
  }, [pinCoords, currentHole, coords]);

  const gpsYards = gpsDistanceToPin();
  const displayYards = validYardage ? yardage : gpsYards;
  const clubSuggestion = displayYards ? suggestClub(displayYards, windMph, windDir) : null;

  const handleSetPin = () => {
    if (!coords) {
      toast.error("Stand at the pin, then tap Set Pin");
      return;
    }
    triggerHaptic("medium");
    setPinCoords((prev) => ({ ...prev, [currentHole]: coords }));
    toast.success(`Pin set for hole ${currentHole}`);
  };

  // ── Shot logger ─────────────────────────────────────
  const saveShot = (updates: {
    teeResult?: TeeResult;
    puttResult?: PuttResult;
    emotionalTag?: EmotionalTag;
  }) => {
    triggerHaptic("medium");
    const existing = getHoleShot(currentHole);
    const newShot = {
      holeNumber: currentHole,
      loggedAt: new Date().toISOString(),
      ...existing,
      yardageToPin: validYardage ? yardage : gpsYards ?? undefined,
      gpsLat: coords?.lat,
      gpsLng: coords?.lng,
      ...updates,
    };
    logHoleShot(newShot);
    setHoleShot(newShot);
  };

  const handleTeeSelect = (val: TeeResult) => {
    setSelectedTee(val);
    saveShot({ teeResult: val });
  };

  const handlePuttSelect = (val: PuttResult) => {
    setSelectedPutt(val);
    saveShot({ puttResult: val });
  };

  const handleEmotionSelect = (val: EmotionalTag) => {
    const newVal = selectedEmotion === val ? null : val;
    setSelectedEmotion(newVal);
    saveShot({ emotionalTag: newVal });
  };

  const handleHoleChange = (delta: number) => {
    const next = Math.max(1, Math.min(18, currentHole + delta));
    if (next === currentHole) return;
    triggerHaptic("light");
    setCurrentHole(next);
    setYardageInput("");
  };

  const handleFinishRound = () => {
    triggerHaptic("medium");
    completePatternRound();
    toast.success("Pattern data saved");
    navigate("/");
  };

  const loggedCount = loadActivePatternRound()?.holes.length ?? 0;

  return (
    <PageShell backgroundVariant="default">
      <AppShell
        className="mx-auto w-full max-w-3xl"
        header={
          <AppHeader
            left={
              <button
                onClick={() => { triggerHaptic("light"); navigate("/round"); }}
                className="tap-44 flex items-center justify-center text-[var(--text-0)]"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            }
            center={
              <div>
                <h1 className="font-serif text-[23px] leading-tight tracking-wide text-[var(--text-0)]">
                  Mental GPS
                </h1>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-1)]">
                  Rangefinder · Pattern Tracker
                </p>
              </div>
            }
            right={<div className="tap-44" />}
          />
        }
      >
        <div className="with-bottom-dock flex flex-col overflow-y-auto pb-6 pt-4">

          {/* ── Hole selector ─────────────────────── */}
          <div className="flex items-center justify-between gap-4 px-5 pb-4">
            <button
              onClick={() => handleHoleChange(-1)}
              disabled={currentHole <= 1}
              className="tap-44 flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(203,184,146,0.2)] bg-[rgba(203,184,146,0.06)] text-[var(--text-0)] disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-1)]">Hole</p>
              <p className="font-serif text-3xl text-[var(--text-0)]">{currentHole}</p>
              <p className="text-[10px] text-[var(--text-1)] opacity-50">{loggedCount} holes logged</p>
            </div>
            <button
              onClick={() => handleHoleChange(1)}
              disabled={currentHole >= 18}
              className="tap-44 flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(203,184,146,0.2)] bg-[rgba(203,184,146,0.06)] text-[var(--text-0)] disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* ── Tab selector ──────────────────────── */}
          <div className="mx-5 mb-4 flex rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] p-1">
            {(["range", "log"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { triggerHaptic("light"); setTab(t); }}
                className={cn(
                  "flex-1 rounded-xl py-2 text-sm font-medium transition-all",
                  tab === t
                    ? "bg-[rgba(203,184,146,0.15)] text-[var(--sand-0)]"
                    : "text-[var(--text-1)]"
                )}
              >
                {t === "range" ? "Rangefinder" : "Shot Logger"}
              </button>
            ))}
          </div>

          {/* ═════════════════ RANGEFINDER ═══════════ */}
          {tab === "range" && (
            <div className="space-y-4 px-5">

              {/* Yardage display */}
              <GlassCard glow className="p-5">
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-1)]">Distance to pin</p>
                    <p className="font-serif text-5xl text-[var(--sand-0)]">
                      {displayYards ?? "—"}
                    </p>
                    <p className="text-sm text-[var(--text-1)]">yards</p>
                  </div>

                  {/* Manual yardage input */}
                  <div>
                    <label className="mb-1 block text-xs text-[var(--text-1)]">Enter yardage manually</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={yardageInput}
                      onChange={(e) => setYardageInput(e.target.value)}
                      placeholder="e.g. 165"
                      className="w-full rounded-xl border border-[rgba(203,184,146,0.2)] bg-[rgba(5,8,7,0.5)] px-4 py-3 text-center text-lg font-medium text-[var(--text-0)] placeholder-[var(--text-1)] focus:outline-none focus:ring-2 focus:ring-[var(--sand-0)]"
                    />
                  </div>

                  {/* GPS distance if pin is set */}
                  {gpsYards !== null && (
                    <div className="flex items-center justify-between rounded-xl border border-[rgba(31,180,100,0.2)] bg-[rgba(31,180,100,0.06)] px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Navigation className="h-4 w-4 text-[rgba(31,180,100,0.9)]" />
                        <p className="text-sm text-[var(--text-0)]">GPS to pin</p>
                      </div>
                      <p className="font-medium text-[rgba(31,180,100,0.9)]">{gpsYards} yds</p>
                    </div>
                  )}
                </div>
              </GlassCard>

              {/* GPS controls */}
              <GlassCard className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[var(--text-0)]">GPS Pin</p>
                    <span className={cn("text-xs", watching ? "text-[rgba(31,180,100,0.9)]" : "text-[var(--text-1)]")}>
                      {watching ? "● Tracking" : "○ Off"}
                    </span>
                  </div>
                  {gpsError && <p className="text-xs text-[rgba(220,80,60,0.9)]">{gpsError}</p>}
                  {coords && (
                    <p className="text-xs text-[var(--text-1)]">
                      {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    </p>
                  )}
                  <div className="flex gap-2">
                    {!watching && (
                      <PillButton tone="sand" onClick={startWatching} className="flex-1 text-sm">
                        <Navigation className="mr-1.5 h-3.5 w-3.5" />
                        Start GPS
                      </PillButton>
                    )}
                    <PillButton
                      tone="green"
                      onClick={handleSetPin}
                      disabled={!coords}
                      className="flex-1 text-sm"
                    >
                      <MapPin className="mr-1.5 h-3.5 w-3.5" />
                      {pinCoords[currentHole] ? "Move Pin" : "Set Pin Here"}
                    </PillButton>
                  </div>
                  <p className="text-[10px] text-[var(--text-1)] opacity-60">
                    Walk to the pin flag and tap Set Pin. GPS distance updates as you move.
                  </p>
                </div>
              </GlassCard>

              {/* Wind */}
              <GlassCard className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Wind className="h-4 w-4 text-[var(--sand-0)]" />
                    <p className="text-sm font-medium text-[var(--text-0)]">Wind</p>
                  </div>

                  {/* Wind direction */}
                  <div className="flex gap-2">
                    {WIND_DIRS.map((wd) => (
                      <button
                        key={wd.id}
                        onClick={() => { triggerHaptic("light"); setWindDir(wd.id); }}
                        className={cn(
                          "flex flex-1 flex-col items-center gap-0.5 rounded-xl border py-2 text-xs transition-all",
                          windDir === wd.id
                            ? "border-[var(--sand-0)] bg-[rgba(203,184,146,0.12)] text-[var(--sand-0)]"
                            : "border-[rgba(255,255,255,0.08)] text-[var(--text-1)]"
                        )}
                      >
                        <span className="text-base">{wd.icon}</span>
                        <span>{wd.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Wind speed */}
                  {windDir !== "none" && (
                    <div>
                      <p className="mb-1 text-xs text-[var(--text-1)]">Speed: {windMph} mph</p>
                      <input
                        type="range"
                        min={0}
                        max={30}
                        value={windMph}
                        onChange={(e) => setWindMph(parseInt(e.target.value, 10))}
                        className="w-full accent-[var(--sand-0)]"
                      />
                    </div>
                  )}
                </div>
              </GlassCard>

              {/* Club suggestion */}
              {clubSuggestion && displayYards && (
                <GlassCard className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(203,184,146,0.12)]">
                        <Target className="h-5 w-5 text-[var(--sand-0)]" />
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-1)]">Suggested club</p>
                        <p className="text-lg font-medium text-[var(--text-0)]">{clubSuggestion}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[var(--text-1)]">
                        {windDir !== "none" && windMph > 0 ? `${windDir === "headwind" ? "+" : "-"}${Math.round(windMph * 0.75)} adj.` : "no wind adj."}
                      </p>
                      <p className="text-sm text-[var(--text-1)]">{displayYards} yds</p>
                    </div>
                  </div>
                </GlassCard>
              )}
            </div>
          )}

          {/* ═════════════════ SHOT LOGGER ═══════════ */}
          {tab === "log" && (
            <div className="space-y-4 px-5">

              {/* Tee shot */}
              <GlassCard className="p-4">
                <p className="mb-3 text-sm font-medium text-[var(--text-0)]">Tee shot</p>
                <div className="flex flex-wrap gap-2">
                  {TEE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleTeeSelect(opt.value)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-sm transition-all",
                        selectedTee === opt.value
                          ? "border-transparent text-white"
                          : "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-[var(--text-1)]"
                      )}
                      style={selectedTee === opt.value ? { backgroundColor: opt.color, borderColor: opt.color } : {}}
                    >
                      {selectedTee === opt.value && <Check className="mr-1 inline h-3.5 w-3.5" />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </GlassCard>

              {/* Putt result */}
              <GlassCard className="p-4">
                <p className="mb-3 text-sm font-medium text-[var(--text-0)]">Putting</p>
                <div className="flex flex-wrap gap-2">
                  {PUTT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handlePuttSelect(opt.value)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-sm transition-all",
                        selectedPutt === opt.value
                          ? "border-transparent text-white"
                          : "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-[var(--text-1)]"
                      )}
                      style={selectedPutt === opt.value ? { backgroundColor: opt.color, borderColor: opt.color } : {}}
                    >
                      {selectedPutt === opt.value && <Check className="mr-1 inline h-3.5 w-3.5" />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </GlassCard>

              {/* Emotional tag */}
              <GlassCard className="p-4">
                <p className="mb-1 text-sm font-medium text-[var(--text-0)]">Mental state this hole</p>
                <p className="mb-3 text-xs text-[var(--text-1)]">Optional — tap to toggle</p>
                <div className="flex flex-wrap gap-2">
                  {EMOTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleEmotionSelect(opt.value)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-all",
                        selectedEmotion === opt.value
                          ? "border-[rgba(203,184,146,0.5)] bg-[rgba(203,184,146,0.15)] text-[var(--sand-0)]"
                          : "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-[var(--text-1)]"
                      )}
                    >
                      <span>{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </GlassCard>

              {/* Saved indicator */}
              {holeShot && (
                <div className="flex items-center justify-center gap-2 text-sm text-[rgba(31,180,100,0.9)]">
                  <Check className="h-4 w-4" />
                  <span>Hole {currentHole} logged</span>
                </div>
              )}

              {/* Next hole */}
              {currentHole < 18 && (
                <PillButton
                  tone="sand"
                  onClick={() => handleHoleChange(1)}
                  className="w-full"
                >
                  Next hole →
                </PillButton>
              )}

              {loggedCount >= 3 && (
                <PillButton tone="green" onClick={handleFinishRound} className="w-full">
                  Finish & Save Patterns
                </PillButton>
              )}
            </div>
          )}
        </div>
      </AppShell>
    </PageShell>
  );
};

export default MentalGPS;
