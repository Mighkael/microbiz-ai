"use client";

import { C, FONT_HEAD } from "@/lib/theme";
import { DEFAULT_PROFILE } from "@/lib/data";
import { useProfileContext } from "@/components/ProfileProvider";
import NewsPanel from "@/components/NewsPanel";
import OpportunitiesPanel from "@/components/OpportunitiesPanel";
import Copyright from "@/components/Copyright";

export default function NewsPage() {
  const { profile: saved } = useProfileContext();
  const profile = saved ?? DEFAULT_PROFILE;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontFamily: FONT_HEAD, fontSize: 30, color: C.ink, margin: "0 0 6px" }}>News, Markets & Research</h1>
      <p style={{ color: C.mist, marginBottom: 24 }}>
        {saved
          ? `Live briefings and growth research for ${profile.industry} in ${profile.location || "the US"}.`
          : "General small-business news, market rates, and growth research — complete the assessment to personalize this to your industry and location."}
      </p>
      <div style={{ display: "grid", gap: 20 }}>
        <NewsPanel p={profile} />
        <OpportunitiesPanel p={profile} />
      </div>
      <div style={{ fontSize: 11.5, color: C.mist, marginTop: 28, borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
        <Copyright /> · educational tool, not financial, legal, tax, or investment advice.
      </div>
    </div>
  );
}
