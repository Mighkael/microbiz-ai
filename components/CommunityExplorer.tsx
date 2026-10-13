"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { C } from "@/lib/theme";
import { INDUSTRIES } from "@/lib/data";
import { useProfileContext } from "./ProfileProvider";
import { Card, H, Btn, inputStyle } from "./ui";
import CommunityPanel from "./CommunityPanel";

/**
 * Full community profile for any place, with the reading tailored to an
 * industry.
 *
 * Split in two so the saved business profile can arrive as initial values:
 * the outer component waits for it to load, the inner one starts from it.
 * A location in the URL always wins over the saved one.
 */
export default function CommunityExplorer() {
  const params = useSearchParams();
  const { profile, hydrated } = useProfileContext();

  if (!hydrated) return <Card><div style={{ fontSize: 13.5, color: C.mist }}>Loading…</div></Card>;

  const urlLocation = params.get("location")?.trim() ?? "";
  const urlIndustry = params.get("industry") ?? "";
  const industry = urlIndustry in INDUSTRIES
    ? urlIndustry
    : !urlLocation && profile?.industry && profile.industry in INDUSTRIES ? profile.industry : "";

  return (
    <Explorer
      key={`${urlLocation}|${industry}`}
      initialLocation={urlLocation || profile?.location?.trim() || ""}
      initialIndustry={industry}
      showImmediately={Boolean(urlLocation)}
    />
  );
}

function Explorer({
  initialLocation, initialIndustry, showImmediately,
}: {
  initialLocation: string;
  initialIndustry: string;
  /** Only a location from the URL loads on arrival; a saved one waits to be asked for. */
  showImmediately: boolean;
}) {
  const [location, setLocation] = useState(initialLocation);
  const [industry, setIndustry] = useState(initialIndustry);
  const [shown, setShown] = useState(() =>
    showImmediately ? { location: initialLocation, industry: initialIndustry } : { location: "", industry: "" });

  useEffect(() => {
    const next = new URLSearchParams();
    if (shown.location) next.set("location", shown.location);
    if (shown.industry) next.set("industry", shown.industry);
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [shown]);

  function run() {
    if (location.trim().length < 3) return;
    setShown({ location: location.trim(), industry });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <H>Which community?</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 14px", maxWidth: 680, lineHeight: 1.55 }}>
          Enter any US town, city or ZIP code. Add an industry and the reading is tailored to that kind of business —
          the same conditions mean different things to a restaurant and a clinic.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <input
            style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Clarksville, TN  ·  or 37040" aria-label="Location"
          />
          <select style={inputStyle} value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label="Industry">
            <option value="">Any industry</option>
            {Object.keys(INDUSTRIES).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <div>
            <Btn tone="green" onClick={run} disabled={location.trim().length < 3}>
              <Search size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
              Show this community
            </Btn>
          </div>
        </div>
      </Card>

      {shown.location && (
        <CommunityPanel
          key={`${shown.location}|${shown.industry}`}
          location={shown.location}
          industry={shown.industry || undefined}
          heading={`What stands out about ${shown.location}`}
        />
      )}
    </div>
  );
}
