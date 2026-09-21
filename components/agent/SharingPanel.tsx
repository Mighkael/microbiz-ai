"use client";

import { useRef, useState } from "react";
import { ShieldCheck, Download, Upload, Trash2 } from "lucide-react";
import { C } from "@/lib/theme";
import { sanitizeAgentData, type AgentData, type SharePermissions } from "@/lib/agent/types";
import { Card, H, Btn } from "../ui";
import { Toggle, downloadText } from "./shared";

const ITEMS: { key: keyof SharePermissions; label: string; description: string }[] = [
  {
    key: "profile", label: "Business profile",
    description: "Industry, location, size and the challenges from your assessment. Lets answers fit your kind of business.",
  },
  {
    key: "financials", label: "Plan and monthly figures",
    description: "Your targets and monthly revenue, expenses and cash. Needed for plan-against-actual answers and for reports.",
  },
  {
    key: "obligations", label: "Obligations",
    description: "Your deadlines and payments. Needed for the Compliance & Obligations assistant.",
  },
];

export default function SharingPanel({
  data, update, replace, clear,
}: {
  data: AgentData;
  update: (fn: (d: AgentData) => AgentData) => void;
  replace: (d: AgentData) => void;
  clear: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");

  const setPermission = (key: keyof SharePermissions, v: boolean) =>
    update((d) => ({ ...d, permissions: { ...d.permissions, [key]: v } }));

  async function restore(file: File) {
    setMessage("");
    try {
      if (file.size > 500_000) throw new Error();
      const parsed = JSON.parse(await file.text());
      replace(sanitizeAgentData(parsed, new Date().getFullYear()));
      setMessage("Backup restored.");
    } catch {
      setMessage("That file isn't a MicroBiz Agent backup.");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card>
        <H>
          <ShieldCheck size={17} style={{ verticalAlign: -3, marginRight: 7 }} color={C.ledger} />
          What the agent may see
        </H>
        <div style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.6, margin: "8px 0 18px", maxWidth: 680 }}>
          Everything you enter here is saved <b>in this browser, on this device</b> — not on MicroBiz AI&apos;s servers.
          The Monitor tab works entirely on your device. Only when you ask the assistant a question or build a report are
          the parts you allow below sent — to answer that one request — to MicroBiz AI and our AI provider.
        </div>
        <div style={{ display: "grid", gap: 16 }}>
          {ITEMS.map((it) => (
            <Toggle key={it.key} checked={data.permissions[it.key]} onChange={(v) => setPermission(it.key, v)} label={it.label} description={it.description} />
          ))}
        </div>
      </Card>

      <Card>
        <H size={16}>Your data</H>
        <div style={{ fontSize: 13, color: C.mist, lineHeight: 1.55, margin: "6px 0 14px", maxWidth: 680 }}>
          Because it lives in this browser, clearing your browsing data or switching device will lose it. Save a backup
          file now and then, and restore it on another device.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn tone="ghost" onClick={() => downloadText(`microbiz-agent-backup-${new Date().toLocaleDateString("en-CA")}.json`, JSON.stringify(data, null, 2), "application/json")}>
            <Download size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Save a backup
          </Btn>
          <Btn tone="ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Restore a backup
          </Btn>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ""; }} />
        </div>
        {message && <div style={{ fontSize: 13, color: message.startsWith("Backup") ? C.ledger : C.alert, marginTop: 10 }}>{message}</div>}

        <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 18, paddingTop: 14 }}>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{
              display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
              color: C.alert, fontSize: 13, cursor: "pointer", padding: 0,
            }}>
              <Trash2 size={14} /> Delete all agent data from this device
            </button>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: C.ink }}>Delete your plan, figures and obligations? This can&apos;t be undone.</span>
              <Btn onClick={() => { clear(); setConfirmDelete(false); setMessage(""); }} style={{ background: C.alert }}>Delete</Btn>
              <Btn tone="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Btn>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
