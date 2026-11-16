import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Check, Globe2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { webUrl } from "./authStyles";
import "./auth-tokens.css";
import { t } from "@/i18n";
import { useSupportHref } from "@/services/platformService";

/**
 * The frame of the panel's sign-in and sign-up — a sibling of booqi-web's /signin, which the
 * founder approved: the hero aura over the sand canvas, logo top-left, the form on a white
 * 32px card on the left, and on a desktop a mesh panel on the right (benefits on sign-in, a
 * live preview of the salon on sign-up). On a phone it is one column and the form stands alone.
 *
 * Colours come from ./auth-tokens.css (the web's own numbers), never hard-coded hex.
 */

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";

/** booqi wordmark — same paths as booqi-web/public/brand/logo-light.svg. */
function BooqiLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 467.19 200" className={className} role="img" aria-label="booqi">
      <defs>
        <linearGradient id="auth-logo-g" gradientUnits="userSpaceOnUse" x1="116" y1="0" x2="308" y2="0">
          <stop offset="0" stopColor="#5B3FD6" />
          <stop offset="1" stopColor="#E83E63" />
        </linearGradient>
      </defs>
      <path
        d="M12 12L12 100M12 100A42 42 0 1 0 96 100A42 42 0 1 0 12 100ZM328 100A42 42 0 1 0 412 100A42 42 0 1 0 328 100ZM412 100L412 188M452 58L452 142"
        fill="none" stroke="#1D1730" strokeWidth="24" strokeLinecap="round"
      />
      <path d="M436.81 21.81A15.19 15.19 0 1 0 467.19 21.81A15.19 15.19 0 1 0 436.81 21.81Z" fill="#1D1730" />
      <path
        d="M181.32 140.45A42 42 0 0 1 128 100A42 42 0 0 1 212 100A42 42 0 0 0 296 100A42 42 0 0 0 242.68 59.55"
        fill="none" stroke="url(#auth-logo-g)" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** The web's mesh, as the aside's backdrop. */
export function MeshPanel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <aside className={cn("relative isolate hidden overflow-hidden rounded-[36px] p-12 lg:flex lg:flex-col", className)}>
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 70% at 12% 10%, rgb(var(--reg-mesh-1)) 0%, transparent 60%)," +
            "radial-gradient(50% 60% at 88% 0%, rgb(var(--reg-mesh-2)) 0%, transparent 60%)," +
            "radial-gradient(55% 65% at 70% 100%, rgb(var(--reg-mesh-3)) 0%, transparent 60%)," +
            "rgb(var(--reg-brand-soft))",
        }}
      />
      {children}
    </aside>
  );
}

/** The small glass chip that opens the aside ("One account" on the web). */
export function GlassChip({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 self-start rounded-full bg-white/60 px-3.5 py-1.5 text-sm font-medium text-[rgb(var(--reg-ink)/0.8)] ring-1 ring-white/70 backdrop-blur">
      <span className="h-2 w-2 rounded-full bg-[rgb(var(--reg-mesh-2))]" aria-hidden />
      {children}
    </p>
  );
}

const benefits = [
  {
    icon: Globe2,
    get title() { return t("auth.bookedOnlineDayAndNight"); },
    get body() { return t("auth.clientsFindYourSalonOn"); },
  },
  {
    icon: CalendarDays,
    get title() { return t("auth.calendarAndTeamInOne"); },
    get body() { return t("auth.everyAppointmentWorkingHourAnd"); },
  },
  {
    icon: Sparkles,
    get title() { return t("auth.startForFree"); },
    get body() { return t("auth.setUpYourProfileAnd"); },
  },
];

/** Sign-in's aside: the same composition as the web's, told for a salon owner. */
export function BenefitsPanel() {
  return (
    <MeshPanel className="min-h-[620px] justify-between">
      <div>
        <GlassChip>{t("auth.booqiForBusiness")}</GlassChip>
        <h2 className="mt-6 max-w-md text-[44px] font-extrabold !leading-[1] tracking-[-0.03em] text-[rgb(var(--reg-ink))] [text-wrap:balance]">
          {t("auth.yourSalonBookedOnline")}
        </h2>
      </div>
      <ul className="mt-10 space-y-3">
        {benefits.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-4 rounded-2xl bg-white/60 p-4 ring-1 ring-white/70 backdrop-blur">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[rgb(var(--reg-brand))] shadow-[0_1px_2px_rgb(var(--reg-ink)/0.04),0_8px_24px_-8px_rgb(var(--reg-ink)/0.1)]">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block font-semibold text-[rgb(var(--reg-ink))]">{title}</span>
              <span className="mt-0.5 block text-sm leading-relaxed text-[rgb(var(--reg-ink)/0.7)]">{body}</span>
            </span>
          </li>
        ))}
      </ul>
      {/* The product itself, as on the web's panel: what lands in the calendar. */}
      <div className="mt-8 flex items-center gap-3 self-end rounded-2xl bg-white/90 p-3.5 pr-5 shadow-[0_2px_6px_rgb(var(--reg-ink)/0.05),0_18px_40px_-12px_rgb(var(--reg-ink)/0.16)] ring-1 ring-[rgb(var(--reg-ink)/0.05)] motion-safe:animate-[auth-float_6s_ease-in-out_infinite]">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-mesh-1)),rgb(var(--reg-mesh-2))_55%,rgb(var(--reg-mesh-3)))] text-[rgb(var(--reg-ink))]">
          <Check className="h-5 w-5" aria-hidden />
        </span>
        <span>
          <span className="block text-sm font-bold text-[rgb(var(--reg-ink))]">{t("common.newBooking")}</span>
          <span className="block text-xs text-[rgb(var(--reg-muted))]">{t("auth.tomorrowAtAddedToYour")}</span>
        </span>
      </div>
    </MeshPanel>
  );
}

interface AuthShellProps {
  children: ReactNode;
  /** The pill in the header row: "Sign up" on sign-in, "Log in" on sign-up. */
  /** Omitted once the person is signed in (the welcome screen after sign-up). */
  headerLink?: { label: string; to: string };
  /** Right-hand panel on a desktop. Defaults to the benefits. */
  aside?: ReactNode;
  /** Card width; sign-up's question screens want a little more than sign-in. */
  cardClassName?: string;
  /** Under the card, inside the card (support/terms/privacy, the way back to the site). */
  footer?: boolean;
  /** Room at the bottom of a phone for a sticky action bar. */
  mobileBarSpace?: boolean;
}

export function AuthShell({ children, headerLink, aside, cardClassName, footer = true, mobileBarSpace = false }: AuthShellProps) {
  const supportHref = useSupportHref(`${webUrl}/support`);
  // The hub ships Inter only; its doors wear the brand face, as on booqi-web. If the font
  // cannot load, the stack falls back to Inter — nothing breaks.
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);

  return (
    <div
      className="relative isolate min-h-screen overflow-x-hidden bg-[rgb(var(--reg-canvas))] text-[rgb(var(--reg-ink))]"
      style={{ fontFamily: '"Plus Jakarta Sans", Inter, system-ui, sans-serif' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]"
        style={{
          background:
            "radial-gradient(60% 80% at 10% 0%, rgb(var(--reg-mesh-1) / 0.6) 0%, transparent 70%)," +
            "radial-gradient(50% 70% at 92% 0%, rgb(var(--reg-mesh-2) / 0.5) 0%, transparent 70%)," +
            "radial-gradient(40% 60% at 60% 0%, rgb(var(--reg-mesh-3) / 0.35) 0%, transparent 70%)",
        }}
      />

      <header className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
        <a href={webUrl} aria-label="booqi" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand))]">
          <BooqiLogo className="block h-8 w-auto md:h-9" />
        </a>
        <div className="flex items-center gap-5">
          <span className="hidden text-sm text-[rgb(var(--reg-ink)/0.75)] sm:inline">{t("auth.forBusiness")}</span>
          {headerLink && (
          <Link
            to={headerLink.to}
            className="inline-flex h-11 items-center rounded-full bg-white/80 px-5 text-sm font-semibold text-[rgb(var(--reg-ink))] shadow-[0_1px_2px_rgb(var(--reg-ink)/0.04),0_8px_24px_-8px_rgb(var(--reg-ink)/0.1)] ring-1 ring-[rgb(var(--reg-ink)/0.06)] backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand))]"
          >
            {headerLink.label}
          </Link>
          )}
        </div>
      </header>

      <div
        className={cn(
          "mx-auto grid max-w-7xl gap-10 px-4 pt-6 md:px-8 md:pt-10 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-14 lg:py-12",
          mobileBarSpace ? "pb-32 md:pb-14" : "pb-14",
        )}
      >
        <main className={cn("mx-auto w-full min-w-0 max-w-[460px] animate-in fade-in-0 slide-in-from-bottom-2 duration-500 motion-reduce:animate-none", cardClassName)}>
          <div className="md:rounded-[32px] md:bg-white/85 md:p-9 md:shadow-[0_2px_4px_rgb(var(--reg-ink)/0.04),0_24px_48px_-16px_rgb(var(--reg-brand-strong)/0.22)] md:ring-1 md:ring-[rgb(var(--reg-ink)/0.05)] md:backdrop-blur-xl">
            {children}
            {footer && (
              <div className="mt-8 border-t border-[rgb(var(--reg-line)/0.7)] pt-6 text-center text-sm text-[rgb(var(--reg-muted))]">
                <p className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                  <a href={supportHref} className="hover:text-[rgb(var(--reg-ink))]">{t("auth.support")}</a>
                  <a href={`${webUrl}/legal/terms`} className="hover:text-[rgb(var(--reg-ink))]">{t("auth.terms")}</a>
                  <a href={`${webUrl}/legal/privacy`} className="hover:text-[rgb(var(--reg-ink))]">{t("auth.privacy")}</a>
                </p>
                <p className="mt-3">
                  {t("auth.bookingAsAClient")}{" "}
                  <a href={webUrl} className="font-medium underline-offset-4 hover:text-[rgb(var(--reg-ink))] hover:underline">
                    {t("auth.goToBooqi")}
                  </a>
                </p>
              </div>
            )}
          </div>
        </main>

        {aside ?? <BenefitsPanel />}
      </div>
    </div>
  );
}
