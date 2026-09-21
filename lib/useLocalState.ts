"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

/**
 * State that survives a page reload, kept in this browser only.
 *
 * Built on useSyncExternalStore, so the server render and the first client
 * render both use `initial` (no hydration mismatch), the stored value is read
 * without setting state inside an effect, and every component — and every
 * open tab — using the same key sees the same value.
 *
 * `hydrated` tells the caller when the stored value has been read — anything
 * that redirects or shows an empty state on "nothing saved" should wait for it.
 */

/** Same-tab listeners; the `storage` event only fires in *other* tabs. */
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

/**
 * Values that couldn't be written to localStorage (blocked or full). The page
 * keeps working from memory for this visit; they just won't survive a reload.
 */
const memory = new Map<string, string>();

function readRaw(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const subscribeNothing = () => () => {};

export function useLocalState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void, boolean] {
  // The first `initial` is kept, so a fresh default object each render
  // doesn't make the value look new.
  const [fallback] = useState(initial);

  const subscribe = useCallback((onChange: () => void) => {
    const set = listeners.get(key) ?? new Set();
    set.add(onChange);
    listeners.set(key, set);
    const onStorage = (e: StorageEvent) => { if (e.key === key) onChange(); };
    window.addEventListener("storage", onStorage);
    return () => {
      set.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [key]);

  const raw = useSyncExternalStore(subscribe, () => readRaw(key), () => null);
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);

  const value = useMemo<T>(() => {
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback; // corrupt entry: fall back to the default
    }
  }, [raw, fallback]);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    let prev = fallback;
    const current = readRaw(key);
    if (current != null) {
      try { prev = JSON.parse(current) as T; } catch { /* keep the default */ }
    }
    const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
    const json = JSON.stringify(resolved);
    try {
      localStorage.setItem(key, json);
      memory.delete(key);
    } catch {
      memory.set(key, json);
    }
    notify(key);
  }, [key, fallback]);

  return [value, set, hydrated];
}

/** Removes a stored value (used by "delete my data"). */
export function clearLocalState(key: string) {
  memory.delete(key);
  try { localStorage.removeItem(key); } catch { /* nothing to clear */ }
  notify(key);
}
