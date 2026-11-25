import type { Id } from "@/types/id";
import { API_BASE_URL } from "@/config/api";
import { startSession } from "@/utils/session";

/**
 * A-01: "Open as owner" from the booqi ops admin.
 *
 * The admin lives on another origin, so it cannot hand over a session through storage, and a
 * token in a URL would end up in history and logs. It opens `<hub>/impersonate?code=…` with a
 * one-time code (60 s, single use); this trades it for an access-only session (no refresh
 * token, so it ends when the access token does) and marks the tab as "opened by booqi ops".
 *
 * Deliberately outside the router (the router is being rewritten): main.tsx calls
 * {@link handleImpersonationLanding} before the app mounts.
 */
const FLAG = "booqi.impersonation";

export type Impersonation = { by: string; email: string; at: string };

export function currentImpersonation(): Impersonation | null {
  try {
    const raw = localStorage.getItem(FLAG);
    return raw ? (JSON.parse(raw) as Impersonation) : null;
  } catch {
    return null;
  }
}

export function clearImpersonationFlag(): void {
  try {
    localStorage.removeItem(FLAG);
  } catch {
    /* storage blocked: nothing to clear */
  }
}

function isLandingPath(pathname: string): boolean {
  return /\/impersonate\/?$/.test(pathname);
}

/** The app's own root, whatever base it is served from. */
function appRoot(): string {
  return import.meta.env.BASE_URL || "/";
}

/**
 * On `/impersonate?code=…`: exchange the code, start the session, go to the panel.
 * Returns "error" when the code was refused (the caller renders the message), "done" when it
 * navigated away, and "none" on any other page.
 */
export async function handleImpersonationLanding(): Promise<"none" | "done" | "error"> {
  if (!isLandingPath(window.location.pathname)) return "none";
  const code = new URLSearchParams(window.location.search).get("code") ?? "";
  // The code is spent either way; take it out of the address bar and history at once.
  window.history.replaceState(null, "", window.location.pathname);
  if (!code) return "error";
  try {
    const res = await fetch(`${API_BASE_URL}/public/impersonation/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return "error";
    const s = (await res.json()) as {
      accessToken: string;
      userId: Id;
      email: string;
      role: string;
      businessId: Id | null;
      impersonatedBy?: string;
    };
    // Whatever this browser was signed in as is replaced, not mixed with the owner's session.
    for (const k of ["accessToken", "refreshToken", "user", "currentBusinessId", "currentBusiness"]) {
      localStorage.removeItem(k);
    }
    await startSession({
      accessToken: s.accessToken,
      refreshToken: "",
      userId: s.userId,
      fullName: s.email,
      email: s.email,
      role: s.role,
      businessId: s.businessId ?? undefined,
    } as Parameters<typeof startSession>[0]);
    localStorage.setItem(FLAG, JSON.stringify({ by: s.impersonatedBy ?? "booqi ops", email: s.email, at: new Date().toISOString() }));
    window.location.replace(appRoot());
    return "done";
  } catch {
    return "error";
  }
}

/** Leave the owner's session: drop it from this browser and go to sign-in. */
export function exitImpersonation(): void {
  for (const k of ["accessToken", "refreshToken", "user", "currentBusinessId", "currentBusiness"]) {
    localStorage.removeItem(k);
  }
  clearImpersonationFlag();
  window.location.replace(`${appRoot().replace(/\/$/, "")}/login`);
}
