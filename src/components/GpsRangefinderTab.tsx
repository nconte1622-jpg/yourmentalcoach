import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Navigation,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Locate,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
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

interface CourseResult {
  name: string;
  lat: number;
  lng: number;
}

export function GpsRangefinderTab() {
  const { coords, error: gpsError, watching, startWatching } = useDeviceGPS();
  const [currentHole, setCurrentHole] = useState(1);
  const [pinCoords, setPinCoords] = useState<Record<number, { lat: number; lng: number }>>({});
  const [courseSearch, setCourseSearch] = useState("");
  const [courseResults, setCourseResults] = useState<CourseResult[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

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

  const selectCourse = useCallback((course: CourseResult) => {
    setSelectedCourse(course.name);
    setCourseSearch("");
    setCourseResults([]);
    triggerHaptic("medium");
    toast.success(`Course: ${course.name}`);
  }, []);

  const currentPin = pinCoords[currentHole];
  const mapCenter = useMemo(() => {
    if (coords) return { lat: coords.lat, lng: coords.lng };
    return { lat: 33.45, lng: -111.94 };
  }, [coords]);

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
  // Approximate front/back of green from the (center) pin distance using a
  // typical green depth (~16 yds). Honest rangefinder convention when only the
  // pin is known.
  const GREEN_HALF_DEPTH = 8;
  const frontYards = gpsYards !== null ? Math.max(0, gpsYards - GREEN_HALF_DEPTH) : null;
  const backYards = gpsYards !== null ? gpsYards + GREEN_HALF_DEPTH : null;

  const linePositions = useMemo(() => {
    if (!coords || !currentPin) return null;
    return [
      [coords.lat, coords.lng] as [number, number],
      [currentPin.lat, currentPin.lng] as [number, number],
    ];
  }, [coords, currentPin]);

  const handleSetPin = () => {
    if (!coords) {
      toast.error("Walk to the pin and tap Set Pin");
      return;
    }
    triggerHaptic("medium");
    setPinCoords((prev) => ({ ...prev, [currentHole]: coords }));
    toast.success(`Pin set for hole ${currentHole}`);
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
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2d6a4f]">Course</p>
              <p className="text-[17px] font-semibold text-[#1a1a1a] leading-tight">{selectedCourse}</p>
            </div>
            <button
              onClick={() => setSelectedCourse(null)}
              className="text-[13px] text-[#2d6a4f] font-medium px-3 py-1.5 rounded-full border border-[rgba(45,106,79,0.15)] hover:bg-[rgba(45,106,79,0.06)]"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-2 rounded-2xl border border-[rgba(45,106,79,0.12)] bg-white/90 px-4 py-3 shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
              <Search className="h-4 w-4 text-[rgba(26,26,26,0.35)]" />
              <input
                type="text"
                value={courseSearch}
                onChange={(e) => handleCourseSearch(e.target.value)}
                placeholder="Search golf course..."
                className="flex-1 bg-transparent text-[16px] text-[#1a1a1a] placeholder-[rgba(26,26,26,0.35)] outline-none"
              />
            </div>
            {courseResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-[rgba(45,106,79,0.1)] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.1)] overflow-hidden">
                {courseResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => selectCourse(r)}
                    className="w-full text-left px-4 py-3.5 text-[15px] text-[#1a1a1a] hover:bg-[rgba(45,106,79,0.04)] border-b border-[rgba(0,0,0,0.04)] last:border-b-0 transition-colors"
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
            {isSearching && (
              <p className="mt-2 text-[13px] text-[rgba(26,26,26,0.45)]">Searching...</p>
            )}
          </div>
        )}
      </div>

      {/* Hole selector — large and prominent */}
      <div className="flex items-center justify-between gap-2 px-5 pb-4">
        <button
          onClick={() => handleHoleChange(-1)}
          disabled={currentHole <= 1}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(45,106,79,0.12)] bg-white text-[#1a1a1a] shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all hover:bg-[rgba(45,106,79,0.04)] disabled:opacity-30"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgba(26,26,26,0.5)]">Hole</p>
          <p className="font-serif text-[52px] font-bold text-[#1a1a1a] leading-none">{currentHole}</p>
        </div>
        <button
          onClick={() => handleHoleChange(1)}
          disabled={currentHole >= 18}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(45,106,79,0.12)] bg-white text-[#1a1a1a] shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all hover:bg-[rgba(45,106,79,0.04)] disabled:opacity-30"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      </div>

      {/* Yardage display — FRONT / CENTER / BACK */}
      <div className="px-5 pb-4">
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: "Front", value: frontYards, big: false },
            { label: "Center", value: gpsYards, big: true },
            { label: "Back", value: backYards, big: false },
          ].map(({ label, value, big }) => (
            <div
              key={label}
              className={cn(
                "rounded-2xl border bg-white text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]",
                big
                  ? "border-[rgba(45,106,79,0.25)] py-4"
                  : "border-[rgba(45,106,79,0.1)] py-3.5"
              )}
            >
              <p
                className={cn(
                  "font-serif font-bold leading-none text-[#2d6a4f]",
                  big ? "text-[44px]" : "text-[30px] text-[rgba(45,106,79,0.75)]"
                )}
              >
                {value !== null ? value : "—"}
              </p>
              <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(26,26,26,0.45)]">
                {label}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[12px] text-[rgba(26,26,26,0.4)]">
          {gpsYards !== null ? "yards to pin" : "Set a pin to see yardages"}
        </p>
      </div>

      {/* Satellite map */}
      <div className="px-5 pb-4">
        <div className="relative overflow-hidden rounded-[20px] border border-[rgba(45,106,79,0.08)] shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <div className="h-[220px] w-full">
            <MapContainer
              center={[mapCenter.lat, mapCenter.lng]}
              zoom={17}
              zoomControl={false}
              attributionControl={false}
              className="h-full w-full"
              style={{ borderRadius: "20px" }}
            >
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
              {coords && <MapRecenter lat={coords.lat} lng={coords.lng} />}
              {coords && <Marker position={[coords.lat, coords.lng]} icon={playerIcon} />}
              {currentPin && <Marker position={[currentPin.lat, currentPin.lng]} icon={pinIcon} />}
              {linePositions && (
                <Polyline
                  positions={linePositions}
                  pathOptions={{ color: "#ffffff", weight: 2, dashArray: "6,8" }}
                />
              )}
            </MapContainer>
            {!watching && !coords && (
              <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-[rgba(245,242,234,0.7)] backdrop-blur-sm">
                <div className="text-center">
                  <Locate className="mx-auto mb-2 h-8 w-8 text-[#2d6a4f] opacity-50" />
                  <p className="text-[15px] text-[rgba(26,26,26,0.6)]">Start GPS to see your position</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* GPS controls */}
      <div className="space-y-3 px-5">
        {!watching && (
          <button
            onClick={startWatching}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#2d6a4f] px-6 py-4 text-[16px] font-semibold text-white shadow-[0_2px_12px_rgba(45,106,79,0.25)] transition-all hover:bg-[#245a42]"
          >
            <Navigation className="h-5 w-5" />
            Start GPS Tracking
          </button>
        )}
        <button
          onClick={handleSetPin}
          disabled={!coords}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[rgba(45,106,79,0.15)] bg-white px-6 py-4 text-[16px] font-semibold text-[#2d6a4f] shadow-[0_1px_6px_rgba(0,0,0,0.04)] transition-all hover:bg-[rgba(45,106,79,0.04)] disabled:opacity-40"
        >
          <MapPin className="h-5 w-5" />
          {pinCoords[currentHole] ? "Move Pin Location" : "Set Pin Here"}
        </button>
        {watching && (
          <div className="flex items-center justify-center gap-2 text-[13px] text-[#2d6a4f]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#2d6a4f]" />
            GPS Tracking Active
            {coords && (
              <span className="ml-1 text-[rgba(26,26,26,0.45)]">
                ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
              </span>
            )}
          </div>
        )}
        {gpsError && <p className="text-center text-[13px] text-red-600">{gpsError}</p>}
        <p className="text-center text-[12px] text-[rgba(26,26,26,0.4)]">
          Walk to the pin and tap Set Pin. GPS distance updates as you move.
        </p>
      </div>
    </div>
  );
}
