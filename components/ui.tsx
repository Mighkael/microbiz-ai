import React from "react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";

export const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 20, ...style }}>{children}</div>
);

export const H = ({ children, size = 18, style }: { children: React.ReactNode; size?: number; style?: React.CSSProperties }) => (
  <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: size, color: C.ink, ...style }}>{children}</div>
);

export const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: C.mist, fontWeight: 600, marginBottom: 6 }}>{children}</div>
);

export const Mono = ({ children, color = C.ink, size = 22 }: { children: React.ReactNode; color?: string; size?: number }) => (
  <span style={{ fontFamily: FONT_MONO, fontSize: size, fontWeight: 600, color }}>{children}</span>
);

export const Btn = ({ children, onClick, tone = "dark", disabled, style }: {
  children: React.ReactNode; onClick?: () => void; tone?: "dark" | "green" | "ghost"; disabled?: boolean; style?: React.CSSProperties;
}) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: disabled ? "#9DB0AC" : tone === "dark" ? C.ink : tone === "green" ? C.ledger : "transparent",
    color: tone === "ghost" ? C.ink : "#fff",
    border: tone === "ghost" ? `1px solid ${C.line}` : "none",
    borderRadius: 8, padding: "10px 16px", fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14,
    cursor: disabled ? "default" : "pointer", ...style,
  }}>{children}</button>
);

export function ScoreRing({ score }: { score: number }) {
  const r = 54, circ = 2 * Math.PI * r;
  const color = score >= 70 ? C.ledger : score >= 45 ? C.signal : C.alert;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={`Business health score ${score} out of 100`}>
      <circle cx="70" cy="70" r={r} fill="none" stroke={C.line} strokeWidth="12" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${(score / 100) * circ} ${circ}`} transform="rotate(-90 70 70)" />
      <text x="70" y="66" textAnchor="middle" style={{ fontFamily: FONT_MONO, fontSize: 30, fontWeight: 700, fill: C.ink }}>{score}</text>
      <text x="70" y="88" textAnchor="middle" style={{ fontFamily: FONT_HEAD, fontSize: 11, fill: C.mist }}>HEALTH SCORE</text>
    </svg>
  );
}

export const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: "#fff", color: C.ink, boxSizing: "border-box" };

export const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><Label>{label}</Label>{children}</div>
);
