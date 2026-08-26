export type IndustryBench = { margin: number; growth: number; varRatio: number };

export const INDUSTRIES: Record<string, IndustryBench> = {
  "Retail": { margin: 0.05, growth: 0.03, varRatio: 0.65 },
  "Restaurant / Food service": { margin: 0.06, growth: 0.04, varRatio: 0.7 },
  "Professional services": { margin: 0.18, growth: 0.05, varRatio: 0.35 },
  "Construction / Trades": { margin: 0.08, growth: 0.04, varRatio: 0.6 },
  "Healthcare": { margin: 0.12, growth: 0.06, varRatio: 0.45 },
  "E-commerce": { margin: 0.1, growth: 0.08, varRatio: 0.6 },
  "Manufacturing": { margin: 0.09, growth: 0.03, varRatio: 0.62 },
  "Technology / SaaS": { margin: 0.2, growth: 0.12, varRatio: 0.25 },
  "Transportation / Logistics": { margin: 0.07, growth: 0.04, varRatio: 0.66 },
  "Personal services / Beauty": { margin: 0.11, growth: 0.05, varRatio: 0.5 },
  "Other": { margin: 0.1, growth: 0.04, varRatio: 0.55 },
};

export const FUNDING = [
  { name: "SBA 7(a) Loan Program", type: "Loan", amount: "Up to $5M", best: ["Working capital", "Expansion", "Equipment", "Real estate"], notes: "Flagship SBA-guaranteed loan through partner banks. Competitive rates; requires solid credit and 2+ years preferred.", url: "sba.gov/funding-programs/loans/7a-loans" },
  { name: "SBA 504 Loan", type: "Loan", amount: "Up to $5.5M", best: ["Real estate", "Equipment"], notes: "Long-term fixed-rate financing for major fixed assets via Certified Development Companies.", url: "sba.gov/funding-programs/loans/504-loans" },
  { name: "SBA Microloans", type: "Loan", amount: "Up to $50K", best: ["Startup", "Working capital", "Inventory"], notes: "Through nonprofit intermediaries; friendlier to newer businesses and thinner credit files.", url: "sba.gov/funding-programs/loans/microloans" },
  { name: "Grants.gov (federal grants)", type: "Grant", amount: "Varies", best: ["R&D", "Specific federal programs"], notes: "Central database of all federal grant opportunities. Most are program-specific, not general operating funds.", url: "grants.gov" },
  { name: "SBIR / STTR", type: "Grant", amount: "$50K–$2M+", best: ["R&D", "Tech innovation"], notes: "America's Seed Fund: non-dilutive federal R&D funding for innovative small businesses.", url: "sbir.gov" },
  { name: "USDA Rural Business Development Grants", type: "Grant", amount: "$10K–$500K", best: ["Rural businesses"], notes: "For small businesses in eligible rural areas; also see USDA B&I guaranteed loans.", url: "rd.usda.gov" },
  { name: "State & local economic development programs", type: "Grant / Incentive", amount: "Varies", best: ["Expansion", "Hiring", "Relocation"], notes: "Every US state runs incentive, grant, or low-interest loan programs; check your state's economic development agency (e.g., TNECD in Tennessee).", url: "your state's economic development site" },
  { name: "Amber Grant (WomensNet)", type: "Grant", amount: "$10K monthly / $25K annual", best: ["Women-owned"], notes: "Monthly grants for women-owned businesses; simple application.", url: "ambergrantsforwomen.com" },
  { name: "FedEx Small Business Grant Contest", type: "Grant", amount: "Up to $50K", best: ["Any US small business"], notes: "Annual competition; strong story and product help.", url: "fedex.com/en-us/small-business/grants" },
  { name: "Hello Alice funding center", type: "Grant marketplace", amount: "Varies", best: ["All owners", "Underrepresented founders"], notes: "Aggregates rotating grant and credit opportunities.", url: "helloalice.com" },
  { name: "CDFIs (Community Development Financial Institutions)", type: "Loan", amount: "$5K–$250K+", best: ["Underserved communities", "Startups"], notes: "Mission-driven lenders with flexible underwriting; find local CDFIs via the CDFI Fund locator.", url: "cdfifund.gov" },
];

export const BANKS = [
  { name: "Live Oak Bank", note: "Consistently a top SBA 7(a) lender by volume; industry-specialized lending teams." },
  { name: "Huntington National Bank", note: "Leading SBA lender by loan count; strong Midwest/Southeast presence." },
  { name: "Chase for Business", note: "Full-service small business banking, credit lines, and SBA lending." },
  { name: "Wells Fargo Small Business", note: "Large SBA lender; lines of credit and equipment financing." },
  { name: "U.S. Bank", note: "SBA Preferred Lender; quick-close small-dollar business loans." },
  { name: "Local community banks & credit unions", note: "Often the best relationship-based underwriting for main-street businesses." },
];

export const WORLD = [
  { region: "Global", name: "World Bank / IFC SME Finance", note: "Financing lines and programs supporting small and medium enterprises in developing markets (ifc.org)." },
  { region: "Global", name: "Kiva", note: "0% interest crowdfunded microloans up to $15K for entrepreneurs worldwide (kiva.org)." },
  { region: "UK", name: "British Business Bank / Start Up Loans", note: "Government-backed loans up to £25K plus mentoring." },
  { region: "EU", name: "EU SME funding (EIC, InvestEU, Horizon)", note: "Grants and guarantees for European small businesses (european-union.europa.eu)." },
  { region: "Canada", name: "BDC & CSBFP", note: "Business Development Bank of Canada loans and the Canada Small Business Financing Program." },
  { region: "Africa", name: "African Development Bank SME programs", note: "Trade finance and SME credit lines through partner banks." },
  { region: "Asia-Pacific", name: "ADB SME finance / national schemes", note: "e.g., India's MUDRA loans, Singapore's Enterprise Financing Scheme." },
  { region: "Latin America", name: "IDB Lab & national development banks", note: "Innovation funding and SME credit (e.g., BNDES in Brazil, Nafin in Mexico)." },
];

export const OPPORTUNITIES = [
  { title: "AI services for main-street businesses", note: "Setup, training, and automation services for local firms adopting AI tools — one of the fastest-growing B2B niches." },
  { title: "Home healthcare & aging-in-place services", note: "Demographics guarantee demand growth for non-medical home care, mobility retrofits, and care coordination." },
  { title: "EV charging & fleet services", note: "Installation, maintenance, and depot services as electrification spreads to small fleets." },
  { title: "Skilled trades & specialty contracting", note: "Persistent labor shortage means strong pricing power in HVAC, electrical, and plumbing." },
  { title: "Reshoring & niche manufacturing", note: "Supply-chain diversification is pushing contract work to small US shops (CNC, injection molding, PCB assembly)." },
  { title: "Sustainability & energy-efficiency retrofits", note: "Rebate-driven demand for insulation, heat pumps, and commercial energy audits." },
  { title: "Pet economy services", note: "Premium grooming, boarding, and pet health continue double-digit category growth." },
  { title: "Experience-based local commerce", note: "Classes, tastings, and events layered onto retail/food concepts to defend against e-commerce." },
];

export type Profile = {
  industry: string;
  location: string;
  revenue: string;
  expenses: string;
  cash: string;
  employees: string;
  age: string;
  financing: string;
  marketing: string;
  operations: string;
};

export const DEFAULT_PROFILE: Profile = {
  industry: "Retail", location: "", revenue: "", expenses: "", cash: "",
  employees: "", age: "", financing: "Working capital", marketing: "", operations: "",
};

export type Metrics = {
  rev: number; exp: number; cash: number; emp: number; age: number;
  bench: IndustryBench;
  profit: number; margin: number; mRev: number; mExp: number; mCash: number;
  varCosts: number; fixedCosts: number; cmRatio: number; breakEven: number;
  runway: number; revPerEmp: number; score: number;
};

export type ChatMessage = { role: "user" | "ai"; text: string };
