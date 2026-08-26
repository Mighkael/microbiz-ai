"use client";

import { useState } from "react";
import { Newspaper } from "lucide-react";
import { C } from "@/lib/theme";
import type { Profile } from "@/lib/data";
import { askBriefing, type Source } from "@/lib/api";
import { Card, H, Btn } from "./ui";
import Markdown from "./Markdown";
import SourceList from "./SourceList";

export default function NewsPanel({ p }: { p: Profile }) {
  const [brief, setBrief] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(kind: "news" | "markets" | "world") {
    setBusy(true); setBrief(""); setSources([]); setError("");
    try {
      const { content, sources } = await askBriefing(kind, p);
      setBrief(content);
      setSources(sources);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection error — please try again.");
    }
    setBusy(false);
  }

  return (
    <Card>
      <H>Live business briefing</H>
      <div style={{ fontSize: 13, color: C.mist, margin: "4px 0 14px" }}>Claude searches the web on demand, so numbers and headlines are current — not canned.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Btn tone="green" onClick={() => run("news")} disabled={busy}><Newspaper size={14} style={{ verticalAlign: -2, marginRight: 6 }} />US small-business news</Btn>
        <Btn onClick={() => run("markets")} disabled={busy}>Markets & rates (Russell 2000)</Btn>
        <Btn tone="ghost" onClick={() => run("world")} disabled={busy}>World SME news</Btn>
      </div>
      {busy && <div style={{ color: C.mist, fontSize: 14 }}>Searching and summarizing — this takes a few seconds…</div>}
      {error && <div style={{ color: C.alert, fontSize: 14 }}>{error}</div>}
      {brief && (
        <div style={{ background: C.paper, borderRadius: 10, padding: 18 }}>
          <Markdown>{brief}</Markdown>
          <SourceList sources={sources} />
        </div>
      )}
      {!brief && !busy && !error && <div style={{ color: C.mist, fontSize: 14, background: C.paper, borderRadius: 10, padding: 18 }}>Pick a briefing above to pull today&apos;s headlines, index levels, and rate news.</div>}
    </Card>
  );
}
