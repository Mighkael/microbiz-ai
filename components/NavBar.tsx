"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { C, FONT_HEAD, NAV_H } from "@/lib/theme";
import UtilityBar from "./UtilityBar";
import { useAuth } from "./AuthProvider";
import { createClient } from "@/lib/supabase/client";

// V2 §2: top-left navigation, centre logo, top-right auth.
// Business and Ask MicroBiz AI are reached from the two hero actions on the
// homepage (§2) rather than duplicated here.
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/data", label: "Data" },
  { href: "/research", label: "Research" },
  { href: "/news", label: "News & Markets" },
];

const linkStyle = (active: boolean): React.CSSProperties => ({
  textDecoration: "none",
  fontFamily: FONT_HEAD,
  fontWeight: 500,
  fontSize: 14,
  color: active ? C.ink : C.mist,
  padding: "8px 10px",
  borderRadius: 8,
  background: active ? C.paper : "transparent",
  whiteSpace: "nowrap",
});

function AuthControls() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) return <div style={{ width: 132 }} />;

  if (!user) {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
        <Link href="/login" style={{ ...linkStyle(false), padding: "8px 12px" }}>Log in</Link>
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
    <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end" }}>
      <span style={{
        fontSize: 12.5, color: C.mist, maxWidth: 150,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{user.email}</span>
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
    <>
    <UtilityBar />
    <header className="mb-header" style={{
      height: NAV_H, borderBottom: `1px solid ${C.line}`, background: "#fff",
      position: "sticky", top: 0, zIndex: 30, boxSizing: "border-box",
    }}>
      <div className="mb-nav" style={{
        maxWidth: 1240, margin: "0 auto", height: "100%", padding: "0 24px",
        display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 16,
      }}>
        <nav style={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} style={linkStyle(pathname === l.href)}>{l.label}</Link>
          ))}
        </nav>

        <Link href="/" style={{ textDecoration: "none", justifySelf: "center" }} aria-label="MicroBiz AI home">
          <Logo size={26} />
        </Link>

        <AuthControls />
      </div>
    </header>
    </>
  );
}
