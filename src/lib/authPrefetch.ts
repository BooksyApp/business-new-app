import { API_BASE_URL } from "@/config/api";
import { getAccessToken, isTokenValid } from "@/utils/authUtils";

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

let validation: { token: string; answer: Promise<Validation | null> } | null = null;
let owned: { token: string; userId: number; answer: Promise<Owned | null> } | null = null;

const get = <T,>(path: string, token: string, init?: RequestInit): Promise<T | null> =>
  fetch(`${API_BASE_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } })
    .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
    .catch(() => null);

export function prefetchAuthChecks(): void {
  try {
    const token = getAccessToken();
    const user = JSON.parse(localStorage.getItem("user") ?? "null") as { id?: number } | null;
    if (!token || !isTokenValid(token)) return;
    validation = { token, answer: get<Validation>("/auth/validate", token, { method: "POST" }) };
    if (user?.id) owned = { token, userId: user.id, answer: get<Owned>(`/businesses/owner/${user.id}`, token) };
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
