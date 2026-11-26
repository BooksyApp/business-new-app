import type { Id } from "@/types/id";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Check,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Globe,
  KeyRound,
  LifeBuoy,
  MessagesSquare,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LanguageModal } from "./LanguageModal";
import { useHubLocale } from "@/lib/hubLocale";
import { useBusinessId } from "@/hooks/useBusinessId";
import { authService } from "@/services/authService";
import { clearAuthData } from "@/utils/authUtils";
import { getCurrentUser, getUserBusinesses } from "@/utils/businessUtils";
import { assetUrl } from "@/config/api";
import { BRAND_FONT, useBrandFont } from "@/components/auth/useBrandFont";
import "@/components/auth/auth-tokens.css";

import { SettingsIcon, isSettingsPath, myAccess, pageAllowed, openQuickSearch, useVisibleNav, useVisibleSettings, type NavEntry } from "./navigation";
import { t } from "@/i18n";
import { NotificationBell } from "./NotificationBell";
import { useSupportHref } from "@/services/platformService";
import { keyForId, salonPath } from "@/lib/salonKey";

/**
 * The panel's navigation, in the booqi look of the new auth and calendar pages: a light
 * sidebar on a desktop (collapsible to icons), and on a phone a slim top bar plus the web's
 * floating bottom tab bar, with "More" opening everything else.
 *
 * What is shown is exactly useVisibleNav() — the same role, permission and feature
 * flag rules as before; this file only changes how it looks.
 */

/** ⌘K on a Mac, Ctrl+K elsewhere — shown on the search button. */
const MOD_KEY = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

/* ── shared helpers ─────────────────────────────────────────────────────── */

type MyBusiness = { id: Id; name: string; logoUrl?: string };

/** The owner's salons, for the switcher. Loaded once; an error just leaves the list short. */
function useMyBusinesses(enabled: boolean) {
  const [list, setList] = useState<MyBusiness[] | null>(null);
  useEffect(() => {
    if (!enabled || list) return;
    let alive = true;
    getUserBusinesses()
      .then((b) => alive && setList((b as MyBusiness[]) ?? []))
      .catch(() => alive && setList([]));
    return () => {
      alive = false;
    };
  }, [enabled, list]);
  return list;
}

const initialsOfName = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "B";

/** The salon list: every salon (current one checked) and "Add salon" at the end. */
function SalonList({ onPick, onAdd, currentId, businesses, large = false }: {
  onPick: (id: Id) => void;
  onAdd: () => void;
  currentId: Id;
  businesses: MyBusiness[] | null;
  large?: boolean;
}) {
  const row = cn("flex w-full items-center gap-3 rounded-xl text-left transition-colors hover:bg-[rgb(var(--reg-ink)/0.04)]", large ? "min-h-[56px] px-3" : "px-2 py-2");
  return (
    <div role="menu" aria-label={t("layout.yourSalons")}>
      {businesses === null ? (
        <p className="px-3 py-3 text-sm text-[rgb(var(--reg-muted))]">{t("common.loading2")}</p>
      ) : (
        businesses.map((b) => {
          const on = b.id === currentId;
          return (
            <button key={b.id} type="button" role="menuitemradio" aria-checked={on} onClick={() => onPick(b.id)} className={row}>
              <SalonMark logo={b.logoUrl} mark={initialsOfName(b.name)} className={large ? "h-10 w-10" : "h-8 w-8 rounded-lg"} />
              <span className={cn("min-w-0 flex-1 truncate font-semibold", large ? "text-[15px]" : "text-sm")}>{b.name}</span>
              {on && <Check size={18} className="shrink-0 text-[rgb(var(--reg-brand))]" aria-hidden />}
            </button>
          );
        })
      )}
      <div className="my-1 h-px bg-[rgb(var(--reg-line))]" aria-hidden />
      <button type="button" role="menuitem" onClick={onAdd} className={cn(row, "text-[rgb(var(--reg-brand-strong))]")}>
        <span className={cn("flex shrink-0 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--reg-brand)/0.5)]", large ? "h-10 w-10 rounded-xl" : "h-8 w-8")}>
          <Plus size={16} aria-hidden />
        </span>
        <span className={cn("font-semibold", large ? "text-[15px]" : "text-sm")}>{t("layout.addSalon")}</span>
      </button>
    </div>
  );
}

function useNavModel() {
  const location = useLocation();
  const navigate = useNavigate();
  const businessId = useBusinessId();
  const sections = useVisibleNav();

  // Prepend the business id inside a business, as the old rail did.
  // /<slug>_<publicId><path> (lib/salonKey) — never the numeric id in the address.
  const salonKey = keyForId(businessId);
  const getPath = (path: string): string => (salonKey && path !== "/" ? `/${salonKey}${path}` : path);
  const matches = (full: string) =>
    location.pathname === full ||
    location.pathname.startsWith(full + "/") ||
    (full === getPath("/business") && location.pathname === `/${salonKey}`);
  // A family is active on any of its tabs.
  const entryActive = (e: NavEntry) => [e.path, ...(e.pages ?? []).map((x) => x.path)].some((p) => matches(getPath(p)));
  const findEntry = (slug: string) => sections.flatMap((sec) => sec.entries).find((e) => e.slug === slug);
  // The salon-relative path ("/setup/email"), for the Settings entry.
  const relPath = salonKey && location.pathname.startsWith(`/${salonKey}`) ? location.pathname.slice(salonKey.length + 1) || "/" : location.pathname;
  const settingsActive = isSettingsPath(relPath) && relPath !== "/support";
  const visibleSettings = useVisibleSettings();
  const hasSettings = visibleSettings.length > 0;
  // A role without the /setup hub (staff) gets the first settings page it may open, not a link that bounces to the calendar.
  const settingsPath = pageAllowed(myAccess(), "/setup") ? "/setup" : visibleSettings[0]?.rows[0]?.path ?? "/setup";

  const currentUser = getCurrentUser();
  const initials = currentUser?.fullName
    ? currentUser.fullName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part: string) => part[0]!.toUpperCase())
        .join("")
    : (currentUser?.email?.[0]?.toUpperCase() ?? "?");

  let business: { name?: string; logoUrl?: string } = {};
  try {
    business = JSON.parse(localStorage.getItem("currentBusiness") || "{}") ?? {};
  } catch {
    business = {};
  }
  const businessName = business.name || t("common.yourSalon");
  const businessMark = businessName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const handleLogout = async () => {
    await authService.logout();
    clearAuthData();
    navigate("/login", { replace: true });
  };
  // Same as picking a card on the salon picker: open that salon's calendar; the business
  // route stores it as the current one.
  const switchTo = (id: Id) => {
    if (id !== businessId) navigate(salonPath(id));
  };
  // The existing add-business flow (CreateBusinessPage).
  const addSalon = () => navigate("/create-business");

  return {
    sections, findEntry, getPath, matches, entryActive, navigate, location, settingsActive, hasSettings, settingsPath,
    currentUser, initials, businessName, businessMark, businessLogo: business.logoUrl, handleLogout, switchTo, addSalon, businessId,
  };
}

function SalonMark({ logo, mark, className }: { logo?: string; mark: string; className?: string }) {
  return logo ? (
    <img src={assetUrl(logo)} alt="" className={cn("shrink-0 rounded-xl object-cover", className)} />
  ) : (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgb(var(--reg-mesh-1)),rgb(var(--reg-mesh-2))_55%,rgb(var(--reg-mesh-3)))] text-xs font-extrabold text-[rgb(var(--reg-ink))]",
        className,
      )}
    >
      {mark || "B"}
    </span>
  );
}

function BooqiMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 467.19 200" className={className} role="img" aria-label="booqi">
      <defs>
        <linearGradient id="nav-logo-g" gradientUnits="userSpaceOnUse" x1="116" y1="0" x2="308" y2="0">
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
        fill="none" stroke="url(#nav-logo-g)" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

/** A tooltip only when the label is hidden (collapsed rail). */
function MaybeTip({ show, label, children }: { show: boolean; label: string; children: React.ReactElement }) {
  if (!show) return children;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="rounded-lg border-none bg-[rgb(var(--reg-ink))] px-2.5 py-1.5 text-xs font-semibold text-white">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// One row height (32px) and one icon size (18) across the rail, so it fits a laptop screen.
const itemBase =
  "group relative flex h-9 items-center gap-2.5 rounded-full px-3 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]";
const itemIdle = "text-[rgb(var(--reg-ink)/0.72)] hover:bg-[rgb(var(--reg-ink)/0.04)] hover:text-[rgb(var(--reg-ink))]";
const itemOn = "bg-[rgb(var(--reg-brand-soft))] font-extrabold text-[rgb(var(--reg-brand-strong))]";

/* ── desktop sidebar ────────────────────────────────────────────────────── */

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const m = useNavModel();
  const supportHref = useSupportHref("https://getbooqi.tech/support"); // A-06
  const [selectedLanguage, setSelectedLanguage] = useHubLocale();
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  useBrandFont();
  const [salonMenuOpen, setSalonMenuOpen] = useState(false);
  const businesses = useMyBusinesses(salonMenuOpen);

  return (
    <>
      <aside
        style={{ fontFamily: BRAND_FONT }}
        className={cn(
          "hidden h-screen shrink-0 flex-col border-r border-[rgb(var(--reg-line)/0.8)] bg-[rgb(var(--reg-canvas))] text-[rgb(var(--reg-ink))] transition-[width] duration-200 md:flex",
          collapsed ? "w-[76px]" : "w-[248px]",
        )}
      >
        {/* Logo + collapse */}
        <div className={cn("flex h-12 shrink-0 items-center", collapsed ? "justify-center" : "justify-between pl-4 pr-2")}>
          {collapsed ? (
            <span className="text-2xl font-extrabold tracking-[-0.04em]" aria-label="booqi">
              {t("layout.b")}
            </span>
          ) : (
            <BooqiMark className="h-6 w-auto" />
          )}
          {!collapsed && (
            <span className="flex items-center gap-0.5">
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={openQuickSearch}
                  aria-label={t("nav.search.open")}
                  aria-keyshortcuts="Meta+K Control+K"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[rgb(var(--reg-ink)/0.6)] hover:bg-[rgb(var(--reg-ink)/0.05)] hover:text-[rgb(var(--reg-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]"
                >
                  <Search size={17} strokeWidth={1.9} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="rounded-lg border-none bg-[rgb(var(--reg-ink))] px-2.5 py-1.5 text-xs font-semibold text-white">
                {t("nav.search.open")} · {MOD_KEY}
              </TooltipContent>
            </Tooltip>
            <button
              type="button"
              onClick={onToggle}
              aria-label={t("layout.collapseMenu")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[rgb(var(--reg-muted))] hover:bg-[rgb(var(--reg-ink)/0.05)] hover:text-[rgb(var(--reg-ink))]"
            >
              <ChevronsLeft size={18} strokeWidth={1.75} />
            </button>
            </span>
          )}
        </div>

        {/* Salon switcher */}
        <div className="px-3 pb-2">
          <DropdownMenu open={salonMenuOpen} onOpenChange={setSalonMenuOpen}>
            <MaybeTip show={collapsed} label={m.businessName}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl bg-white p-1.5 text-left shadow-[0_1px_2px_rgb(var(--reg-ink)/0.04)] ring-1 ring-[rgb(var(--reg-line))] transition hover:ring-[rgb(var(--reg-brand)/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]",
                    collapsed && "justify-center p-1.5",
                  )}
                  aria-label={t("layout.salonYourSalons", { businessName: m.businessName })}
                >
                  <SalonMark logo={m.businessLogo} mark={m.businessMark} className="h-8 w-8 rounded-lg" />
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{m.businessName}</span>
                      </span>
                      <ChevronsUpDown size={16} className="shrink-0 text-[rgb(var(--reg-muted))]" />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
            </MaybeTip>
            <DropdownMenuContent align="start" className="w-64 rounded-2xl p-1.5" style={{ fontFamily: BRAND_FONT }}>
              <DropdownMenuLabel className="text-xs font-semibold text-[rgb(var(--reg-muted))]">{t("layout.yourSalons")}</DropdownMenuLabel>
              <SalonList
                businesses={businesses}
                currentId={m.businessId}
                onPick={(id) => { setSalonMenuOpen(false); m.switchTo(id); }}
                onAdd={() => { setSalonMenuOpen(false); m.addSalon(); }}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* The one primary action: a new booking opens the calendar's form (?new=1). */}
        {m.findEntry("calendar") && (
          <div className="px-3 pb-2">
            <MaybeTip show={collapsed} label={t("common.newBooking")}>
              <button
                type="button"
                onClick={() => m.navigate(`${m.getPath(m.findEntry("calendar")!.path)}?new=1`)}
                aria-label={t("common.newBooking")}
                className={cn(
                  "flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#6f52ed_0%,#e83e63_100%)] text-sm font-bold text-white shadow-[0_10px_24px_-8px_rgb(91_63_214/0.6)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)] focus-visible:ring-offset-2",
                )}
              >
                <Plus size={18} strokeWidth={2.25} aria-hidden />
                {!collapsed && <span className="truncate">{t("common.newBooking")}</span>}
              </button>
            </MaybeTip>
          </div>
        )}

        {/* Quick search (⌘K / Ctrl+K) */}
        {collapsed && <div className="px-3 pb-1">
          <div className="mb-1 flex justify-center"><NotificationBell side="right" /></div>
          <MaybeTip show={collapsed} label={t("nav.search.open")}>
            <button
              type="button"
              onClick={openQuickSearch}
              aria-label={t("nav.search.open")}
              aria-keyshortcuts="Meta+K Control+K"
              className={cn(
                "flex h-9 w-full items-center gap-2.5 rounded-lg bg-[rgb(var(--reg-ink)/0.04)] px-2.5 text-[13px] text-[rgb(var(--reg-muted))] transition-colors hover:bg-[rgb(var(--reg-ink)/0.07)] hover:text-[rgb(var(--reg-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]",
                collapsed && "justify-center px-0",
              )}
            >
              <Search size={16} strokeWidth={1.9} className="shrink-0" aria-hidden />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate text-left">{t("nav.search.open")}</span>
                  <kbd className="rounded-md bg-white px-1.5 py-0.5 font-sans text-[11px] font-semibold text-[rgb(var(--reg-muted))] ring-1 ring-[rgb(var(--reg-line))]">{MOD_KEY}</kbd>
                </>
              )}
            </button>
          </MaybeTip>
        </div>}

        {/* Navigation: every link visible; a category opens a page of cards (SectionPage). */}
        <nav aria-label={t("layout.main")} className="flex-1 overflow-y-auto px-3 pb-2">
          {m.sections.map((sec) => (
            <div key={sec.slug} className="pt-2">
              {sec.key &&
                (collapsed ? (
                  <div className="mx-2 mb-1.5 mt-1 h-px bg-[rgb(var(--reg-line))]" aria-hidden />
                ) : (
                  <p className="px-2.5 pb-0.5 pt-2 text-[10.5px] font-bold uppercase tracking-[0.09em] text-[rgb(var(--reg-muted)/0.85)]">{t(sec.key)}</p>
                ))}
              <ul className="space-y-px">
                {sec.entries.map((e) => {
                  const active = m.entryActive(e);
                  const Icon = e.icon;
                  return (
                    <li key={e.slug}>
                      <MaybeTip show={collapsed} label={e.label}>
                        <NavLink
                          to={m.getPath(e.path)}
                          aria-label={collapsed ? e.label : undefined}
                          aria-current={active ? "page" : undefined}
                          className={cn(itemBase, active ? itemOn : itemIdle, collapsed && "justify-center px-0")}
                        >
                          <Icon size={18} strokeWidth={1.75} className={cn("shrink-0", active ? "text-[rgb(var(--reg-brand))]" : "text-[rgb(var(--reg-ink)/0.5)] group-hover:text-[rgb(var(--reg-ink)/0.75)]")} />
                          {!collapsed && <span className="truncate">{e.label}</span>}
                        </NavLink>
                      </MaybeTip>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Foot: settings, then the account (help, support, password, sign out) and language. */}
        <div className="shrink-0 space-y-px border-t border-[rgb(var(--reg-line)/0.8)] px-3 py-2">
          {m.hasSettings && (
            <MaybeTip show={collapsed} label={t("nav.settings")}>
              <NavLink
                to={m.getPath(m.settingsPath)}
                aria-current={m.settingsActive ? "page" : undefined}
                className={cn(itemBase, m.settingsActive ? itemOn : itemIdle, collapsed && "justify-center px-0")}
              >
                <SettingsIcon size={18} strokeWidth={1.75} className={cn("shrink-0", m.settingsActive ? "text-[rgb(var(--reg-brand))]" : "text-[rgb(var(--reg-ink)/0.5)] group-hover:text-[rgb(var(--reg-ink)/0.75)]")} />
                {!collapsed && t("nav.settings")}
              </NavLink>
            </MaybeTip>
          )}
          {collapsed && (
            <MaybeTip show label={t("layout.expandMenu")}>
              <button type="button" onClick={onToggle} aria-label={t("layout.expandMenu")} className={cn(itemBase, itemIdle, "w-full justify-center px-0")}>
                <ChevronsRight size={18} strokeWidth={1.75} />
              </button>
            </MaybeTip>
          )}
          <div className={cn("flex items-center gap-1 pt-1", collapsed && "flex-col")}>
            <DropdownMenu>
              <MaybeTip show={collapsed} label={m.currentUser?.fullName || m.currentUser?.email || t("layout.account")}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("layout.account")}
                    className={cn("flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-left hover:bg-[rgb(var(--reg-ink)/0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]", collapsed && "flex-none justify-center")}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--reg-ink))] text-[11px] font-bold text-white">{m.initials}</span>
                    {!collapsed && (
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{m.currentUser?.fullName || t("layout.signedIn")}</span>
                        <span className="block truncate text-[11px] text-[rgb(var(--reg-muted))]">{m.currentUser?.email}</span>
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
              </MaybeTip>
              <DropdownMenuContent side="top" align="start" className="w-60 rounded-2xl p-1.5" style={{ fontFamily: BRAND_FONT }}>
                <DropdownMenuItem asChild className="h-10 gap-2 rounded-xl">
                  <NavLink to={m.getPath("/support")}>
                    <MessagesSquare size={16} strokeWidth={1.75} className="text-[rgb(var(--reg-ink)/0.55)]" />
                    {t("layout.support")}
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="h-10 gap-2 rounded-xl">
                  <a href={supportHref}>
                    <LifeBuoy size={16} strokeWidth={1.75} className="text-[rgb(var(--reg-ink)/0.55)]" />
                    {t("layout.help")}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="h-10 gap-2 rounded-xl">
                  <NavLink to={m.getPath("/security")}>
                    <KeyRound size={16} strokeWidth={1.75} className="text-[rgb(var(--reg-ink)/0.55)]" />
                    {t("setup.passwordSecurity")}
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={m.handleLogout} className="h-10 gap-2 rounded-xl text-red-700 focus:text-red-700">
                  <LogOut size={16} strokeWidth={1.75} />{" "}{t("layout.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {!collapsed && <NotificationBell side="right" />}
            <MaybeTip show label={t("layout.language")}>
              <button
                type="button"
                onClick={() => setIsLanguageModalOpen(true)}
                aria-label={t("layout.language")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[rgb(var(--reg-ink)/0.55)] hover:bg-[rgb(var(--reg-ink)/0.05)] hover:text-[rgb(var(--reg-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]"
              >
                <Globe size={17} strokeWidth={1.75} />
              </button>
            </MaybeTip>
          </div>
        </div>
      </aside>

      <LanguageModal
        open={isLanguageModalOpen}
        onOpenChange={setIsLanguageModalOpen}
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
      />
    </>
  );
}

/* ── phone: top bar + floating bottom tab bar + "More" sheet ─────────────── */

export function MobileTopBar() {
  const m = useNavModel();
  const [open, setOpen] = useState(false);
  const businesses = useMyBusinesses(open);
  return (
    <>
    <header
      style={{ fontFamily: BRAND_FONT }}
      className="flex h-14 shrink-0 items-center gap-3 border-b border-[rgb(var(--reg-line)/0.8)] bg-[rgb(var(--reg-canvas))] px-4 text-[rgb(var(--reg-ink))] md:hidden"
    >
      <button type="button" onClick={() => setOpen(true)} aria-expanded={open} className="flex h-11 min-w-0 items-center gap-2.5" aria-label={t("layout.salonYourSalons", { businessName: m.businessName })}>
        <SalonMark logo={m.businessLogo} mark={m.businessMark} className="h-8 w-8 rounded-lg" />
        <span className="truncate text-[15px] font-bold">{m.businessName}</span>
        <ChevronsUpDown size={16} className="shrink-0 text-[rgb(var(--reg-muted))]" />
      </button>
      <NotificationBell className="ml-auto h-11 w-11" />
      <button
        type="button"
        onClick={openQuickSearch}
        aria-label={t("nav.search.open")}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[rgb(var(--reg-ink)/0.7)] hover:bg-[rgb(var(--reg-ink)/0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]"
      >
        <Search size={20} strokeWidth={1.9} />
      </button>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--reg-ink))] text-[11px] font-bold text-white" aria-label={t("layout.signedIn")}>
        {m.initials}
      </span>
    </header>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        style={{ fontFamily: BRAND_FONT }}
        className="max-h-[80vh] overflow-y-auto rounded-t-[28px] border-0 bg-[rgb(var(--reg-canvas))] px-3 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3 text-[rgb(var(--reg-ink))]"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[rgb(var(--reg-ink)/0.15)]" aria-hidden />
        <SheetTitle className="px-2 pb-2 text-xl font-extrabold tracking-[-0.02em]">{t("layout.yourSalons")}</SheetTitle>
        <div className="rounded-2xl bg-white p-1.5 ring-1 ring-[rgb(var(--reg-line))]">
          <SalonList
            large
            businesses={businesses}
            currentId={m.businessId}
            onPick={(id) => { setOpen(false); m.switchTo(id); }}
            onAdd={() => { setOpen(false); m.addSalon(); }}
          />
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}

export function MobileTabBar() {
  const supportHref = useSupportHref("https://getbooqi.tech/support"); // A-06
  const m = useNavModel();
  const [moreOpen, setMoreOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useHubLocale();
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const calendar = m.findEntry("calendar");
  const clients = m.findEntry("clients");
  const sales = m.findEntry("sales");
  const tab = (href: string | null, label: string, Icon: React.ElementType, active: boolean) =>
    href ? (
      <li className="flex flex-1 justify-center">
        <NavLink
          to={href}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]",
            active
              ? "bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] text-white shadow-[0_10px_24px_-8px_rgb(var(--reg-brand-strong)/0.6)]"
              : "text-[rgb(var(--reg-muted))] hover:bg-[rgb(var(--reg-ink)/0.05)] hover:text-[rgb(var(--reg-ink))]",
          )}
        >
          <Icon size={22} />
        </NavLink>
      </li>
    ) : null;

  return (
    <>
      <nav
        aria-label={t("layout.main")}
        className="fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-full bg-white/90 shadow-[0_2px_6px_rgb(var(--reg-ink)/0.05),0_18px_40px_-12px_rgb(var(--reg-ink)/0.2)] ring-1 ring-[rgb(var(--reg-ink)/0.06)] backdrop-blur-xl md:hidden"
      >
        <ul className="flex h-16 items-center gap-1 px-2">
          {calendar && tab(m.getPath(calendar.path), t("common.calendar"), calendar.icon, m.entryActive(calendar))}
          {clients && tab(m.getPath(clients.path), t("common.clients"), clients.icon, m.entryActive(clients))}
          {calendar && (
            <li className="flex flex-1 justify-center">
              {/* The calendar opens its booking form on ?new=1. */}
              <button
                type="button"
                onClick={() => m.navigate(`${m.getPath(calendar.path)}?new=1`)}
                aria-label={t("common.newBooking")}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--reg-ink))] text-white shadow-[0_8px_20px_-8px_rgb(var(--reg-ink)/0.6)] transition active:scale-95"
              >
                <Plus size={22} strokeWidth={2.25} />
              </button>
            </li>
          )}
          {sales && tab(m.getPath(sales.path), t("common.sales"), sales.icon, m.entryActive(sales))}
          <li className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-label={t("common.more")}
              aria-expanded={moreOpen}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
                moreOpen ? "bg-[rgb(var(--reg-ink)/0.06)] text-[rgb(var(--reg-ink))]" : "text-[rgb(var(--reg-muted))] hover:bg-[rgb(var(--reg-ink)/0.05)]",
              )}
            >
              <MoreHorizontal size={22} />
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          style={{ fontFamily: BRAND_FONT }}
          className="max-h-[85vh] overflow-y-auto rounded-t-[28px] border-0 bg-[rgb(var(--reg-canvas))] px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3 text-[rgb(var(--reg-ink))]"
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[rgb(var(--reg-ink)/0.15)]" aria-hidden />
          <SheetTitle className="px-1 text-xl font-extrabold tracking-[-0.02em]">{t("layout.menu")}</SheetTitle>
          <button
            type="button"
            onClick={() => { setMoreOpen(false); openQuickSearch(); }}
            className="mt-3 flex h-12 w-full items-center gap-3 rounded-2xl bg-white px-4 text-[15px] text-[rgb(var(--reg-muted))] ring-1 ring-[rgb(var(--reg-line))]"
          >
            <Search size={18} strokeWidth={1.9} aria-hidden /> {t("nav.search.placeholder")}
          </button>
          <div className="mt-5 space-y-5">
            {m.sections.map((sec) => (
              <section key={sec.slug}>
                {sec.key && <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted))]">{t(sec.key)}</p>}
                <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-[rgb(var(--reg-line))]">
                  {sec.entries.map((e) => {
                    const on = m.entryActive(e);
                    const Icon = e.icon;
                    return (
                      <li key={e.slug} className="border-b border-[rgb(var(--reg-line)/0.6)] last:border-0">
                        <NavLink
                          to={m.getPath(e.path)}
                          onClick={() => setMoreOpen(false)}
                          aria-current={on ? "page" : undefined}
                          className={cn("flex min-h-[48px] items-center gap-3 px-4 text-[15px] font-semibold", on && "text-[rgb(var(--reg-brand-strong))]")}
                        >
                          <Icon size={18} strokeWidth={1.75} className={on ? "text-[rgb(var(--reg-brand))]" : "text-[rgb(var(--reg-ink)/0.5)]"} aria-hidden />
                          {e.label}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {m.hasSettings && (
              <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-[rgb(var(--reg-line))]">
                <li>
                  <NavLink to={m.getPath(m.settingsPath)} onClick={() => setMoreOpen(false)} className={cn("flex min-h-[48px] items-center gap-3 px-4 text-[15px] font-semibold", m.settingsActive && "text-[rgb(var(--reg-brand-strong))]")}>
                    <SettingsIcon size={18} strokeWidth={1.75} className="text-[rgb(var(--reg-ink)/0.5)]" aria-hidden />
                    {t("nav.settings")}
                  </NavLink>
                </li>
              </ul>
            )}
            <section>
              <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-[rgb(var(--reg-line))]">

                <li className="border-b border-[rgb(var(--reg-line)/0.6)]">
                  <button type="button" onClick={() => { setMoreOpen(false); setIsLanguageModalOpen(true); }} className="flex min-h-[48px] w-full items-center gap-3 px-4 text-[15px] font-semibold">
                    <Globe size={18} strokeWidth={1.75} />{" "}{t("layout.language")}
                  </button>
                </li>
                <li className="border-b border-[rgb(var(--reg-line)/0.6)]">
                  <NavLink to={m.getPath("/support")} onClick={() => setMoreOpen(false)} className="flex min-h-[48px] items-center gap-3 px-4 text-[15px] font-semibold">
                    <MessagesSquare size={18} strokeWidth={1.75} />{" "}{t("layout.support")}
                  </NavLink>
                </li>
                <li className="border-b border-[rgb(var(--reg-line)/0.6)]">
                  <a href={supportHref} className="flex min-h-[48px] items-center gap-3 px-4 text-[15px] font-semibold">
                    <LifeBuoy size={18} strokeWidth={1.75} />{" "}{t("layout.help")}
                  </a>
                </li>
                <li>
                  <button type="button" onClick={m.handleLogout} className="flex min-h-[48px] w-full items-center gap-3 px-4 text-[15px] font-semibold text-red-700">
                    <LogOut size={18} strokeWidth={1.75} />{" "}{t("layout.signOut")}
                  </button>
                </li>
              </ul>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <LanguageModal
        open={isLanguageModalOpen}
        onOpenChange={setIsLanguageModalOpen}
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
      />
    </>
  );
}
