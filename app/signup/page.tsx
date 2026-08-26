"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { C, FONT_HEAD } from "@/lib/theme";
import { Card, Btn, Field, inputStyle } from "@/components/ui";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div style={{ maxWidth: 420, margin: "64px auto", padding: "0 24px", textAlign: "center" }}>
        <h1 style={{ fontFamily: FONT_HEAD, fontSize: 24, color: C.ink, marginBottom: 10 }}>Check your email</h1>
        <p style={{ color: C.mist, fontSize: 14 }}>
          We sent a confirmation link to <b style={{ color: C.ink }}>{email}</b>. Click it, then come back and log in.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: "64px auto", padding: "0 24px" }}>
      <h1 style={{ fontFamily: FONT_HEAD, fontSize: 28, color: C.ink, margin: "0 0 6px" }}>Create an account</h1>
      <p style={{ color: C.mist, fontSize: 14, marginBottom: 24 }}>Save your business profile and pick up where you left off.</p>
      <Card>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <Field label="Email">
            <input style={inputStyle} type="email" required autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <input style={inputStyle} type="password" required autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </Field>
          <Field label="Confirm password">
            <input style={inputStyle} type="password" required autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
          </Field>
          {error && <div style={{ color: C.alert, fontSize: 13 }}>{error}</div>}
          <Btn tone="green" disabled={busy} style={{ width: "100%" }}>{busy ? "Creating account…" : "Create account"}</Btn>
        </form>
      </Card>
      <p style={{ color: C.mist, fontSize: 13, marginTop: 16, textAlign: "center" }}>
        Already have an account? <Link href="/login" style={{ color: C.ledger }}>Log in</Link>
      </p>
    </div>
  );
}
