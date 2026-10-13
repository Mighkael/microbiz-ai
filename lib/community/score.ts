/**
 * The Community Conditions Score: the place as somewhere to run a business.
 *
 * What it is: five pillars, each built from published figures, each scored so
 * that 50 means "the typical US county". It answers "how do conditions here
 * compare with the rest of the country, and where is the strain?"
 *
 * What it is NOT, and the page says so: a forecast of sales. Conditions are
 * not demand. A hard place can hold a thriving business and an easy one can
 * starve it. The score exists so several places can be compared on the same
 * basis, and so the reasons behind the number are visible — every pillar
 * lists the figures that moved it.
 *
 * Deliberately kept apart from the market Opportunity Score, which measures
 * what businesses in a sector actually earn in that place. The two answer
 * different questions and are shown side by side rather than merged.
 */
import type { CommunityProfile, Indicator } from "./types";

export type PillarKey = "customers" | "workforce" | "access" | "resilience" | "fit";

export type Pillar = {
  key: PillarKey;
  label: string;
  /** 0–100, where 50 is the typical US county (except resilience — see `basis`). */
  score: number;
  weight: number;
  /** How the pillar was measured, in plain words. */
  reading: string;
  /** The figures behind it. */
  drivers: string[];
  basis: "national" | "banded" | "rules";
};

export type CommunityScore = {
  score: number;
  band: { label: string; blurb: string };
  pillars: Pillar[];
  /** How many pillars had enough data — a score from two is worth less. */
  confidence: "high" | "moderate" | "limited";
  verdict: string;
  method: string[];
};

/** Parity with the national figure is 50; twice the national figure caps at 100. */
const ratioScore = (ratio: number) => Math.max(0, Math.min(100, 50 * Math.min(ratio, 2)));
const higherBetter = (v: number | null, n: number | null) => (v == null || !n ? null : ratioScore(v / n));
const lowerBetter = (v: number | null, n: number | null) => (v == null || !v || n == null ? null : ratioScore(n / v));

const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
const usd = (v: number | null) => (v == null ? "—" : v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }));

function find(profile: CommunityProfile, key: string): Indicator | null {
  for (const g of [...profile.people, ...profile.health]) {
    const hit = g.indicators.find((i) => i.key === key);
    if (hit) return hit;
  }
  return null;
}

const mean = (xs: (number | null)[]) => {
  const got = xs.filter((x): x is number => x != null);
  return got.length ? got.reduce((a, b) => a + b, 0) / got.length : null;
};

/* ------------------------------------------------------------------ */
/* Industry alignment                                                  */
/* ------------------------------------------------------------------ */

type Signal = { label: string; points: number };

/**
 * Where a community's make-up lines up with what an industry typically needs
 * or serves. Each rule is one visible reason, worth a few points either way,
 * starting from 50 — never a hidden adjustment.
 *
 * Health conditions raise this only for businesses that help manage them.
 * They are never counted as reducing demand for anyone, because no published
 * data supports that.
 */
function industryAlignment(profile: CommunityProfile, industry?: string): { score: number; signals: Signal[] } | null {
  if (!industry) return null;
  const signals: Signal[] = [];
  const v = (k: string) => find(profile, k);
  const isHigh = (k: string) => v(k)?.comparison === "higher";
  const isLow = (k: string) => v(k)?.comparison === "lower";

  const chronic = ["DIABETES", "OBESITY", "BPHIGH", "COPD", "CHD", "ARTHRITIS"].filter(isHigh).length;

  switch (industry) {
    case "Healthcare":
      if (chronic >= 2) signals.push({ label: `${chronic} long-term conditions run above the national rate — more people needing care`, points: 12 });
      if (isHigh("over65")) signals.push({ label: `An older population (${pct(v("over65")?.value ?? null)} aged 65+)`, points: 8 });
      if (isHigh("disability")) signals.push({ label: `More people living with a disability (${pct(v("disability")?.value ?? null)})`, points: 6 });
      if (isHigh("ACCESS2")) signals.push({ label: `More patients uninsured (${pct(v("ACCESS2")?.value ?? null)}) — harder to get paid`, points: -10 });
      if (isHigh("MHLTH")) signals.push({ label: "Frequent mental distress above average — unmet need for mental health services", points: 6 });
      break;

    case "Personal services / Beauty":
      if (isHigh("over65")) signals.push({ label: "An older population, which uses personal services steadily", points: 6 });
      if (isHigh("LPA")) signals.push({ label: "Little spare-time exercise reported — room for accessible activity and wellbeing services", points: 6 });
      if (isLow("medianIncome")) signals.push({ label: `Lower household income (${usd(v("medianIncome")?.value ?? null)}) limits discretionary spend`, points: -8 });
      break;

    case "Restaurant / Food service":
      if (isHigh("commuteMinutes")) signals.push({ label: "Long commutes favor grab-and-go and early or late trade", points: 6 });
      if (isHigh("householdsWithChildren")) signals.push({ label: "More households with children — family trade", points: 5 });
      if (isHigh("poverty")) signals.push({ label: `Higher poverty (${pct(v("poverty")?.value ?? null)}) squeezes eating out`, points: -8 });
      break;

    case "Retail":
    case "E-commerce":
      if (isLow("broadband") && industry === "E-commerce") signals.push({ label: `Fewer homes with broadband (${pct(v("broadband")?.value ?? null)}) — a smaller online market`, points: -12 });
      if (isHigh("broadband") && industry === "E-commerce") signals.push({ label: "More homes with broadband than average", points: 8 });
      if (isHigh("noVehicle") && industry === "Retail") signals.push({ label: `${pct(v("noVehicle")?.value ?? null)} of households have no car — siting decides reach`, points: -8 });
      if (isHigh("populationGrowth")) signals.push({ label: "Population growing faster than the country", points: 8 });
      break;

    case "Construction / Trades":
      if ((profile.hazards?.total ?? 0) >= 8) signals.push({ label: `${profile.hazards?.total} declared disasters since ${profile.hazards?.sinceYear} — recurring repair work`, points: 10 });
      if (isHigh("populationGrowth")) signals.push({ label: "A growing population drives building and renovation", points: 8 });
      if (isLow("renters")) signals.push({ label: "More homeowners than average — the people who pay for improvements", points: 5 });
      break;

    case "Professional services":
    case "Technology / SaaS":
      if (isHigh("bachelors")) signals.push({ label: `More graduates (${pct(v("bachelors")?.value ?? null)}) — both clients and recruits`, points: 10 });
      if (isLow("bachelors")) signals.push({ label: `Fewer graduates (${pct(v("bachelors")?.value ?? null)}) — a thinner hiring pool locally`, points: -8 });
      if (isHigh("broadband")) signals.push({ label: "Good broadband coverage", points: 4 });
      break;

    case "Transportation / Logistics":
      if (isHigh("populationGrowth")) signals.push({ label: "A growing population means more goods moving", points: 6 });
      if (isHigh("workingAge")) signals.push({ label: "A large working-age population to recruit drivers from", points: 6 });
      break;

    case "Manufacturing":
      if (isHigh("workingAge")) signals.push({ label: `A large working-age population (${pct(v("workingAge")?.value ?? null)})`, points: 8 });
      if (isHigh("laborForce")) signals.push({ label: "More adults in the labor force than average", points: 5 });
      break;

    default:
      break;
  }

  if (isHigh("veterans") && ["Healthcare", "Personal services / Beauty", "Retail", "Restaurant / Food service"].includes(industry)) {
    signals.push({ label: `A large military-connected population (${pct(v("veterans")?.value ?? null)} veterans) with steady federal pay`, points: 5 });
  }

  if (signals.length === 0) return null;
  const score = Math.max(0, Math.min(100, 50 + signals.reduce((s, x) => s + x.points, 0)));
  return { score, signals };
}

/* ------------------------------------------------------------------ */

/** Banded, not compared with other counties — see the method note. */
function resilienceScore(profile: CommunityProfile): { score: number; drivers: string[] } | null {
  const hz = profile.hazards;
  if (!hz) return null;
  const drivers: string[] = [];
  const total = hz.total;
  let score = total <= 2 ? 75 : total <= 5 ? 62 : total <= 9 ? 52 : total <= 15 ? 42 : total <= 24 ? 32 : 22;
  drivers.push(`${total} federally declared disasters since ${hz.sinceYear}${hz.types[0] ? `, most often ${hz.types[0].type.toLowerCase()}` : ""}`);

  const cl = profile.climate;
  if (cl?.warmest && cl.warmest.avgTempF >= 85) { score -= 6; drivers.push(`Very hot summers (${Math.round(cl.warmest.avgTempF)}°F in the warmest month) — higher cooling costs`); }
  if (cl?.coldest && cl.coldest.avgTempF <= 25) { score -= 6; drivers.push(`Hard winters (${Math.round(cl.coldest.avgTempF)}°F in the coldest month) — heating costs and lost days`); }
  if (cl?.annualPrecipIn != null && cl.annualPrecipIn >= 55) { score -= 4; drivers.push(`Wet climate (${cl.annualPrecipIn} inches a year)`); }

  return { score: Math.max(0, Math.min(100, score)), drivers };
}

const BANDS = [
  { min: 62, label: "Favorable conditions", blurb: "On the measures we can check, this county is an easier place to operate than most." },
  { min: 52, label: "Slightly above average", blurb: "Conditions are a little better than the typical US county, with specific strengths and strains below." },
  { min: 45, label: "Typical", blurb: "This county sits close to the national middle. What matters is which pillar is weak, not the overall number." },
  { min: 35, label: "Demanding", blurb: "Several conditions here are harder than average. Businesses do succeed in such places, but the plan has to account for them." },
  { min: 0, label: "Hard conditions", blurb: "Conditions are well below the national picture on most pillars. Treat the specific strains below as things to plan around, not reasons to walk away." },
];

export function scoreCommunity(profile: CommunityProfile, industry?: string): CommunityScore | null {
  const v = (k: string) => find(profile, k);
  const pillars: Pillar[] = [];

  /* Customers — can people here spend, and are there more of them each year? */
  const income = v("medianIncome");
  const poverty = v("poverty");
  const growth = v("populationGrowth");
  const customers = mean([
    higherBetter(income?.value ?? null, income?.national ?? null),
    lowerBetter(poverty?.value ?? null, poverty?.national ?? null),
    growth?.value != null ? Math.max(0, Math.min(100, 50 + growth.value * 4)) : null,
  ]);
  if (customers != null) {
    pillars.push({
      key: "customers", label: "Customer base", score: customers, weight: 0.3, basis: "national",
      reading: "Household income, poverty and how fast the population is changing, against the national figures.",
      drivers: [
        income?.value != null ? `Median household income ${usd(income.value)} against ${usd(income.national)} nationally` : "",
        poverty?.value != null ? `${pct(poverty.value)} below the poverty line against ${pct(poverty.national)}` : "",
        growth?.value != null ? `Population ${growth.value >= 0 ? "up" : "down"} ${Math.abs(growth.value).toFixed(1)}% over five years (nationally ${growth.national?.toFixed(1)}%)` : "",
      ].filter(Boolean),
    });
  }

  /* Workforce — can you staff it? */
  const workingAge = v("workingAge");
  const labor = v("laborForce");
  const degree = v("bachelors");
  const workforce = mean([
    higherBetter(workingAge?.value ?? null, workingAge?.national ?? null),
    higherBetter(labor?.value ?? null, labor?.national ?? null),
    higherBetter(degree?.value ?? null, degree?.national ?? null),
  ]);
  if (workforce != null) {
    pillars.push({
      key: "workforce", label: "Workforce", score: workforce, weight: 0.2, basis: "national",
      reading: "The share of people of working age, how many are in the labor force, and how many hold a degree.",
      drivers: [
        workingAge?.value != null ? `${pct(workingAge.value)} aged 18–64 against ${pct(workingAge.national)} nationally` : "",
        labor?.value != null ? `${pct(labor.value)} of adults in the labor force against ${pct(labor.national)}` : "",
        degree?.value != null ? `${pct(degree.value)} hold a degree against ${pct(degree.national)}` : "",
      ].filter(Boolean),
    });
  }

  /* Access — can customers reach you, and can you reach them? */
  const noVehicle = v("noVehicle");
  const broadband = v("broadband");
  const commute = v("commuteMinutes");
  const access = mean([
    lowerBetter(noVehicle?.value ?? null, noVehicle?.national ?? null),
    higherBetter(broadband?.value ?? null, broadband?.national ?? null),
    lowerBetter(commute?.value ?? null, commute?.national ?? null),
  ]);
  if (access != null) {
    pillars.push({
      key: "access", label: "Access & connection", score: access, weight: 0.15, basis: "national",
      reading: "Car access, broadband at home and how far people travel to work.",
      drivers: [
        noVehicle?.value != null ? `${pct(noVehicle.value)} of households have no car against ${pct(noVehicle.national)} nationally` : "",
        broadband?.value != null ? `${pct(broadband.value)} have broadband against ${pct(broadband.national)}` : "",
        commute?.value != null ? `${commute.value.toFixed(0)} minute average commute against ${commute.national?.toFixed(0)}` : "",
      ].filter(Boolean),
    });
  }

  /* Resilience — what has gone wrong here, and what does the weather demand? */
  const resilience = resilienceScore(profile);
  if (resilience) {
    pillars.push({
      key: "resilience", label: "Resilience & risk", score: resilience.score, weight: 0.15, basis: "banded",
      reading: "Declared disasters over 20 years and climate extremes. Banded by count rather than compared with other counties.",
      drivers: resilience.drivers,
    });
  }

  /* Fit — does this community line up with this kind of business? */
  const fit = industryAlignment(profile, industry);
  if (fit) {
    pillars.push({
      key: "fit", label: `Fit for ${industry?.toLowerCase()}`, score: fit.score, weight: 0.2, basis: "rules",
      reading: "How this community's make-up lines up with what this kind of business serves and needs. Each reason is listed.",
      drivers: fit.signals.map((s) => `${s.points > 0 ? "+" : "−"} ${s.label}`),
    });
  }

  if (pillars.length < 2) return null;

  const totalWeight = pillars.reduce((s, p) => s + p.weight, 0);
  const score = Math.round(pillars.reduce((s, p) => s + p.score * p.weight, 0) / totalWeight);
  const band = BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];

  const strongest = [...pillars].sort((a, b) => b.score - a.score)[0];
  const weakest = [...pillars].sort((a, b) => a.score - b.score)[0];
  const verdict = strongest.key === weakest.key
    ? `${band.label.toLowerCase()} overall.`
    : `Strongest on ${strongest.label.toLowerCase()} (${Math.round(strongest.score)}), weakest on ${weakest.label.toLowerCase()} (${Math.round(weakest.score)}).`;

  return {
    score,
    band,
    pillars,
    confidence: pillars.length >= 5 ? "high" : pillars.length >= 3 ? "moderate" : "limited",
    verdict,
    method: [
      "50 means the typical US county. Each pillar is built from published figures, weighted as shown, and every figure behind it is listed.",
      "Resilience is banded by how many disasters were declared, not compared with other counties — there is no clean national rate to compare against.",
      industry ? "The fit pillar is a set of stated rules about what this kind of business serves and needs. Health conditions raise it only for businesses that help manage them; they are never counted as reducing demand for anyone, because no published data supports that." : "Choose an industry to add a fit pillar.",
      "This scores conditions, not demand. It is for comparing places on the same basis and seeing where the strain is — not for predicting whether a business will succeed.",
    ],
  };
}
