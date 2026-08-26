import React from "react";
import { C, FONT_HEAD } from "@/lib/theme";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, background: C.ledger,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontFamily: FONT_HEAD, fontWeight: 700, fontSize: size * 0.5,
      flexShrink: 0,
    }}>M</div>
  );
}

export function Logo({ size = 28, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <LogoMark size={size} />
      <span style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: size * 0.6, color: dark ? "#fff" : C.ink, letterSpacing: 0.2, whiteSpace: "nowrap" }}>
        MicroBiz <span style={{ color: dark ? "#8FE0C4" : C.ledger }}>AI</span>
      </span>
    </div>
  );
}
