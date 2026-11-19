import { lazy, type ComponentType } from "react";

const KEY = "hub-chunk-reload";

/** Reloads the page once per minute (sessionStorage-guarded so a real outage cannot loop). */
export function reloadOnceForNewBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * React.lazy for route chunks. After a deploy an open tab asks for hashed files that no longer
 * exist ("Failed to fetch dynamically imported module", or a module without a default export);
 * reload once to pick up the new build, otherwise surface the error as before.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy<T>(async () => {
    try {
      const mod = await factory();
      if (!mod || !mod.default) throw new TypeError("Cannot read properties of undefined (reading 'default')");
      return mod;
    } catch (err) {
      if (reloadOnceForNewBuild()) return new Promise<{ default: T }>(() => {});
      throw err;
    }
  });
}
