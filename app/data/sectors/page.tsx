import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import SectorBrowser from "@/components/SectorBrowser";
import Copyright from "@/components/Copyright";

export default function SectorsPage() {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px 72px" }}>
      <Link href="/data" style={{
        display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none",
        color: C.mist, fontSize: 13, marginBottom: 18,
      }}>
        <ChevronLeft size={15} /> Data
      </Link>

      <div style={{
        fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.18em",
        textTransform: "uppercase", color: C.ledger, fontWeight: 600, marginBottom: 12,
      }}>Sector Browser</div>

      <h1 style={{
        fontFamily: FONT_HEAD, fontSize: "clamp(28px, 4.5vw, 38px)", lineHeight: 1.12,
        letterSpacing: "-0.02em", color: C.ink, margin: "0 0 12px",
      }}>Where does an industry actually operate?</h1>

      <p style={{ color: C.mist, fontSize: 15.5, maxWidth: 640, margin: "0 0 32px", lineHeight: 1.6 }}>
        Pick any industry and see how many businesses it has, where they concentrate, what they pay and how big they
        are — across states, or across the counties of one state. Switch between map, table and chart without losing
        your place.
      </p>

      {/* The browser reads its filters from the URL, which needs a Suspense boundary to prerender. */}
      <Suspense fallback={<div style={{ color: C.mist, fontSize: 14 }}>Loading…</div>}>
        <SectorBrowser />
      </Suspense>

      <div style={{ fontSize: 11.5, color: C.mist, marginTop: 40, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <Copyright /> · educational tool, not financial, legal, tax, or investment advice.
      </div>
    </div>
  );
}
