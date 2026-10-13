/**
 * What the weather normally does here: NOAA's 1991–2020 monthly climate
 * normals from the nearest reporting station.
 *
 * Normals are thirty-year averages, so they describe the usual year rather
 * than the next one. For a business that is the useful question: when is the
 * outdoor season, which months are wet, how cold does heating have to work.
 *
 * Server-only. No key required.
 */
import { CLIMATE_STATIONS } from "../geo/climateStations";
import type { ClimateMonth, ClimateSummary } from "./types";

/** Normals are fixed for a decade; there is no point re-fetching them often. */
const MONTH = 2_592_000;
const SOURCE = "NOAA NCEI — 1991–2020 Climate Normals";
const VINTAGE = "1991–2020";
const EARTH_RADIUS_MILES = 3958.8;

function haversineMiles(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(s));
}

/**
 * Nearest stations first. Several are tried because a station can be in the
 * list yet publish no temperature normals.
 */
function nearestStations(lat: number, lon: number, howMany: number) {
  return CLIMATE_STATIONS
    .map((s) => ({ id: s[0], lat: s[1], lon: s[2], name: s[3], state: s[4], distanceMiles: haversineMiles(lat, lon, s[1], s[2]) }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, howMany);
}

type NceiRow = { DATE?: string; STATION?: string; "MLY-TAVG-NORMAL"?: string; "MLY-PRCP-NORMAL"?: string };

const value = (v: string | undefined): number | null => {
  if (v === undefined) return null;
  const n = Number(v.trim());
  // NCEI uses -9999 for missing values.
  return Number.isFinite(n) && n > -999 ? n : null;
};

async function fetchNormals(stationId: string): Promise<ClimateMonth[] | null> {
  const url = new URL("https://www.ncei.noaa.gov/access/services/data/v1");
  url.searchParams.set("dataset", "normals-monthly-1991-2020");
  url.searchParams.set("stations", stationId);
  url.searchParams.set("dataTypes", "MLY-TAVG-NORMAL,MLY-PRCP-NORMAL");
  url.searchParams.set("format", "json");
  url.searchParams.set("startDate", "0001-01-01");
  url.searchParams.set("endDate", "0001-12-01");

  const res = await fetch(url, { next: { revalidate: MONTH } });
  if (!res.ok) return null;

  let rows: NceiRow[];
  try {
    rows = (await res.json()) as NceiRow[];
  } catch {
    return null;
  }
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const months: ClimateMonth[] = rows
    .map((r) => ({
      month: Number(r.DATE),
      avgTempF: value(r["MLY-TAVG-NORMAL"]),
      precipIn: value(r["MLY-PRCP-NORMAL"]),
    }))
    .filter((m) => m.month >= 1 && m.month <= 12)
    .sort((a, b) => a.month - b.month);

  // A station with no temperature normals is no use for the seasonal picture.
  return months.some((m) => m.avgTempF != null) ? months : null;
}

export async function getClimate(lat: number, lon: number): Promise<ClimateSummary | null> {
  // Prefer a station that reports both temperature and rainfall; keep the
  // first temperature-only station as a fallback so a place isn't left with
  // no seasonal picture at all.
  let fallback: { station: ReturnType<typeof nearestStations>[number]; months: ClimateMonth[] } | null = null;

  for (const station of nearestStations(lat, lon, 6)) {
    const months = await fetchNormals(station.id);
    if (!months) continue;
    const hasPrecip = months.some((m) => m.precipIn != null);
    if (!hasPrecip) {
      fallback ??= { station, months };
      continue;
    }
    return summarize(station, months);
  }
  return fallback ? summarize(fallback.station, fallback.months) : null;
}

function summarize(
  station: ReturnType<typeof nearestStations>[number],
  months: ClimateMonth[],
): ClimateSummary {
  const temps = months.filter((m) => m.avgTempF != null);
  const precip = months.filter((m) => m.precipIn != null);
  const pick = (list: ClimateMonth[], better: (a: ClimateMonth, b: ClimateMonth) => boolean) =>
    list.reduce<ClimateMonth | null>((best, m) => (!best || better(m, best) ? m : best), null);

  const warmest = pick(temps, (a, b) => (a.avgTempF as number) > (b.avgTempF as number));
  const coldest = pick(temps, (a, b) => (a.avgTempF as number) < (b.avgTempF as number));
  const wettest = pick(precip, (a, b) => (a.precipIn as number) > (b.precipIn as number));

  return {
    station: {
      id: station.id,
      name: station.name,
      state: station.state,
      distanceMiles: Math.round(station.distanceMiles * 10) / 10,
    },
    months,
    warmest: warmest ? { month: warmest.month, avgTempF: warmest.avgTempF as number } : null,
    coldest: coldest ? { month: coldest.month, avgTempF: coldest.avgTempF as number } : null,
    wettest: wettest ? { month: wettest.month, precipIn: wettest.precipIn as number } : null,
    annualPrecipIn: precip.length === 12
      ? Math.round(precip.reduce((sum, m) => sum + (m.precipIn as number), 0) * 10) / 10
      : null,
    source: SOURCE,
    vintage: VINTAGE,
  };
}

export const CLIMATE_SOURCE = SOURCE;
export const CLIMATE_LIMITATION =
  "Climate figures are thirty-year averages (1991–2020) from the nearest reporting station, which may be some miles away. They describe a typical year, not a forecast, and they do not capture how the climate is changing.";
