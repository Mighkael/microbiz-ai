"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Profile } from "@/lib/data";
import { useAuth } from "./AuthProvider";
import { createClient } from "@/lib/supabase/client";
import {
  dbToProfile, profileToBusinessRow, profileToFinancialsRow, firstOfCurrentMonth,
  type BusinessRow, type MonthlyFinancialRow,
} from "@/lib/profileMapping";

const STORAGE_KEY = "microbiz.profile";

type Ctx = {
  profile: Profile | null;
  hydrated: boolean;
  saving: boolean;
  saveProfile: (p: Profile) => Promise<void>;
  clearProfile: () => void;
};

const ProfileContext = createContext<Ctx | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load: from Supabase when logged in, from localStorage otherwise.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setHydrated(false);

    (async () => {
      if (user) {
        try {
          const supabase = createClient();
          const { data: business } = await supabase
            .from("businesses")
            .select("*")
            .eq("owner_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle<BusinessRow & { id: string }>();

          if (business) {
            const { data: financial } = await supabase
              .from("monthly_financials")
              .select("*")
              .eq("business_id", business.id)
              .order("period", { ascending: false })
              .limit(1)
              .maybeSingle<MonthlyFinancialRow>();

            if (!cancelled) setProfile(dbToProfile(business, financial ?? null));
          } else if (!cancelled) {
            setProfile(null);
          }
        } catch {
          if (!cancelled) setProfile(null);
        }
      } else {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!cancelled) setProfile(raw ? JSON.parse(raw) : null);
        } catch {
          if (!cancelled) setProfile(null);
        }
      }
      if (!cancelled) setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const saveProfile = useCallback(async (p: Profile) => {
    if (user) {
      setSaving(true);
      try {
        const supabase = createClient();

        const { data: existing } = await supabase
          .from("businesses").select("id").eq("owner_id", user.id).limit(1).maybeSingle<{ id: string }>();

        const businessRow = profileToBusinessRow(p, user.id);
        let businessId: string;

        if (existing) {
          const { data, error } = await supabase
            .from("businesses")
            .update({ ...businessRow, updated_at: new Date().toISOString() })
            .eq("id", existing.id)
            .select("id")
            .single<{ id: string }>();
          if (error) throw error;
          businessId = data.id;
        } else {
          const { data, error } = await supabase
            .from("businesses")
            .insert(businessRow)
            .select("id")
            .single<{ id: string }>();
          if (error) throw error;
          businessId = data.id;
        }

        const financialsRow = profileToFinancialsRow(p, businessId, firstOfCurrentMonth());
        const { error: fErr } = await supabase
          .from("monthly_financials")
          .upsert(financialsRow, { onConflict: "business_id,period" });
        if (fErr) throw fErr;

        setProfile(p);
      } finally {
        setSaving(false);
      }
    } else {
      setProfile(p);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
      } catch {
        // ignore storage failures (e.g. private browsing)
      }
    }
  }, [user]);

  const clearProfile = useCallback(() => {
    setProfile(null);
    if (!user) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore storage failures
      }
    }
  }, [user]);

  return (
    <ProfileContext.Provider value={{ profile, hydrated, saving, saveProfile, clearProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfileContext() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfileContext must be used within a ProfileProvider");
  return ctx;
}
