/**
 * Client Prospect Pipeline.
 *
 * Two questions a business needs answered before it sells anything: is there
 * demand here, and who exactly do I approach?
 *
 * What this deliberately is not: a list of individuals who searched for
 * something. No public source publishes who searched for what — search
 * engines treat it as personal data and don't sell it — so any product
 * claiming to is either guessing or trading data it shouldn't have. What
 * this does instead is find *businesses* in an area using the contact
 * details those businesses published themselves on OpenStreetMap, which is
 * the honest basis for business-to-business outreach.
 */

export type Prospect = {
  /** OpenStreetMap type and id, e.g. "node/123" — stable across refreshes. */
  id: string;
  name: string;
  category: string;
  address: string | null;
  lat: number;
  lon: number;
  website: string | null;
  /** Only ever an address the business published on its own public listing. */
  email: string | null;
  phone: string | null;
  distanceMiles: number;
};

export type Stage = "new" | "contacted" | "replied" | "won" | "lost";

export const STAGES: { key: Stage; label: string; blurb: string }[] = [
  { key: "new", label: "To approach", blurb: "Saved, not yet contacted." },
  { key: "contacted", label: "Contacted", blurb: "You've reached out and are waiting." },
  { key: "replied", label: "In conversation", blurb: "They answered — keep it moving." },
  { key: "won", label: "Won", blurb: "Became a customer." },
  { key: "lost", label: "Not now", blurb: "No for now. Worth a note on why." },
];

export type PipelineEntry = Prospect & {
  stage: Stage;
  notes: string;
  addedAt: string;
  lastContactedAt: string | null;
};

/** The sender's own details — required in any commercial email under US law. */
export type SenderDetails = {
  businessName: string;
  postalAddress: string;
  replyEmail: string;
  /** One line on what they offer, used to draft outreach. */
  offer: string;
};

export type ProspectData = {
  sender: SenderDetails;
  pipeline: PipelineEntry[];
  /** Anyone who asked not to be contacted again. Checked before every draft. */
  doNotContact: string[];
  updatedAt: string | null;
};

export const emptyProspectData = (): ProspectData => ({
  sender: { businessName: "", postalAddress: "", replyEmail: "", offer: "" },
  pipeline: [],
  doNotContact: [],
  updatedAt: null,
});

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const numOr = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Stored data can't be trusted — it may be hand-edited or from an older version. */
export function sanitizeProspectData(raw: unknown): ProspectData {
  const base = emptyProspectData();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const s = (r.sender && typeof r.sender === "object" ? r.sender : {}) as Record<string, unknown>;
  const stages = STAGES.map((x) => x.key as string);

  return {
    sender: {
      businessName: str(s.businessName, 120),
      postalAddress: str(s.postalAddress, 300),
      replyEmail: str(s.replyEmail, 254),
      offer: str(s.offer, 400),
    },
    pipeline: (Array.isArray(r.pipeline) ? r.pipeline : [])
      .slice(0, 500)
      .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === "object")
      .map((e, i) => ({
        id: str(e.id, 60) || `p${i}`,
        name: str(e.name, 160) || "Unnamed",
        category: str(e.category, 80),
        address: e.address ? str(e.address, 240) : null,
        lat: numOr(e.lat, 0),
        lon: numOr(e.lon, 0),
        website: e.website ? str(e.website, 300) : null,
        email: e.email ? str(e.email, 254) : null,
        phone: e.phone ? str(e.phone, 40) : null,
        distanceMiles: numOr(e.distanceMiles, 0),
        stage: (stages.includes(String(e.stage)) ? e.stage : "new") as Stage,
        notes: str(e.notes, 2000),
        addedAt: str(e.addedAt, 40) || new Date().toISOString(),
        lastContactedAt: e.lastContactedAt ? str(e.lastContactedAt, 40) : null,
      })),
    doNotContact: (Array.isArray(r.doNotContact) ? r.doNotContact : [])
      .slice(0, 2000)
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : null,
  };
}

/**
 * US commercial email rules, in plain words. Shown wherever outreach is
 * drafted, because the duties fall on the sender, not on us.
 */
export const CAN_SPAM_RULES = [
  "Tell the truth in the From line and the subject. Both must reflect who you are and what the message is about.",
  "Say where you are: a commercial email must include your real street address or registered PO box.",
  "Give a clear way to opt out, and honor it within 10 business days. Keep those addresses on your do-not-contact list forever.",
  "Make clear it's a commercial message if the recipient wouldn't otherwise expect to hear from you.",
  "Don't buy harvested lists, and don't keep emailing someone who hasn't replied. Penalties under the CAN-SPAM Act run per email.",
];

export const CAN_SPAM_NOTE =
  "These are the main duties in the US CAN-SPAM Act as they apply to business-to-business email. This is a plain summary, not legal advice — if you're emailing at scale or outside the US, check the rules that apply to you.";
