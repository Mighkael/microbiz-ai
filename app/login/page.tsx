"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { C, FONT_HEAD } from "@/lib/theme";
import { Card, Btn, Field, inputStyle } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 420, margin: "64px auto", padding: "0 24px" }}>
      <h1 style={{ fontFamily: FONT_HEAD, fontSize: 28, color: C.ink, margin: "0 0 6px" }}>Log in</h1>
      <p style={{ color: C.mist, fontSize: 14, marginBottom: 24 }}>Welcome back to MicroBiz AI.</p>
      <Card>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <Field label="Email">
            <input style={inputStyle} type="email" required autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <input style={inputStyle} type="password" required autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          {error && <div style={{ color: C.alert, fontSize: 13 }}>{error}</div>}
          <Btn tone="green" disabled={busy} style={{ width: "100%" }}>{busy ? "Logging in…" : "Log in"}</Btn>
        </form>
      </Card>
      <p style={{ color: C.mist, fontSize: 13, marginTop: 16, textAlign: "center" }}>
        Don&apos;t have an account? <Link href="/signup" style={{ color: C.ledger }}>Sign up</Link>
      </p>
    </div>
  );
}
