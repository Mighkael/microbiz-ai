/**
 * Community health, from the CDC's PLACES program.
 *
 * An important caveat carried everywhere these figures appear: PLACES numbers
 * are *model-based estimates*, not counts. The CDC builds them from the
 * national BRFSS survey plus local demographics, which is why every county in
 * the country has a figure even though nobody surveyed every county. They are
 * good for comparing places and spotting what stands out; they are not a
 * census of anyone's health, and a single county figure carries uncertainty.
 *
 * Crude prevalence is used — the share of adults in this county — because an
 * owner serving this market cares how many people are actually affected, not
 * what the rate would be if the county had the national age mix.
 *
 * Server-only.
 */
import { compare, num, type Indicator, type IndicatorGroup } from "./types";

const DAY = 86400;
/** PLACES: Local Data for Better Health, County Data, 2025 release. */
const DATASET = "swc5-untb";
const BASE = `https://data.cdc.gov/resource/${DATASET}.json`;
const SOURCE = "CDC PLACES (model-based estimates)";
const MODELLED = "A model-based estimate for this county, not a count. Good for comparison; not a measurement of local people.";

type Measure = { id: string; label: string };

const GROUPS: { key: string; label: string; blurb: string; measures: Measure[] }[] = [
  {
    key: "conditions",
    label: "Long-term conditions among adults",
    blurb: "What people here are living with, which shapes both what they need and what they avoid.",
    measures: [
      { id: "DIABETES", label: "Diabetes" },
      { id: "OBESITY", label: "Obesity" },
      { id: "BPHIGH", label: "High blood pressure" },
      { id: "HIGHCHOL", label: "High cholesterol" },
      { id: "CASTHMA", label: "Asthma" },
      { id: "COPD", label: "COPD" },
      { id: "CHD", label: "Heart disease" },
      { id: "ARTHRITIS", label: "Arthritis" },
      { id: "CANCER", label: "Cancer (excluding skin)" },
    ],
  },
  {
    key: "behaviors",
    label: "Everyday habits",
    blurb: "Habits that create demand for some businesses and dampen it for others.",
    measures: [
      { id: "CSMOKING", label: "Currently smoke cigarettes" },
      { id: "BINGE", label: "Binge drinking" },
      { id: "LPA", label: "No leisure-time physical activity" },
      { id: "SLEEP", label: "Sleep under 7 hours" },
      { id: "TEETHLOST", label: "Lost all natural teeth (65+)" },
    ],
  },
  {
    key: "wellbeing",
    label: "Wellbeing and daily living",
    blurb: "How people rate their own health, and how many need support to get through the day.",
    measures: [
      { id: "GHLTH", label: "Fair or poor general health" },
      { id: "MHLTH", label: "Frequent mental distress" },
      { id: "DEPRESSION", label: "Depression" },
      { id: "DISABILITY", label: "Any disability" },
      { id: "MOBILITY", label: "Difficulty walking or climbing stairs" },
      { id: "INDEPLIVE", label: "Difficulty running errands alone" },
    ],
  },
  {
    key: "care",
    label: "Getting care",
    blurb: "Whether people can reach care — which matters for health businesses, and for staff too.",
    measures: [
      { id: "ACCESS2", label: "No health insurance (adults 18–64)" },
      { id: "CHECKUP", label: "Routine check-up in the past year" },
      { id: "DENTAL", label: "Dentist visit in the past year" },
      { id: "BPMED", label: "Taking blood pressure medication" },
      { id: "COLON_SCREEN", label: "Up to date with colorectal screening" },
    ],
  },
];

/** Measures where a higher number is the good news, so the UI can colour them correctly. */
export const HIGHER_IS_BETTER = new Set(["CHECKUP", "DENTAL", "BPMED", "COLON_SCREEN", "CHOLSCREEN", "MAMMOUSE"]);

type Row = { measureid: string; data_value: string; year: string; totalpopulation?: string };

async function socrata<T>(url: URL, revalidate = DAY): Promise<T | null> {
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export type HealthResult = { groups: IndicatorGroup[]; vintage: string };

export async function getHealth(countyFips: string): Promise<HealthResult | null> {
  const county = new URL(BASE);
  county.searchParams.set("locationid", countyFips);
  county.searchParams.set("data_value_type", "Crude prevalence");
  county.searchParams.set("$select", "measureid,data_value,year,totalpopulation");
  county.searchParams.set("$limit", "60");

  // One call gives the average across all US counties for every measure, so a
  // local figure can be read against the typical county.
  const national = new URL(BASE);
  national.searchParams.set("$select", "measureid,avg(data_value)");
  national.searchParams.set("$where", "data_value_type='Crude prevalence'");
  national.searchParams.set("$group", "measureid");
  national.searchParams.set("$limit", "60");

  const [localRows, nationalRows] = await Promise.all([
    socrata<Row[]>(county),
    socrata<{ measureid: string; avg_data_value: string }[]>(national, DAY * 7),
  ]);
  if (!localRows || localRows.length === 0) return null;

  const localBy = new Map(localRows.map((r) => [r.measureid, r]));
  const nationalBy = new Map((nationalRows ?? []).map((r) => [r.measureid, num(r.avg_data_value)]));
  const vintage = localRows[0]?.year ?? "";

  const groups: IndicatorGroup[] = GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    blurb: g.blurb,
    indicators: g.measures.flatMap((m): Indicator[] => {
      const row = localBy.get(m.id);
      if (!row) return [];
      const value = num(row.data_value);
      const nat = nationalBy.get(m.id) ?? null;
      return [{
        key: m.id,
        label: m.label,
        value,
        unit: "percent",
        national: nat == null ? null : Math.round(nat * 10) / 10,
        comparison: compare(value, nat, "percent"),
        source: SOURCE,
        vintage: row.year ?? vintage,
        note: MODELLED,
      }];
    }),
  })).filter((g) => g.indicators.length > 0);

  return groups.length ? { groups, vintage } : null;
}

export const HEALTH_SOURCE = SOURCE;
export const HEALTH_LIMITATIONS = [
  "Health figures are model-based estimates from CDC PLACES, built from a national survey and local demographics — not counts of people in this county. Use them to see what stands out, not as a measurement.",
  "Rates are for adults, as a share of the county's adult population, and the national figure shown is the average across all US counties.",
];
