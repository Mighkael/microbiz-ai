/**
 * Assembles the community profile for a place: people, health, hazards and
 * climate, fetched together and each allowed to fail on its own.
 *
 * A missing section is reported by name rather than hidden, so the page can
 * say "health figures didn't load" instead of quietly showing a shorter page.
 *
 * Server-only.
 */
import type { ResolvedGeography } from "../census/geography";
import { getPeople, PEOPLE_SOURCE } from "./people";
import { getHealth, HEALTH_SOURCE, HEALTH_LIMITATIONS } from "./health";
import { getHazards, HAZARDS_SOURCE, HAZARDS_LIMITATION } from "./hazards";
import { getClimate, CLIMATE_SOURCE, CLIMATE_LIMITATION } from "./climate";
import type { CommunityProfile } from "./types";

export async function getCommunityProfile(
  geo: ResolvedGeography,
  todayISO: string,
): Promise<CommunityProfile | null> {
  if (!geo.countyFips) return null;
  const countyId = `${geo.stateFips}${geo.countyFips}`;

  const [people, health, hazards, climate] = await Promise.all([
    getPeople(geo.stateFips, geo.countyFips).catch(() => null),
    getHealth(countyId).catch(() => null),
    getHazards(geo.stateFips, geo.countyFips, todayISO).catch(() => null),
    getClimate(geo.lat, geo.lon).catch(() => null),
  ]);

  if (!people && !health) return null;

  const unavailable: string[] = [];
  if (!people) unavailable.push("Population and income figures");
  if (!health) unavailable.push("Health figures");
  if (!hazards) unavailable.push("Disaster history");
  if (!climate) unavailable.push("Climate normals");

  const sources = [
    people ? PEOPLE_SOURCE : null,
    health ? `${HEALTH_SOURCE} ${health.vintage}` : null,
    hazards ? HAZARDS_SOURCE : null,
    climate ? `${CLIMATE_SOURCE} (station ${climate.station.name})` : null,
  ].filter((s): s is string => Boolean(s));

  return {
    geography: {
      label: geo.countyName ? `${geo.countyName}, ${geo.stateName}` : geo.stateName,
      displayName: geo.displayName,
      countyFips: geo.countyFips,
      stateFips: geo.stateFips,
      lat: geo.lat,
      lon: geo.lon,
    },
    population: people?.population ?? null,
    people: people?.groups ?? [],
    health: health?.groups ?? [],
    hazards,
    climate,
    unavailable,
    sources,
    limitations: [
      "Everything here describes the county, not a street or neighborhood. Conditions vary a lot within a county, so treat it as the backdrop and check the immediate area yourself.",
      ...(health ? HEALTH_LIMITATIONS : []),
      ...(hazards ? [HAZARDS_LIMITATION] : []),
      ...(climate ? [CLIMATE_LIMITATION] : []),
    ],
  };
}

export type { CommunityProfile } from "./types";
