/**
 * Tools that let Ask MicroBiz AI query the platform's own data engines (§12).
 *
 * This is what separates it from a generic chatbot: when asked "should I open
 * a bakery in 37040?", the model doesn't reason from memory — it calls
 * run_feasibility_study, gets real Census figures back, and answers from
 * those. Every tool result carries its source so the answer can cite it.
 *
 * Server-only. Tools call the analytics layer directly rather than looping
 * back through HTTP.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { resolveGeography } from "@/lib/census/geography";
import { getBusinessActivity, getDemographics } from "@/lib/census/client";
import { getSectorEconomics } from "@/lib/census/economic";
import { getLocationProfile, getNationalReference } from "@/lib/census/location";
import { naicsForIndustry, INDUSTRY_TO_NAICS } from "@/lib/census/naics";
import { scoreLocation } from "@/lib/locationScore";
import { buildComparisons, positionScore } from "@/lib/benchmarks";
import { assessFeasibility } from "@/lib/feasibility";
import type { DataPoint } from "@/lib/census/types";
import { getCommunityProfile } from "@/lib/community";
import { deriveImplications, IMPLICATION_CAVEAT } from "@/lib/community/implications";

const INDUSTRIES = Object.keys(INDUSTRY_TO_NAICS);

/** Flattens a DataPoint for the model: value plus why it's missing. */
function flat(p: DataPoint | undefined) {
  if (!p) return null;
  return p.value === null
    ? { value: null, status: p.status, note: p.note, source: p.source, vintage: p.vintage }
    : { value: p.value, status: p.status, source: p.source, vintage: p.vintage, geography: p.geography };
}

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_market_snapshot",
    description:
      "Population, median household income, and how many businesses operate in a given sector, for a US location. " +
      "Use for questions about how big a market is, who lives there, or how many competitors exist. " +
      "Returns ZIP-level figures when a ZIP is given, plus county figures (Census withholds employment and payroll at ZIP level).",
    input_schema: {
      type: "object",
      properties: {
        location: { type: "string", description: "City and state, or a 5-digit ZIP code. e.g. 'Clarksville, TN' or '37040'" },
        industry: { type: "string", enum: INDUSTRIES, description: "The business sector to count." },
      },
      required: ["location", "industry"],
    },
  },
  {
    name: "benchmark_business",
    description:
      "Compares an existing business's revenue, revenue per employee and team size against published figures for its " +
      "sector and area. Use when the user asks how their business compares, or whether their numbers are good.",
    input_schema: {
      type: "object",
      properties: {
        location: { type: "string", description: "City and state, or ZIP code." },
        industry: { type: "string", enum: INDUSTRIES },
        annual_revenue: { type: "number", description: "The business's annual revenue in dollars." },
        employees: { type: "number", description: "Number of employees." },
        level: { type: "string", enum: ["county", "state", "us"], description: "Geography to compare against. Defaults to county." },
      },
      required: ["location", "industry", "annual_revenue", "employees"],
    },
  },
  {
    name: "score_locations",
    description:
      "Scores one to three markets on opportunity for a sector — spending power, what businesses there earn, room in " +
      "the market, and population growth. Use for 'where should I open' or 'is X or Y better' questions.",
    input_schema: {
      type: "object",
      properties: {
        locations: {
          type: "array",
          items: { type: "string" },
          description: "One to three locations, each a city and state or ZIP code.",
        },
        industry: { type: "string", enum: INDUSTRIES },
      },
      required: ["locations", "industry"],
    },
  },
  {
    name: "run_feasibility_study",
    description:
      "Tests a prospective business's assumptions against what a market supports: whether the revenue expectation is " +
      "realistic, what payroll would cost at local wages, and how far starting capital stretches. Use when someone is " +
      "considering starting a business. Startup costs, rent and inventory are NOT available from any source.",
    input_schema: {
      type: "object",
      properties: {
        location: { type: "string", description: "Target location — city and state, or ZIP code." },
        industry: { type: "string", enum: INDUSTRIES },
        expected_revenue: { type: "number", description: "Expected annual revenue in dollars." },
        employees: { type: "number", description: "Planned number of employees." },
        startup_capital: { type: "number", description: "Capital available to start, in dollars." },
      },
      required: ["location", "industry"],
    },
  },
  {
    name: "get_community_profile",
    description:
      "The community a business would operate in: age structure, income, poverty, vehicle access and broadband " +
      "(Census ACS); community health estimates such as diabetes, obesity, smoking and uninsured rates (CDC PLACES); " +
      "federally declared disasters over the last 20 years (FEMA); and climate normals (NOAA). Use for questions " +
      "about who lives somewhere, local health or demographics, weather or disaster risk, or what kind of business a " +
      "place might need. The figures describe the county, and health figures are model-based estimates. They do NOT " +
      "measure demand for any product — treat them as context to test, never as proof that something will or won't sell.",
    input_schema: {
      type: "object",
      properties: {
        location: { type: "string", description: "City and state, or ZIP code." },
        industry: { type: "string", enum: INDUSTRIES, description: "Optional: tailors what the conditions might mean." },
      },
      required: ["location"],
    },
  },
];

type ToolInput = Record<string, unknown>;

/** Runs one tool and returns a compact result for the model. */
export async function runTool(name: string, input: ToolInput): Promise<unknown> {
  const industry = String(input.industry ?? "Other");
  const sector = naicsForIndustry(industry);

  if (name === "get_community_profile") {
    const geo = await resolveGeography(String(input.location ?? ""));
    if (!geo?.countyFips) return { error: `Could not resolve "${input.location}" to a US county.` };

    const profile = await getCommunityProfile(geo, new Date().toISOString().slice(0, 10));
    if (!profile) return { error: "No community figures are published for that county." };

    const chosen = typeof input.industry === "string" && INDUSTRIES.includes(input.industry) ? input.industry : undefined;
    const flatten = (groups: { label: string; indicators: { label: string; value: number | null; national: number | null; comparison: string | null }[] }[]) =>
      Object.fromEntries(groups.flatMap((g) => g.indicators.map((i) =>
        [i.label, { value: i.value, national: i.national, vs_national: i.comparison }])));

    return {
      county: profile.geography.label,
      population: profile.population,
      people: flatten(profile.people),
      health_model_based_estimates: flatten(profile.health),
      declared_disasters_last_20_years: profile.hazards && {
        total: profile.hazards.total,
        by_type: profile.hazards.types.map((t) => `${t.type}: ${t.count} (latest ${t.latestYear})`),
      },
      climate_normals_1991_2020: profile.climate && {
        station: profile.climate.station.name,
        warmest_month_avg_f: profile.climate.warmest?.avgTempF ?? null,
        coldest_month_avg_f: profile.climate.coldest?.avgTempF ?? null,
        annual_precipitation_inches: profile.climate.annualPrecipIn,
      },
      what_this_might_mean: deriveImplications(profile, chosen).map((i) => ({
        kind: i.kind, point: i.title, based_on: i.basis, consider: i.consider,
      })),
      caveat: IMPLICATION_CAVEAT,
      sources: profile.sources,
    };
  }

  if (name === "get_market_snapshot") {
    const geo = await resolveGeography(String(input.location ?? ""));
    if (!geo) return { error: `Could not resolve location "${input.location}".` };

    const [zipDemo, countyDemo, zipAct, countyAct] = await Promise.all([
      geo.zip ? getDemographics(geo, "zip") : null,
      getDemographics(geo, "county"),
      geo.zip ? getBusinessActivity(geo, sector, "zip") : null,
      getBusinessActivity(geo, sector, "county"),
    ]);

    return {
      resolved: { zip: geo.zip, county: geo.countyName, state: geo.stateName },
      sector: sector.label,
      zip: zipDemo && {
        population: flat(zipDemo.population),
        median_household_income: flat(zipDemo.medianHouseholdIncome),
        businesses_in_sector: flat(zipAct?.establishments),
        employees_in_sector: flat(zipAct?.employees),
      },
      county: {
        population: flat(countyDemo?.population),
        median_household_income: flat(countyDemo?.medianHouseholdIncome),
        businesses_in_sector: flat(countyAct?.establishments),
        employees_in_sector: flat(countyAct?.employees),
        annual_payroll_in_sector: flat(countyAct?.annualPayroll),
      },
    };
  }

  if (name === "benchmark_business") {
    const geo = await resolveGeography(String(input.location ?? ""));
    if (!geo) return { error: `Could not resolve location "${input.location}".` };

    const level = (String(input.level ?? "county") as "county" | "state" | "us");
    const market = await getSectorEconomics(geo, sector, level);
    if (!market) return { error: "No market data available for that geography." };

    const comparisons = buildComparisons(
      { annualRevenue: Number(input.annual_revenue) || 0, employees: Number(input.employees) || 0 },
      market,
    );

    return {
      comparing_against: market.geography,
      sector: sector.label,
      position_score: positionScore(comparisons),
      comparisons: comparisons.map((c) => ({
        metric: c.label,
        yours: c.yours,
        market: c.benchmark.value,
        ratio: c.ratio,
        verdict: c.verdict,
        reading: c.reading,
        source: `${c.benchmark.source} ${c.benchmark.vintage}`,
      })),
    };
  }

  if (name === "score_locations") {
    const raw = Array.isArray(input.locations) ? input.locations.slice(0, 3) : [];
    const queries = raw.map(String).filter((q) => q.trim().length >= 3);
    if (queries.length === 0) return { error: "Provide at least one location." };

    const anchor = await resolveGeography(queries[0]);
    if (!anchor) return { error: `Could not resolve location "${queries[0]}".` };

    const [national, ...profiles] = await Promise.all([
      getNationalReference(anchor, sector),
      ...queries.map((q) => getLocationProfile(q, sector)),
    ]);

    return {
      sector: sector.label,
      markets: queries.map((query, i) => {
        const profile = profiles[i];
        if (!profile) return { query, error: "No county-level data available." };
        const score = scoreLocation(profile, national);
        return {
          market: profile.geography.label,
          opportunity_score: score.score,
          confidence: score.confidence,
          factors: score.factors.map((f) => ({ factor: f.label, subscore: f.subscore, direction: f.direction, reading: f.reading })),
        };
      }),
      source: "US Census Bureau — American Community Survey and Economic Census",
    };
  }

  if (name === "run_feasibility_study") {
    const location = String(input.location ?? "");
    const anchor = await resolveGeography(location);
    if (!anchor) return { error: `Could not resolve location "${location}".` };

    const [national, profile] = await Promise.all([
      getNationalReference(anchor, sector),
      getLocationProfile(location, sector),
    ]);
    if (!profile) return { error: "No county-level data available for that location." };

    const score = scoreLocation(profile, national);
    const result = assessFeasibility(
      {
        expectedRevenue: Number(input.expected_revenue) || 0,
        employees: Number(input.employees) || 0,
        startupCapital: Number(input.startup_capital) || 0,
      },
      profile, national, score,
    );

    return {
      market: profile.geography.label,
      sector: sector.label,
      outlook: result.outlook,
      estimated_annual_payroll: result.estimatedAnnualPayroll,
      checks: result.checks.map((c) => ({ check: c.label, status: c.status, headline: c.headline, detail: c.detail })),
      key_figures: result.summaryFacts,
      not_available: "Startup costs, rent, equipment and inventory are not published by any free federal source and must not be estimated.",
    };
  }

  return { error: `Unknown tool: ${name}` };
}
