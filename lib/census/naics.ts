/**
 * Maps MicroBiz AI's plain-English industry names onto NAICS codes.
 *
 * Two code sets are needed, because the datasets disagree:
 *   - County Business Patterns 2023 queries on NAICS2017
 *   - Economic Census 2022 queries on NAICS2022
 *
 * NAICS 2022 restructured retail and dissolved the separate e-commerce
 * industry (4541), so a few sectors have no clean 2022 equivalent. Those
 * carry a fallback plus a note, rather than silently benchmarking against
 * the wrong thing.
 *
 * Every code below was verified against both datasets.
 */

export type NaicsSector = {
  /** Code for County Business Patterns (NAICS2017). */
  code: string;
  /** Code for Economic Census (NAICS2022). Null where none applies. */
  code2022: string | null;
  label: string;
  level: "all" | "sector" | "industry";
  /** Shown to the user when the 2022 code isn't a like-for-like match. */
  benchmarkNote?: string;
};

/** All industries combined. Economic Census publishes no such total. */
export const ALL_SECTORS: NaicsSector = {
  code: "00",
  code2022: null,
  label: "All industries",
  level: "all",
};

export const INDUSTRY_TO_NAICS: Record<string, NaicsSector> = {
  "Retail": { code: "44-45", code2022: "44-45", label: "Retail trade", level: "sector" },
  "Restaurant / Food service": { code: "72", code2022: "72", label: "Accommodation and food services", level: "sector" },
  "Professional services": { code: "54", code2022: "54", label: "Professional, scientific, and technical services", level: "sector" },
  "Construction / Trades": { code: "23", code2022: "23", label: "Construction", level: "sector" },
  "Healthcare": { code: "62", code2022: "62", label: "Health care and social assistance", level: "sector" },
  "E-commerce": {
    code: "4541",
    code2022: "44-45",
    label: "Electronic shopping and mail-order houses",
    level: "industry",
    benchmarkNote:
      "NAICS 2022 dissolved the separate e-commerce category, so revenue benchmarks compare against retail trade overall.",
  },
  "Manufacturing": { code: "31-33", code2022: "31-33", label: "Manufacturing", level: "sector" },
  "Technology / SaaS": { code: "5415", code2022: "5415", label: "Computer systems design and related services", level: "industry" },
  "Transportation / Logistics": { code: "48-49", code2022: "48-49", label: "Transportation and warehousing", level: "sector" },
  "Personal services / Beauty": { code: "812", code2022: "812", label: "Personal and laundry services", level: "industry" },
  "Other": ALL_SECTORS,
};

export function naicsForIndustry(industry: string): NaicsSector {
  return INDUSTRY_TO_NAICS[industry] ?? ALL_SECTORS;
}
