import { API_BASE_URL } from "@/config/api";
import { getAccessToken } from "@/utils/authUtils";

/**
 * Opening the panel on a business page ran two checks one after the other: the token
 * (ProtectedRoute), and only once that answered, which businesses this user owns
 * (BusinessOwnerRoute). On a phone that is two full round trips before the page may even
 * start. Both are started together at startup instead; each guard takes its answer once
 * and still decides exactly as before. Nothing is cached beyond that first use.
 *
 * Only for a token that has not expired by its own clock: an expired one goes through the
 * guards' refresh path untouched, so two refreshes can never race. Any failure here simply
 * means the guard asks again itself.
 */
type Validation = { valid: boolean; message: string; user?: unknown };
type Owned = { id: number }[];

/** Unexpired by its own clock. JWTs are base64url; plain atob() rejects "-" and "_". */
function unexpired(token: string): boolean {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "="))) as { exp?: number };
    return typeof payload.exp === "number" && Date.now() < payload.exp * 1000 - 30_000;
  } catch {
    return false;
  }
}

let validation: { token: string; answer: Promise<Validation | null> } | null = null;
let owned: { token: string; userId: number; answer: Promise<Owned | null> } | null = null;

const get = <T,>(path: string, token: string, init?: RequestInit): Promise<T | null> =>
  fetch(`${API_BASE_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } })
    .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
    .catch(() => null);

/*
 * The first screen's own GETs, started together with the checks above. Without this the
 * page could only ask for its data once its chunk had downloaded and rendered — on a phone
 * a second after the checks were done. apiClient.get takes a matching answer once, within
 * EARLY_TTL_MS; anything else (another URL, a 403, an error, too late) is asked normally.
 * URLs mirror exactly what the pages request (checked against a network waterfall).
 */
const EARLY_TTL_MS = 15_000;
const early = new Map<string, { token: string; at: number; answer: Promise<string | null> }>();
const FIRST_SCREEN: Record<string, (b: string, day: string) => string[]> = {
  calendar: (b, day) => [
    `/businesses/${b}`,
    `/businesses/${b}/readiness`,
    `/bookings/business/${b}?startDate=${day}&endDate=${day}`,
    `/staff/business/${b}`,
    `/services/business/${b}`,
    `/time-off/business/${b}`,
    `/business-hours/business/${b}`,
    `/services/business/${b}/discounts`,
    `/waitlist/business/${b}`,
    `/clients/business/${b}`,
  ],
  sales: (b, day) => [
    `/businesses/${b}`,
    `/services/business/${b}`,
    `/addons/business/${b}`,
    `/staff/business/${b}`,
    `/services/business/${b}/discounts`,
    `/bookings/business/${b}/clients?limit=1000&offset=0`,
    `/businesses/${b}/memberships?activeOnly=true`,
    `/quick-sale/business/${b}`,
    `/bookings/business/${b}?startDate=${day}&endDate=${day}`,
  ],
  clients: (b) => [
    `/businesses/${b}`,
    `/services/business/${b}`,
    `/staff/business/${b}`,
    `/bookings/business/${b}/clients?limit=1000&offset=0`,
    `/invitations/business/${b}`,
  ],
};
FIRST_SCREEN[""] = FIRST_SCREEN.calendar;
FIRST_SCREEN.contacts = FIRST_SCREEN.clients;
FIRST_SCREEN.shopping = FIRST_SCREEN.sales;

function localDay(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** An early answer for this GET (raw body text), once; null when there is none to use. */
export function takeEarly(endpoint: string, token: string | null): Promise<string | null> | null {
  const e = early.get(endpoint);
  if (!e) return null;
  early.delete(endpoint);
  if (e.token !== token || Date.now() - e.at > EARLY_TTL_MS) return null;
  return e.answer;
}

/** `businessId` / `page`: the first two path segments under /manage, when on a business page. */
export function prefetchAuthChecks(businessId?: string, page?: string): void {
  try {
    const token = getAccessToken();
    if (!token || !unexpired(token)) return;
    validation = { token, answer: get<Validation>("/auth/validate", token, { method: "POST" }) };
    const user = JSON.parse(localStorage.getItem("user") ?? "null") as { id?: number } | null;
    if (user?.id) owned = { token, userId: user.id, answer: get<Owned>(`/businesses/owner/${user.id}`, token) };
    const urls = businessId ? FIRST_SCREEN[page ?? ""]?.(businessId, localDay()) : undefined;
    for (const url of urls ?? []) {
      const answer = fetch(`${API_BASE_URL}${url}`, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok && r.status !== 204 ? r.text() : null))
        .catch(() => null);
      early.set(url, { token, at: Date.now(), answer });
    }
  } catch {
    /* no storage / bad JSON: the guards do their own checks */
  }
}

/** The early token check for this token, once; null when there is none to use. */
export async function takeValidation(token: string): Promise<Validation | null> {
  const v = validation;
  validation = null;
  if (!v || v.token !== token) return null;
  const answer = await v.answer;
  // Only a clear yes is reused; a "no" or an error is re-asked through the normal path.
  return answer && answer.valid ? answer : null;
}

/** The early ownership list for this user and token, once; null when there is none. */
export async function takeOwnedBusinesses(userId: number, token: string): Promise<Owned | null> {
  const o = owned;
  owned = null;
  if (!o || o.userId !== userId || o.token !== token) return null;
  const answer = await o.answer;
  return Array.isArray(answer) ? answer : null;
}
