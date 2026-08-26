"use client";

import { useState } from "react";
import { Rocket } from "lucide-react";
import { C } from "@/lib/theme";
import { OPPORTUNITIES } from "@/lib/data";
import type { Profile } from "@/lib/data";
import { askBriefing, type Source } from "@/lib/api";
import { Card, H, Btn } from "./ui";
import Markdown from "./Markdown";
import SourceList from "./SourceList";

export default function OpportunitiesPanel({ p }: { p: Profile }) {
  const [ai, setAi] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function personalize() {
    setBusy(true); setAi(""); setSources([]); setError("");
    try {
      const { content, sources } = await askBriefing("opportunities", p);
      setAi(content);
      setSources(sources);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection error — please try again.");
    }
    setBusy(false);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <H>Growing small-business categories</H>
          <Btn tone="green" onClick={personalize} disabled={busy}><Rocket size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{busy ? "Researching…" : "Personalize with live research"}</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12, marginTop: 14 }}>
          {OPPORTUNITIES.map((o) => (
            <div key={o.title} style={{ background: C.paper, borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "'Space Grotesk','Segoe UI',sans-serif", fontWeight: 600, fontSize: 14.5 }}>{o.title}</div>
              <div style={{ fontSize: 13, color: C.mist, marginTop: 5, lineHeight: 1.5 }}>{o.note}</div>
            </div>
          ))}
        </div>
      </Card>
      {error && <Card><div style={{ color: C.alert, fontSize: 14 }}>{error}</div></Card>}
      {ai && (
        <Card>
          <H size={15}>Personalized for {p.industry} · {p.location || "US"}</H>
          <div style={{ marginTop: 10 }}>
            <Markdown>{ai}</Markdown>
            <SourceList sources={sources} />
          </div>
        </Card>
      )}
    </div>
  );
}
