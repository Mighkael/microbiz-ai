"use client";

import Link from "next/link";
import { useProfileContext } from "@/components/ProfileProvider";
import DashboardShell from "@/components/DashboardShell";
import { Btn } from "@/components/ui";
import { C, FONT_HEAD } from "@/lib/theme";

export default function DashboardPage() {
  const { profile, hydrated } = useProfileContext();

  if (!hydrated) return null;

  if (!profile) {
    return (
      <div style={{ maxWidth: 440, margin: "100px auto", textAlign: "center", padding: "0 24px" }}>
        <h2 style={{ fontFamily: FONT_HEAD, fontSize: 24, color: C.ink, marginBottom: 8 }}>No business profile yet</h2>
        <p style={{ color: C.mist, marginBottom: 20 }}>
          Complete the quick assessment to unlock your dashboard, financial analysis, and AI advisor.
        </p>
        <Link href="/assessment" style={{ textDecoration: "none" }}>
          <Btn tone="green">Start Business Assessment</Btn>
        </Link>
      </div>
    );
  }

  return <DashboardShell profile={profile} />;
}
