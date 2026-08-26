// Maps our single-snapshot `Profile` (from the 9-question assessment) onto
// the real relational schema (docs/backend-reference/db/schema.sql), which
// splits a business into a `businesses` row (static facts) and one
// `monthly_financials` row per month (the actual numbers). We treat the
// assessment's annual revenue/expenses as one month's run-rate — dividing
// by 12 on save and multiplying by 12 on load round-trips exactly, and it's
// what the dashboard's math already assumes.
import { INDUSTRIES, type Profile } from "./data";

export type BusinessRow = {
  id: string;
  owner_id: string;
  name: string;
  industry: string;
  location_city: string | null;
  location_state: string | null;
  country: string;
  founded_year: number | null;
  employees: number | null;
  financing_need: string | null;
  marketing_challenge: string | null;
  operational_challenge: string | null;
};

export type MonthlyFinancialRow = {
  id?: string;
  business_id: string;
  period: string;
  revenue: number;
  cogs: number;
  opex: number;
  payroll: number;
  cash_balance: number | null;
  debt_payments: number;
  source: string;
};

export function splitLocation(location: string): { city: string | null; state: string | null } {
  const parts = location.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return { city: parts[0], state: parts[1] };
  if (parts.length === 1) return { city: parts[0], state: null };
  return { city: null, state: null };
}

export function firstOfCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function profileToBusinessRow(p: Profile, ownerId: string) {
  const { city, state } = splitLocation(p.location);
  const age = +p.age || 0;
  return {
    owner_id: ownerId,
    name: p.location ? `${p.industry} — ${p.location}` : `${p.industry} business`,
    industry: p.industry,
    location_city: city,
    location_state: state,
    country: "US",
    founded_year: age > 0 ? new Date().getFullYear() - age : null,
    employees: +p.employees || 0,
    financing_need: p.financing || null,
    marketing_challenge: p.marketing || null,
    operational_challenge: p.operations || null,
  };
}

export function profileToFinancialsRow(p: Profile, businessId: string, period: string): MonthlyFinancialRow {
  const bench = INDUSTRIES[p.industry] || INDUSTRIES.Other;
  const monthlyRevenue = (+p.revenue || 0) / 12;
  const monthlyExpenses = (+p.expenses || 0) / 12;
  return {
    business_id: businessId,
    period,
    revenue: monthlyRevenue,
    cogs: monthlyExpenses * bench.varRatio,
    opex: monthlyExpenses * (1 - bench.varRatio),
    payroll: 0,
    cash_balance: p.cash === "" ? null : +p.cash || 0,
    debt_payments: 0,
    source: "manual",
  };
}

export function dbToProfile(business: BusinessRow, financial: MonthlyFinancialRow | null): Profile {
  const location = [business.location_city, business.location_state].filter(Boolean).join(", ");
  const age = business.founded_year ? new Date().getFullYear() - business.founded_year : 0;
  const monthlyRevenue = financial?.revenue ?? 0;
  const monthlyExpenses = financial ? financial.cogs + financial.opex + financial.payroll + financial.debt_payments : 0;

  return {
    industry: business.industry || "Retail",
    location,
    revenue: monthlyRevenue ? String(Math.round(monthlyRevenue * 12)) : "",
    expenses: monthlyExpenses ? String(Math.round(monthlyExpenses * 12)) : "",
    cash: financial?.cash_balance != null ? String(financial.cash_balance) : "",
    employees: business.employees != null ? String(business.employees) : "",
    age: String(age),
    financing: business.financing_need || "Working capital",
    marketing: business.marketing_challenge || "",
    operations: business.operational_challenge || "",
  };
}
