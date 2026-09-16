export const C = {
  ink: "#16242E",
  ink2: "#22343F",
  paper: "#F4F6F5",
  card: "#FFFFFF",
  ledger: "#0E7B5F",
  ledgerSoft: "#E3F0EB",
  signal: "#D99A2B",
  alert: "#BE4B3A",
  mist: "#64798A",
  line: "#E2E8E6",
};

export const FONT_HEAD = "'Space Grotesk','Segoe UI',sans-serif";
export const FONT_MONO = "'IBM Plex Mono','SFMono-Regular',Consolas,monospace";
export const FONT_BODY = "'Inter','Segoe UI',system-ui,sans-serif";

export const NAV_H = 64;
/** The Contact / Feedback / Tour strip above the header. Scrolls away; the header stays sticky. */
export const UTILITY_H = 34;

export const fmt = (n: number) => (isNaN(n) ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }));
export const pct = (n: number) => (isNaN(n) ? "—" : (n * 100).toFixed(1) + "%");
