import { API_BASE_URL } from "@/config/api";
import { getAccessToken } from "@/utils/authUtils";
import firstScreen from "./firstScreen.json";

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
// One list for this module and the HTML boot script (vite.config.ts), so they cannot drift.
const TEMPLATES = firstScreen as Record<string, string[]>;
const ALIAS: Record<string, string> = { "": "calendar", contacts: "clients", shopping: "sales" };
const firstScreenUrls = (page: string, b: string, day: string): string[] | undefined =>
  TEMPLATES[ALIAS[page] ?? page]?.map((u) => u.replace(/\{b\}/g, b).replace(/\{day\}/g, day));

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
    // The HTML boot script (vite.config.ts) may have started these already, before this
    // bundle had even downloaded: adopt its in-flight requests when they carry this token.
    const boot = (window as Window & { __booqiEarly?: Record<string, { token: string; at: number; answer: Promise<string | null> }> })
      .__booqiEarly;
    const fromBoot = (url: string) => {
      const e = boot?.[url];
      return e && e.token === token ? e : undefined;
    };
    for (const [url, e] of Object.entries(boot ?? {})) if (e.token === token) early.set(url, e);
    const parsed = <T,>(e: { answer: Promise<string | null> }): Promise<T | null> =>
      e.answer.then((text) => (text ? (JSON.parse(text) as T) : null)).catch(() => null);
    const bootValidation = fromBoot("/auth/validate");
    early.delete("/auth/validate");
    validation = {
      token,
      answer: bootValidation ? parsed<Validation>(bootValidation) : get<Validation>("/auth/validate", token, { method: "POST" }),
    };
    const user = JSON.parse(localStorage.getItem("user") ?? "null") as { id?: number } | null;
    if (user?.id) {
      const ownedUrl = `/businesses/owner/${user.id}`;
      const bootOwned = fromBoot(ownedUrl);
      early.delete(ownedUrl);
      owned = { token, userId: user.id, answer: bootOwned ? parsed<Owned>(bootOwned) : get<Owned>(ownedUrl, token) };
    }
    const urls = businessId ? firstScreenUrls(page ?? "", businessId, localDay()) : undefined;
    for (const url of urls ?? []) {
      if (early.has(url)) continue; // already started by the HTML boot script
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
