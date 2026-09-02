"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import { useProfileContext } from "@/components/ProfileProvider";
import ScenarioSimulator from "@/components/ScenarioSimulator";
import Copyright from "@/components/Copyright";
import { Card, Btn } from "@/components/ui";

export default function ScenariosPage() {
  const { profile, hydrated } = useProfileContext();

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
      }}>Scenario Simulator</div>

      <h1 style={{
        fontFamily: FONT_HEAD, fontSize: "clamp(28px, 4.5vw, 38px)", lineHeight: 1.12,
        letterSpacing: "-0.02em", color: C.ink, margin: "0 0 12px",
      }}>What if things changed?</h1>

      <p style={{ color: C.mist, fontSize: 15.5, maxWidth: 640, margin: "0 0 32px", lineHeight: 1.6 }}>
        Test a price rise, a hire, a rent increase or a marketing spend against your real numbers before you commit
        to any of them.
      </p>

      {profile ? (
        <ScenarioSimulator profile={profile} />
      ) : (
        <Card>
          <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
            No business profile yet
          </div>
          <p style={{ color: C.mist, fontSize: 14, marginTop: 0, marginBottom: 16 }}>
            Scenarios model changes against your own figures, so complete the assessment first.
          </p>
          <Link href="/assessment" style={{ textDecoration: "none" }}>
            <Btn tone="green">Start Business Assessment</Btn>
          </Link>
        </Card>
      )}

      <div className="no-print" style={{ fontSize: 11.5, color: C.mist, marginTop: 40, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <Copyright /> · educational tool, not financial, legal, tax, or investment advice.
      </div>
    </div>
  );
}
