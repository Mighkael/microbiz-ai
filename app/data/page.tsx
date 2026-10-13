import Link from "next/link";
import { Table, LineChart, Layers, Download, HeartPulse } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import MarketSnapshot from "@/components/MarketSnapshot";
import Copyright from "@/components/Copyright";

const TOOLS = [
  {
    Icon: Layers,
    title: "Sector Browser",
    body: "Explore any industry by NAICS code: how many establishments, where they concentrate, how employment is distributed.",
    href: "/data/sectors",
  },
  {
    Icon: Table,
    title: "Map, Table & Chart Views",
    body: "See the same data three ways, and switch between them without losing your filters.",
    href: "/data/sectors?naics=722511&view=map",
  },
  {
    Icon: LineChart,
    title: "Time Series",
    body: "How a market or industry has changed — businesses, employment, payroll and population, 2017 onward.",
    href: "/research/data-lab",
  },
  {
    Icon: Download,
    title: "Download",
    body: "Export any extract to CSV or Word with its source attribution, vintage and methodology attached.",
    href: "/research/data-lab",
  },
  {
    Icon: HeartPulse,
    title: "Community & Conditions",
    body: "Who lives in a place, community health, disaster history and climate — and what each of those might mean for a business there.",
    href: "/data/community",
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
      }}>More in the Data Lab</h2>
      <p style={{ color: C.mist, fontSize: 13.5, margin: "0 0 18px" }}>
        Built on the same data layer, with the source and date attached to every figure.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
        {TOOLS.map(({ Icon, title, body, href }) => (
          <Link key={title} href={href} style={{ textDecoration: "none" }}>
            <div style={{
              background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12,
              padding: 18, height: "100%", boxSizing: "border-box",
              display: "flex", flexDirection: "column", gap: 7,
            }}>
              <Icon size={19} color={C.ledger} />
              <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 15, color: C.ink }}>{title}</div>
              <div style={{ fontSize: 13, color: C.mist, lineHeight: 1.55 }}>{body}</div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ fontSize: 11.5, color: C.mist, marginTop: 40, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <Copyright /> · educational tool, not financial, legal, tax, or investment advice.
      </div>
    </div>
  );
}
