/**
 * Framework-free API client core for the business apps: error type, value guards and one `request` function
 * with offline detection, RFC 7807 `detail` messages and one renew-and-retry on 401.
 * Pattern copied from customer-new-app/packages/shared/src/api/core.ts (no X-PLATFORM here: the old business app never sent it).
 */

/** Public ids are UUID strings. Never Number()/isFinite on an id. */
export type Id = string;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: unknown = null
  ) {
    super(message);
  }
}

export const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
export const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export type ApiOptions = {
  /** Origin without trailing slash and without `/api`. */
  baseUrl: string;
  getToken: () => string | null;
  /** Renews the session once (server rotates the refresh token); returns the new access token or null. */
  renew: () => Promise<string | null>;
  /** Called when a 401 could not be recovered. */
  onUnauthorized: () => void;
};

export type RequestOptions = { method?: string; body?: unknown; auth?: boolean };

export function createApi({ baseUrl, getToken, renew, onUnauthorized }: ApiOptions) {
  const base = baseUrl.replace(/\/+$/, "");

  async function request<T>(path: string, opts: RequestOptions = {}, retriedWith?: string): Promise<T> {
    const auth = opts.auth !== false;
    const token = retriedWith ?? (auth ? getToken() : null);
    let res: Response;
    // A stalled connection must fail (status 0 = offline) instead of leaving the screen loading forever.
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 25000) : null;
    try {
      res = await fetch(`${base}/api${path}`, {
        signal: ctl?.signal,
        method: opts.method ?? "GET",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
    } catch {
      throw new ApiError("offline", 0);
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (res.status === 401 && auth && retriedWith === undefined) {
      let nt: string | null;
      try {
        nt = await renew();
      } catch {
        // Renewal failed because the network did, not because the session is invalid: stay signed in.
        throw new ApiError("offline", 0);
      }
      if (nt) return request<T>(path, opts, nt);
    }
    if (res.status === 401 && auth) {
      onUnauthorized();
      throw new ApiError("unauthorized", 401);
    }
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
      throw new ApiError(str(d.detail) ?? str(d.message) ?? str(d.error) ?? `HTTP ${res.status}`, res.status, data);
    }
    return data as T;
  }

  return { request };
}
