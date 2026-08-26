import type { Profile, Metrics, ChatMessage } from "./data";

export async function askAdvisor(profile: Profile, metrics: Metrics, message: string, history: ChatMessage[]): Promise<string> {
  const res = await fetch("/api/advisor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile, metrics, message, history }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Advisor request failed.");
  return data.reply as string;
}

export type Source = { url: string; title: string };

export async function askBriefing(kind: "news" | "markets" | "world" | "opportunities", profile: Profile): Promise<{ content: string; sources: Source[] }> {
  const res = await fetch("/api/briefing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, industry: profile.industry, location: profile.location }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Briefing request failed.");
  return { content: data.content as string, sources: (data.sources ?? []) as Source[] };
}
