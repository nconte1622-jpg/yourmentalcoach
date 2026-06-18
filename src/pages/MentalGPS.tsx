/**
 * MentalGPS — GPS Rangefinder + Mental Pattern Tracker
 *
 * Two panels:
 * 1. Rangefinder: yardage to pin (manual input + device GPS) + wind + club suggestion
 *    + satellite map (react-leaflet + ESRI World Imagery tiles)
 * 2. Shot Logger: tap-to-log tee shot, lie, putt result, emotional tag per hole
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  Locate,
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
} from "@/lib/gpsPatternStorage";
import { loadRoundContext } from "@/lib/roundContext";
import { loadActiveRoundSession } from "@/lib/roundSession";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

/* ─── Leaflet custom icons ─────────────────────────────── */
const playerIcon = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:rgba(31,180,100,0.95);border:3px solid white;box-shadow:0 0 12px rgba(31,180,100,0.6),0 2px 8px rgba(0,0,0,0.3);"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="display:flex;flex-direction:column;align-items:center;"><div style="width:12px;height:12px;border-radius:50%;background:rgba(220,60,40,0.95);border:2px solid white;box-shadow:0 0 10px rgba(220,60,40,0.5);"></div><div style="width:2px;height:16px;background:white;margin-top:-1px;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div></div>',
  iconSize: [12, 30],
  iconAnchor: [6, 30],
});

/* ─── Map recenter component ───────────────────────────── */
function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

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

  const [currentHole, setCurrentHole] = useState(1);
  const [tab, setTab] = useState<"range" | "log">("range");

  const [yardageInput, setYardageInput] = useState("");
  const [windDir, setWindDir] = useState<WindDir>("none");
  const [windMph, setWindMph] = useState(0);
  const [pinCoords, setPinCoords] = useState<Record<number, { lat: number; lng: number }>>({});

  const [holeShot, setHoleShot] = useState(() => getHoleShot(1));
  const [selectedTee, setSelectedTee] = useState<TeeResult | null>(null);
  const [selectedPutt, setSelectedPutt] = useState<PuttResult | null>(null);
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionalTag | null>(null);

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

  useEffect(() => {
    const shot = getHoleShot(currentHole);
    setHoleShot(shot);
    setSelectedTee(shot?.teeResult ?? null);
    setSelectedPutt(shot?.puttResult ?? null);
    setSelectedEmotion(shot?.emotionalTag ?? null);
  }, [currentHole]);

  const yardage = parseInt(yardageInput, 10);
  const validYardage = !isNaN(yardage) && yardage > 0;

  const gpsDistanceToPin = useCallback((): number | null => {
    const pin = pinCoords[currentHole];
    if (!pin || !coords) return null;
    const R = 6371000;
    const dLat = ((pin.lat - coords.lat) * Math.PI) / 180;
    const dLng = ((pin.lng - coords.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((coords.lat * Math.PI) / 180) *
        Math.cos((pin.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round((R * c) / 0.9144);
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

  const currentPin = pinCoords[currentHole];
  const mapCenter = useMemo(() => {
    if (coords) return { lat: coords.lat, lng: coords.lng };
    return { lat: 33.45, lng: -111.94 };
  }, [coords]);

  const linePositions = useMemo(() => {
    if (!coords || !currentPin) return null;
    return [
      [coords.lat, coords.lng] as [number, number],
      [currentPin.lat, currentPin.lng] as [number, number],
    ];
  }, [coords, currentPin]);

  return (
    <PageShell backgroundVariant="default">
      <AppShell
        className="mx-auto w-full max-w-3xl"
        header={
          <AppHeader
            left={
              <button
                onClick={() => { triggerHaptic("light"); navigate("/round"); }}
                className="tap-44 flex items-center justify-center text-[#1a1a1a]"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            }
            center={
              <div>
                <h1 className="font-serif text-[23px] font-semibold leading-tight tracking-wide text-[#1a1a1a]">
                  Mental GPS
                </h1>
                <p className="text-[10px] uppercase tracking-[0.16em] text-[rgba(26,26,26,0.6)] opacity-70">
                  Rangefinder
                </p>
              </div>
            }
            right={<div className="tap-44" />}
          />
        }
      >
        <div className="with-bottom-dock flex flex-col overflow-y-auto pb-6 pt-4">

          {/* ── Hole selector ─────────────────────── */}
          <div className="flex items-center justify-between gap-2 px-5 pb-4">
            <button
              onClick={() => handleHoleChange(-1)}
              disabled={currentHole <= 1}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)] text-[#1a1a1a] shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all hover:bg-[rgba(45,106,79,0.06)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] disabled:opacity-30 disabled:shadow-none"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="text-center">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[rgba(26,26,26,0.6)]">Hole</p>
              <p className="font-serif text-4xl font-semibold text-[#1a1a1a]">{currentHole}</p>
              <p className="text-[10px] text-[rgba(26,26,26,0.6)] opacity-50">{loggedCount} logged</p>
            </div>
            <button
              onClick={() => handleHoleChange(1)}
              disabled={currentHole >= 18}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)] text-[#1a1a1a] shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all hover:bg-[rgba(45,106,79,0.06)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] disabled:opacity-30 disabled:shadow-none"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          {/* ── Tab selector ──────────────────────── */}
          <div className="mx-5 mb-4 flex rounded-2xl border border-[rgba(45,106,79,0.12)] bg-white/70 p-1">
            {(["range", "log"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { triggerHaptic("light"); setTab(t); }}
                className={cn(
                  "flex-1 rounded-xl py-2.5 text-sm font-medium transition-all",
                  tab === t
                    ? "bg-[rgba(45,106,79,0.06)] text-[#2d6a4f] shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                    : "text-[rgba(26,26,26,0.6)]"
                )}
              >
                {t === "range" ? "Rangefinder" : "Shot Logger"}
              </button>
            ))}
          </div>

          {/* ═════════════════ RANGEFINDER ═══════════ */}
          {tab === "range" && (
            <div className="space-y-4 px-5">

              {/* Satellite map */}
              <GlassCard className="overflow-hidden p-0">
                <div className="relative h-[240px] w-full overflow-hidden rounded-[24px]">
                  <MapContainer
                    center={[mapCenter.lat, mapCenter.lng]}
                    zoom={17}
                    zoomControl={false}
                    attributionControl={false}
                    className="h-full w-full"
                    style={{ borderRadius: "24px" }}
                  >
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    />
                    {coords && <MapRecenter lat={coords.lat} lng={coords.lng} />}
                    {coords && (
                      <Marker position={[coords.lat, coords.lng]} icon={playerIcon} />
                    )}
                    {currentPin && (
                      <Marker position={[currentPin.lat, currentPin.lng]} icon={pinIcon} />
                    )}
                    {linePositions && (
                      <Polyline
                        positions={linePositions}
                        pathOptions={{
                          color: "rgba(203,184,146,0.8)",
                          weight: 2,
                          dashArray: "6,8",
                        }}
                      />
                    )}
                  </MapContainer>
                  {gpsYards !== null && (
                    <div className="absolute left-1/2 top-4 z-[1000] -translate-x-1/2">
                      <div className="flex items-center gap-2 rounded-2xl border border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)] px-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                        <Navigation className="h-4 w-4 text-[rgba(31,180,100,0.9)]" />
                        <span className="font-serif text-2xl font-semibold text-[#2d6a4f]">{gpsYards}</span>
                        <span className="text-xs text-[rgba(26,26,26,0.6)]">yds</span>
                      </div>
                    </div>
                  )}
                  {!watching && !coords && (
                    <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-[rgba(245,242,234,0.7)] backdrop-blur-sm">
                      <div className="text-center">
                        <Locate className="mx-auto mb-2 h-8 w-8 text-[#2d6a4f] opacity-60" />
                        <p className="text-sm text-[rgba(26,26,26,0.6)]">Start GPS to see your position</p>
                      </div>
                    </div>
                  )}
                </div>
              </GlassCard>

              {/* Yardage display */}
              <GlassCard glow className="p-5">
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[rgba(26,26,26,0.6)]">Distance to pin</p>
                    <p className="font-serif text-5xl font-semibold text-[#2d6a4f]">
                      {displayYards ?? "—"}
                    </p>
                    <p className="text-sm text-[rgba(26,26,26,0.6)] opacity-70">yards</p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[rgba(26,26,26,0.6)]">Enter yardage manually</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={yardageInput}
                      onChange={(e) => setYardageInput(e.target.value)}
                      placeholder="e.g. 165"
                      className="w-full rounded-xl border border-[rgba(45,106,79,0.12)] bg-white/80 px-4 py-3 text-center text-lg font-medium text-[#1a1a1a] placeholder-[rgba(26,26,26,0.35)] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/20"
                    />
                  </div>
                </div>
              </GlassCard>

              {/* GPS controls — large full-width CTAs */}
              <div className="space-y-3">
                {!watching && (
                  <button
                    onClick={startWatching}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[rgba(45,106,79,0.12)] bg-[#2d6a4f] px-6 py-4 text-base font-semibold text-[#1a1e1c] shadow-[0_4px_16px_rgba(203,184,146,0.25)] transition-all hover:shadow-[0_6px_24px_rgba(203,184,146,0.35)]"
                  >
                    <Navigation className="h-5 w-5" />
                    Start GPS Tracking
                  </button>
                )}
                <button
                  onClick={handleSetPin}
                  disabled={!coords}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[rgba(45,106,79,0.15)] bg-white px-6 py-4 text-base font-semibold text-[#2d6a4f] shadow-[0_1px_6px_rgba(0,0,0,0.04)] transition-all hover:bg-[rgba(45,106,79,0.04)] disabled:opacity-40 disabled:shadow-none"
                >
                  <MapPin className="h-5 w-5" />
                  {pinCoords[currentHole] ? "Move Pin Location" : "Set Pin Here"}
                </button>
                {watching && (
                  <div className="flex items-center justify-center gap-2 text-xs text-[rgba(31,180,100,0.9)]">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[rgba(31,180,100,0.9)]" />
                    GPS Tracking Active
                    {coords && (
                      <span className="ml-1 text-[rgba(26,26,26,0.6)]">
                        ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
                      </span>
                    )}
                  </div>
                )}
                {gpsError && <p className="text-center text-xs text-[rgba(220,80,60,0.9)]">{gpsError}</p>}
                <p className="text-center text-[10px] text-[rgba(26,26,26,0.6)] opacity-60">
                  Walk to the pin flag and tap Set Pin. GPS distance updates as you move.
                </p>
              </div>

              {/* Wind */}
              <GlassCard className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Wind className="h-4 w-4 text-[#2d6a4f]" />
                    <p className="text-sm font-semibold text-[#1a1a1a]">Wind</p>
                  </div>

                  <div className="flex gap-2">
                    {WIND_DIRS.map((wd) => (
                      <button
                        key={wd.id}
                        onClick={() => { triggerHaptic("light"); setWindDir(wd.id); }}
                        className={cn(
                          "flex flex-1 flex-col items-center gap-0.5 rounded-xl border py-2 text-xs transition-all",
                          windDir === wd.id
                            ? "border-[#2d6a4f] bg-[rgba(45,106,79,0.06)] text-[#2d6a4f] shadow-[0_2px_8px_rgba(203,184,146,0.15)]"
                            : "border-[rgba(45,106,79,0.12)] text-[rgba(26,26,26,0.6)] hover:bg-[rgba(45,106,79,0.04)]"
                        )}
                      >
                        <span className="text-base">{wd.icon}</span>
                        <span>{wd.label}</span>
                      </button>
                    ))}
                  </div>

                  {windDir !== "none" && (
                    <div>
                      <p className="mb-1 text-xs text-[rgba(26,26,26,0.6)]">Speed: {windMph} mph</p>
                      <input
                        type="range"
                        min={0}
                        max={30}
                        value={windMph}
                        onChange={(e) => setWindMph(parseInt(e.target.value, 10))}
                        className="w-full accent-[#2d6a4f]"
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
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(45,106,79,0.06)]">
                        <Target className="h-5 w-5 text-[#2d6a4f]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[rgba(26,26,26,0.6)]">Suggested club</p>
                        <p className="text-xl font-semibold text-[#1a1a1a]">{clubSuggestion}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[rgba(26,26,26,0.6)]">
                        {windDir !== "none" && windMph > 0 ? `${windDir === "headwind" ? "+" : "-"}${Math.round(windMph * 0.75)} adj.` : "no wind adj."}
                      </p>
                      <p className="text-sm text-[rgba(26,26,26,0.6)]">{displayYards} yds</p>
                    </div>
                  </div>
                </GlassCard>
              )}
            </div>
          )}

          {/* ═════════════════ SHOT LOGGER ═══════════ */}
          {tab === "log" && (
            <div className="space-y-4 px-5">

              <GlassCard className="p-4">
                <p className="mb-3 text-sm font-semibold text-[#1a1a1a]">Tee shot</p>
                <div className="flex flex-wrap gap-2">
                  {TEE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleTeeSelect(opt.value)}
                      className={cn(
                        "rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all",
                        selectedTee === opt.value
                          ? "border-transparent text-white shadow-[0_2px_10px_rgba(0,0,0,0.2)]"
                          : "border-[rgba(45,106,79,0.12)] bg-white/70 text-[rgba(26,26,26,0.6)] hover:bg-[rgba(45,106,79,0.04)]"
                      )}
                      style={selectedTee === opt.value ? { backgroundColor: opt.color, borderColor: opt.color } : {}}
                    >
                      {selectedTee === opt.value && <Check className="mr-1 inline h-3.5 w-3.5" />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="p-4">
                <p className="mb-3 text-sm font-semibold text-[#1a1a1a]">Putting</p>
                <div className="flex flex-wrap gap-2">
                  {PUTT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handlePuttSelect(opt.value)}
                      className={cn(
                        "rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all",
                        selectedPutt === opt.value
                          ? "border-transparent text-white shadow-[0_2px_10px_rgba(0,0,0,0.2)]"
                          : "border-[rgba(45,106,79,0.12)] bg-white/70 text-[rgba(26,26,26,0.6)] hover:bg-[rgba(45,106,79,0.04)]"
                      )}
                      style={selectedPutt === opt.value ? { backgroundColor: opt.color, borderColor: opt.color } : {}}
                    >
                      {selectedPutt === opt.value && <Check className="mr-1 inline h-3.5 w-3.5" />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="p-4">
                <p className="mb-1 text-sm font-semibold text-[#1a1a1a]">Mental state this hole</p>
                <p className="mb-3 text-xs text-[rgba(26,26,26,0.6)] opacity-70">Optional — tap to toggle</p>
                <div className="flex flex-wrap gap-2">
                  {EMOTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleEmotionSelect(opt.value)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all",
                        selectedEmotion === opt.value
                          ? "border-[rgba(45,106,79,0.12)] bg-[rgba(45,106,79,0.06)] text-[#2d6a4f] shadow-[0_2px_10px_rgba(203,184,146,0.15)]"
                          : "border-[rgba(45,106,79,0.12)] bg-white/70 text-[rgba(26,26,26,0.6)] hover:bg-[rgba(45,106,79,0.04)]"
                      )}
                    >
                      <span>{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </GlassCard>

              {holeShot && (
                <div className="flex items-center justify-center gap-2 text-sm text-[rgba(31,180,100,0.9)]">
                  <Check className="h-4 w-4" />
                  <span>Hole {currentHole} logged</span>
                </div>
              )}

              {currentHole < 18 && (
                <PillButton
                  tone="sand"
                  onClick={() => handleHoleChange(1)}
                  className="w-full py-4 text-base"
                >
                  Next hole →
                </PillButton>
              )}

              {loggedCount >= 3 && (
                <PillButton tone="green" onClick={handleFinishRound} className="w-full py-4 text-base">
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
