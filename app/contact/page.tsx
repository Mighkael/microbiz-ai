import type { Metadata } from "next";
import { C, FONT_HEAD, FONT_MONO } from "@/lib/theme";
import ContactForm from "@/components/ContactForm";
import Copyright from "@/components/Copyright";

export const metadata: Metadata = {
  title: "Contact us · MicroBiz AI",
};

export default function ContactPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 72px" }}>
      <div style={{
        fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.18em",
        textTransform: "uppercase", color: C.ledger, fontWeight: 600, marginBottom: 12,
      }}>Contact us</div>

      <h1 style={{
        fontFamily: FONT_HEAD, fontSize: "clamp(28px, 4.5vw, 38px)", lineHeight: 1.12,
        letterSpacing: "-0.02em", color: C.ink, margin: "0 0 12px",
      }}>Get in touch</h1>

      <p style={{ color: C.mist, fontSize: 15.5, margin: "0 0 28px", lineHeight: 1.6 }}>
        Questions, partnerships, press, or something about the data — send us a message and we&apos;ll reply by email.
        Spotted a problem on a page? The <b>Feedback</b> button at the top of every page records which page you were on.
      </p>

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: "22px 22px 24px" }}>
        <ContactForm />
      </div>

      <div style={{ fontSize: 11.5, color: C.mist, marginTop: 40, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <Copyright /> · educational tool, not financial, legal, tax, or investment advice.
      </div>
    </div>
  );
}
