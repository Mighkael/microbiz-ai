import { Table, LineChart, Layers, Download } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import MarketSnapshot from "@/components/MarketSnapshot";
import Copyright from "@/components/Copyright";

const COMING = [
  {
    Icon: Layers,
    title: "Sector Browser",
    body: "Explore any industry by NAICS code: how many establishments, where they concentrate, how employment is distributed.",
    phase: "Phase 3",
  },
  {
    Icon: Table,
    title: "Map, Table & Chart Views",
    body: "See the same data three ways, and switch between them without losing your filters.",
    phase: "Phase 8",
  },
  {
    Icon: LineChart,
    title: "Time Series",
    body: "How a market or industry has changed — employment, wages and business counts over time, from BLS.",
    phase: "Phase 8",
  },
  {
    Icon: Download,
    title: "Download",
    body: "Export any view with its source attribution, vintage and methodology attached.",
    phase: "Phase 8",
  },
];

export default function DataPage() {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "56px 24px 72px" }}>
      <div style={{
        fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.18em",
        textTransform: "uppercase", color: C.ledger, fontWeight: 600, marginBottom: 12,
      }}>Data</div>

      <h1 style={{
        fontFamily: FONT_HEAD, fontSize: "clamp(30px, 5vw, 42px)", lineHeight: 1.1,
        letterSpacing: "-0.02em", color: C.ink, margin: "0 0 12px",
      }}>Explore the data</h1>

      <p style={{ color: C.mist, fontSize: 16, maxWidth: 620, margin: "0 0 36px", lineHeight: 1.6 }}>
        Public data on American small business — business counts, employment and demographics, down to ZIP code level.
        Every figure carries its source and date.
      </p>

      <MarketSnapshot />

      <h2 style={{
        fontFamily: FONT_HEAD, fontSize: 18, fontWeight: 600, color: C.ink,
        margin: "44px 0 4px",
      }}>Coming next</h2>
      <p style={{ color: C.mist, fontSize: 13.5, margin: "0 0 18px" }}>
        Built on the same data layer, in the order set out in the V2 plan.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
        {COMING.map(({ Icon, title, body, phase }) => (
          <div key={title} style={{
            background: C.paper, border: `1px solid ${C.line}`, borderRadius: 12,
            padding: 18, display: "flex", flexDirection: "column", gap: 7,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <Icon size={19} color={C.mist} />
              <span style={{
                fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase",
                color: C.mist, background: "#fff", border: `1px solid ${C.line}`,
                borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap",
              }}>{phase}</span>
            </div>
            <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 15, color: C.ink }}>{title}</div>
            <div style={{ fontSize: 13, color: C.mist, lineHeight: 1.55 }}>{body}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11.5, color: C.mist, marginTop: 40, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <Copyright /> · educational tool, not financial, legal, tax, or investment advice.
      </div>
    </div>
  );
}
