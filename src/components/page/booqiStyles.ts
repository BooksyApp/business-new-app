/** Shared classes for the booqi page template (see ./booqi.tsx). */

/** Page body padding, shared. */
export const pageBody = "space-y-6 px-4 py-5 md:px-8 md:py-6";

export const primaryBtn =
  "h-11 gap-1.5 rounded-full border-0 bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgb(var(--reg-brand-strong)/0.7)] hover:brightness-110 disabled:opacity-60";

export const secondaryBtn =
  "h-11 gap-1.5 rounded-full border border-[rgb(var(--reg-line))] bg-white px-5 text-sm font-semibold text-[rgb(var(--reg-ink))] hover:bg-[rgb(var(--reg-canvas))]";

/** Sheet footer buttons (52px, as on the calendar sheets). */
export const sheetSecondary =
  "h-[52px] min-w-0 flex-1 whitespace-normal px-4 leading-tight rounded-full border border-[rgb(var(--reg-line))] bg-white text-base font-semibold text-[rgb(var(--reg-ink))] hover:bg-[rgb(var(--reg-canvas))]";

export const sheetPrimary =
  "h-[52px] min-w-0 flex-[1.6] whitespace-normal px-4 leading-tight rounded-full text-base font-semibold text-white bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] shadow-[0_10px_24px_-8px_rgb(var(--reg-brand-strong)/0.6)] hover:brightness-110 disabled:opacity-60";
