"use client";

import { Database } from "lucide-react";
import { C, FONT_MONO } from "@/lib/theme";
import type { Evidence } from "@/lib/api";

/** Plain-English names for the data engines, so the trail reads to a non-analyst. */
const TOOL_LABELS: Record<string, string> = {
  get_market_snapshot: "Market snapshot",
  benchmark_business: "Business benchmark",
  score_locations: "Location scoring",
  run_feasibility_study: "Feasibility study",
};

function describe(e: Evidence): string {
  const label = TOOL_LABELS[e.tool] ?? e.tool;
  const loc = e.input.location ?? (Array.isArray(e.input.locations) ? (e.input.locations as string[]).join(", ") : null);
  const industry = e.input.industry;
  const parts = [loc, industry].filter(Boolean);
  return parts.length ? `${label} — ${parts.join(" · ")}` : label;
}

/**
 * Shows which live data the answer was built from. Without this the user has
 * no way to tell a cited Census figure from a confident-sounding guess.
 */
export default function EvidenceTrail({ evidence }: { evidence: Evidence[] }) {
  if (!evidence || evidence.length === 0) return null;

  // The model sometimes calls the same tool twice while refining a question.
  const seen = new Set<string>();
  const unique = evidence.filter((e) => {
    const k = describe(e);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return (
    <div style={{
      marginTop: 10, paddingTop: 9, borderTop: `1px solid ${C.line}`,
      display: "flex", gap: 7, alignItems: "flex-start", flexWrap: "wrap",
    }}>
      <Database size={12} color={C.mist} style={{ marginTop: 3, flexShrink: 0 }} />
      <div style={{ fontSize: 11, color: C.mist, lineHeight: 1.6 }}>
        <span style={{ fontFamily: FONT_MONO, letterSpacing: "0.04em" }}>LIVE DATA USED: </span>
        {unique.map((e, i) => (
          <span key={i}>
            {i > 0 ? " · " : ""}{describe(e)}
          </span>
        ))}
        <span> — US Census Bureau</span>
      </div>
    </div>
  );
}
