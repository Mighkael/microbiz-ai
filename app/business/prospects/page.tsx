"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { useProfileContext } from "@/components/ProfileProvider";
import ProspectWorkspace from "@/components/prospects/ProspectWorkspace";
import Copyright from "@/components/Copyright";

export default function ProspectsPage() {
  const { profile, hydrated } = useProfileContext();

  // The workspace takes the saved location and industry as starting values.
  if (!hydrated) return null;

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "48px 24px 72px" }}>
      <Link href="/business" style={{
        display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none",
        color: C.mist, fontSize: 13, marginBottom: 18,
      }}>
        <ChevronLeft size={15} /> Business
      </Link>

      <div style={{
        fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.18em",
        textTransform: "uppercase", color: C.ledger, fontWeight: 600, marginBottom: 12,
      }}>Client Prospect Pipeline</div>

      <h1 style={{
        fontFamily: FONT_HEAD, fontSize: "clamp(28px, 4.5vw, 38px)", lineHeight: 1.12,
        letterSpacing: "-0.02em", color: C.ink, margin: "0 0 12px",
      }}>Find the work, then go and win it</h1>

      <p style={{ color: C.mist, fontSize: 15.5, maxWidth: 680, margin: "0 0 32px", lineHeight: 1.6 }}>
        First check whether the need exists where you are and when it peaks. Then pull up the businesses nearby who
        could buy from you, keep them in a pipeline, and send each one a short, honest email written for them —
        from your own mailbox.
      </p>

      <ProspectWorkspace profile={profile} />

      <div style={{ fontSize: 11.5, color: C.mist, marginTop: 40, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <Copyright /> · educational tool, not financial, legal, tax, or investment advice.
      </div>
    </div>
  );
}
