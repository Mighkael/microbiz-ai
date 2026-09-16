"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Compass, ClipboardList, MapPin, Lightbulb, Layers, FileSearch, MessageCircle, ShieldCheck,
  ChevronLeft, ChevronRight, ArrowUpRight,
} from "lucide-react";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import Modal from "./Modal";

type Step = {
  Icon: typeof Compass;
  eyebrow: string;
  title: string;
  body: string;
  href?: string;
  cta?: string;
};

const STEPS: Step[] = [
  {
    Icon: Compass,
    eyebrow: "Welcome",
    title: "MicroBiz AI in two minutes",
    body: "Business intelligence built on public data about every market in the country — for owners, would-be owners, and the people who support them. We built it to help small businesses grow, because local business growth is one of the most consistent levers against neighborhood crime.",
  },
  {
    Icon: ClipboardList,
    eyebrow: "Start here",
    title: "Business Assessment",
    body: "Enter your revenue, costs, cash and staffing. You get a dashboard of margins, cash runway, break-even and risk — and a read on how you compare with businesses in your sector.",
    href: "/assessment",
    cta: "Start an assessment",
  },
  {
    Icon: MapPin,
    eyebrow: "Where",
    title: "Location Intelligence",
    body: "Score a market on spending power, what businesses there actually earn, how crowded it is and whether it's growing. Compare up to three places side by side.",
    href: "/business/locations",
    cta: "Compare locations",
  },
  {
    Icon: Lightbulb,
    eyebrow: "What",
    title: "Opportunity Finder",
    body: "Know your area and budget but not the business? This ranks sectors by how they perform in your county, and sets aside anything beyond your budget rather than recommending it.",
    href: "/business/opportunities",
    cta: "Find opportunities",
  },
  {
    Icon: FileSearch,
    eyebrow: "Test it",
    title: "Feasibility Study",
    body: "Before committing money, check your revenue, staffing and capital assumptions against what that sector really takes in and pays in that market.",
    href: "/research/feasibility",
    cta: "Run a study",
  },
  {
    Icon: Layers,
    eyebrow: "Explore",
    title: "Sector Browser",
    body: "Any of 1,300+ industries — where it concentrates, what it pays, how big its businesses are — as a map, a table or a chart.",
    href: "/data/sectors",
    cta: "Browse sectors",
  },
  {
    Icon: MessageCircle,
    eyebrow: "Ask",
    title: "Ask MicroBiz AI",
    body: "Ask a question in plain English. The advisor looks up real Census figures to answer, and shows you the evidence it used.",
    href: "/ask",
    cta: "Ask a question",
  },
  {
    Icon: ShieldCheck,
    eyebrow: "One promise",
    title: "Every figure says where it came from",
    body: "Numbers carry their source and year. Where the government withholds a figure, we say it's withheld rather than showing a zero — and where no reliable data exists, we tell you instead of estimating.",
  },
];

export default function TourDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  function close() {
    onClose();
    setIndex(0);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      // Arrow keys page through, unless focus is in a field.
      if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(STEPS.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const { Icon } = step;

  return (
    <Modal open={open} onClose={close} title="Tour" width={480}>
      <div aria-live="polite">
        <div style={{
          width: 46, height: 46, borderRadius: 12, background: C.ledgerSoft,
          display: "grid", placeItems: "center", marginBottom: 14,
        }}>
          <Icon size={23} color={C.ledger} />
        </div>
        <div style={{
          fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
          color: C.ledger, fontWeight: 600,
        }}>
          {step.eyebrow} · {index + 1} of {STEPS.length}
        </div>
        <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 21, color: C.ink, margin: "6px 0 8px", lineHeight: 1.25 }}>
          {step.title}
        </div>
        <div style={{ fontSize: 14.5, color: C.ink2, lineHeight: 1.65, minHeight: 96 }}>{step.body}</div>

        {step.href && (
          <Link
            href={step.href}
            onClick={close}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5, marginTop: 12,
              color: C.ledger, fontWeight: 600, fontSize: 14, textDecoration: "none",
            }}
          >
            {step.cta} <ArrowUpRight size={15} />
          </Link>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, gap: 12 }}>
        <div style={{ display: "flex", gap: 6 }} aria-hidden="true">
          {STEPS.map((_, i) => (
            <button
              key={i}
              tabIndex={-1}
              onClick={() => setIndex(i)}
              style={{
                width: i === index ? 18 : 7, height: 7, borderRadius: 999, border: "none", padding: 0, cursor: "pointer",
                background: i === index ? C.ledger : C.line, transition: "width .15s",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {index > 0 && (
            <button onClick={() => setIndex(index - 1)} style={navBtn(false)}>
              <ChevronLeft size={15} /> Back
            </button>
          )}
          <button onClick={() => (last ? close() : setIndex(index + 1))} style={navBtn(true)}>
            {last ? "Finish" : <>Next <ChevronRight size={15} /></>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const navBtn = (primary: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 3,
  fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14, cursor: "pointer",
  padding: "8px 14px", borderRadius: 8,
  border: primary ? "none" : `1px solid ${C.line}`,
  background: primary ? C.ledger : "#fff",
  color: primary ? "#fff" : C.ink,
});
