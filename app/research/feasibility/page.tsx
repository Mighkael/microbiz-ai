import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import FeasibilityStudy from "@/components/FeasibilityStudy";
import Copyright from "@/components/Copyright";

export default function FeasibilityPage() {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px 72px" }}>
      <Link href="/research" style={{
        display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none",
        color: C.mist, fontSize: 13, marginBottom: 18,
      }}>
        <ChevronLeft size={15} /> Research
      </Link>

      <div style={{
        fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.18em",
        textTransform: "uppercase", color: C.ledger, fontWeight: 600, marginBottom: 12,
      }}>Feasibility &amp; Viability</div>

      <h1 style={{
        fontFamily: FONT_HEAD, fontSize: "clamp(28px, 4.5vw, 38px)", lineHeight: 1.12,
        letterSpacing: "-0.02em", color: C.ink, margin: "0 0 12px",
      }}>Would this business work here?</h1>

      <p style={{ color: C.mist, fontSize: 15.5, maxWidth: 640, margin: "0 0 32px", lineHeight: 1.6 }}>
        Before committing money, test your assumptions against what businesses in that sector and market actually
        report — how much they take in, what they spend on wages, and how crowded the field already is.
      </p>

      <FeasibilityStudy />

      <div style={{ fontSize: 11.5, color: C.mist, marginTop: 40, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <Copyright /> · educational tool, not financial, legal, tax, or investment advice.
      </div>
    </div>
  );
}
