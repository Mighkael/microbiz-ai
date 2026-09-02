/**
 * Every figure the platform shows must be able to say where it came from and
 * whether it is real (V2 spec §18). Wrapping values in `DataPoint` makes that
 * structural rather than something the UI has to remember to do — and keeps
 * the AI layer from ever presenting an estimate as an observation.
 */
export type DataStatus =
  /** Published by the source for exactly this geography. */
  | "observed"
  /** The source withholds it here — usually to protect confidentiality. */
  | "suppressed"
  /** Derived by us from other figures. */
  | "calculated"
  /** The source has no coverage for this geography or period. */
  | "unavailable";

export type DataPoint<T = number> = {
  value: T | null;
  status: DataStatus;
  source: string;
  vintage: string;
  /** Human-readable geography this figure describes, e.g. "ZIP 37040". */
  geography: string;
  /** Why a value is missing, or how a calculated one was derived. */
  note?: string;
};

export function observed<T>(
  value: T, source: string, vintage: string, geography: string,
): DataPoint<T> {
  return { value, status: "observed", source, vintage, geography };
}

export function suppressed<T>(
  source: string, vintage: string, geography: string, note: string,
): DataPoint<T> {
  return { value: null, status: "suppressed", source, vintage, geography, note };
}

export function unavailable<T>(
  source: string, vintage: string, geography: string, note: string,
): DataPoint<T> {
  return { value: null, status: "unavailable", source, vintage, geography, note };
}
