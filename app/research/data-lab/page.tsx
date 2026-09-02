import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import DataLab from "@/components/DataLab";
import Copyright from "@/components/Copyright";

export default function DataLabPage() {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px 72px" }}>
      <Link href="/research" className="no-print" style={{
        display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none",
        color: C.mist, fontSize: 13, marginBottom: 18,
      }}>
        <ChevronLeft size={15} /> Research
      </Link>

      <div style={{
        fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.18em",
        textTransform: "uppercase", color: C.ledger, fontWeight: 600, marginBottom: 12,
      }}>Data Lab</div>

      <h1 style={{
        fontFamily: FONT_HEAD, fontSize: "clamp(28px, 4.5vw, 38px)", lineHeight: 1.12,
        letterSpacing: "-0.02em", color: C.ink, margin: "0 0 12px",
      }}>How has this market changed?</h1>

      <p style={{ color: C.mist, fontSize: 15.5, maxWidth: 640, margin: "0 0 32px", lineHeight: 1.6 }}>
        Year-by-year figures on businesses, employment, payroll, population and income — for any ZIP, county or state,
        by sector. Built for researchers, consultants and institutions, with sources and methodology attached to every
        extract.
      </p>

      <DataLab />

      <div className="no-print" style={{ fontSize: 11.5, color: C.mist, marginTop: 40, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <Copyright /> · educational tool, not financial, legal, tax, or investment advice.
      </div>
    </div>
  );
}
