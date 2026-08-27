"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { C, FONT_HEAD } from "@/lib/theme";
import { INDUSTRIES, DEFAULT_PROFILE } from "@/lib/data";
import type { Profile } from "@/lib/data";
import { Card, Btn, Field, inputStyle } from "./ui";
import { useProfileContext } from "./ProfileProvider";
import { useAuth } from "./AuthProvider";
import LocationInsight from "./LocationInsight";
import Copyright from "./Copyright";

export default function AssessmentForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile: saved, hydrated, saving, saveProfile } = useProfileContext();
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState("");

  // Fill the form from whatever ProfileProvider loaded (localStorage or
  // Supabase) exactly once, as soon as it's ready — avoids blowing away
  // in-progress typing if this fires more than once.
  useEffect(() => {
    if (hydrated && !initialized) {
      setProfile(saved ?? DEFAULT_PROFILE);
      setInitialized(true);
    }
  }, [hydrated, saved, initialized]);

  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setProfile({ ...profile, [k]: e.target.value });

  async function handleSubmit() {
    setError("");
    try {
      await saveProfile(profile);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your profile. Please try again.");
    }
  }

  function handleClear() {
    setProfile(DEFAULT_PROFILE);
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
      <div style={{ fontFamily: FONT_HEAD, fontSize: 13, letterSpacing: 2, color: C.ledger, fontWeight: 700 }}>MICROBIZ AI</div>
      <h1 style={{ fontFamily: FONT_HEAD, fontSize: 38, margin: "8px 0 4px", color: C.ink, lineHeight: 1.15 }}>
        Tell us about your business.
      </h1>
      <p style={{ color: C.mist, fontSize: 15, marginBottom: 8 }}>
        Nine quick answers unlock your dashboard: financial analysis, risk assessment, AI guidance, and funding matches.
      </p>
      <p style={{ color: C.mist, fontSize: 12.5, marginBottom: 32 }}>
        {user
          ? <>Saving to your account (<b style={{ color: C.ink }}>{user.email}</b>) — it'll be here next time you log in.</>
          : <>Saving to this device only. <Link href="/signup" style={{ color: C.ledger }}>Create an account</Link> to keep it across devices.</>}
      </p>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18 }}>
          <Field label="Industry">
            <select style={inputStyle} value={profile.industry} onChange={set("industry")}>
              {Object.keys(INDUSTRIES).map((i) => <option key={i}>{i}</option>)}
            </select>
          </Field>
          <Field label="Location (city, state)">
            <input style={inputStyle} value={profile.location} onChange={set("location")} placeholder="Clarksville, TN" />
          </Field>
          <Field label="Annual revenue ($)">
            <input style={inputStyle} type="number" value={profile.revenue} onChange={set("revenue")} placeholder="500000" />
          </Field>
          <Field label="Annual expenses ($)">
            <input style={inputStyle} type="number" value={profile.expenses} onChange={set("expenses")} placeholder="420000" />
          </Field>
          <Field label="Cash on hand ($)">
            <input style={inputStyle} type="number" value={profile.cash} onChange={set("cash")} placeholder="60000" />
          </Field>
          <Field label="Employees">
            <input style={inputStyle} type="number" value={profile.employees} onChange={set("employees")} placeholder="6" />
          </Field>
          <Field label="Business age (years)">
            <input style={inputStyle} type="number" value={profile.age} onChange={set("age")} placeholder="3" />
          </Field>
          <Field label="Financing needs">
            <select style={inputStyle} value={profile.financing} onChange={set("financing")}>
              {["None right now", "Working capital", "Equipment", "Expansion", "Real estate", "Startup", "Inventory", "R&D"].map((f) => <option key={f}>{f}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
          <Field label="Biggest marketing challenge">
            <textarea style={{ ...inputStyle, minHeight: 70 }} value={profile.marketing} onChange={set("marketing")} placeholder="e.g., getting repeat customers; low online visibility" />
          </Field>
          <Field label="Biggest operational challenge">
            <textarea style={{ ...inputStyle, minHeight: 70 }} value={profile.operations} onChange={set("operations")} placeholder="e.g., staffing, inventory management, scheduling" />
          </Field>
        </div>
        {error && <div style={{ color: C.alert, fontSize: 13, marginTop: 16 }}>{error}</div>}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Btn tone="ghost" onClick={handleClear} disabled={saving}>Clear all</Btn>
          <Btn tone="green" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : <>Build my dashboard <ChevronRight size={16} style={{ verticalAlign: -3 }} /></>}
          </Btn>
        </div>
      </Card>

      {profile.location.trim().length >= 3 && (
        <div style={{ marginTop: 20 }}>
          <LocationInsight location={profile.location} />
        </div>
      )}

      <p style={{ color: C.mist, fontSize: 12, marginTop: 16 }}>
        Estimates only — MicroBiz AI is an educational tool, not financial, legal, or investment advice.
        <br /><Copyright />
      </p>
    </div>
  );
}
