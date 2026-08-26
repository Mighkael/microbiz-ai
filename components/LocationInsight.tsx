"use client";

import { useEffect, useState } from "react";
import { MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { C, FONT_HEAD } from "@/lib/theme";
import { Card, H } from "./ui";
import LocationMap from "./LocationMap";

type OZResult = {
  designated: boolean;
  tract: string | null;
  county: string | null;
  state: string | null;
  rural: boolean | null;
};

type LocationResult = {
  lat: number;
  lon: number;
  displayName: string;
  opportunityZone: OZResult;
};

export default function LocationInsight({ location }: { location: string }) {
  const [result, setResult] = useState<LocationResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const q = location.trim();
    if (q.length < 3) {
      setResult(null);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/location?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Location lookup failed.");
        setResult(data);
        setStatus("idle");
      } catch {
        setResult(null);
        setStatus("error");
      }
    }, 700);
    return () => clearTimeout(handle);
  }, [location]);

  if (status === "idle" && !result) return null;

  return (
    <Card>
      <H size={15}><MapPin size={15} style={{ verticalAlign: -2, marginRight: 6 }} color={C.ledger} />Business location</H>
      {status === "loading" && (
        <div style={{ color: C.mist, fontSize: 13, marginTop: 8 }}>Looking up the map and opportunity-zone status…</div>
      )}
      {status === "error" && (
        <div style={{ color: C.mist, fontSize: 13, marginTop: 8 }}>Couldn&apos;t find that location. Try &quot;City, State&quot;.</div>
      )}
      {result && (
        <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
          <LocationMap
            lat={result.lat}
            lon={result.lon}
            label={result.displayName}
            highlight={result.opportunityZone.designated}
          />
          <div style={{
            borderRadius: 8, padding: 14,
            background: result.opportunityZone.designated ? "#FBF1E1" : C.paper,
            border: `1px solid ${result.opportunityZone.designated ? "#EED9AE" : C.line}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, cursor: "pointer" }}
              onClick={() => setExpanded((e) => !e)}>
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 13.5, color: C.ink }}>
                {result.opportunityZone.designated
                  ? "Located in a federally designated Opportunity Zone"
                  : "Not in a federally designated Opportunity Zone"}
              </div>
              {expanded ? <ChevronUp size={16} color={C.mist} /> : <ChevronDown size={16} color={C.mist} />}
            </div>
            {expanded && (
              <div style={{ fontSize: 12.5, color: C.mist, marginTop: 10, lineHeight: 1.6 }}>
                {result.opportunityZone.designated ? (
                  <>
                    Census tract <b style={{ color: C.ink }}>{result.opportunityZone.tract}</b>
                    {result.opportunityZone.county && <> · {result.opportunityZone.state}, county FIPS {result.opportunityZone.county}</>}
                    {" "}was nominated and certified as a Qualified Opportunity Zone — a tract identified as low-income or economically
                    distressed under the 2017 Tax Cuts and Jobs Act. Businesses here are often priority candidates for CDFI loans,
                    New Markets Tax Credit financing, and local economic-development incentives — see the Funding tab.
                    <br /><br />
                    <b style={{ color: C.ink }}>Part of our mission:</b> we treat business growth in these areas as a lever for community
                    safety, not just profit — more local jobs and foot traffic are consistently linked to lower neighborhood crime rates
                    over time.
                  </>
                ) : (
                  <>
                    This tract was not designated a Qualified Opportunity Zone under the 2017 federal program. That doesn&apos;t rule out
                    other forms of local disinvestment — check the Funding tab for CDFI and state programs that use different eligibility maps.
                  </>
                )}
                <br /><br />
                Source: HUD/Treasury Opportunity Zones dataset (2010 census boundaries, certified 2018). One data point, not a full
                picture of a neighborhood.
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
