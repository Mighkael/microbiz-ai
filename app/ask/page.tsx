import { Suspense } from "react";
import type { Metadata } from "next";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import AgentWorkspace from "@/components/agent/AgentWorkspace";
import Copyright from "@/components/Copyright";

export const metadata: Metadata = {
  title: "MicroBiz Agent · MicroBiz AI",
};

/**
 * Ask MicroBiz AI, grown into the MicroBiz Agent (V3 §2): an assistant in four
 * roles that also holds the owner's plan, actual results and obligations, and
 * checks one against the other.
 */
export default function AskPage() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "44px 24px 72px" }}>
      <div style={{
        fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.18em",
        textTransform: "uppercase", color: C.ledger, fontWeight: 600, marginBottom: 12,
      }}>MicroBiz Agent</div>

      <h1 style={{
        fontFamily: FONT_HEAD, fontSize: "clamp(28px, 4.5vw, 38px)", lineHeight: 1.12,
        letterSpacing: "-0.02em", color: C.ink, margin: "0 0 12px",
      }}>Ask MicroBiz AI</h1>

      <p style={{ color: C.mist, fontSize: 15.5, maxWidth: 680, margin: "0 0 28px", lineHeight: 1.6 }}>
        An assistant for running the business. Ask it anything — or give it your plan and your monthly results, and it
        will compare them, warn you when you&apos;re off track or a deadline is close, recommend what to do, and build
        reports for a bank or an investor.
      </p>

      {/* The workspace reads ?tab= and ?assistant= from the URL. */}
      <Suspense fallback={<div style={{ color: C.mist, fontSize: 14 }}>Loading…</div>}>
        <AgentWorkspace />
      </Suspense>

      <div style={{ fontSize: 11.5, color: C.mist, marginTop: 40, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <Copyright /> · educational tool, not financial, legal, tax, or investment advice.
      </div>
    </div>
  );
}
