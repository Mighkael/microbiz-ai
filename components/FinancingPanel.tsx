"use client";

import { useEffect, useState } from "react";
import { Landmark, Search, ExternalLink, Info } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { Card, H, Btn, inputStyle } from "./ui";

type Opportunity = {
  id: string;
  number: string;
  title: string;
  agency: string;
  openDate: string | null;
  closeDate: string | null;
  status: string;
  url: string;
};

type FinancingResponse = {
  total: number;
  showing: number;
  opportunities: Opportunity[];
  source: string;
  limitations: string[];
};

export default function FinancingPanel({ defaultKeyword = "" }: { defaultKeyword?: string }) {
  const [keyword, setKeyword] = useState(defaultKeyword);
  const [status, setStatus] = useState<"posted" | "forecasted">("posted");
  const [data, setData] = useState<FinancingResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(kw = keyword, st = status) {
    if (busy) return;
    setBusy(true); setError(""); setData(null);
    try {
      const params = new URLSearchParams({ keyword: kw.trim(), status: st });
      const res = await fetch(`/api/financing?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Lookup failed.");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed. Please try again.");
    }
    setBusy(false);
  }

  // Show something useful on arrival rather than an empty page.
  useEffect(() => { run(defaultKeyword, "posted"); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <H>Federal funding open to small businesses</H>
        <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 16px", maxWidth: 640, lineHeight: 1.55 }}>
          Live from Grants.gov, filtered to opportunities that list small businesses as eligible. Search by what your
          business does — &quot;food&quot;, &quot;manufacturing&quot;, &quot;rural&quot;, &quot;energy&quot;.
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            style={{ ...inputStyle, flex: "2 1 240px" }}
            value={keyword} onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="What does your business do?" aria-label="Keyword"
          />
          <select
            style={{ ...inputStyle, flex: "1 1 150px" }}
            value={status}
            onChange={(e) => { const v = e.target.value as "posted" | "forecasted"; setStatus(v); run(keyword, v); }}
            aria-label="Opportunity status"
          >
            <option value="posted">Open now</option>
            <option value="forecasted">Expected soon</option>
          </select>
          <Btn tone="green" onClick={() => run()} disabled={busy}>
            <Search size={15} style={{ verticalAlign: -3, marginRight: 6 }} />
            {busy ? "Searching…" : "Search"}
          </Btn>
        </div>

        {error && <div style={{ fontSize: 13.5, color: C.alert, marginTop: 12 }}>{error}</div>}
      </Card>

      {data && (
        <>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
              <H size={16}>
                <Landmark size={16} style={{ verticalAlign: -3, marginRight: 7 }} color={C.ledger} />
                {data.total.toLocaleString("en-US")} matching {data.total === 1 ? "opportunity" : "opportunities"}
              </H>
              {data.showing < data.total && (
                <div style={{ fontSize: 12.5, color: C.mist }}>Showing the first {data.showing}</div>
              )}
            </div>

            {data.opportunities.length === 0 ? (
              <div style={{ fontSize: 13.5, color: C.mist, marginTop: 12 }}>
                Nothing matched that search. Try a broader word, or switch to &quot;Expected soon&quot;.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 2, marginTop: 12 }}>
                {data.opportunities.map((o) => (
                  <a
                    key={o.id || o.number}
                    href={o.url} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: "block", textDecoration: "none", color: "inherit",
                      padding: "12px 4px", borderBottom: `1px solid ${C.line}`,
                    }}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <ExternalLink size={13} color={C.mist} style={{ marginTop: 3, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14, color: C.ink, lineHeight: 1.4 }}>
                          {o.title}
                        </div>
                        <div style={{ fontSize: 12, color: C.mist, marginTop: 3 }}>
                          {o.agency}
                          {o.closeDate ? <> · closes <span style={{ fontFamily: FONT_MONO }}>{o.closeDate}</span></> : null}
                          {o.number ? <> · <span style={{ fontFamily: FONT_MONO }}>{o.number}</span></> : null}
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
              <Info size={14} color={C.signal} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14, color: C.ink, marginBottom: 6 }}>
                  Before you spend time on these
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                  {data.limitations.map((l, i) => (
                    <li key={i} style={{ fontSize: 12.5, color: C.mist, lineHeight: 1.55 }}>{l}</li>
                  ))}
                </ul>
                <div style={{ fontSize: 11.5, color: C.mist, marginTop: 10 }}>{data.source}</div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
