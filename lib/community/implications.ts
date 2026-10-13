/**
 * What community conditions might mean for a business — the two-sided reading
 * the platform is for: the same fact is usually a difficulty for one kind of
 * business and an opening for another.
 *
 * Hard rule, enforced by how these are written: nothing here predicts demand.
 * No published dataset says that a county with more diabetes buys less candy.
 * What the data supports is a *question worth testing*, with the figure that
 * raises it attached, so an owner or investor can go and check it cheaply
 * instead of assuming. Every item therefore states the figure, says what it
 * might mean, and suggests how to find out.
 */
import type { CommunityProfile, Indicator } from "./types";

export type Implication = {
  id: string;
  kind: "opportunity" | "challenge" | "watch";
  title: string;
  /** The published figures this rests on, quoted. */
  basis: string;
  /** What it might mean, and how to check it. */
  consider: string;
  /** How far the figure sits from the national one — used for ordering. */
  weight: number;
  /** True when the rule was chosen for this particular industry. */
  forIndustry: boolean;
};

const FOOD = ["Restaurant / Food service"];
const RETAIL = ["Retail", "E-commerce"];
const HEALTH = ["Healthcare"];
const PERSONAL = ["Personal services / Beauty"];
const TRADES = ["Construction / Trades"];
const OUTDOOR_WORK = [...TRADES, "Transportation / Logistics"];

const miles = (d: number) => d < 1 ? "under a mile away" : `about ${Math.round(d)} mile${Math.round(d) === 1 ? "" : "s"} away`;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Percentage-point gap from the national figure, used only to rank items. */
const gap = (i: Indicator | null) => (i?.value != null && i.national != null ? Math.abs(i.value - i.national) : 0);
const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
const usd = (v: number | null) => (v == null ? "—" : v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }));

function find(profile: CommunityProfile, key: string): Indicator | null {
  for (const g of [...profile.people, ...profile.health]) {
    const hit = g.indicators.find((i) => i.key === key);
    if (hit) return hit;
  }
  return null;
}

const higher = (i: Indicator | null) => i?.comparison === "higher";
const lower = (i: Indicator | null) => i?.comparison === "lower";

export function deriveImplications(profile: CommunityProfile, industry?: string): Implication[] {
  const out: Implication[] = [];
  const relevant = (industries: string[]) => (industry ? industries.includes(industry) : false);
  const add = (
    i: Omit<Implication, "weight" | "forIndustry">, weight: number, forIndustry = false,
  ) => out.push({ ...i, weight, forIndustry });

  const diabetes = find(profile, "DIABETES");
  const obesity = find(profile, "OBESITY");
  const inactivity = find(profile, "LPA");
  const uninsuredAcs = find(profile, "uninsured");
  const uninsuredAdults = find(profile, "ACCESS2");
  const mental = find(profile, "MHLTH");
  const smoking = find(profile, "CSMOKING");
  const disability = find(profile, "disability");
  const over65 = find(profile, "over65");
  const under18 = find(profile, "under18");
  const children = find(profile, "householdsWithChildren");
  const poverty = find(profile, "poverty");
  const income = find(profile, "medianIncome");
  const noVehicle = find(profile, "noVehicle");
  const broadband = find(profile, "broadband");
  const veterans = find(profile, "veterans");
  const commute = find(profile, "commuteMinutes");
  const renters = find(profile, "renters");
  const otherLanguage = find(profile, "otherLanguage");

  /* ---------------- Health ---------------- */

  if (higher(diabetes) || higher(obesity)) {
    const basis = [
      diabetes?.value != null ? `An estimated ${pct(diabetes.value)} of adults here have diabetes (US county average ${pct(diabetes.national)})` : null,
      obesity?.value != null ? `obesity is estimated at ${pct(obesity.value)} (average ${pct(obesity.national)})` : null,
    ].filter(Boolean).join("; ") + ".";

    if (relevant([...FOOD, ...RETAIL])) {
      add({
        id: "diet_food_challenge",
        kind: "challenge",
        title: "A sugar-heavy or indulgence-led range may be a harder sell than average",
        basis,
        consider: "Diet-related conditions are more common here than in most counties, and health advice locally will be pushing the other way. That doesn't mean treats don't sell — it means a range built only on them carries more risk. Test it cheaply: run a few lower-sugar or smaller-portion options for a month and compare what moves.",
      }, gap(diabetes) + gap(obesity), true);
      add({
        id: "diet_food_opportunity",
        kind: "opportunity",
        title: "Low-sugar, fresh and portion-controlled options may be underserved",
        basis,
        consider: "Where a condition is this common, people are actively looking for options that suit them, and small operators are usually quicker to offer them than chains. Look at what nearby places already label clearly; if nobody does, that gap is yours to take. Say what is in the food plainly rather than making health claims.",
      }, gap(diabetes) + gap(obesity), true);
    } else if (relevant([...HEALTH, ...PERSONAL])) {
      add({
        id: "diet_health_opportunity",
        kind: "opportunity",
        title: "Services that help people manage these conditions have a visible local need",
        basis,
        consider: "Diabetes and obesity are more common here than in most counties. Services built around them — nutrition support, foot care, supervised exercise, medication reviews, meal preparation — meet a need the figures show plainly. Check what the local hospital and clinics already run before assuming the gap is open.",
      }, gap(diabetes) + gap(obesity), true);
    } else {
      add({
        id: "diet_general",
        kind: "watch",
        title: "Diet-related conditions are more common here than in most counties",
        basis,
        consider: "This shapes what sells and what local campaigns push. It also affects your own team: health cover and sick days tend to cost more where chronic conditions are widespread.",
      }, gap(diabetes) + gap(obesity));
    }
  }

  if (higher(inactivity)) {
    add({
      id: "inactivity",
      kind: "opportunity",
      title: "Little spare-time exercise reported — affordable, close-to-home activity may be missing",
      basis: `An estimated ${pct(inactivity!.value)} of adults report no leisure-time physical activity (US county average ${pct(inactivity!.national)}).`,
      consider: "This is often about cost, hours and distance rather than willingness. Options that remove those barriers — short classes, early or late slots, pay-as-you-go, somewhere within walking distance — are worth testing. For other businesses, it is a sign that foot traffic may be lighter than population alone suggests.",
    }, gap(inactivity), relevant([...PERSONAL, ...HEALTH]));
  }

  if (higher(uninsuredAdults) || higher(uninsuredAcs)) {
    const ind = higher(uninsuredAdults) ? uninsuredAdults! : uninsuredAcs!;
    add({
      id: "uninsured",
      kind: relevant(HEALTH) ? "challenge" : "watch",
      title: relevant(HEALTH) ? "More patients than average will be paying out of pocket" : "Medical costs take a bigger bite of local household budgets",
      basis: `${pct(ind.value)} are without health insurance (national ${pct(ind.national)}).`,
      consider: relevant(HEALTH)
        ? "A model built on insurance reimbursement will reach fewer people here. Clear cash prices, payment plans, and sliding scales widen the market — and get you paid faster. Check which plans the main local employers offer."
        : "Unexpected medical bills compete with everything else people buy, which shows up as cancelled bookings and slower repeat purchases. Flexible payment options help more here than in most places.",
    }, gap(ind), relevant(HEALTH));
  }

  if (higher(mental)) {
    add({
      id: "mental_health",
      kind: "watch",
      title: "Frequent mental distress is reported more often than in most counties",
      basis: `An estimated ${pct(mental!.value)} of adults report frequent mental distress (US county average ${pct(mental!.national)}).`,
      consider: "For health and personal-service businesses this points to real unmet need, including evening and weekend availability. For any employer, it is worth knowing what support your health plan actually covers before you need it.",
    }, gap(mental), relevant([...HEALTH, ...PERSONAL]));
  }

  if (higher(smoking)) {
    add({
      id: "smoking",
      kind: "watch",
      title: "Smoking is more common here than in most counties",
      basis: `An estimated ${pct(smoking!.value)} of adults currently smoke (US county average ${pct(smoking!.national)}).`,
      consider: "Pharmacies and health services often find quit-support programs well used where rates are this high. As an employer, expect more break time and higher cleaning and insurance costs in premises where smoking happens nearby.",
    }, gap(smoking));
  }

  if (higher(disability)) {
    add({
      id: "disability",
      kind: "opportunity",
      title: "A larger share of customers and staff live with a disability",
      basis: `${pct(disability!.value)} of people here live with a disability (national ${pct(disability!.national)}).`,
      consider: "Step-free access, room to move between fixtures, clear signage and somewhere to sit widen your market here more than in most places — and the Americans with Disabilities Act sets requirements regardless. The same goes for how you write job adverts.",
    }, gap(disability));
  }

  /* ---------------- People ---------------- */

  if (higher(over65)) {
    add({
      id: "older",
      kind: "opportunity",
      title: "An older population than most counties",
      basis: `${pct(over65!.value)} are aged 65 or over (national ${pct(over65!.national)})${find(profile, "medianAge")?.value != null ? `, median age ${find(profile, "medianAge")!.value}` : ""}.`,
      consider: "Daytime trade is usually stronger and late-night weaker. Home-delivered and at-home services, help with technology, health and mobility support, and anything that saves a trip all travel well here. Plan for a smaller pool of younger workers.",
    }, gap(over65));
  }

  if (higher(under18) || higher(children)) {
    const ind = higher(children) ? children! : under18!;
    add({
      id: "families",
      kind: "opportunity",
      title: "More families with children than most places",
      basis: higher(children)
        ? `${pct(children!.value)} of households include a child under 18 (national ${pct(children!.national)}).`
        : `${pct(under18!.value)} of people here are under 18 (national ${pct(under18!.national)}).`,
      consider: "School terms and the school run shape the trading day. Family pricing, space for a stroller, quick weekday evenings and weekend mornings matter. Childcare itself is persistently short in most such places — worth checking what already exists locally.",
    }, gap(ind));
  }

  if (higher(poverty) || lower(income)) {
    add({
      id: "value",
      kind: "challenge",
      title: "Household budgets are tighter than the national picture",
      basis: [
        poverty?.value != null ? `${pct(poverty.value)} of people live below the poverty line (national ${pct(poverty.national)})` : null,
        income?.value != null ? `median household income is ${usd(income.value)} against ${usd(income.national)} nationally` : null,
      ].filter(Boolean).join("; ") + ".",
      consider: "Premium positioning is harder, and demand moves sharply with price. What usually works instead: smaller pack or portion sizes, a clear entry price, honest value rather than discounting that you can't sustain, and payment timing that fits when people are paid. Essentials hold up better than treats through tight months.",
    }, Math.max(gap(poverty), income?.value != null && income.national != null ? Math.abs(income.value - income.national) / 1000 : 0));
  }

  if (higher(noVehicle)) {
    add({
      id: "no_vehicle",
      kind: "challenge",
      title: "Many households have no car, so where you sit decides who can reach you",
      basis: `${pct(noVehicle!.value)} of households have no vehicle (national ${pct(noVehicle!.national)}).`,
      consider: "A site on a bus route, within walking distance of housing, beats a cheaper unit out of town. Delivery, collection points and a phone ordering option reach the rest. It also affects hiring: staff need to get to you for early and late shifts.",
    }, gap(noVehicle), relevant([...RETAIL, ...FOOD, ...PERSONAL]));
  }

  if (lower(broadband)) {
    add({
      id: "broadband",
      kind: "challenge",
      title: "Fewer homes have broadband than the national average",
      basis: `${pct(broadband!.value)} of households have a broadband subscription (national ${pct(broadband!.national)}).`,
      consider: "Online-only ordering, app-based booking and email marketing will reach a smaller share of this market than the national pattern suggests. Keep a phone number answered by a person, and text messaging, as first-class channels.",
    }, gap(broadband), relevant(["E-commerce", "Technology / SaaS"]));
  }

  if (higher(veterans)) {
    add({
      id: "veterans",
      kind: "opportunity",
      title: "A notably large veteran and military-connected population",
      basis: `${pct(veterans!.value)} of adults are veterans (national ${pct(veterans!.national)}).`,
      consider: "Steady federal pay and benefits support demand, and military discounts are expected rather than generous here. Note the rhythm: deployments, pay dates and base events move trade. Veteran-owned certification can also open contracting doors.",
    }, gap(veterans));
  }

  if (higher(commute)) {
    add({
      id: "commute",
      kind: "opportunity",
      title: "Long commutes shape when people can buy",
      basis: `The average commute is ${commute!.value?.toFixed(0)} minutes (national ${commute!.national?.toFixed(0)}).`,
      consider: "Early openings, drive-through or grab-and-go formats, pre-ordering and later closing capture trade that a nine-to-five business misses. Weekday evening footfall is often weaker than the population suggests.",
    }, gap(commute));
  }

  if (higher(renters)) {
    add({
      id: "renters",
      kind: "watch",
      title: "More renters than most places",
      basis: `${pct(renters!.value)} of homes are rented (national ${pct(renters!.national)}).`,
      consider: "Renters move more often and have less storage and no workshop. That favors compact goods, laundry and repair services, storage, and anything aimed at moving in or out — and it means a steady flow of new arrivals who haven't chosen their regular shops yet.",
    }, gap(renters));
  }

  if (higher(otherLanguage)) {
    add({
      id: "language",
      kind: "opportunity",
      title: "Many people here speak a language other than English at home",
      basis: `${pct(otherLanguage!.value)} speak a language other than English at home (national ${pct(otherLanguage!.national)}).`,
      consider: "Signage, menus and staff who speak the main local languages widen your market directly, and word of mouth travels fast in communities that are underserved in their own language. Check the main languages locally before translating anything.",
    }, gap(otherLanguage));
  }

  /* ---------------- Hazards and climate ---------------- */

  const hz = profile.hazards;
  if (hz && hz.total >= 3) {
    const top = hz.types.slice(0, 3).map((t) => `${t.type.toLowerCase()} (${t.count})`).join(", ");
    add({
      id: "hazards",
      kind: "challenge",
      title: `${hz.total} federally declared disasters here since ${hz.sinceYear}`,
      basis: `Most often: ${top}. Latest in ${Math.max(...hz.types.map((t) => t.latestYear))}.`,
      consider: "Expect insurance to cost more and to ask harder questions, and expect to lose trading days. Worth doing before you sign a lease: check the flood map for the exact address, ask what the building did in the last event, price business-interruption cover, and keep records and backups off site. Lenders increasingly ask about this.",
    }, hz.total, relevant(OUTDOOR_WORK));
    if (hz.types.some((t) => /storm|flood|hurricane|tornado|fire/i.test(t.type)) && relevant(TRADES)) {
      add({
        id: "hazards_trades",
        kind: "opportunity",
        title: "Repeated storm damage sustains repair and restoration work",
        basis: `${hz.total} declared disasters since ${hz.sinceYear}, mostly ${hz.types[0].type.toLowerCase()}.`,
        consider: "Roofing, water damage restoration, tree work, generators and backup power have recurring demand here. Insurance-funded work pays differently from private jobs — understand the claims process and get on insurers' approved lists before the next event, not after.",
      }, hz.total, true);
    }
  }

  const cl = profile.climate;
  if (cl?.warmest && cl.warmest.avgTempF >= 78) {
    add({
      id: "hot_summer",
      kind: "watch",
      title: `Hot summers — ${MONTHS[cl.warmest.month - 1]} averages ${Math.round(cl.warmest.avgTempF)}°F`,
      basis: `NOAA 1991–2020 normals from ${cl.station.name}, ${miles(cl.station.distanceMiles)}.`,
      consider: "Budget for cooling, and for equipment that works harder in summer. Shade, cold drinks and early or late hours protect trade on the hottest days. For outdoor work, plan the schedule around the heat and the rules on breaks and water.",
    }, 1);
  }
  if (cl?.coldest && cl.coldest.avgTempF <= 35) {
    add({
      id: "cold_winter",
      kind: "watch",
      title: `Cold winters — ${MONTHS[cl.coldest.month - 1]} averages ${Math.round(cl.coldest.avgTempF)}°F`,
      basis: `NOAA 1991–2020 normals from ${cl.station.name}, ${miles(cl.station.distanceMiles)}.`,
      consider: "Plan cash for the slow months rather than being surprised by them, and budget heating. Outdoor trades lose working days; indoor and delivery formats gain. Snow clearing, winter servicing and seasonal lines are the other side of it.",
    }, 1);
  }
  if (cl?.wettest && cl.wettest.precipIn >= 4.5 && relevant(OUTDOOR_WORK)) {
    add({
      id: "wet_month",
      kind: "watch",
      title: `${MONTHS[cl.wettest.month - 1]} is the wettest month, averaging ${cl.wettest.precipIn.toFixed(1)} inches`,
      basis: `NOAA 1991–2020 normals from ${cl.station.name}.`,
      consider: "Build weather days into quotes and schedules for outdoor work, and avoid promising completion dates in the wettest weeks without slack.",
    }, 1, true);
  }

  // Industry-specific first, then by how far the figure sits from the norm.
  return out.sort((a, b) => Number(b.forIndustry) - Number(a.forIndustry) || b.weight - a.weight);
}

export const IMPLICATION_CAVEAT =
  "These are prompts to investigate, not predictions. No public dataset shows how a community's health or make-up changes demand for a particular business — what the figures do is tell you which questions are worth testing cheaply before you commit money.";
