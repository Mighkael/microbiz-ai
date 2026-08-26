"use client";

import { ExternalLink } from "lucide-react";
import { C, FONT_HEAD } from "@/lib/theme";
import type { Source } from "@/lib/api";

export default function SourceList({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
      <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: C.mist, fontWeight: 600, marginBottom: 8 }}>
        Sources
      </div>
      <div style={{ display: "grid", gap: 2 }}>
        {sources.map((s) => (
          <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "flex-start", gap: 8, textDecoration: "none",
            padding: "8px 6px", borderRadius: 6, color: C.ink,
          }}>
            <ExternalLink size={13} color={C.mist} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontFamily: FONT_HEAD, fontWeight: 500, fontSize: 13.5, lineHeight: 1.4 }}>{s.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
