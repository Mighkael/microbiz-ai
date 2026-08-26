"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { C, FONT_HEAD, NAV_H } from "@/lib/theme";
import { useAuth } from "./AuthProvider";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/assessment", label: "Assessment" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/ask", label: "Ask MicroBiz AI" },
  { href: "/news", label: "News & Markets" },
];

function AuthControls() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) return null;

  if (!user) {
    return (
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <Link href="/login" style={{
          textDecoration: "none", fontFamily: FONT_HEAD, fontWeight: 500, fontSize: 14,
          color: C.mist, padding: "8px 12px", borderRadius: 8, whiteSpace: "nowrap",
        }}>Log in</Link>
        <Link href="/signup" style={{
          textDecoration: "none", fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 14,
          color: "#fff", background: C.ledger, padding: "8px 14px", borderRadius: 8, whiteSpace: "nowrap",
        }}>Sign up</Link>
      </div>
    );
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <span style={{ fontSize: 12.5, color: C.mist, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {user.email}
      </span>
      <button onClick={handleLogout} style={{
        fontFamily: FONT_HEAD, fontWeight: 500, fontSize: 14, color: C.ink, background: "transparent",
        border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer", whiteSpace: "nowrap",
      }}>Log out</button>
    </div>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  return (
    <header style={{
      height: NAV_H, borderBottom: `1px solid ${C.line}`, background: "#fff",
      position: "sticky", top: 0, zIndex: 30, boxSizing: "border-box",
    }}>
      <div style={{
        maxWidth: 1160, margin: "0 auto", height: "100%", padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
      }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <Logo size={26} />
        </Link>
        <nav style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link key={l.href} href={l.href} style={{
                textDecoration: "none", fontFamily: FONT_HEAD, fontWeight: 500, fontSize: 14,
                color: active ? C.ink : C.mist, padding: "8px 12px", borderRadius: 8,
                background: active ? C.paper : "transparent", whiteSpace: "nowrap",
              }}>{l.label}</Link>
            );
          })}
          <div style={{ width: 1, height: 20, background: C.line, margin: "0 4px" }} />
          <AuthControls />
        </nav>
      </div>
    </header>
  );
}
