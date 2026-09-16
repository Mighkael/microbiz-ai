"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, MessageSquareText, Compass } from "lucide-react";
import { C, FONT_HEAD, UTILITY_H } from "@/lib/theme";
import FeedbackDialog from "./FeedbackDialog";
import TourDialog from "./TourDialog";

const itemStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  fontFamily: FONT_HEAD, fontWeight: 500, fontSize: 12.5, color: C.mist,
  background: "none", border: "none", cursor: "pointer", textDecoration: "none",
  padding: "4px 8px", borderRadius: 6, whiteSpace: "nowrap",
};

/**
 * Slim strip above the main header: Contact, Feedback, Tour. It scrolls away
 * with the page, so the sticky header below keeps its height and nothing that
 * positions itself under the header has to change.
 */
export default function UtilityBar() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  return (
    <>
      <div className="mb-utility no-print" style={{ height: UTILITY_H, background: C.paper, borderBottom: `1px solid ${C.line}` }}>
        <div className="mb-utility-inner" style={{
          maxWidth: 1240, margin: "0 auto", height: "100%", padding: "0 16px",
          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2,
        }}>
          <Link href="/contact" style={itemStyle} className="mb-utility-item">
            <Mail size={14} /> Contact us
          </Link>
          <button onClick={() => setFeedbackOpen(true)} style={itemStyle} className="mb-utility-item">
            <MessageSquareText size={14} /> Feedback
          </button>
          <button onClick={() => setTourOpen(true)} style={itemStyle} className="mb-utility-item">
            <Compass size={14} /> Tour
          </button>
        </div>
      </div>

      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <TourDialog open={tourOpen} onClose={() => setTourOpen(false)} />
    </>
  );
}
