/**
 * date-fns `format` with the panel's locale applied. Import `format` from here instead of
 * "date-fns" so month and weekday names follow the language (date-fns ships its own az / ru
 * data, so this is independent of the browser's Intl). English keeps date-fns' default.
 */
import { format as dfFormat } from "date-fns";
import { az, ru } from "date-fns/locale";
import { getHubLocale } from "@/lib/hubLocale";

type Opts = NonNullable<Parameters<typeof dfFormat>[2]>;

export function format(date: Parameters<typeof dfFormat>[0], pattern: string, options?: Opts): string {
  const loc = getHubLocale();
  return dfFormat(date, pattern, { locale: loc === "az" ? az : loc === "ru" ? ru : undefined, ...options });
}

const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Translate an English month name sent by the API ("March") into the active language; unknown text is returned as is. */
export function monthName(name: string | undefined | null): string {
  const i = name ? EN_MONTHS.indexOf(name) : -1;
  return i < 0 ? name ?? "" : format(new Date(2000, i, 1), "LLLL");
}
