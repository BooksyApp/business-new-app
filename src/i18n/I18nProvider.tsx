import { Fragment, useEffect, type ReactNode } from "react";
import { useHubLocale } from "@/lib/hubLocale";
import { I18nContext } from "./context";

/**
 * Publishes the active locale, keeps <html lang> in step with it, and remounts the subtree
 * when it changes so every `t(...)` call (global or hook) re-evaluates. Switching language
 * is rare, so losing transient component state on a switch is accepted.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale] = useHubLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <I18nContext.Provider value={locale}>
      <Fragment key={locale}>{children}</Fragment>
    </I18nContext.Provider>
  );
}
