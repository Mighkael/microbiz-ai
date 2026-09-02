/**
 * Maps MicroBiz AI's plain-English industry names onto NAICS codes, which is
 * what the Census API actually queries on.
 *
 * All codes below were verified against County Business Patterns 2023.
 * Some NAICS sectors are hyphenated ranges ("44-45" for Retail Trade) —
 * that is the literal code the API expects, not a typo.
 */

export type NaicsSector = {
  /** The code passed to the Census API. */
  code: string;
  /** Census's own name for the sector. */
  label: string;
  /** How specific the code is — sector level is broad, industry level narrow. */
  level: "all" | "sector" | "industry";
};

/** Every sector, all industries combined. */
export const ALL_SECTORS: NaicsSector = { code: "00", label: "All industries", level: "all" };

/**
 * Keyed by the industry names already used in the assessment form, so the
 * existing profiles map across without a migration.
 */
export const INDUSTRY_TO_NAICS: Record<string, NaicsSector> = {
  "Retail": { code: "44-45", label: "Retail trade", level: "sector" },
  "Restaurant / Food service": { code: "72", label: "Accommodation and food services", level: "sector" },
  "Professional services": { code: "54", label: "Professional, scientific, and technical services", level: "sector" },
  "Construction / Trades": { code: "23", label: "Construction", level: "sector" },
  "Healthcare": { code: "62", label: "Health care and social assistance", level: "sector" },
  "E-commerce": { code: "4541", label: "Electronic shopping and mail-order houses", level: "industry" },
  "Manufacturing": { code: "31-33", label: "Manufacturing", level: "sector" },
  "Technology / SaaS": { code: "5415", label: "Computer systems design and related services", level: "industry" },
  "Transportation / Logistics": { code: "48-49", label: "Transportation and warehousing", level: "sector" },
  "Personal services / Beauty": { code: "812", label: "Personal and laundry services", level: "industry" },
  "Other": ALL_SECTORS,
};

export function naicsForIndustry(industry: string): NaicsSector {
  return INDUSTRY_TO_NAICS[industry] ?? ALL_SECTORS;
}
