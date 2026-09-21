/**
 * AI Readiness & Adoption Roadmap.
 *
 * The question this answers: given what this particular business does, how can
 * the owner practically learn, adopt and implement AI to improve it?
 *
 * Everything here is deterministic. The readiness score, the use-case ranking
 * and the 30-60-90 roadmap are computed from the owner's own answers and a
 * curated catalog — the AI layer only writes a short plain-language summary
 * from the results (see app/api/ai-roadmap). It never chooses a tool, a cost
 * or a saving.
 *
 * Two design commitments:
 *  - Small businesses in disinvested areas often have no software and no
 *    spare budget. "None of these" and "$0" are first-class answers, and the
 *    plan starts from where the business is: foundations first when needed,
 *    and free writing-and-planning uses that need no data at all.
 *  - No invented numbers. Catalog entries describe effort, cost tier and time
 *    to value qualitatively. We do not claim dollar or hour savings.
 */

/* ------------------------------------------------------------------ */
/* Inputs                                                             */
/* ------------------------------------------------------------------ */

export type FocusArea =
  | "sales_marketing" | "customer_service" | "bookkeeping"
  | "inventory" | "scheduling_hr" | "admin";
export type RecordsLevel = "memory" | "paper" | "spreadsheet" | "software";
export type ToolKey = "smartphone" | "social" | "messaging" | "spreadsheet" | "accounting" | "pos" | "website";
export type AiExperience = "never" | "tried" | "sometimes" | "regular";
export type BudgetTier = "none" | "low" | "mid" | "high";
export type Device = "phone" | "computer" | "both";

export type ReadinessAnswers = {
  /** Up to three areas that eat the most repetitive time. */
  focus: FocusArea[];
  records: RecordsLevel;
  tools: ToolKey[];
  device: Device;
  experience: AiExperience;
  budget: BudgetTier;
  /** Optional: one task repeated every week, in the owner's words. */
  repetitive: string;
};

export const DEFAULT_ANSWERS: ReadinessAnswers = {
  focus: [], records: "paper", tools: [], device: "phone",
  experience: "never", budget: "none", repetitive: "",
};

/** What we already know from the main assessment; nothing here is re-asked. */
export type ReadinessContext = {
  industry: string;
  employees: number;
  location: string;
  marketing: string;
  operations: string;
};

export const FOCUS_OPTIONS: { key: FocusArea; label: string; hint: string }[] = [
  { key: "sales_marketing", label: "Finding and keeping customers", hint: "Posts, promos, follow-ups" },
  { key: "customer_service", label: "Answering customers", hint: "Calls, messages, questions" },
  { key: "bookkeeping", label: "Money and bookkeeping", hint: "Receipts, invoices, cash" },
  { key: "inventory", label: "Stock and suppliers", hint: "Ordering, running out, waste" },
  { key: "scheduling_hr", label: "Staff and scheduling", hint: "Shifts, hiring, training" },
  { key: "admin", label: "Paperwork and admin", hint: "Forms, letters, permits" },
];

export const RECORDS_OPTIONS: { key: RecordsLevel; label: string; hint: string }[] = [
  { key: "memory", label: "Mostly in my head", hint: "Nothing written down regularly" },
  { key: "paper", label: "On paper or in a notebook", hint: "Receipts, a ledger book" },
  { key: "spreadsheet", label: "In a spreadsheet or phone notes", hint: "Excel, Sheets, Notes app" },
  { key: "software", label: "In business software", hint: "Accounting or point-of-sale system" },
];

export const TOOL_OPTIONS: { key: ToolKey | "none"; label: string }[] = [
  { key: "smartphone", label: "A smartphone" },
  { key: "social", label: "Facebook / Instagram / TikTok for the business" },
  { key: "messaging", label: "WhatsApp or text with customers" },
  { key: "spreadsheet", label: "A spreadsheet" },
  { key: "accounting", label: "Accounting software" },
  { key: "pos", label: "A point-of-sale or card-payment app" },
  { key: "website", label: "A website or online listing" },
  { key: "none", label: "None of these" },
];

export const DEVICE_OPTIONS: { key: Device; label: string }[] = [
  { key: "phone", label: "Mostly my phone" },
  { key: "computer", label: "Mostly a computer" },
  { key: "both", label: "Both" },
];

export const EXPERIENCE_OPTIONS: { key: AiExperience; label: string; hint: string }[] = [
  { key: "never", label: "Not yet", hint: "I haven't used ChatGPT, Claude or similar" },
  { key: "tried", label: "I've tried it", hint: "A few times, out of curiosity" },
  { key: "sometimes", label: "Sometimes", hint: "I use it now and then for work" },
  { key: "regular", label: "Regularly", hint: "It's part of how I work" },
];

export const BUDGET_OPTIONS: { key: BudgetTier; label: string; hint: string }[] = [
  { key: "none", label: "$0 — free tools only", hint: "That is a perfectly good place to start" },
  { key: "low", label: "Under $50 a month", hint: "" },
  { key: "mid", label: "$50 – $200 a month", hint: "" },
  { key: "high", label: "More than $200 a month", hint: "" },
];

const FOCUS_KEYS = FOCUS_OPTIONS.map((o) => o.key);
const RECORDS_KEYS = RECORDS_OPTIONS.map((o) => o.key);
const TOOL_KEYS = TOOL_OPTIONS.filter((o) => o.key !== "none").map((o) => o.key as ToolKey);
const DEVICE_KEYS = DEVICE_OPTIONS.map((o) => o.key);
const EXPERIENCE_KEYS = EXPERIENCE_OPTIONS.map((o) => o.key);
const BUDGET_KEYS = BUDGET_OPTIONS.map((o) => o.key);

/** Server-side: never trust the shape of what the browser sent. */
export function normalizeAnswers(raw: unknown): ReadinessAnswers {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
    typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  const list = <T extends string>(v: unknown, allowed: readonly T[], max: number): T[] =>
    Array.isArray(v)
      ? Array.from(new Set(v.filter((x): x is T => typeof x === "string" && (allowed as readonly string[]).includes(x)))).slice(0, max)
      : [];
  return {
    focus: list(r.focus, FOCUS_KEYS, 3),
    records: pick(r.records, RECORDS_KEYS, DEFAULT_ANSWERS.records),
    tools: list(r.tools, TOOL_KEYS, TOOL_KEYS.length),
    device: pick(r.device, DEVICE_KEYS, DEFAULT_ANSWERS.device),
    experience: pick(r.experience, EXPERIENCE_KEYS, DEFAULT_ANSWERS.experience),
    budget: pick(r.budget, BUDGET_KEYS, DEFAULT_ANSWERS.budget),
    repetitive: typeof r.repetitive === "string" ? r.repetitive.trim().slice(0, 300) : "",
  };
}

/* ------------------------------------------------------------------ */
/* Readiness score                                                    */
/* ------------------------------------------------------------------ */

export type Stage = "foundations" | "starter" | "scale";

export type DimensionKey = "records" | "tools" | "skills" | "capacity";

export type Dimension = { key: DimensionKey; label: string; score: number; weight: number; reading: string };

export type Readiness = {
  overall: number;
  stage: Stage;
  stageLabel: string;
  stageBlurb: string;
  dimensions: Dimension[];
};

const RECORDS_SCORE: Record<RecordsLevel, number> = { memory: 10, paper: 30, spreadsheet: 65, software: 90 };
const EXPERIENCE_SCORE: Record<AiExperience, number> = { never: 10, tried: 40, sometimes: 70, regular: 90 };
const BUDGET_SCORE: Record<BudgetTier, number> = { none: 30, low: 50, mid: 75, high: 90 };
const TOOL_POINTS: Record<ToolKey, number> = {
  smartphone: 15, social: 15, messaging: 10, spreadsheet: 25, accounting: 25, pos: 20, website: 15,
};

const STAGES: Record<Stage, { label: string; blurb: string }> = {
  foundations: {
    label: "Foundations first",
    blurb: "A few simple habits will make AI far more useful for you. You can still start this week with free writing and planning help that needs no data at all.",
  },
  starter: {
    label: "Ready to start small",
    blurb: "You have enough in place to get real value from AI on a few everyday tasks. Start with one, prove it saves you time, then add the next.",
  },
  scale: {
    label: "Ready to build on what you have",
    blurb: "Your records and tools give AI something to work with. Focus on the uses that connect to your numbers and your customers, and measure what changes.",
  },
};

export function scoreReadiness(a: ReadinessAnswers): Readiness {
  const recordsScore = RECORDS_SCORE[a.records];
  const toolsScore = Math.min(100, a.tools.reduce((s, t) => s + TOOL_POINTS[t], 0));
  const skillsScore = EXPERIENCE_SCORE[a.experience];
  const deviceAdj = a.device === "phone" ? -10 : a.device === "both" ? 5 : 0;
  const capacityScore = Math.max(0, Math.min(100, BUDGET_SCORE[a.budget] + deviceAdj));

  const dimensions: Dimension[] = [
    {
      key: "records", label: "Records & data", score: recordsScore, weight: 0.3,
      reading: recordsScore >= 65
        ? "Your sales and costs are written down somewhere AI can help you read them."
        : "AI can only help with what is written down. A simple daily log is the single most useful first step.",
    },
    {
      key: "tools", label: "Digital tools", score: toolsScore, weight: 0.25,
      reading: toolsScore >= 60
        ? "You already use tools that AI features can plug into."
        : toolsScore >= 25
          ? "You have a few tools in place; a couple more would open up more uses."
          : "Very little is digital today — that is fine, and a smartphone is enough to begin.",
    },
    {
      key: "skills", label: "Your AI comfort", score: skillsScore, weight: 0.2,
      reading: skillsScore >= 70
        ? "You are already comfortable enough to try new uses on your own."
        : "A short, guided practice routine will get you comfortable quickly — most people need about a week.",
    },
    {
      key: "capacity", label: "Budget & access", score: capacityScore, weight: 0.25,
      reading: a.budget === "none"
        ? "Free tools cover a lot of ground. The plan below sticks to them until something proves its worth."
        : "You have room to pay for a tool once a free one has shown it saves you time.",
    },
  ];

  const overall = Math.round(dimensions.reduce((s, d) => s + d.score * d.weight, 0));
  const stage: Stage = overall < 35 ? "foundations" : overall < 65 ? "starter" : "scale";
  return { overall, stage, stageLabel: STAGES[stage].label, stageBlurb: STAGES[stage].blurb, dimensions };
}

/* ------------------------------------------------------------------ */
/* Use-case catalog                                                   */
/* ------------------------------------------------------------------ */

export type CostTier = "free" | "low" | "paid";
export type TimeToValue = "days" | "weeks" | "months";

type Needs = {
  /** Minimum way of keeping records, if the use needs the owner's own data. */
  records?: RecordsLevel;
  /** Needs at least one of these tools. */
  anyTool?: ToolKey[];
  /** Cannot be done free. */
  budget?: BudgetTier;
};

type UseCase = {
  id: string;
  area: FocusArea;
  title: string;
  what: string;
  /** Sectors where this is especially relevant; omitted = all. */
  fit?: string[];
  needs: Needs;
  cost: CostTier;
  timeToValue: TimeToValue;
  firstStep: string;
  /** {business} = the industry in lower case, {place} = the city or "your area". */
  prompt: string;
  guardrail: string;
  measure: string;
  link?: { href: string; label: string };
};

const RETAILISH = ["Retail", "E-commerce", "Restaurant / Food service", "Personal services / Beauty"];
const SERVICEISH = ["Professional services", "Construction / Trades", "Healthcare", "Personal services / Beauty", "Transportation / Logistics"];

export const USE_CASES: UseCase[] = [
  {
    id: "social_content", area: "sales_marketing", title: "Draft posts and promotions",
    what: "Have an AI assistant write captions, offers and announcements in your voice, so posting takes minutes instead of an evening.",
    fit: RETAILISH, needs: {}, cost: "free", timeToValue: "days",
    firstStep: "Open a free AI assistant on your phone and ask it for a week of posts, giving it your best sellers and your tone.",
    prompt: "I run a {business} in {place}. Write 5 short social media posts for this week. My best sellers are [list 2-3]. Friendly, plain language, one clear call to action each.",
    guardrail: "Read every post before publishing. Never let it invent prices, hours or claims.",
    measure: "Minutes you spend on posts each week, before and after.",
  },
  {
    id: "review_replies", area: "sales_marketing", title: "Reply to reviews and messages",
    what: "Draft polite, professional replies to customer reviews and comments, and tidy up your online business description.",
    needs: {}, cost: "free", timeToValue: "days",
    firstStep: "Copy one recent review into a free AI assistant and ask for a reply you can edit.",
    prompt: "Here is a customer review of my {business}: [paste review]. Write a warm, brief reply. If it is a complaint, acknowledge it and offer to make it right.",
    guardrail: "Remove customers' full names or contact details before pasting.",
    measure: "How quickly you now reply to reviews and messages.",
  },
  {
    id: "repeat_customer_offers", area: "sales_marketing", title: "Win back repeat customers",
    what: "Turn your customer list into simple, personal follow-up messages and offers so people come back.",
    needs: { records: "spreadsheet", anyTool: ["messaging", "social", "spreadsheet", "accounting", "pos"] },
    cost: "free", timeToValue: "weeks",
    firstStep: "Put your best 20 customers' first names and what they usually buy into one sheet, then ask AI to draft a short thank-you-and-offer message.",
    prompt: "I have a {business} in {place}. Draft a short, friendly text to send to customers who haven't visited in 30 days, with a small thank-you offer. Keep it under 40 words.",
    guardrail: "Only message people who agreed to hear from you, and include a way to opt out.",
    measure: "How many messaged customers come back within two weeks.",
  },
  {
    id: "quotes_followup", area: "sales_marketing", title: "Write quotes and follow-ups",
    what: "Draft clear quotes, proposals and 'just checking in' follow-ups so leads do not go cold.",
    fit: SERVICEISH, needs: {}, cost: "free", timeToValue: "days",
    firstStep: "Paste the details of your last job and ask AI to turn them into a one-page quote you can edit.",
    prompt: "I run a {business} in {place}. Turn these job details into a clear one-page quote with scope, price and timeline: [paste details]. Then write a friendly follow-up message for 3 days later.",
    guardrail: "You set the prices and scope. Check every figure before it goes to a customer.",
    measure: "How many quotes you send per week and how many are answered.",
  },
  {
    id: "faq_replies", area: "customer_service", title: "Answer common questions fast",
    what: "Write ready-to-use replies to the questions customers ask every day — hours, prices, bookings, returns — so you stop retyping them.",
    needs: {}, cost: "free", timeToValue: "days",
    firstStep: "List the 10 questions you answer most, and ask AI to draft a short reply to each. Save them in your phone's notes.",
    prompt: "I run a {business} in {place}. Here are questions customers ask me often: [list]. Write a short, friendly answer to each that I can copy and paste.",
    guardrail: "Fill in the real facts yourself (prices, hours, policies) — AI does not know them.",
    measure: "Minutes a day you spend answering repeat questions.",
  },
  {
    id: "auto_replies", area: "customer_service", title: "After-hours automatic replies",
    what: "Set up an automatic first reply for messages that arrive when you are busy or closed, and hand off to you for anything complicated.",
    needs: { anyTool: ["messaging", "social", "website"], budget: "low" },
    cost: "low", timeToValue: "weeks",
    firstStep: "Start with the free 'away message' in the messaging app you already use, using the answers from your FAQ list.",
    prompt: "Write a short automatic reply for my {business} for messages received after hours. It should say when I will reply, give my most common answer, and ask for a phone number.",
    guardrail: "Always give customers an easy way to reach a person.",
    measure: "Messages answered within an hour of arriving.",
  },
  {
    id: "receipt_sorting", area: "bookkeeping", title: "Sort receipts and expenses",
    what: "Turn a pile of receipts or a list of expenses into tidy categories, ready for your bookkeeper or tax preparer.",
    needs: { records: "paper" }, cost: "free", timeToValue: "weeks",
    firstStep: "Photograph a week of receipts, type the totals into a sheet, and ask AI to group them into standard expense categories.",
    prompt: "Here are my business expenses for this month as a list: [paste]. Group them into standard categories, add up each category, and flag anything that looks personal.",
    guardrail: "Do not paste bank or card numbers. A licensed preparer should confirm anything tax-related.",
    measure: "Time to close out a month's books.",
  },
  {
    id: "cash_check", area: "bookkeeping", title: "Monthly cash check-in",
    what: "Once a month, enter revenue, expenses and cash, and get a plain-language read on whether you are on track — the MicroBiz Agent does this against your own plan.",
    needs: { records: "paper" }, cost: "free", timeToValue: "days",
    firstStep: "Open the MicroBiz Agent, set a revenue goal for the year, and enter last month's figures.",
    prompt: "Here are my numbers for the last 3 months: [revenue, expenses, cash]. Are they on track for [goal]? What is the one thing to fix first?",
    guardrail: "Treat it as a second opinion, not an accountant.",
    measure: "Whether you catch a shortfall a month earlier than you used to.",
    link: { href: "/ask?assistant=financial", label: "Open the Financial assistant" },
  },
  {
    id: "invoice_reminders", area: "bookkeeping", title: "Invoices and payment reminders",
    what: "Draft clear invoices and polite, firm reminders so you get paid faster without awkward conversations.",
    fit: SERVICEISH, needs: {}, cost: "free", timeToValue: "days",
    firstStep: "Take your oldest unpaid invoice and ask AI for a friendly first reminder and a firmer second one.",
    prompt: "Write two payment reminders for an invoice that is [X] days overdue at my {business}: a friendly first one and a firmer second one. Keep both under 60 words.",
    guardrail: "Check amounts and dates before sending.",
    measure: "Average days from invoice to payment.",
  },
  {
    id: "reorder_planning", area: "inventory", title: "Plan reorders from your sales",
    what: "Use your own sales history to see what sells, what sits, and when to reorder, so you run out less and waste less.",
    needs: { records: "spreadsheet" }, cost: "free", timeToValue: "weeks",
    fit: ["Retail", "E-commerce", "Restaurant / Food service", "Manufacturing"],
    firstStep: "Export or type a month of sales by item, then ask AI to rank items by how fast they sell and suggest reorder points.",
    prompt: "Here is a month of sales by item for my {business}: [paste]. Rank items by how fast they sell, flag slow ones, and suggest how much to reorder next week.",
    guardrail: "Suggestions are arithmetic on your numbers — adjust for holidays and local events you know about.",
    measure: "Times you ran out of a top seller, and what you threw away.",
  },
  {
    id: "supplier_outreach", area: "inventory", title: "Find and approach suppliers",
    what: "Use the MicroBiz sourcing tool to see where suppliers cluster near you, then have AI draft short inquiry messages to ask for prices.",
    needs: {}, cost: "free", timeToValue: "weeks",
    firstStep: "Run the Sourcing & Supply Chain tool for your supplier category, pick two nearby clusters, and draft an inquiry.",
    prompt: "Write a short, polite email from a small {business} in {place} asking a supplier for wholesale pricing, minimum order, delivery options and payment terms.",
    guardrail: "Get quotes in writing and compare delivered cost, not just unit price.",
    measure: "Number of supplier quotes you compare per major purchase.",
    link: { href: "/business/sourcing", label: "Open Sourcing & Supply Chain" },
  },
  {
    id: "schedule_hiring", area: "scheduling_hr", title: "Schedules, job posts and interviews",
    what: "Draft shift schedules from your staff's availability, write clear job posts, and prepare consistent interview questions.",
    needs: {}, cost: "free", timeToValue: "days",
    firstStep: "Paste your staff availability and busiest hours and ask AI for a draft schedule you can adjust.",
    prompt: "I run a {business} with [N] staff. Here is everyone's availability and my busiest times: [paste]. Draft a weekly schedule, then write a short job post for one new hire.",
    guardrail: "Follow local wage-and-hour rules; AI does not know them. Never use it to screen people on protected characteristics.",
    measure: "Time you spend on the weekly schedule.",
  },
  {
    id: "training_sops", area: "scheduling_hr", title: "Turn what you know into checklists",
    what: "Describe how a task is done and get a simple step-by-step checklist a new employee can follow — opening, closing, cleaning, handling a complaint.",
    needs: {}, cost: "free", timeToValue: "days",
    firstStep: "Talk through how you open the business, and ask AI to turn it into a one-page checklist.",
    prompt: "Turn this description of how I do [task] at my {business} into a numbered checklist a new employee can follow on day one: [describe it].",
    guardrail: "Walk through the checklist yourself once to make sure nothing is missing.",
    measure: "How long a new person takes to do the task unaided.",
  },
  {
    id: "admin_drafts", area: "admin", title: "Draft letters, policies and applications",
    what: "Get a solid first draft of routine letters, simple policies, and the narrative parts of permit or loan applications.",
    needs: {}, cost: "free", timeToValue: "days",
    firstStep: "Pick the paperwork task you most dislike and ask AI for a first draft you can edit.",
    prompt: "Draft a short [letter / policy / application narrative] for my {business} in {place} about [topic]. Plain language, under one page. I will edit the details.",
    guardrail: "AI drafts are not legal advice. Have important documents reviewed before signing or filing.",
    measure: "Hours a month spent on paperwork.",
  },
  {
    id: "summarise_documents", area: "admin", title: "Understand forms and contracts",
    what: "Paste a confusing form, lease or letter and ask for a plain-language summary and a list of questions to ask.",
    needs: {}, cost: "free", timeToValue: "days",
    firstStep: "Take a notice or contract you have not fully read and ask AI to explain it in plain language.",
    prompt: "Explain this document in plain language and list the dates, amounts and obligations in it, plus 5 questions I should ask before agreeing: [paste text].",
    guardrail: "Use it to understand, not to decide. Confirm anything binding with a professional.",
    measure: "Fewer surprises after signing.",
  },
];

/* ------------------------------------------------------------------ */
/* Matching                                                           */
/* ------------------------------------------------------------------ */

const AREA_KEYWORDS: Record<FocusArea, RegExp> = {
  sales_marketing: /customer|repeat|online|social|market|advert|promo|visib|sales|lead|quote/i,
  customer_service: /phone|call|message|complain|question|respond|reply|booking|appointment/i,
  bookkeeping: /book|cash|invoice|payment|tax|receipt|expens|billing|paid/i,
  inventory: /inventor|stock|supplier|order|waste|food cost|shortage|ran out|run out/i,
  scheduling_hr: /staff|schedul|hiring|turnover|train|shift|employee|labor|labour/i,
  admin: /paper|permit|form|admin|licen|compliance|document|letter/i,
};

const RECORDS_ORDER: RecordsLevel[] = ["memory", "paper", "spreadsheet", "software"];
const BUDGET_ORDER: BudgetTier[] = ["none", "low", "mid", "high"];

function unmetNeeds(uc: UseCase, a: ReadinessAnswers): string | null {
  const n = uc.needs;
  if (n.records && RECORDS_ORDER.indexOf(a.records) < RECORDS_ORDER.indexOf(n.records)) {
    return n.records === "spreadsheet"
      ? "needs your sales or customers written down in a spreadsheet or phone notes"
      : "needs your figures written down somewhere, even on paper";
  }
  if (n.anyTool && !n.anyTool.some((t) => a.tools.includes(t))) {
    return "needs a messaging app, social page, website or similar tool to work through";
  }
  if (n.budget && BUDGET_ORDER.indexOf(a.budget) < BUDGET_ORDER.indexOf(n.budget)) {
    return "needs a small monthly budget";
  }
  return null;
}

export type MatchedUseCase = UseCase & {
  /** Why this one was picked for this business, in plain words. */
  because: string[];
  /** Prompt with the business filled in. */
  promptFilled: string;
  /** Only on the "later" list: what to put in place first. */
  unlockedBy?: string;
};

const BUSINESS_LABEL: Record<string, string> = {
  "Retail": "retail shop",
  "Restaurant / Food service": "restaurant or food business",
  "Professional services": "professional services business",
  "Construction / Trades": "construction or trades business",
  "Healthcare": "healthcare practice",
  "E-commerce": "online store",
  "Manufacturing": "small manufacturing business",
  "Technology / SaaS": "technology business",
  "Transportation / Logistics": "transportation or logistics business",
  "Personal services / Beauty": "personal services or beauty business",
};

function fillPrompt(p: string, ctx: ReadinessContext): string {
  const city = ctx.location.split(",")[0].trim();
  return p
    .replaceAll("{business}", BUSINESS_LABEL[ctx.industry] ?? "small business")
    .replaceAll("{place}", city || "my area");
}

const COST_RANK: Record<CostTier, number> = { free: 0, low: 1, paid: 2 };
const TTV_RANK: Record<TimeToValue, number> = { days: 0, weeks: 1, months: 2 };

export function matchUseCases(a: ReadinessAnswers, ctx: ReadinessContext) {
  const text = `${ctx.marketing} ${ctx.operations} ${a.repetitive}`;
  const scored = USE_CASES.map((uc) => {
    const because: string[] = [];
    let score = 0;
    if (a.focus.includes(uc.area)) {
      score += 4;
      because.push(`You said ${FOCUS_OPTIONS.find((f) => f.key === uc.area)!.label.toLowerCase()} takes a lot of your time.`);
    }
    if (text.trim() && AREA_KEYWORDS[uc.area].test(text)) {
      score += 2;
      because.push("It matches challenges you described in your assessment.");
    }
    if (uc.fit?.includes(ctx.industry)) {
      score += 1;
      because.push(`It is a common fit for ${ctx.industry.toLowerCase()} businesses.`);
    } else if (uc.fit && ctx.industry !== "Other") {
      // Written for other kinds of business: keep it available, but rank it lower.
      score -= 3;
    }
    return { uc, score, because, unmet: unmetNeeds(uc, a) };
  });

  const byPriority = (x: typeof scored[number], y: typeof scored[number]) =>
    y.score - x.score
    || (x.uc.fit ? 1 : 0) - (y.uc.fit ? 1 : 0)
    || COST_RANK[x.uc.cost] - COST_RANK[y.uc.cost]
    || TTV_RANK[x.uc.timeToValue] - TTV_RANK[y.uc.timeToValue];

  const wanted = scored.filter((s) => s.score > 0);
  const pool = wanted.length >= 2 ? wanted : scored.filter((s) => !s.unmet && s.score > -3);

  const ready = pool.filter((s) => !s.unmet).sort(byPriority);

  // One best pick for each area the owner named first, so a second or third
  // concern is not crowded out by the first; then fill up by priority.
  const start: typeof ready = [];
  for (const area of a.focus) {
    const best = ready.find((s) => s.uc.area === area && !start.includes(s));
    if (best) start.push(best);
  }
  for (const s of ready) {
    if (start.length >= 4) break;
    if (!start.includes(s)) start.push(s);
  }
  start.splice(4);
  start.sort(byPriority);
  const startIds = new Set(start.map((s) => s.uc.id));

  const later = pool
    .filter((s) => s.unmet && !startIds.has(s.uc.id))
    .sort(byPriority)
    .slice(0, 3);

  const finish = (s: typeof scored[number], withUnlock: boolean): MatchedUseCase => ({
    ...s.uc,
    because: s.because.length ? s.because : ["A low-risk place to begin: it needs no data and no spending."],
    promptFilled: fillPrompt(s.uc.prompt, ctx),
    ...(withUnlock && s.unmet ? { unlockedBy: s.unmet } : {}),
  });

  return { start: start.map((s) => finish(s, false)), later: later.map((s) => finish(s, true)) };
}

/* ------------------------------------------------------------------ */
/* Foundations, training, roadmap                                     */
/* ------------------------------------------------------------------ */

export type Foundation = { id: string; title: string; detail: string };

export function foundationsFor(a: ReadinessAnswers): Foundation[] {
  const out: Foundation[] = [];
  if (a.records === "memory" || a.records === "paper") {
    out.push({
      id: "sales_log", title: "Start a simple daily log",
      detail: "Spend five minutes at close writing down the day's sales and any spending — in a spreadsheet or your phone's notes app. This one habit is what lets AI help with your numbers later.",
    });
  }
  if (!a.tools.includes("spreadsheet") && !a.tools.includes("accounting") && !a.tools.includes("pos")) {
    out.push({
      id: "receipts", title: "Keep receipts in one place",
      detail: "Take a photo of each receipt and save it in a single album on your phone. Once a week, add the totals to your log.",
    });
  }
  if (!a.tools.includes("website") && !a.tools.includes("social") && !a.tools.includes("messaging")) {
    out.push({
      id: "presence", title: "Give customers one way to reach you",
      detail: "Set up a free business profile or a business messaging number so people can find and contact you. It also gives AI something to help you with.",
    });
  }
  return out.slice(0, 3);
}

export type TrainingModule = { id: string; title: string; minutes: number; detail: string };

export function trainingFor(a: ReadinessAnswers): TrainingModule[] {
  const beginner = a.experience === "never" || a.experience === "tried";
  const mods: TrainingModule[] = [];
  if (beginner) {
    mods.push({
      id: "t_basics", title: "What AI is good and bad at", minutes: 15,
      detail: "Open a free AI assistant and ask it a few questions about your own business. Notice what it gets right, what it guesses, and what it cannot know.",
    });
  }
  mods.push({
    id: "t_prompts", title: "Asking well: role, task, details, format", minutes: 20,
    detail: "A good request says who the AI should act as, what you want, the facts it needs, and the shape of the answer. Practice by rewriting one vague request three ways.",
  });
  mods.push({
    id: "t_safe", title: "Using it safely", minutes: 10,
    detail: "Do not paste customers' personal details, bank or card numbers, or passwords. Check every fact, price and date before using it. Keep a human in the loop for anything a customer or a regulator will read.",
  });
  mods.push({
    id: "t_review", title: "Measure and improve", minutes: 10,
    detail: "Once a month, look at the time you tracked before and after each use. Keep what helps, drop what does not.",
  });
  return mods;
}

export type RoadmapTask = { id: string; kind: "foundation" | "learn" | "use" | "measure"; title: string; detail: string };
export type RoadmapPhase = { id: string; label: string; goal: string; tasks: RoadmapTask[] };

export function buildRoadmap(
  start: MatchedUseCase[], foundations: Foundation[], training: TrainingModule[], later: MatchedUseCase[],
): RoadmapPhase[] {
  const first = start.slice(0, 1);
  const mid = start.slice(1, 3);
  const last = start.slice(3);

  const useTask = (u: MatchedUseCase): RoadmapTask => ({
    id: `use_${u.id}`, kind: "use", title: u.title, detail: u.firstStep,
  });
  const learn = (id: string): RoadmapTask[] =>
    training.filter((t) => t.id === id).map((t) => ({
      id: t.id, kind: "learn" as const, title: `${t.title} (${t.minutes} min)`, detail: t.detail,
    }));

  const phase1: RoadmapTask[] = [
    ...foundations.map((f) => ({ id: `f_${f.id}`, kind: "foundation" as const, title: f.title, detail: f.detail })),
    ...learn("t_basics"), ...learn("t_prompts"), ...learn("t_safe"),
    ...first.map(useTask),
    ...first.map((u): RoadmapTask => ({ id: `m_${u.id}`, kind: "measure", title: `Note your baseline: ${u.measure}`, detail: "Write down today's number before you change anything, so you can see the difference." })),
  ];

  const phase2: RoadmapTask[] = [
    ...mid.map(useTask),
    ...mid.map((u): RoadmapTask => ({ id: `m_${u.id}`, kind: "measure", title: `Track: ${u.measure}`, detail: "Compare with your baseline after two weeks of use." })),
  ];

  const phase3: RoadmapTask[] = [
    ...last.map(useTask),
    ...later.slice(0, 1).map((u): RoadmapTask => ({
      id: `next_${u.id}`, kind: "use", title: `When ready: ${u.title}`,
      detail: `${u.unlockedBy ? `Once you have this in place — ${u.unlockedBy} — ` : ""}${u.firstStep}`,
    })),
    ...learn("t_review"),
  ];

  return [
    { id: "p1", label: "Days 1–30", goal: "Get set up and win something small.", tasks: phase1 },
    { id: "p2", label: "Days 31–60", goal: "Make it routine.", tasks: phase2 },
    { id: "p3", label: "Days 61–90", goal: "Review, then extend.", tasks: phase3.length ? phase3 : learn("t_review") },
  ];
}

/* ------------------------------------------------------------------ */
/* Whole plan                                                         */
/* ------------------------------------------------------------------ */

export type AdoptionPlan = {
  readiness: Readiness;
  start: MatchedUseCase[];
  later: MatchedUseCase[];
  foundations: Foundation[];
  training: TrainingModule[];
  roadmap: RoadmapPhase[];
  /** Facts the AI summary is allowed to use — and nothing else. */
  summaryFacts: string[];
};

const COST_LABEL: Record<CostTier, string> = { free: "Free", low: "Low monthly cost", paid: "Paid software" };
const TTV_LABEL: Record<TimeToValue, string> = { days: "Days to a first result", weeks: "A few weeks to a result", months: "Months to a result" };
export const costLabel = (c: CostTier) => COST_LABEL[c];
export const timeLabel = (t: TimeToValue) => TTV_LABEL[t];

export function buildAdoptionPlan(rawAnswers: unknown, ctx: ReadinessContext): AdoptionPlan {
  const answers = normalizeAnswers(rawAnswers);
  const readiness = scoreReadiness(answers);
  const { start, later } = matchUseCases(answers, ctx);
  const foundations = foundationsFor(answers);
  const training = trainingFor(answers);
  const roadmap = buildRoadmap(start, foundations, training, later);

  const summaryFacts = [
    `Business: ${ctx.industry}${ctx.location ? ` in ${ctx.location}` : ""}, ${ctx.employees} employee${ctx.employees === 1 ? "" : "s"}.`,
    `AI readiness (calculated from the owner's own answers, not measured): ${readiness.overall}/100 — "${readiness.stageLabel}".`,
    ...readiness.dimensions.map((d) => `${d.label}: ${d.score}/100.`),
    `Budget for new tools: ${BUDGET_OPTIONS.find((b) => b.key === answers.budget)!.label}. Works mostly from: ${DEVICE_OPTIONS.find((d) => d.key === answers.device)!.label.toLowerCase()}.`,
    `Recommended first uses, in order: ${start.map((s) => `${s.title} (${COST_LABEL[s.cost].toLowerCase()}, ${TTV_LABEL[s.timeToValue].toLowerCase()})`).join("; ") || "none yet"}.`,
    foundations.length ? `Foundations to put in place first: ${foundations.map((f) => f.title).join("; ")}.` : "No foundations are blocking the first uses.",
    later.length ? `Worth adding later: ${later.map((l) => l.title).join("; ")}.` : "",
    answers.repetitive ? `Task the owner repeats every week: ${answers.repetitive}` : "",
  ].filter(Boolean);

  return { readiness, start, later, foundations, training, roadmap, summaryFacts };
}
