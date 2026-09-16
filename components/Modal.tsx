"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { C, FONT_HEAD } from "@/lib/theme";

/**
 * A plain accessible dialog: Escape and the backdrop close it, focus moves
 * into it on open, stays inside it while open, and returns to whatever opened
 * it on close.
 */
export default function Modal({
  open, onClose, title, children, width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Parents usually pass a fresh onClose each render. Reading it through a ref
  // keeps the effect below tied to opening and closing only — otherwise every
  // keystroke in a form inside the dialog would re-run it and yank focus away.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    (focusables()[1] ?? panel)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onCloseRef.current(); return; }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 100, background: "rgba(22,36,46,0.45)",
        display: "grid", placeItems: "center", padding: 16,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          width: "100%", maxWidth: width, maxHeight: "calc(100vh - 32px)", overflowY: "auto",
          background: "#fff", borderRadius: 14, boxShadow: "0 24px 64px rgba(22,36,46,0.28)",
          padding: "20px 22px 22px", boxSizing: "border-box", outline: "none",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 17, color: C.ink }}>{title}</div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none", background: "none", cursor: "pointer", color: C.mist,
              padding: 4, borderRadius: 6, display: "grid", placeItems: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
