import { t } from "@/i18n";
import { currentImpersonation, exitImpersonation } from "@/lib/impersonation";

/**
 * A-01: shown on every screen while booqi ops is viewing a salon as its owner. Mounted next to
 * the app in main.tsx (outside the router), fixed to the top so no page can hide it.
 */
export function ImpersonationBanner() {
  const session = currentImpersonation();
  if (!session || !localStorage.getItem("accessToken")) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-[1000] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-black"
    >
      <span>{t("impersonation.banner", { email: session.email })}</span>
      <button
        type="button"
        onClick={exitImpersonation}
        className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white hover:bg-black/80"
      >
        {t("impersonation.exit")}
      </button>
    </div>
  );
}

/** The landing page's answer when the one-time link is spent or expired. */
export function ImpersonationError() {
  return (
    <div style={{ padding: "3rem 1.5rem", fontFamily: "sans-serif", maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>{t("impersonation.invalidTitle")}</h1>
      <p style={{ marginTop: 12, color: "#555" }}>{t("impersonation.invalidBody")}</p>
    </div>
  );
}
