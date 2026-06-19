import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Navigation,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Locate,
  Search,
  Thermometer,
  Wind,
  Mountain,
  Sparkles,
  X,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchCourseWeather, calcYardageAdjustment, type CourseWeather } from "@/lib/weather";
import {
  fetchCourseHoles,
  courseIdFromName,
  getHoleNote,
  saveHoleNote,
  fetchHoleAimCue,
  setActiveHole,
  clearActiveHole,
  getRoundCourse,
  setRoundCourse,
  clearRoundCourse,
  type HoleGeometry,
  type HoleNote,
  type MissTendency,
} from "@/lib/holeIntel";

/**
 * Recenters the map when the focus *reason* changes (course loaded, hole
 * changed, pin set, or "follow me" toggled) — applying that reason's zoom only
 * on the change. Routine GPS position ticks and the user's own panning/zooming
 * are left untouched, so selecting a course frames the course instead of
 * snapping back to where the golfer is standing.
 */
function MapController({
  lat,
  lng,
  zoom,
  focusKey,
  onUserDrag,
}: {
  lat: number;
  lng: number;
  zoom: number;
  focusKey: string;
  onUserDrag: () => void;
}) {
  const map = useMap();
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    const keyChanged = lastKey.current !== focusKey;
    lastKey.current = focusKey;
    map.setView([lat, lng], keyChanged ? zoom : map.getZoom(), { animate: true });
  }, [lat, lng, zoom, focusKey, map]);
  useMapEvents({
    dragstart: () => onUserDrag(),
  });
  return null;
}

const playerIcon = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#2d6a4f;border:3px solid white;box-shadow:0 0 12px rgba(45,106,79,0.5),0 2px 8px rgba(0,0,0,0.2);"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="display:flex;flex-direction:column;align-items:center;"><div style="width:14px;height:14px;border-radius:50%;background:#dc2626;border:2.5px solid white;box-shadow:0 0 10px rgba(220,38,38,0.4);"></div><div style="width:2px;height:16px;background:white;margin-top:-1px;box-shadow:0 1px 4px rgba(0,0,0,0.2);"></div></div>',
  iconSize: [14, 32],
  iconAnchor: [7, 32],
});

const greenIcon = L.divIcon({
  className: "",
  html: '<div style="width:12px;height:12px;border-radius:50%;background:#e8a84c;border:2px solid white;box-shadow:0 0 8px rgba(232,168,76,0.6);"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

function useDeviceGPS() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [altitudeFt, setAltitudeFt] = useState<number>(0);
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
        if (pos.coords.altitude != null && !Number.isNaN(pos.coords.altitude)) {
          setAltitudeFt(Math.round(pos.coords.altitude * 3.28084));
        }
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

  return { coords, altitudeFt, error, watching, startWatching, stopWatching };
}

interface CourseResult {
  name: string;
  lat: number;
  lng: number;
}

const MISS_OPTIONS: { value: MissTendency; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
];

// Great-circle bearing (degrees from north) between two lat/lng points.
function bearingBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function GpsRangefinderTab() {
  const { coords, altitudeFt, error: gpsError, watching, startWatching } = useDeviceGPS();
  const [currentHole, setCurrentHole] = useState(1);
  const [pinCoords, setPinCoords] = useState<Record<number, { lat: number; lng: number }>>({});
  const [courseSearch, setCourseSearch] = useState("");
  const [courseResults, setCourseResults] = useState<CourseResult[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [coursePos, setCoursePos] = useState<{ lat: number; lng: number } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  // The map follows the player only when explicitly enabled (the recenter
  // button). Default off so a freshly-selected course frames the course.
  const [followPlayer, setFollowPlayer] = useState(false);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  // New: course download, hole picker, weather, per-hole intel
  const [holes, setHoles] = useState<HoleGeometry[]>([]);
  const [showHolePicker, setShowHolePicker] = useState(false);
  const [weather, setWeather] = useState<CourseWeather | null>(null);
  const [holeNote, setHoleNote] = useState<HoleNote | null>(null);
  const [aimCue, setAimCue] = useState<string>("");
  const [aimLoading, setAimLoading] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState("");

  const courseId = selectedCourse ? courseIdFromName(selectedCourse) : null;

  const handleCourseSearch = useCallback((query: string) => {
    setCourseSearch(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.length < 3) {
      setCourseResults([]);
      return;
    }
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + " golf course")}&limit=5`
        );
        const data = await res.json();
        setCourseResults(
          data.map((r: { display_name: string; lat: string; lon: string }) => ({
            name: r.display_name.split(",").slice(0, 2).join(","),
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
          }))
        );
      } catch {
        setCourseResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, []);

  const loadCourse = useCallback(async (course: CourseResult, openPicker: boolean) => {
    setSelectedCourse(course.name);
    setCoursePos({ lat: course.lat, lng: course.lng });
    // Frame the course the moment it's chosen — stop following the player so
    // the map flies to the course rather than the golfer's current location.
    setFollowPlayer(false);
    setCourseSearch("");
    setCourseResults([]);
    if (openPicker) setShowHolePicker(true);

    // Pull live conditions + download the course layout for every hole.
    void fetchCourseWeather(course.lat, course.lng).then(setWeather);
    const downloaded = await fetchCourseHoles(course.name, course.lat, course.lng);
    setHoles(downloaded);
    if (openPicker) {
      toast.success(
        downloaded.length ? `${course.name} — ${downloaded.length} holes loaded` : `Course: ${course.name}`
      );
    }
  }, []);

  const selectCourse = useCallback(
    (course: CourseResult) => {
      triggerHaptic("medium");
      // Persist so a tab switch (which remounts this tab) keeps the chosen course.
      setRoundCourse(course);
      void loadCourse(course, true);
    },
    [loadCourse]
  );

  // Auto-load the course chosen at round setup — no second search needed.
  const autoloadedRef = useRef(false);
  useEffect(() => {
    if (autoloadedRef.current) return;
    autoloadedRef.current = true;
    const rc = getRoundCourse();
    if (rc) {
      void loadCourse({ name: rc.name, lat: rc.lat, lng: rc.lng }, false);
    }
  }, [loadCourse]);

  const confirmStartingHole = (hole: number) => {
    triggerHaptic("medium");
    setCurrentHole(hole);
    setShowHolePicker(false);
  };

  const currentHoleGeo = useMemo(
    () => holes.find((h) => h.ref === currentHole) ?? null,
    [holes, currentHole]
  );

  const currentPin = pinCoords[currentHole];

  // Map focus + the zoom/key for each "reason" we'd recenter. Player-follow only
  // wins when the golfer explicitly turns it on; otherwise we frame the pin, the
  // selected hole, then the course — so a chosen course is always visible.
  const focusPoint = useMemo(() => {
    if (followPlayer && coords)
      return { lat: coords.lat, lng: coords.lng, zoom: 18, key: "player" };
    if (currentPin)
      return { lat: currentPin.lat, lng: currentPin.lng, zoom: 17, key: `pin-${currentHole}` };
    if (currentHoleGeo)
      return { lat: currentHoleGeo.green[0], lng: currentHoleGeo.green[1], zoom: 17, key: `hole-${currentHole}` };
    if (coursePos)
      return { lat: coursePos.lat, lng: coursePos.lng, zoom: 16, key: "course" };
    if (coords)
      return { lat: coords.lat, lng: coords.lng, zoom: 17, key: "player" };
    return { lat: 33.45, lng: -111.94, zoom: 15, key: "default" };
  }, [followPlayer, coords, currentPin, currentHole, currentHoleGeo, coursePos]);

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
  const GREEN_HALF_DEPTH = 8;
  const frontYards = gpsYards !== null ? Math.max(0, gpsYards - GREEN_HALF_DEPTH) : null;
  const backYards = gpsYards !== null ? gpsYards + GREEN_HALF_DEPTH : null;

  // Shot bearing for the wind calc: player → pin if we have both, else tee → green.
  const shotBearing = useMemo(() => {
    if (coords && currentPin) return bearingBetween(coords, currentPin);
    if (currentHoleGeo)
      return bearingBetween(
        { lat: currentHoleGeo.tee[0], lng: currentHoleGeo.tee[1] },
        { lat: currentHoleGeo.green[0], lng: currentHoleGeo.green[1] }
      );
    return 0;
  }, [coords, currentPin, currentHoleGeo]);

  const adjustYards = useCallback(
    (raw: number | null): number | null => {
      if (raw === null || !weather) return null;
      const { adjustedYards } = calcYardageAdjustment(
        raw,
        weather.tempF,
        weather.windMph,
        weather.windDeg,
        shotBearing,
        altitudeFt
      );
      return adjustedYards;
    },
    [weather, shotBearing, altitudeFt]
  );

  // The whole-distance condition delta, shown in the weather bar.
  const conditionsDelta = useMemo(() => {
    if (gpsYards === null || !weather) return null;
    const adj = adjustYards(gpsYards);
    return adj === null ? null : adj - gpsYards;
  }, [gpsYards, weather, adjustYards]);

  const linePositions = useMemo(() => {
    if (!coords || !currentPin) return null;
    return [
      [coords.lat, coords.lng] as [number, number],
      [currentPin.lat, currentPin.lng] as [number, number],
    ];
  }, [coords, currentPin]);

  // Load per-hole note whenever course/hole changes.
  useEffect(() => {
    if (!courseId) {
      setHoleNote(null);
      setAimCue("");
      return;
    }
    const note = getHoleNote(courseId, currentHole);
    setHoleNote(note);
    setAimCue(note?.aimCue ?? "");
    setDraftNote(note?.notes ?? "");
    setEditingNote(false);
  }, [courseId, currentHole]);

  // Tell the mid-round coach which hole the player is on, so it can reference
  // that hole's saved notes (miss tendency / aim cue / personal note).
  useEffect(() => {
    if (courseId && selectedCourse) {
      setActiveHole(courseId, selectedCourse, currentHole);
    }
  }, [courseId, selectedCourse, currentHole]);

  const persistNote = useCallback(
    (patch: Partial<HoleNote>) => {
      if (!courseId) return;
      const next: HoleNote = {
        courseId,
        holeNumber: currentHole,
        missTendency: holeNote?.missTendency ?? "none",
        aimCue: holeNote?.aimCue ?? "",
        notes: holeNote?.notes ?? "",
        updatedAt: new Date().toISOString(),
        ...patch,
      };
      saveHoleNote(next);
      setHoleNote(next);
    },
    [courseId, currentHole, holeNote]
  );

  const handleSetMiss = (miss: MissTendency) => {
    triggerHaptic("light");
    const next = holeNote?.missTendency === miss ? "none" : miss;
    persistNote({ missTendency: next });
  };

  const handleGetAimCue = async () => {
    if (!selectedCourse) return;
    triggerHaptic("soft");
    setAimLoading(true);
    try {
      const cue = await fetchHoleAimCue({
        courseName: selectedCourse,
        holeNumber: currentHole,
        par: currentHoleGeo?.par,
        missTendency: holeNote?.missTendency ?? "none",
      });
      setAimCue(cue);
      persistNote({ aimCue: cue });
    } finally {
      setAimLoading(false);
    }
  };

  const handleSetPin = () => {
    // Drop the pin at the CENTER of the current map view (the green you've framed
    // under the crosshair) — not where the golfer is standing. This lets you set
    // a pin while looking at the course, even before/without GPS. Falls back to
    // the live GPS position if the map isn't ready.
    const center = mapInstance?.getCenter();
    const target = center ? { lat: center.lat, lng: center.lng } : coords;
    if (!target) {
      toast.error("Move the map over the pin, then tap Set Pin");
      return;
    }
    triggerHaptic("medium");
    setPinCoords((prev) => ({ ...prev, [currentHole]: { lat: target.lat, lng: target.lng } }));
    toast.success(`Pin set for hole ${currentHole}`);
  };

  const toggleFollowPlayer = () => {
    triggerHaptic("light");
    setFollowPlayer((prev) => !prev);
  };

  const handleHoleChange = (delta: number) => {
    const next = Math.max(1, Math.min(18, currentHole + delta));
    if (next === currentHole) return;
    triggerHaptic("light");
    setCurrentHole(next);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-6">
      {/* Course header */}
      <div className="px-5 pt-4 pb-3">
        {selectedCourse ? (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1a5c2e]">Course</p>
              <p className="truncate text-[17px] font-semibold leading-tight text-[#0f1f0f]">{selectedCourse}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setShowHolePicker(true)}
                className="rounded-full border border-[#c8ddc8] px-3 py-1.5 text-[13px] font-medium text-[#1a5c2e] hover:bg-[#f0f7f1]"
              >
                Hole
              </button>
              <button
                onClick={() => {
                  setSelectedCourse(null);
                  setCoursePos(null);
                  setHoles([]);
                  setWeather(null);
                  clearActiveHole();
                  clearRoundCourse();
                }}
                className="rounded-full border border-[#c8ddc8] px-3 py-1.5 text-[13px] font-medium text-[#1a5c2e] hover:bg-[#f0f7f1]"
              >
                Change
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-2 rounded-2xl border border-[#c8ddc8] bg-white px-4 py-3 shadow-[0_1px_6px_rgba(15,31,15,0.05)]">
              <Search className="h-4 w-4 text-[#5a7a5a]" />
              <input
                type="text"
                value={courseSearch}
                onChange={(e) => handleCourseSearch(e.target.value)}
                placeholder="Search any golf course in the world..."
                className="flex-1 bg-transparent text-[16px] text-[#0f1f0f] placeholder-[#5a7a5a] outline-none"
              />
            </div>
            {courseResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-[1100] mt-2 overflow-hidden rounded-2xl border border-[#c8ddc8] bg-white shadow-[0_8px_32px_rgba(15,31,15,0.14)]">
                {courseResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => void selectCourse(r)}
                    className="w-full border-b border-[#e8f0e9] px-4 py-3.5 text-left text-[15px] text-[#0f1f0f] transition-colors last:border-b-0 hover:bg-[#f0f7f1]"
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
            {isSearching && <p className="mt-2 text-[13px] text-[#5a7a5a]">Searching...</p>}
          </div>
        )}
      </div>

      {/* Weather / conditions bar */}
      {selectedCourse && weather && (
        <div className="px-5 pb-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border border-[#c8ddc8] bg-[#f0f7f1] px-4 py-2.5 text-[13px] font-medium text-[#0f1f0f]">
            <span className="flex items-center gap-1.5">
              <Thermometer className="h-4 w-4 text-[#d4813a]" />
              {weather.tempF}°F
            </span>
            <span className="flex items-center gap-1.5">
              <Wind className="h-4 w-4 text-[#1a5c2e]" />
              {weather.windMph} mph {weather.windCardinal}
            </span>
            <span className="flex items-center gap-1.5">
              <Mountain className="h-4 w-4 text-[#5a7a5a]" />
              {altitudeFt > 0 ? `${altitudeFt} ft` : "— ft"}
            </span>
            {conditionsDelta !== null && (
              <span className="ml-auto rounded-full bg-[#1a5c2e] px-2.5 py-0.5 text-white">
                {conditionsDelta >= 0 ? "+" : ""}
                {conditionsDelta} yds
              </span>
            )}
          </div>
        </div>
      )}

      {/* Hole selector — large and prominent */}
      <div className="flex items-center justify-between gap-2 px-5 pb-4">
        <button
          onClick={() => handleHoleChange(-1)}
          disabled={currentHole <= 1}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-[#c8ddc8] bg-white text-[#0f1f0f] shadow-[0_2px_8px_rgba(15,31,15,0.06)] transition-all hover:bg-[#f0f7f1] disabled:opacity-30"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5a7a5a]">
            Hole{currentHoleGeo?.par ? ` · Par ${currentHoleGeo.par}` : ""}
          </p>
          <p className="font-serif text-[52px] font-bold leading-none text-[#0f1f0f]">{currentHole}</p>
        </div>
        <button
          onClick={() => handleHoleChange(1)}
          disabled={currentHole >= 18}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-[#c8ddc8] bg-white text-[#0f1f0f] shadow-[0_2px_8px_rgba(15,31,15,0.06)] transition-all hover:bg-[#f0f7f1] disabled:opacity-30"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      </div>

      {/* Yardage display — FRONT / CENTER / BACK with weather-adjusted figure */}
      <div className="px-5 pb-4">
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: "Front", value: frontYards, big: false },
            { label: "Center", value: gpsYards, big: true },
            { label: "Back", value: backYards, big: false },
          ].map(({ label, value, big }) => {
            const adj = adjustYards(value);
            return (
              <div
                key={label}
                className={cn(
                  "rounded-2xl border bg-white text-center shadow-[0_1px_4px_rgba(15,31,15,0.06)]",
                  big ? "border-[#1a5c2e]/35 py-4" : "border-[#c8ddc8] py-3.5"
                )}
              >
                <p
                  className={cn(
                    "font-serif font-bold leading-none text-[#1a5c2e]",
                    big ? "text-[44px]" : "text-[30px] text-[#2d7a4a]"
                  )}
                >
                  {value !== null ? value : "—"}
                </p>
                {adj !== null && adj !== value && (
                  <p className="mt-1 text-[12px] font-semibold text-[#d4813a]">→ {adj}y</p>
                )}
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5a7a5a]">
                  {label}
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-center text-[12px] text-[#5a7a5a]">
          {gpsYards !== null
            ? weather
              ? "raw yardage · → plays as (wind/temp/elevation adjusted)"
              : "yards to pin"
            : "Set a pin to see yardages"}
        </p>
      </div>

      {/* Satellite map */}
      <div className="px-5 pb-4">
        <div className="relative overflow-hidden rounded-[20px] border border-[#c8ddc8] shadow-[0_2px_12px_rgba(15,31,15,0.06)]">
          <div className="relative h-[220px] w-full">
            <MapContainer
              center={[focusPoint.lat, focusPoint.lng]}
              zoom={focusPoint.zoom}
              zoomControl={false}
              attributionControl={false}
              className="h-full w-full"
              style={{ borderRadius: "20px" }}
              ref={setMapInstance}
            >
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
              <MapController
                lat={focusPoint.lat}
                lng={focusPoint.lng}
                zoom={focusPoint.zoom}
                focusKey={focusPoint.key}
                onUserDrag={() => setFollowPlayer(false)}
              />
              {coords && <Marker position={[coords.lat, coords.lng]} icon={playerIcon} />}
              {currentHoleGeo && (
                <>
                  <Polyline
                    positions={currentHoleGeo.points}
                    pathOptions={{ color: "#e8a84c", weight: 3, opacity: 0.85 }}
                  />
                  <Marker position={currentHoleGeo.green} icon={greenIcon} />
                </>
              )}
              {currentPin && <Marker position={[currentPin.lat, currentPin.lng]} icon={pinIcon} />}
              {linePositions && (
                <Polyline
                  positions={linePositions}
                  pathOptions={{ color: "#ffffff", weight: 2, dashArray: "6,8" }}
                />
              )}
            </MapContainer>

            {/* Center crosshair — marks where "Set Pin Here" will drop the pin. */}
            <div className="pointer-events-none absolute inset-0 z-[900] flex items-center justify-center">
              <div className="relative h-7 w-7">
                <span className="absolute left-1/2 top-0 h-7 w-px -translate-x-1/2 bg-white/80 shadow-[0_0_4px_rgba(0,0,0,0.5)]" />
                <span className="absolute top-1/2 left-0 h-px w-7 -translate-y-1/2 bg-white/80 shadow-[0_0_4px_rgba(0,0,0,0.5)]" />
                <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 bg-[#dc2626]/70" />
              </div>
            </div>

            {/* Recenter / follow-me toggle — lets the golfer jump the map to their
                own position (and follow), or back to the framed course/hole. */}
            {coords && (
              <button
                type="button"
                onClick={toggleFollowPlayer}
                className={cn(
                  "absolute right-3 top-3 z-[1000] flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_2px_10px_rgba(0,0,0,0.25)] transition-all",
                  followPlayer
                    ? "border-[#1a5c2e] bg-[#1a5c2e] text-white"
                    : "border-[#c8ddc8] bg-white/95 text-[#1a5c2e] hover:bg-white"
                )}
                aria-label={followPlayer ? "Stop following my location" : "Center on my location"}
              >
                <Locate className="h-5 w-5" />
              </button>
            )}

            {!watching && !coords && (
              <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-[rgba(232,240,233,0.7)] backdrop-blur-sm">
                <div className="text-center">
                  <Locate className="mx-auto mb-2 h-8 w-8 text-[#1a5c2e] opacity-60" />
                  <p className="text-[15px] text-[#2d4d2d]">Start GPS to see your position</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hole Intel card */}
      {selectedCourse && (
        <div className="px-5 pb-4">
          <div className="rounded-2xl border border-[#c8ddc8] bg-white p-4 shadow-[0_1px_6px_rgba(15,31,15,0.05)]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1a5c2e]">
                Hole {currentHole} Intel
              </p>
            </div>

            {/* Miss tendency */}
            <p className="mt-3 text-[12px] font-medium text-[#2d4d2d]">Your miss here</p>
            <div className="mt-1.5 grid grid-cols-4 gap-2">
              {MISS_OPTIONS.map((opt) => {
                const active = holeNote?.missTendency === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleSetMiss(opt.value)}
                    className={cn(
                      "rounded-xl border py-2 text-[13px] font-semibold transition-all",
                      active
                        ? "border-[#1a5c2e] bg-[#1a5c2e] text-white"
                        : "border-[#c8ddc8] bg-white text-[#2d4d2d] hover:bg-[#f0f7f1]"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* AI aim cue */}
            <div className="mt-4 rounded-xl bg-[#f0f7f1] p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1a5c2e]">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Aim Cue
                </span>
                <button
                  onClick={() => void handleGetAimCue()}
                  disabled={aimLoading}
                  className="rounded-full bg-[#1a5c2e] px-3 py-1 text-[12px] font-medium text-white disabled:opacity-60"
                >
                  {aimLoading ? "Reading hole…" : aimCue ? "Refresh" : "Get cue"}
                </button>
              </div>
              {aimCue ? (
                <p className="mt-2 text-[14px] leading-6 text-[#0f1f0f]">{aimCue}</p>
              ) : (
                <p className="mt-2 text-[13px] leading-6 text-[#5a7a5a]">
                  Tap “Get cue” — the AI reads the hole and your miss tendency for an aim + mental cue.
                </p>
              )}
            </div>

            {/* Free notes */}
            <div className="mt-3">
              {editingNote ? (
                <div className="space-y-2">
                  <textarea
                    value={draftNote}
                    onChange={(e) => setDraftNote(e.target.value)}
                    rows={2}
                    placeholder="e.g. Bunker short-right, bail left. Pin tucked back."
                    className="w-full rounded-xl border border-[#c8ddc8] bg-white p-3 text-[14px] text-[#0f1f0f] placeholder-[#5a7a5a] outline-none focus:border-[#1a5c2e]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        persistNote({ notes: draftNote });
                        setEditingNote(false);
                        triggerHaptic("soft");
                      }}
                      className="flex-1 rounded-xl bg-[#1a5c2e] py-2 text-[13px] font-medium text-white"
                    >
                      Save note
                    </button>
                    <button
                      onClick={() => {
                        setDraftNote(holeNote?.notes ?? "");
                        setEditingNote(false);
                      }}
                      className="rounded-xl border border-[#c8ddc8] px-4 py-2 text-[13px] font-medium text-[#2d4d2d]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setDraftNote(holeNote?.notes ?? "");
                    setEditingNote(true);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-[#c8ddc8] px-3 py-2.5 text-left text-[14px] text-[#0f1f0f] hover:bg-[#f0f7f1]"
                >
                  <span className={holeNote?.notes ? "" : "text-[#5a7a5a]"}>
                    {holeNote?.notes || "Add a mental note for this hole"}
                  </span>
                  <Pencil className="h-4 w-4 shrink-0 text-[#1a5c2e]" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GPS controls */}
      <div className="space-y-3 px-5">
        {!watching && (
          <button
            onClick={startWatching}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#1a5c2e_0%,#2d7a4a_100%)] px-6 py-4 text-[16px] font-semibold text-white shadow-[0_4px_16px_rgba(26,92,46,0.32)] transition-all active:scale-[0.98]"
          >
            <Navigation className="h-5 w-5" />
            Start GPS Tracking
          </button>
        )}
        <button
          onClick={handleSetPin}
          disabled={!mapInstance && !coords}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[#1a5c2e]/40 bg-white px-6 py-4 text-[16px] font-semibold text-[#1a5c2e] shadow-[0_1px_6px_rgba(15,31,15,0.05)] transition-all hover:bg-[#f0f7f1] disabled:opacity-40"
        >
          <MapPin className="h-5 w-5" />
          {pinCoords[currentHole] ? "Move Pin to Crosshair" : "Set Pin at Crosshair"}
        </button>
        {watching && (
          <div className="flex items-center justify-center gap-2 text-[13px] text-[#1a5c2e]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#1a5c2e]" />
            GPS Tracking Active
            {coords && (
              <span className="ml-1 text-[#5a7a5a]">
                ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
              </span>
            )}
          </div>
        )}
        {gpsError && <p className="text-center text-[13px] text-red-600">{gpsError}</p>}
        <p className="text-center text-[12px] text-[#5a7a5a]">
          Drag the map so the crosshair sits on the pin, then tap Set Pin. GPS distance updates as you move.
        </p>
      </div>

      {/* Hole picker dialog */}
      {showHolePicker && (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-[rgba(15,31,15,0.55)] p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border border-[#c8ddc8] bg-white p-5 shadow-[0_24px_60px_rgba(15,31,15,0.3)]">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-xl font-semibold text-[#0f1f0f]">
                Which hole are you starting on?
              </h3>
              <button
                onClick={() => setShowHolePicker(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#5a7a5a] hover:bg-[#f0f7f1]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {selectedCourse && (
              <p className="mt-1 text-[13px] text-[#2d4d2d]">{selectedCourse}</p>
            )}
            <div className="mt-4 grid grid-cols-6 gap-2">
              {Array.from({ length: 18 }, (_, i) => i + 1).map((h) => {
                const known = holes.some((g) => g.ref === h);
                return (
                  <button
                    key={h}
                    onClick={() => confirmStartingHole(h)}
                    className={cn(
                      "flex h-11 items-center justify-center rounded-xl border text-[15px] font-semibold transition-all",
                      h === currentHole
                        ? "border-[#1a5c2e] bg-[#1a5c2e] text-white"
                        : known
                        ? "border-[#1a5c2e]/30 bg-[#f0f7f1] text-[#1a5c2e] hover:bg-[#e3f0e6]"
                        : "border-[#c8ddc8] bg-white text-[#2d4d2d] hover:bg-[#f0f7f1]"
                    )}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-center text-[12px] text-[#5a7a5a]">
              {holes.length
                ? `${holes.length} holes downloaded · highlighted holes have layout data`
                : "Layout still downloading — you can start anyway"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
