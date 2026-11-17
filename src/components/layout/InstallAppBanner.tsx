import { useState, useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";
import { t } from "@/i18n";
import { canInstall, promptInstall, subscribeInstall } from "@/lib/pwa";

const DISMISS_KEY = "booqi.hub.installDismissed";

/**
 * FG-W2-130: a slim "Install app" bar on a phone, only when the browser offers installation
 * (beforeinstallprompt — so never once installed, and never on iOS Safari). "Not now" is
 * remembered per browser.
 */
export function InstallAppBanner() {
  const available = useSyncExternalStore(subscribeInstall, canInstall, () => false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (!available || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* per-browser convenience only */
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-[rgb(var(--reg-line)/0.8)] bg-[rgb(var(--reg-brand)/0.08)] px-4 py-2 text-[rgb(var(--reg-ink))] md:hidden">
      <p className="min-w-0 flex-1 text-[13px] leading-snug">{t("layout.installAppHint")}</p>
      <button
        type="button"
        onClick={() => void promptInstall()}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[rgb(var(--reg-brand))] px-3 text-[13px] font-semibold text-white"
      >
        <Download size={15} aria-hidden />
        {t("layout.installApp")}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("layout.installAppLater")}
        title={t("layout.installAppLater")}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[rgb(var(--reg-muted))]"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
