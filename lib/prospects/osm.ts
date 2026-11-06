/**
 * Finds businesses near a point from OpenStreetMap, via the Overpass API.
 *
 * Why this source: every detail here was put on a public map by the business
 * itself or by a local mapper, under an open licence. Nothing is crawled from
 * private pages, nothing is bought from a data broker, and no personal
 * addresses are collected — only the contact details a business chose to
 * publish for customers to use.
 *
 * Overpass is run by volunteers, so results are cached for a day, the radius
 * is capped, and every request identifies itself.
 *
 * Server-only.
 */
import { revalidateTag } from "next/cache";
import { TARGET_CATEGORIES, targetByKey } from "./categories";
import type { Prospect } from "./types";

const DAY = 86400;
const ENDPOINT = "https://overpass-api.de/api/interpreter";
const EARTH_RADIUS_MILES = 3958.8;

export const MAX_RADIUS_MILES = 25;
export const MAX_RESULTS = 150;
/** Overpass is slow on broad queries; keeping a search narrow keeps it inside the request budget. */
export const MAX_TARGETS = 4;

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function haversineMiles(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(s));
}

/** Readable name for whatever kind of place this is. */
function categoryOf(tags: Record<string, string>): string {
  const raw = tags.shop ?? tags.office ?? tags.craft ?? tags.amenity ?? tags.healthcare
    ?? tags.tourism ?? tags.leisure ?? tags.industrial ?? "business";
  return raw.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function addressOf(tags: Record<string, string>): string | null {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:city"],
    tags["addr:state"],
    tags["addr:postcode"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function emailOf(tags: Record<string, string>): string | null {
  const raw = (tags.email ?? tags["contact:email"] ?? "").split(";")[0].trim().toLowerCase();
  return EMAIL_RE.test(raw) ? raw : null;
}

function websiteOf(tags: Record<string, string>): string | null {
  const raw = (tags.website ?? tags["contact:website"] ?? tags.url ?? "").split(";")[0].trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export type SearchOptions = {
  lat: number;
  lon: number;
  radiusMiles: number;
  /** Category keys from lib/prospects/categories.ts. */
  targets: string[];
  /** Only keep businesses that published a way to contact them. */
  needsContact?: boolean;
};

export type SearchResult = {
  prospects: Prospect[];
  /** Everything found, before the contact filter — so the UI can be honest about coverage. */
  totalFound: number;
  withEmail: number;
  withWebsite: number;
  withPhone: number;
  radiusMiles: number;
};

export async function findProspects(opts: SearchOptions): Promise<SearchResult | null> {
  const radiusMiles = Math.min(Math.max(opts.radiusMiles, 1), MAX_RADIUS_MILES);

  const chosen = opts.targets.length
    ? opts.targets.map(targetByKey).filter((t): t is NonNullable<typeof t> => Boolean(t))
    : TARGET_CATEGORIES;
  if (chosen.length === 0) return null;

  // One union query: every filter, around the point, with names only.
  // A bounding box rather than a radius: Overpass answers box queries from
  // its spatial index, where "around" measures a distance to every candidate
  // and times out on anything broad. The true radius is applied below, on
  // figures we calculate ourselves.
  const dLat = radiusMiles / 69;
  const dLon = radiusMiles / (69 * Math.cos((opts.lat * Math.PI) / 180));
  const bbox = [opts.lat - dLat, opts.lon - dLon, opts.lat + dLat, opts.lon + dLon]
    .map((n) => n.toFixed(4))
    .join(",");

  // nw, not nwr: relations are rarely businesses and cost Overpass real time.
  const clauses = chosen
    .flatMap((t) => t.filters)
    .map((f) => `nw${f}["name"](${bbox});`)
    .join("");
  const query = `[out:json][timeout:40];(${clauses});out tags center ${MAX_RESULTS * 3};`;

  // Tagged so a bad answer can be thrown out of the cache rather than served
  // for a day — see below.
  const tag = `overpass:${hash(query)}`;
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "MicroBizAI/1.0 (https://www.microbiz-ai.com)",
    },
    body: new URLSearchParams({ data: query }),
    next: { revalidate: DAY, tags: [tag] },
  });
  if (!res.ok) return null;

  let payload: { elements?: OsmElement[]; remark?: string };
  try {
    payload = (await res.json()) as { elements?: OsmElement[]; remark?: string };
  } catch {
    return null;
  }

  // An overloaded Overpass answers HTTP 200 with an empty list and a remark
  // such as "runtime error: Query timed out". Read literally that looks like
  // "there are no businesses here", which is the opposite of the truth — so
  // it is treated as a failure, and purged so the next attempt refetches.
  const failed = Boolean(payload.remark && /timed out|error|runtime/i.test(payload.remark));
  if (failed) {
    // Next 16 wants a staleness profile; "max" drops it immediately.
    revalidateTag(tag, "max");
    return null;
  }

  const elements = payload.elements ?? [];

  const seen = new Set<string>();
  const all: Prospect[] = [];
  for (const el of elements) {
    const tags = el.tags;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!tags?.name || lat == null || lon == null) continue;

    // The same business can be mapped as both a point and a building.
    const dedupeKey = `${tags.name.toLowerCase()}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    // The box has corners; the radius the owner asked for does not.
    const distanceMiles = haversineMiles(opts.lat, opts.lon, lat, lon);
    if (distanceMiles > radiusMiles) continue;

    all.push({
      id: `${el.type}/${el.id}`,
      name: tags.name.slice(0, 160),
      category: categoryOf(tags),
      address: addressOf(tags),
      lat,
      lon,
      website: websiteOf(tags),
      email: emailOf(tags),
      phone: (tags.phone ?? tags["contact:phone"] ?? "").split(";")[0].trim() || null,
      distanceMiles: Math.round(distanceMiles * 10) / 10,
    });
  }

  const withEmail = all.filter((p) => p.email).length;
  const withWebsite = all.filter((p) => p.website).length;
  const withPhone = all.filter((p) => p.phone).length;

  const kept = (opts.needsContact ? all.filter((p) => p.email || p.website || p.phone) : all)
    // Contactable first, then nearest.
    .sort((a, b) => {
      const score = (p: Prospect) => (p.email ? 2 : 0) + (p.website || p.phone ? 1 : 0);
      return score(b) - score(a) || a.distanceMiles - b.distanceMiles;
    })
    .slice(0, MAX_RESULTS);

  return { prospects: kept, totalFound: all.length, withEmail, withWebsite, withPhone, radiusMiles };
}

/** Small stable hash, just to name a cache tag. */
function hash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export const OSM_SOURCE = "OpenStreetMap contributors (ODbL) via the Overpass API";

export const OSM_LIMITATIONS = [
  "These are businesses mapped on OpenStreetMap, an open map anyone can edit. It is good on high streets and patchy in business parks, so treat it as a strong start rather than a complete list of everyone in the area.",
  "Only contact details the business published on its own public listing are shown. Nothing is crawled from private pages or social accounts, and no personal addresses are collected.",
  "Details can be out of date. Check a business is still trading, and still the right fit, before you contact it.",
];
