// Browser error tracking (Better Stack Errors via the Sentry SDK). Inert unless VITE_SENTRY_DSN
// was set at build time; the SDK is then loaded as a separate chunk, so builds without a DSN
// (local dev, production today) ship no Sentry code. Errors only, no tracing, no default PII;
// e-mails, phones and tokens are masked and query strings dropped before an event leaves.
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /\+\d[\d -]{7,16}\d|\b(?:994|0)\d{9}\b/g;
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const BEARER = /bearer\s+[A-Za-z0-9._-]+/gi;

export function scrub(s?: string): string | undefined {
  if (!s) return s;
  return s.replace(EMAIL, "[email]").replace(JWT, "[jwt]").replace(BEARER, "Bearer [token]").replace(PHONE, "[phone]");
}

const noQuery = (u?: string) => (u ? u.split("?")[0] : u);

export function scrubEvent<T>(e: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event = e as any;
  if (event.message) event.message = scrub(event.message);
  for (const ex of event.exception?.values ?? []) ex.value = scrub(ex.value);
  if (event.request) {
    event.request.url = noQuery(event.request.url);
    delete event.request.query_string;
    delete event.request.data;
    delete event.request.cookies;
  }
  delete event.user;
  for (const b of event.breadcrumbs ?? []) {
    b.message = scrub(b.message);
    if (b.data) for (const k of ["url", "from", "to"]) if (typeof b.data[k] === "string") b.data[k] = noQuery(b.data[k]);
  }
  return e;
}

let sdk: Promise<typeof import("@sentry/react")> | null = null;

/*
 * The SDK chunk is ~160 KB gzipped. Requested at startup it shared a phone's bandwidth with
 * the first screen's own chunks and data and pushed the first paint back by ~1 s on 4G, so
 * it now loads once the page has finished loading and the browser is idle. An error caught
 * by an error boundary before then loads it at once and is still reported (reportError
 * waits for it); uncaught errors in those first seconds are not — a deliberate trade.
 */
export function initSentry() {
  if (!dsn || sdk || typeof window === "undefined") return;
  const start = () => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
      .requestIdleCallback;
    if (idle) idle(() => void load(), { timeout: 5000 });
    else setTimeout(() => void load(), 1500);
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}

function load(): Promise<typeof import("@sentry/react")> | null {
  if (!dsn) return null;
  if (sdk) return sdk;
  sdk = import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string) || "development",
      release: (import.meta.env.VITE_SENTRY_RELEASE as string) || undefined,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      beforeSend: (event) => scrubEvent(event),
    });
    return Sentry;
  });
  return sdk;
}

/** Report an error caught by a React error boundary (no-op when Sentry is off). */
export function reportError(error: unknown, componentStack?: string | null) {
  void load()?.then((Sentry) =>
    Sentry.captureException(error, { contexts: { react: { componentStack: componentStack ?? "" } } }),
  );
}
