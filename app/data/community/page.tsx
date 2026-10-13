import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import CommunityExplorer from "@/components/CommunityExplorer";
import Copyright from "@/components/Copyright";

export default function CommunityPage() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 24px 72px" }}>
      <Link href="/data" style={{
        display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none",
        color: C.mist, fontSize: 13, marginBottom: 18,
      }}>
        <ChevronLeft size={15} /> Data
      </Link>

      <div style={{
        fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.18em",
        textTransform: "uppercase", color: C.ledger, fontWeight: 600, marginBottom: 12,
      }}>Community & Conditions</div>

      <h1 style={{
        fontFamily: FONT_HEAD, fontSize: "clamp(28px, 4.5vw, 38px)", lineHeight: 1.12,
        letterSpacing: "-0.02em", color: C.ink, margin: "0 0 12px",
      }}>Who lives there, and what the place is like</h1>

      <p style={{ color: C.mist, fontSize: 15.5, maxWidth: 680, margin: "0 0 32px", lineHeight: 1.6 }}>
        Market figures tell you what businesses there earn. They don&apos;t tell you that half the households have a
        child in them, that diabetes runs well above the national rate, that the county has been declared a disaster
        area eleven times, or that it rains most in May. All of that shapes what works — and what&apos;s missing.
      </p>

      {/* The explorer reads ?location= and ?industry= from the URL. */}
      <Suspense fallback={<div style={{ color: C.mist, fontSize: 14 }}>Loading…</div>}>
        <CommunityExplorer />
      </Suspense>

      <div style={{ fontSize: 11.5, color: C.mist, marginTop: 40, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <Copyright /> · educational tool, not financial, legal, tax, or investment advice.
      </div>
    </div>
  );
}
