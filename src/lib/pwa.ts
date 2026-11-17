/**
 * FG-W2-130 — the panel as an installable app: the service worker (public/sw.js) and the
 * browser's "install" offer (Chrome / Edge / Android; Safari has no such event — there it is
 * Share → Add to Home Screen, which the manifest and the apple-* tags in index.html cover).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Production only: in dev a worker would serve stale modules against Vite's HMR. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const register = () =>
    navigator.serviceWorker
      // updateViaCache "none": sw.js itself is always revalidated, so a deploy is seen at once.
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        // A worker from the previous visit's deploy is waiting: this load already came from the
        // network (navigations are network-first), so it can take over now, for the next load.
        if (reg.waiting && navigator.serviceWorker.controller) reg.waiting.postMessage("skipWaiting");
      })
      .catch(() => undefined);
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

/** Listen as early as possible: the event can fire before the layout is mounted. */
export function captureInstallPrompt() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the mini-infobar
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export const canInstall = () => deferred !== null;

export function subscribeInstall(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Shows the browser's install dialog; the event can be used once, whatever the answer. */
export async function promptInstall() {
  const e = deferred;
  if (!e) return;
  deferred = null;
  notify();
  try {
    await e.prompt();
    await e.userChoice;
  } catch {
    /* the browser refused (e.g. not from a user gesture) */
  }
}
