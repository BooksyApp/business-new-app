import type { Id } from "@/types/id";
/**
 * business.getbooqi.tech/<slug>_<publicId>/calendar — the panel's salon address.
 *
 * The numeric business id never goes into a URL: it is guessable and says how many salons
 * there are. The address carries the salon's public UUID (businesses.public_id) with its
 * name in front for people; only the UUID counts, and the backend answers it only for the
 * salon's owner and team (GET /api/businesses/panel/{key}, 404 for anyone else).
 *
 * The API itself still takes the numeric id, so this keeps the id ↔ key pairs the server
 * has told us about. They are also stored for the HTML boot script (vite.config.ts), which
 * needs the id to start the first screen's requests before the app has loaded.
 */

export const SALON_KEYS_STORAGE = "booqi.hub.salonKeys";

const UUID_AT_END = /(?:^|_)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** publicId (lowercase) → [business id, canonical key]. UUID phase 2: the id IS the public id. */
type Store = Record<string, [Id, string]>;

let cache: Store | null = null;

function load(): Store {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(SALON_KEYS_STORAGE) || "{}") as Record<string, [unknown, string]>;
    // UUID phase 2: pairs saved before the switch hold numeric ids — drop them, the next
    // owner-list / resolve call stores them again with the public id.
    cache = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => Array.isArray(v) && typeof v[0] === "string"),
    ) as Store;
  } catch {
    cache = {};
  }
  return cache ?? (cache = {});
}

/** The public UUID inside a panel key ("name_uuid" or a bare uuid); null when it has none. */
export function publicIdOf(key: string | undefined | null): string | null {
  const m = key ? UUID_AT_END.exec(key.trim()) : null;
  return m ? m[1].toLowerCase() : null;
}

/** Does this path segment look like a salon key (and not a page such as /login)? */
export function isSalonKey(segment: string | undefined | null): boolean {
  return publicIdOf(segment) !== null;
}

/** Remember what the server said about these salons (owner list, resolve, create). */
export function rememberSalons(list: Array<{ id?: Id; publicId?: string; panelKey?: string } | null | undefined>): void {
  const store = load();
  let changed = false;
  for (const b of list) {
    if (!b?.id || !b.publicId || !b.panelKey) continue;
    const k = b.publicId.toLowerCase();
    const id = String(b.id);
    const prev = store[k];
    if (!prev || prev[0] !== id || prev[1] !== b.panelKey) {
      store[k] = [id, b.panelKey];
      changed = true;
    }
  }
  if (!changed) return;
  try {
    localStorage.setItem(SALON_KEYS_STORAGE, JSON.stringify(store));
  } catch {
    /* storage full / blocked: the in-memory copy still works for this tab */
  }
}

/** The business id behind a panel key: since UUID phase 2 it is the key's public id itself. */
export function idForKey(key: string | undefined | null): Id | undefined {
  const p = publicIdOf(key);
  return p ? (load()[p]?.[0] ?? p) : undefined;
}

/** The canonical panel key of a salon id we know; undefined otherwise. */
export function keyForId(id: Id | null | undefined): string | undefined {
  if (!id) return undefined;
  const want = String(id).toLowerCase();
  for (const [bid, key] of Object.values(load())) if (String(bid).toLowerCase() === want) return key;
  return undefined;
}

/**
 * Address of a panel page of a salon: `/<key>/<page>`. A salon we have no key for (should
 * not happen inside the panel) goes to the salon picker, which loads them.
 */
export function salonPath(id: Id | null | undefined, page = "calendar"): string {
  const key = keyForId(id);
  if (!key) return "/";
  const rest = page.replace(/^\/+/, "");
  return rest ? `/${key}/${rest}` : `/${key}`;
}

/** Sign-out: another account on this browser must not inherit the pairs. */
export function forgetSalons(): void {
  cache = {};
  try {
    localStorage.removeItem(SALON_KEYS_STORAGE);
  } catch {
    /* ignore */
  }
}
