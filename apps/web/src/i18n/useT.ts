import { useCallback, useContext } from "react";
import { I18nContext } from "./context";
import { translate, type TKey, type TParams } from "./index";
import { formatDate, formatNumber } from "./format";

/** Hook form: `const { t, locale, fmtDate, fmtNumber } = useT();` Same lookup rules as the global `t`. */
export function useT() {
  const locale = useContext(I18nContext);
  const t = useCallback((key: TKey, params?: TParams) => translate(locale, key, params), [locale]);
  return {
    t,
    locale,
    fmtDate: (d: Date | string | number, opts?: Intl.DateTimeFormatOptions) => formatDate(locale, d, opts),
    fmtNumber: (n: number, opts?: Intl.NumberFormatOptions) => formatNumber(locale, n, opts),
  };
}
