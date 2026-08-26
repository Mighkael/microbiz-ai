import type { Metadata } from "next";
import type { ReactNode } from "react";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { ProfileProvider } from "@/components/ProfileProvider";
import { AuthProvider } from "@/components/AuthProvider";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "MicroBiz AI",
  description: "AI-powered dashboard for small businesses — financials, risk, funding, location and Opportunity Zone insight, and an AI advisor — built on the idea that small-business growth is also a tool against crime.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ProfileProvider>
            <NavBar />
            {children}
          </ProfileProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
