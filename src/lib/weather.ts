/**
 * weather.ts — live course conditions + physics-based yardage adjustment.
 *
 * Pulls current weather from Open-Meteo (free, no API key) and adjusts a target
 * yardage for temperature, wind (head/tailwind component) and elevation. Golf
 * ball flight genuinely changes with all three, so the caddie can tell you how
 * many yards a shot is *really* playing.
 */

export interface CourseWeather {
  tempF: number;
  apparentTempF: number;
  windMph: number;
  windDeg: number; // 0=N, 90=E, 180=S, 270=W
  windCardinal: string;
  fetchedAt: string;
}

export interface YardageAdjustment {
  adjustedYards: number;
  delta: number; // adjusted - raw
  breakdown: string;
}

const CACHE_PREFIX = "course-weather-v1";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — conditions drift slowly

function cardinalFromDeg(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}

export async function fetchCourseWeather(
  lat: number,
  lng: number
): Promise<CourseWeather | null> {
  const key = `${CACHE_PREFIX}:${lat.toFixed(3)},${lng.toFixed(3)}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const cached = JSON.parse(raw) as CourseWeather;
      if (Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS) {
        return cached;
      }
    }
  } catch {
    /* ignore cache miss */
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,wind_speed_10m,wind_direction_10m,apparent_temperature` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        apparent_temperature?: number;
        wind_speed_10m?: number;
        wind_direction_10m?: number;
      };
    };
    const c = data.current;
    if (!c) return null;
    const weather: CourseWeather = {
      tempF: Math.round(c.temperature_2m ?? 70),
      apparentTempF: Math.round(c.apparent_temperature ?? c.temperature_2m ?? 70),
      windMph: Math.round(c.wind_speed_10m ?? 0),
      windDeg: Math.round(c.wind_direction_10m ?? 0),
      windCardinal: cardinalFromDeg(c.wind_direction_10m ?? 0),
      fetchedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(key, JSON.stringify(weather));
    } catch {
      /* best-effort cache */
    }
    return weather;
  } catch {
    return null;
  }
}

/**
 * Adjust a target yardage for real playing conditions.
 *
 * Temperature: +0.5% per 10°F above 70°F (cold air is denser → ball flies shorter).
 * Wind: ~1.5 yds per mph of head/tailwind component (cosine of angle to shot bearing).
 * Elevation: +1% per 1000 ft above sea level (thin air → ball carries farther).
 */
export function calcYardageAdjustment(
  targetYards: number,
  tempF: number,
  windMph: number,
  windDeg: number,
  shotBearingDeg: number,
  elevationFt: number
): YardageAdjustment {
  const tempDelta = ((tempF - 70) * 0.005) / 10; // fractional change per yard

  // Wind blows FROM windDeg. A wind from directly ahead of the shot bearing is a
  // pure headwind. Wind direction is "coming from", so a wind from the same
  // bearing the player aims at is a headwind → cos(0) should be negative.
  const angle = (((windDeg - shotBearingDeg) + 360) % 360);
  const headwindComponent = Math.cos((angle * Math.PI) / 180); // +1 tail-ish, -1 head-ish
  const windYards = headwindComponent * windMph * 1.5;

  const elevDelta = (elevationFt / 1000) * 0.01;

  const totalMultiplier = 1 + tempDelta + elevDelta;
  const adjustedYards = Math.round(targetYards * totalMultiplier + windYards);

  const tempY = Math.round(tempDelta * targetYards);
  const windY = Math.round(windYards);
  const breakdown =
    `${tempY >= 0 ? "+" : ""}${tempY}y temp, ${windY >= 0 ? "+" : ""}${windY}y wind`;

  return { adjustedYards, delta: adjustedYards - targetYards, breakdown };
}
