"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircle, Activity, Table2, CalendarClock, FileText, ShieldCheck } from "lucide-react";
import { C, FONT_HEAD } from "@/lib/theme";
import { useProfileContext } from "../ProfileProvider";
import { ROLES, type AssistantRole } from "@/lib/agent/types";
import { analyze } from "@/lib/agent/analysis";
import { useAgentWorkspace, todayISO } from "./shared";
import { useAgentChat } from "./useAgentChat";
import AssistantPanel from "./AssistantPanel";
import MonitorPanel from "./MonitorPanel";
import PlanPanel from "./PlanPanel";
import ObligationsPanel from "./ObligationsPanel";
import ReportsPanel from "./ReportsPanel";
import SharingPanel from "./SharingPanel";

type Tab = "assistant" | "monitor" | "plan" | "obligations" | "reports" | "sharing";

const TABS: { key: Tab; label: string; Icon: typeof Activity }[] = [
  { key: "assistant", label: "Assistant", Icon: MessageCircle },
  { key: "monitor", label: "Monitor", Icon: Activity },
  { key: "plan", label: "Plan & actuals", Icon: Table2 },
  { key: "obligations", label: "Obligations", Icon: CalendarClock },
  { key: "reports", label: "Reports", Icon: FileText },
  { key: "sharing", label: "Sharing", Icon: ShieldCheck },
];

const isTab = (v: string | null): v is Tab => TABS.some((t) => t.key === v);
const isRole = (v: string | null): v is AssistantRole => ROLES.some((r) => r.key === v);

export default function AgentWorkspace() {
  const params = useSearchParams();
  const { profile } = useProfileContext();
  const { data, update, replace, clear, hydrated } = useAgentWorkspace();

  // Links such as /ask?assistant=financial (from the AI Roadmap) or
  // /ask?tab=plan open the right place directly.
  const [tab, setTab] = useState<Tab>(() => {
    const t = params.get("tab");
    return isTab(t) ? t : "assistant";
  });
  const [role, setRole] = useState<AssistantRole>(() => {
    const r = params.get("assistant");
    return isRole(r) ? r : "executive";
  });

  const chat = useAgentChat(data, profile);

  useEffect(() => {
    const next = new URLSearchParams();
    if (tab !== "assistant") next.set("tab", tab);
    if (role !== "executive") next.set("assistant", role);
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [tab, role]);

  const attention = useMemo(
    () => analyze(data, todayISO()).alerts.filter((a) => a.severity === "high" || a.severity === "medium").length,
    [data],
  );

  function askFromAlert(r: AssistantRole, question: string) {
    setRole(r);
    setTab("assistant");
    chat.send(r, question);
  }

  const goTo = (t: Tab) => { setTab(t); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (!hydrated) return <div style={{ color: C.mist, fontSize: 14 }}>Loading your workspace…</div>;

  return (
    <div>
      <div role="tablist" aria-label="MicroBiz Agent" style={{
        display: "flex", gap: 4, overflowX: "auto", borderBottom: `1px solid ${C.line}`, marginBottom: 18,
      }}>
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key} role="tab" aria-selected={active} onClick={() => setTab(key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                padding: "10px 12px", border: "none", background: "none", cursor: "pointer",
                fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14,
                color: active ? C.ink : C.mist,
                borderBottom: `2px solid ${active ? C.ledger : "transparent"}`, marginBottom: -1,
              }}
            >
              <Icon size={15} /> {label}
              {key === "monitor" && attention > 0 && (
                <span aria-label={`${attention} need attention`} style={{
                  fontSize: 11, fontWeight: 700, color: "#fff", background: C.alert,
                  borderRadius: 999, padding: "1px 7px", marginLeft: 2,
                }}>{attention}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "assistant" && (
        <AssistantPanel data={data} role={role} onRoleChange={setRole} chat={chat} onGoTo={goTo} />
      )}
      {tab === "monitor" && <MonitorPanel data={data} onAsk={askFromAlert} onGoTo={goTo} />}
      {tab === "plan" && <PlanPanel data={data} update={update} />}
      {tab === "obligations" && <ObligationsPanel data={data} update={update} />}
      {tab === "reports" && <ReportsPanel data={data} profile={profile} update={update} />}
      {tab === "sharing" && <SharingPanel data={data} update={update} replace={replace} clear={clear} />}
    </div>
  );
}
