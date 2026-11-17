import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { webUrl } from "./authStyles";
import "./auth-tokens.css";
import { t } from "@/i18n";
import { useSupportHref } from "@/services/platformService";
import { MomentLine, MomentOccupancy } from "@/components/moments/Moments";

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

const ARCH_RADIUS = "999px 999px 30px 30px";

/**
 * Sign-in's aside: a real salon moment in booqi's arch, with the product on its edges — the same
 * "moments" as booqi-web's for-business page (a booking lands, the week fills up, a payment comes in).
 * Desktop only (the aside is hidden on phones); the photo is lazy, so it never slows the sign-in.
 */
export function BenefitsPanel() {
  return (
    <MeshPanel className="min-h-[620px]">
      <div>
        <GlassChip>{t("auth.booqiForBusiness")}</GlassChip>
        <h2 className="mt-6 max-w-md text-[44px] font-extrabold !leading-[1] tracking-[-0.03em] text-[rgb(var(--reg-ink))] [text-wrap:balance]">
          {t("auth.yourSalonBookedOnline")}
        </h2>
      </div>
      <div aria-hidden className="relative mt-10 min-h-[400px] flex-1">
        {/* the mirror's lit edge, offset up-right behind the photo */}
        <span className="absolute right-0 top-0 h-[380px] w-[280px] border-[1.5px] border-[rgb(233_162_127/0.7)]" style={{ borderRadius: ARCH_RADIUS, transform: "translate(12px,-12px)" }} />
        <div className="absolute right-0 top-0 h-[380px] w-[280px] overflow-hidden bg-[rgb(251_231_220)] shadow-[0_40px_70px_-40px_rgb(160_80_50/0.45)]" style={{ borderRadius: ARCH_RADIUS }}>
          <img src={`${import.meta.env.BASE_URL}auth/arch.webp`} alt="" width={560} height={700} loading="lazy" decoding="async" className="h-full w-full object-cover object-[58%_26%]" />
        </div>
        <MomentLine icon={Check} tone="brand" title={t("common.newBooking")} body={t("auth.tomorrowAtAddedToYour")} className="absolute left-0 top-12 w-[260px]" />
        <MomentOccupancy label={t("auth.mWeek")} value={t("auth.mWeekValue")} className="absolute bottom-10 left-0 w-[230px]" />
        <MomentLine icon={Wallet} tone="peach" title={t("auth.mPaidTitle")} body={t("auth.mPaidBody")} className="absolute -right-2 bottom-0 w-[240px]" />
      </div>
    </MeshPanel>
  );
}

/**
 * Phones and tablets (the desktop aside is hidden there): booqi's arch with a real salon photo and
 * two moments on its edges, above the form — the same composition as booqi-web's for-business on
 * a phone. Small and fixed in size, so the form never jumps; the photo decodes off the main thread.
 */
function AuthMobileHero({ variant }: { variant: "signin" | "signup" }) {
  return (
    <div aria-hidden className="relative mb-9 mt-2 h-[208px] lg:hidden">
      <span className="absolute inset-y-0 left-6 right-4 border-[1.5px] border-[rgb(233_162_127/0.7)]" style={{ borderRadius: "46% 46% 26px 26px / 62% 62% 26px 26px", transform: "translate(10px,-10px)" }} />
      <div className="absolute inset-y-0 left-6 right-4 overflow-hidden bg-[rgb(251_231_220)] shadow-[0_34px_60px_-36px_rgb(160_80_50/0.5)]" style={{ borderRadius: "46% 46% 26px 26px / 62% 62% 26px 26px" }}>
        <img src={`${import.meta.env.BASE_URL}auth/arch.webp`} alt="" width={560} height={700} decoding="async" className="h-full w-full object-cover object-[58%_30%]" />
      </div>
      {variant === "signin" ? (
        <>
          <MomentLine icon={Check} tone="brand" title={t("common.newBooking")} body={t("auth.tomorrowAtAddedToYour")} className="absolute -top-3 right-0 w-[min(250px,72%)]" />
          <MomentOccupancy label={t("auth.mWeek")} value={t("auth.mWeekValue")} className="absolute -bottom-5 left-0 w-[min(200px,56%)] !p-3" />
        </>
      ) : (
        <>
          <MomentLine icon={Users} tone="glow" title={t("auth.mNewClientsTitle")} body={t("auth.mNewClientsBody")} className="absolute -top-3 right-0 w-[min(260px,76%)]" />
          <MomentLine icon={Check} tone="brand" title={t("auth.mConfirmTitle")} body={t("auth.mConfirmBody")} className="absolute -bottom-5 left-0 w-[min(250px,72%)]" />
        </>
      )}
    </div>
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
  /** Phones/tablets only: the arch photo with two moments above the card. Defaults to the
   *  sign-in set when the page has no aside of its own; pass "signup" or false explicitly. */
  mobileHero?: "signin" | "signup" | false;
}

export function AuthShell({ children, headerLink, aside, cardClassName, footer = true, mobileBarSpace = false, mobileHero }: AuthShellProps) {
  const hero = mobileHero ?? (aside ? false : "signin");
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
          {hero && <AuthMobileHero variant={hero} />}
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
