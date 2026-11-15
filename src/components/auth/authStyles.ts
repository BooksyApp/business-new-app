import { publicSiteUrl } from "@/config/api";

/** Shared classes for the hub's sign-in and sign-up, to booqi-web's AuthShell/FormField spec. */

/** The web's own site (booqi-web). VITE_WEB_URL wins; otherwise the hub's existing setting. */
export const webUrl = (import.meta.env.VITE_WEB_URL as string | undefined) || publicSiteUrl() || "/";

/* ── Shared control classes: booqi-web's FormField.inputClass / AuthShell.authButton ── */

/** Text inputs and select triggers: 48px, 14px radius, sand line, violet focus ring. */
export const authInput =
  "h-12 min-h-[48px] w-full rounded-[14px] border border-[rgb(var(--reg-line))] bg-white px-4 text-base " +
  "text-[rgb(var(--reg-ink))] placeholder:text-[rgb(var(--reg-muted))] transition-colors " +
  "focus:outline-none focus-visible:outline-none focus:border-[rgb(var(--reg-brand))] focus:ring-4 " +
  "focus:ring-[rgb(var(--reg-brand)/0.1)] focus-visible:ring-4 focus-visible:ring-[rgb(var(--reg-brand)/0.1)] " +
  "focus-visible:ring-offset-0 focus-visible:border-[rgb(var(--reg-brand))]";

/** Field labels: semibold ink, 6px above the field. */
export const authLabel = "mb-1.5 block text-sm font-semibold text-[rgb(var(--reg-ink))]";

/** Inline text links: semibold brand, underline on hover. */
export const authLink =
  "font-semibold text-[rgb(var(--reg-brand-strong))] underline-offset-4 hover:underline " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand))] rounded-sm";

/** Page title, as on booqi-web /signin. */
export const authTitle =
  "text-[32px] md:text-[36px] font-extrabold leading-[1.05] tracking-[-0.04em] text-[rgb(var(--reg-ink))] [text-wrap:balance]";
export const authSubtitle = "mt-2 mb-7 text-base leading-relaxed text-[rgb(var(--reg-muted))]";

/** The one primary action: 52px, full width, brand gradient, AA white text. */
export const brandCta =
  "inline-flex min-h-[52px] h-[52px] items-center justify-center gap-2 rounded-full px-7 text-base font-semibold text-white " +
  "shadow-[0_10px_24px_-8px_rgb(var(--reg-brand-strong)/0.6)] " +
  "bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] hover:brightness-110 " +
  "active:scale-[0.99] transition disabled:opacity-60 disabled:hover:brightness-100 disabled:cursor-not-allowed";

/** The quiet secondary action (Back): white pill on the sand line. */
export const authGhost =
  "inline-flex min-h-[52px] h-[52px] items-center justify-center gap-2 rounded-full border border-[rgb(var(--reg-line))] " +
  "bg-white px-5 text-base font-semibold text-[rgb(var(--reg-ink))] transition hover:bg-[rgb(var(--reg-canvas))] " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgb(var(--reg-brand)/0.15)]";

/** A tappable answer card (one choice of a question screen). */
export const choiceCard = (selected: boolean) =>
  "flex w-full items-center gap-3 rounded-2xl border bg-white px-4 py-3.5 text-left text-[15px] font-semibold transition " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgb(var(--reg-brand)/0.15)] " +
  (selected
    ? "border-[rgb(var(--reg-brand))] bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-ink))] shadow-[0_0_0_1px_rgb(var(--reg-brand))]"
    : "border-[rgb(var(--reg-line))] text-[rgb(var(--reg-ink))] hover:border-[rgb(var(--reg-brand)/0.5)]");
