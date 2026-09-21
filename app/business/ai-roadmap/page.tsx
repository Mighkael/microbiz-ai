"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { useProfileContext } from "@/components/ProfileProvider";
import AiRoadmap from "@/components/AiRoadmap";
import Copyright from "@/components/Copyright";

export default function Page() {
  const { profile, hydrated } = useProfileContext();

  // The intake pre-fills from the saved profile, so wait until it has loaded.
  if (!hydrated) return null;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 24px 72px" }}>
      <Link href="/business" className="no-print" style={{
        display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none",
        color: C.mist, fontSize: 13, marginBottom: 18,
      }}>
        <ChevronLeft size={15} /> Business
      </Link>

      <div style={{
        fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.18em",
        textTransform: "uppercase", color: C.ledger, fontWeight: 600, marginBottom: 12,
      }}>AI Readiness &amp; Adoption Roadmap</div>

      <h1 style={{
        fontFamily: FONT_HEAD, fontSize: "clamp(28px, 4.5vw, 38px)", lineHeight: 1.12,
        letterSpacing: "-0.02em", color: C.ink, margin: "0 0 12px",
      }}>How could AI help your business?</h1>

      <p style={{ color: C.mist, fontSize: 15.5, maxWidth: 660, margin: "0 0 32px", lineHeight: 1.6 }}>
        Answer a few questions about how your business runs today. You get an honest read on how ready you are, the
        specific uses that fit a business like yours, how to learn them, and a 90-day plan to put them to work —
        starting from the tools and budget you actually have.
      </p>

      <AiRoadmap profile={profile} />

      <div style={{ fontSize: 11.5, color: C.mist, marginTop: 40, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <Copyright /> · educational tool, not financial, legal, tax, or investment advice.
      </div>
    </div>
  );
}
