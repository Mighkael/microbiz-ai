"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";

const components: Components = {
  h1: ({ children }) => <div style={{ fontFamily: FONT_HEAD, fontSize: 17, fontWeight: 700, color: C.ink }}>{children}</div>,
  h2: ({ children }) => <div style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 700, color: C.ink }}>{children}</div>,
  h3: ({ children }) => <div style={{ fontFamily: FONT_HEAD, fontSize: 14.5, fontWeight: 700, color: C.ink }}>{children}</div>,
  h4: ({ children }) => <div style={{ fontFamily: FONT_HEAD, fontSize: 14, fontWeight: 700, color: C.ink }}>{children}</div>,
  p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
  strong: ({ children }) => <strong style={{ fontWeight: 700, color: C.ink }}>{children}</strong>,
  ul: ({ children }) => <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  hr: () => <hr style={{ border: "none", borderTop: `1px solid ${C.line}` }} />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: C.ledger, textDecoration: "underline", textUnderlineOffset: 2 }}>
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{ textAlign: "left", padding: "9px 12px", background: C.paper, borderBottom: `1px solid ${C.line}`, fontFamily: FONT_HEAD, fontWeight: 600, color: C.ink, whiteSpace: "nowrap" }}>
      {children}
    </th>
  ),
  td: ({ children }) => <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C.line}`, verticalAlign: "top" }}>{children}</td>,
  code: ({ children }) => (
    <code style={{ background: C.paper, borderRadius: 4, padding: "1px 5px", fontFamily: FONT_MONO, fontSize: 12.5 }}>{children}</code>
  ),
  blockquote: ({ children }) => (
    <blockquote style={{ margin: 0, padding: "2px 14px", borderLeft: `3px solid ${C.line}`, color: C.mist }}>{children}</blockquote>
  ),
};

export default function Markdown({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 14, lineHeight: 1.65, color: C.ink, display: "grid", gap: 10 }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
