"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/data";
import type { Evidence } from "@/lib/api";
import { redactForAssistant, type AgentData, type AssistantRole } from "@/lib/agent/types";
import { todayISO } from "./shared";

export type ChatMsg = { role: "user" | "ai"; text: string; assistant?: AssistantRole; evidence?: Evidence[] };

/**
 * The conversation with the agent. Held above the tabs, so switching to the
 * Monitor or Plan tab and back doesn't lose it, and so "Ask the agent" on an
 * alert can send a question straight from its click handler.
 */
export function useAgentChat(data: AgentData, profile: Profile | null) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // Read by send() for the history, without making send change on every message.
  const messagesRef = useRef<ChatMsg[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const send = useCallback(async (role: AssistantRole, text: string) => {
    const question = text.trim();
    if (!question || busyRef.current) return;
    busyRef.current = true;
    const history = messagesRef.current.map(({ role: r, text: t }) => ({ role: r, text: t }));
    setMessages((m) => [...m, { role: "user", text: question }]);
    setBusy(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          message: question,
          history,
          // Filtered here and again on the server: only what the owner allowed leaves the device.
          data: redactForAssistant(data),
          profile: data.permissions.profile ? profile : null,
          today: todayISO(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "The assistant couldn't answer.");
      setMessages((m) => [...m, { role: "ai", text: json.reply, assistant: role, evidence: json.evidence ?? [] }]);
    } catch (err) {
      setMessages((m) => [...m, {
        role: "ai", assistant: role,
        text: err instanceof Error ? err.message : "Connection error. Please try again.",
      }]);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [data, profile]);

  const reset = useCallback(() => setMessages([]), []);

  return { messages, busy, send, reset };
}
