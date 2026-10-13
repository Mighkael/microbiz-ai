/**
 * Who lives here: age structure, households, income, means and access.
 *
 * American Community Survey 5-year data profiles — counted (well, surveyed)
 * rather than modelled, and published for every county. Two calls: the county
 * and the United States, so every figure can be read against the national one.
 *
 * Server-only.
 */
import { compare, num, type Indicator, type IndicatorGroup } from "./types";

const DAY = 86400;
const VINTAGE = "2023";
const SOURCE = "US Census Bureau — American Community Survey (5-year)";
const BASE = `https://api.census.gov/data/${VINTAGE}/acs/acs5/profile`;

/** Verified against the 2023 profile tables; these codes move between years. */
const VARS = {
  population: "DP05_0001E",
  medianAge: "DP05_0018E",
  under18: "DP05_0019PE",
  over65: "DP05_0024PE",
  householdsWithChildren: "DP02_0014PE",
  householdSize: "DP02_0016E",
  bachelors: "DP02_0068PE",
  disability: "DP02_0072PE",
  broadband: "DP02_0154PE",
  veterans: "DP02_0070PE",
  commuteMinutes: "DP03_0025E",
  medianIncome: "DP03_0062E",
  uninsured: "DP03_0099PE",
  poverty: "DP03_0128PE",
  noVehicle: "DP04_0058PE",
  renters: "DP04_0047PE",
  englishOnly: "DP02_0113PE",
  laborForce: "DP03_0002PE",
} as const;

/** Five years earlier, for population change. The windows don't overlap. */
const THEN_VINTAGE = "2018";

type Key = keyof typeof VARS;
type Row = Partial<Record<Key, number | null>>;

async function fetchProfile(forClause: string, inClause?: string): Promise<Row | null> {
  const url = new URL(BASE);
  url.searchParams.set("get", Object.values(VARS).join(","));
  url.searchParams.set("for", forClause);
  if (inClause) url.searchParams.set("in", inClause);
  url.searchParams.set("key", process.env.CENSUS_API_KEY ?? "");

  const res = await fetch(url, { next: { revalidate: DAY } });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim().startsWith("[")) return null;
  const rows = JSON.parse(text) as string[][];
  if (rows.length < 2) return null;

  const header = rows[0];
  const data = rows[1];
  const out: Row = {};
  for (const [key, code] of Object.entries(VARS) as [Key, string][]) {
    out[key] = num(data[header.indexOf(code)]);
  }
  return out;
}

/** "Speak a language other than English at home" is the complement of what ACS publishes. */
const otherLanguage = (englishOnly: number | null) => (englishOnly == null ? null : Math.round((100 - englishOnly) * 10) / 10);

async function fetchPopulationThen(forClause: string, inClause?: string): Promise<number | null> {
  const url = new URL(`https://api.census.gov/data/${THEN_VINTAGE}/acs/acs5/profile`);
  url.searchParams.set("get", VARS.population);
  url.searchParams.set("for", forClause);
  if (inClause) url.searchParams.set("in", inClause);
  url.searchParams.set("key", process.env.CENSUS_API_KEY ?? "");
  const res = await fetch(url, { next: { revalidate: DAY } });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim().startsWith("[")) return null;
  const rows = JSON.parse(text) as string[][];
  return rows.length < 2 ? null : num(rows[1][0]);
}

const growthPercent = (now: number | null, then: number | null) =>
  now == null || then == null || then === 0 ? null : Math.round(((now - then) / then) * 1000) / 10;

/** 18–64: the ages most likely to be working, and the local hiring pool. */
const workingAge = (under18: number | null, over65: number | null) =>
  under18 == null || over65 == null ? null : Math.round((100 - under18 - over65) * 10) / 10;

export type PeopleResult = { groups: IndicatorGroup[]; population: number | null };

export async function getPeople(stateFips: string, countyFips: string): Promise<PeopleResult | null> {
  const [local, national, localThen, nationalThen] = await Promise.all([
    fetchProfile(`county:${countyFips}`, `state:${stateFips}`),
    fetchProfile("us:1"),
    fetchPopulationThen(`county:${countyFips}`, `state:${stateFips}`),
    fetchPopulationThen("us:1"),
  ]);
  if (!local) return null;

  const localGrowth = growthPercent(local.population ?? null, localThen);
  const nationalGrowth = growthPercent(national?.population ?? null, nationalThen);
  const localWorkingAge = workingAge(local.under18 ?? null, local.over65 ?? null);
  const nationalWorkingAge = workingAge(national?.under18 ?? null, national?.over65 ?? null);
  const derived = (
    key: string, label: string, value: number | null, nat: number | null, note: string,
  ): Indicator => ({
    key, label, value, unit: "percent", national: nat,
    comparison: compare(value, nat, "percent"), source: SOURCE, vintage: VINTAGE, note,
  });

  const ind = (
    key: string, label: string, field: Key, unit: Indicator["unit"], note?: string,
  ): Indicator => {
    const value = local[field] ?? null;
    const nat = national?.[field] ?? null;
    return { key, label, value, unit, national: nat, comparison: compare(value, nat, unit), source: SOURCE, vintage: VINTAGE, note };
  };

  const groups: IndicatorGroup[] = [
    {
      key: "ages",
      label: "Who lives here",
      blurb: "The age mix shapes what sells, when people shop, and who you can hire.",
      indicators: [
        // No national comparison: "smaller than the United States" says nothing.
        {
          key: "population", label: "Population", value: local.population ?? null, unit: "people",
          national: null, comparison: null, source: SOURCE, vintage: VINTAGE,
        },
        ind("medianAge", "Median age", "medianAge", "years"),
        ind("under18", "Children under 18", "under18", "percent"),
        ind("over65", "Aged 65 and over", "over65", "percent"),
        ind("householdsWithChildren", "Households with children", "householdsWithChildren", "percent"),
        ind("householdSize", "Average household size", "householdSize", "people"),
        ind("veterans", "Veterans (adults)", "veterans", "percent"),
        derived("populationGrowth", "Population change over five years", localGrowth, nationalGrowth,
          `Calculated by MicroBiz AI from ACS ${THEN_VINTAGE} and ${VINTAGE} population. The two five-year windows don't overlap.`),
        {
          key: "otherLanguage",
          label: "Speak a language other than English at home",
          value: otherLanguage(local.englishOnly ?? null),
          unit: "percent",
          national: otherLanguage(national?.englishOnly ?? null),
          comparison: compare(otherLanguage(local.englishOnly ?? null), otherLanguage(national?.englishOnly ?? null), "percent"),
          source: SOURCE, vintage: VINTAGE,
          note: "Calculated by MicroBiz AI as 100% minus the share who speak only English at home.",
        },
      ],
    },
    {
      key: "means",
      label: "Spending power",
      blurb: "What customers can afford, and how price-sensitive the market is likely to be.",
      indicators: [
        ind("medianIncome", "Median household income", "medianIncome", "dollars"),
        ind("poverty", "People below the poverty line", "poverty", "percent"),
        ind("renters", "Homes that are rented", "renters", "percent"),
      ],
    },
    {
      key: "workforce",
      label: "The people you could hire",
      blurb: "Who is available to work, and what they bring — the other half of whether a business can run here.",
      indicators: [
        derived("workingAge", "Aged 18–64", localWorkingAge, nationalWorkingAge,
          "Calculated by MicroBiz AI as everyone who is neither under 18 nor over 65."),
        ind("laborForce", "Adults in the labor force", "laborForce", "percent"),
        ind("bachelors", "Adults with a bachelor's degree or higher", "bachelors", "percent"),
      ],
    },
    {
      key: "access",
      label: "Getting to you, and reaching you",
      blurb: "How customers travel and whether they are online — which decides where you site and how you sell.",
      indicators: [
        ind("noVehicle", "Households with no vehicle", "noVehicle", "percent"),
        ind("commuteMinutes", "Average commute", "commuteMinutes", "minutes"),
        ind("broadband", "Households with broadband internet", "broadband", "percent"),
        ind("uninsured", "People without health insurance", "uninsured", "percent"),
        ind("disability", "People living with a disability", "disability", "percent"),
      ],
    },
  ];

  return { groups, population: local.population ?? null };
}

export const PEOPLE_SOURCE = `${SOURCE} ${VINTAGE}`;
