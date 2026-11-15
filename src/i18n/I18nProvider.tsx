import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useHubLocale } from "@/lib/hubLocale";
import { I18nContext } from "./context";
import { isHubLocaleLoaded, loadHubLocale } from "./index";

/**
 * Publishes the active locale, keeps <html lang> in step with it, and remounts the subtree
 * when it changes so every `t(...)` call (global or hook) re-evaluates. Switching language
 * is rare, so losing transient component state on a switch is accepted. A lazily bundled
 * locale (ru) is fetched on the switch; the tree remounts again once it has arrived.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale] = useHubLocale();
  const [loadedTick, setLoadedTick] = useState(0);
  useEffect(() => {
    document.documentElement.lang = locale;
    if (isHubLocaleLoaded(locale)) return;
    let alive = true;
    loadHubLocale(locale).then(() => {
      if (alive) setLoadedTick((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [locale]);
  return (
    <I18nContext.Provider value={locale}>
      <Fragment key={`${locale}:${loadedTick}`}>{children}</Fragment>
    </I18nContext.Provider>
  );
}
