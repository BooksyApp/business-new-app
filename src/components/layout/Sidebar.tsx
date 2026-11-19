import type { Id } from "@/types/id";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
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

import { NAV_SECTIONS, SettingsIcon, isSettingsPath, openQuickSearch, useVisibleNavGroups, useVisibleSettings, type NavGroup } from "./navigation";
import { t } from "@/i18n";
import { useSupportHref } from "@/services/platformService";
import { keyForId, salonPath } from "@/lib/salonKey";

/**
 * The panel's navigation, in the booqi look of the new auth and calendar pages: a light
 * sidebar on a desktop (collapsible to icons), and on a phone a slim top bar plus the web's
 * floating bottom tab bar, with "More" opening everything else.
 *
 * What is shown is exactly useVisibleNavGroups() — the same role, permission and feature
 * flag rules as before; this file only changes how it looks.
 */

/** ⌘K on a Mac, Ctrl+K elsewhere — shown on the search button. */
const MOD_KEY = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

const OPEN_KEY = "booqi.nav.open";
/** Which groups the person has opened, remembered per browser (storage may be blocked). */
function useOpenGroups(): [Set<string>, (slug: string) => void] {
  const [open, setOpen] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) || "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  const toggle = (slug: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify([...next]));
      } catch {
        /* per-browser convenience only */
      }
      return next;
    });
  return [open, toggle];
}

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
  const groups = useVisibleNavGroups();

  // Prepend the business id inside a business, as the old rail did.
  // /<slug>_<publicId><path> (lib/salonKey) — never the numeric id in the address.
  const salonKey = keyForId(businessId);
  const getPath = (path: string): string => (salonKey && path !== "/" ? `/${salonKey}${path}` : path);
  const groupHref = (g: NavGroup) => (g.path ? getPath(g.path) : getPath(`/section/${g.slug}`));
  const matches = (full: string) =>
    location.pathname === full ||
    location.pathname.startsWith(full + "/") ||
    (full === getPath("/business") && location.pathname === `/${salonKey}`);
  const groupActive = (g: NavGroup) =>
    (g.items ? [...g.items.map((i) => getPath(i.path)), getPath(`/section/${g.slug}`)] : [getPath(g.path!)]).some(matches);
  // The salon-relative path ("/setup/email"), for the Settings entry.
  const relPath = salonKey && location.pathname.startsWith(`/${salonKey}`) ? location.pathname.slice(salonKey.length + 1) || "/" : location.pathname;
  const settingsActive = isSettingsPath(relPath) && relPath !== "/support";
  const hasSettings = useVisibleSettings().length > 0;

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
    groups, getPath, groupHref, matches, groupActive, navigate, location, settingsActive, hasSettings,
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

const itemBase =
  "group flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]";
const itemIdle = "text-[rgb(var(--reg-ink)/0.72)] hover:bg-[rgb(var(--reg-ink)/0.04)] hover:text-[rgb(var(--reg-ink))]";
const itemOn = "bg-[rgb(var(--reg-brand)/0.1)] text-[rgb(var(--reg-ink))]";
// The group that holds the current page: named in ink, the page itself carries the tint.
const itemGroupOn = "text-[rgb(var(--reg-ink))]";

/* ── desktop sidebar ────────────────────────────────────────────────────── */

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const m = useNavModel();
  const supportHref = useSupportHref("https://getbooqi.tech/support"); // A-06
  const [selectedLanguage, setSelectedLanguage] = useHubLocale();
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  useBrandFont();
  const [salonMenuOpen, setSalonMenuOpen] = useState(false);
  const businesses = useMyBusinesses(salonMenuOpen);

  const [openGroups, toggleGroup] = useOpenGroups();

  const sections = NAV_SECTIONS.map((sec) => ({
    title: t(sec.key),
    groups: sec.slugs.map((slug) => m.groups.find((g) => g.slug === slug)).filter(Boolean) as NavGroup[],
  }));
  // Any group not placed in a section still shows (never lose a destination).
  const placed = new Set(NAV_SECTIONS.flatMap((sec) => sec.slugs));
  const rest = m.groups.filter((g) => !placed.has(g.slug));
  if (rest.length) sections.push({ title: t("common.more"), groups: rest });

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
        <div className={cn("flex h-16 items-center", collapsed ? "justify-center" : "justify-between px-5")}>
          {collapsed ? (
            <span className="text-2xl font-extrabold tracking-[-0.04em]" aria-label="booqi">
              {t("layout.b")}
            </span>
          ) : (
            <BooqiMark className="h-7 w-auto" />
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={onToggle}
              aria-label={t("layout.collapseMenu")}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[rgb(var(--reg-muted))] hover:bg-[rgb(var(--reg-ink)/0.05)] hover:text-[rgb(var(--reg-ink))]"
            >
              <ChevronsLeft size={18} strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Salon switcher */}
        <div className={cn("pb-3", collapsed ? "px-3" : "px-3")}>
          <DropdownMenu open={salonMenuOpen} onOpenChange={setSalonMenuOpen}>
            <MaybeTip show={collapsed} label={m.businessName}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl bg-white p-2 text-left shadow-[0_1px_2px_rgb(var(--reg-ink)/0.04)] ring-1 ring-[rgb(var(--reg-line))] transition hover:ring-[rgb(var(--reg-brand)/0.35)]",
                    collapsed && "justify-center p-1.5",
                  )}
                  aria-label={t("layout.salonYourSalons", { businessName: m.businessName })}
                >
                  <SalonMark logo={m.businessLogo} mark={m.businessMark} className="h-9 w-9" />
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{m.businessName}</span>
                        <span className="block truncate text-xs text-[rgb(var(--reg-muted))]">{t("common.yourSalon")}</span>
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

        {/* Quick search (⌘K / Ctrl+K) */}
        <div className="px-3 pb-2">
          <MaybeTip show={collapsed} label={t("nav.search.open")}>
            <button
              type="button"
              onClick={openQuickSearch}
              aria-label={t("nav.search.open")}
              aria-keyshortcuts="Meta+K Control+K"
              className={cn(
                "flex h-10 w-full items-center gap-2.5 rounded-xl bg-[rgb(var(--reg-ink)/0.04)] px-3 text-sm text-[rgb(var(--reg-muted))] transition-colors hover:bg-[rgb(var(--reg-ink)/0.07)] hover:text-[rgb(var(--reg-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]",
                collapsed && "justify-center px-0",
              )}
            >
              <Search size={17} strokeWidth={1.9} className="shrink-0" aria-hidden />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate text-left">{t("nav.search.open")}</span>
                  <kbd className="rounded-md bg-white px-1.5 py-0.5 font-sans text-[11px] font-semibold text-[rgb(var(--reg-muted))] ring-1 ring-[rgb(var(--reg-line))]">{MOD_KEY}</kbd>
                </>
              )}
            </button>
          </MaybeTip>
        </div>

        {/* Navigation */}
        <nav aria-label={t("layout.main")} className="flex-1 overflow-y-auto px-3 pb-3">
          {sections.map((section) =>
            section.groups.length ? (
              <div key={section.title} className="mt-4 first:mt-1">
                {!collapsed ? (
                  <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted)/0.8)]">
                    {section.title}
                  </p>
                ) : (
                  <div className="mx-3 mb-2 h-px bg-[rgb(var(--reg-line))] first:hidden" aria-hidden />
                )}
                <ul className="space-y-0.5">
                  {section.groups.map((g) => {
                    const active = m.groupActive(g);
                    const Icon = g.icon;
                    const iconCls = cn(
                      "shrink-0",
                      active ? "text-[rgb(var(--reg-brand))]" : "text-[rgb(var(--reg-ink)/0.55)] group-hover:text-[rgb(var(--reg-ink)/0.8)]",
                    );
                    // A page, or the collapsed rail (a group then opens its section page).
                    if (!g.items || collapsed) {
                      return (
                        <li key={g.slug}>
                          <MaybeTip show={collapsed} label={g.label}>
                            <NavLink
                              to={m.groupHref(g)}
                              aria-label={collapsed ? g.label : undefined}
                              aria-current={active ? "page" : undefined}
                              className={cn(itemBase, active && !g.items ? itemOn : active ? itemGroupOn : itemIdle, collapsed && "justify-center px-0")}
                            >
                              <Icon size={20} strokeWidth={1.75} className={iconCls} />
                              {!collapsed && <span className="truncate">{g.label}</span>}
                            </NavLink>
                          </MaybeTip>
                        </li>
                      );
                    }
                    // A group: opens in place. The group holding the current page stays open.
                    const expanded = active || openGroups.has(g.slug);
                    const listId = `nav-group-${g.slug}`;
                    return (
                      <li key={g.slug}>
                        <button
                          type="button"
                          onClick={() => !active && toggleGroup(g.slug)}
                          aria-expanded={expanded}
                          aria-controls={listId}
                          className={cn(itemBase, "w-full", active ? itemGroupOn : itemIdle)}
                        >
                          <Icon size={20} strokeWidth={1.75} className={iconCls} />
                          <span className="flex-1 truncate text-left">{g.label}</span>
                          <ChevronDown
                            size={16}
                            aria-hidden
                            className={cn("shrink-0 text-[rgb(var(--reg-muted))] transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180", active && "opacity-0")}
                          />
                        </button>
                        {expanded && (
                          <ul id={listId} className="mb-1.5 ml-[21px] mt-0.5 space-y-0.5 border-l border-[rgb(var(--reg-line))] pl-3">
                            {g.items.map((item) => {
                              const on = m.matches(m.getPath(item.path));
                              return (
                                <li key={item.path}>
                                  <NavLink
                                    to={m.getPath(item.path)}
                                    aria-current={on ? "page" : undefined}
                                    className={cn(
                                      "block truncate rounded-lg px-2.5 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]",
                                      on
                                        ? "bg-[rgb(var(--reg-brand)/0.1)] font-semibold text-[rgb(var(--reg-brand-strong))]"
                                        : "text-[rgb(var(--reg-ink)/0.68)] hover:bg-[rgb(var(--reg-ink)/0.04)] hover:text-[rgb(var(--reg-ink))]",
                                    )}
                                  >
                                    {item.label}
                                  </NavLink>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null,
          )}
        </nav>

        {/* Bottom: help, language, profile */}
        <div className="space-y-0.5 border-t border-[rgb(var(--reg-line)/0.8)] px-3 py-3">
          {m.hasSettings && (
            <MaybeTip show={collapsed} label={t("nav.settings")}>
              <NavLink
                to={m.getPath("/setup")}
                aria-current={m.settingsActive ? "page" : undefined}
                className={cn(itemBase, m.settingsActive ? itemOn : itemIdle, collapsed && "justify-center px-0")}
              >
                <SettingsIcon size={20} strokeWidth={1.6} className={cn("shrink-0", m.settingsActive ? "text-[rgb(var(--reg-brand))]" : "text-[rgb(var(--reg-ink)/0.55)]")} />
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
          <MaybeTip show={collapsed} label={t("layout.support")}>
            <NavLink
              to={m.getPath("/support")}
              aria-current={m.matches(m.getPath("/support")) ? "page" : undefined}
              className={cn(itemBase, m.matches(m.getPath("/support")) ? itemOn : itemIdle, collapsed && "justify-center px-0")}
            >
              <MessagesSquare size={20} strokeWidth={1.6} className="shrink-0 text-[rgb(var(--reg-ink)/0.55)]" />
              {!collapsed && t("layout.support")}
            </NavLink>
          </MaybeTip>
          <MaybeTip show={collapsed} label={t("layout.language")}>
            <button type="button" onClick={() => setIsLanguageModalOpen(true)} className={cn(itemBase, itemIdle, "w-full", collapsed && "justify-center px-0")}>
              <Globe size={20} strokeWidth={1.6} className="shrink-0 text-[rgb(var(--reg-ink)/0.55)]" />
              {!collapsed && t("layout.language")}
            </button>
          </MaybeTip>

          <DropdownMenu>
            <MaybeTip show={collapsed} label={m.currentUser?.fullName || m.currentUser?.email || t("layout.account")}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("layout.account")}
                  className={cn("mt-1 flex w-full items-center gap-3 rounded-xl p-1.5 text-left hover:bg-[rgb(var(--reg-ink)/0.04)]", collapsed && "justify-center")}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--reg-ink))] text-xs font-bold text-white">
                    {m.initials}
                  </span>
                  {!collapsed && (
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{m.currentUser?.fullName || t("layout.signedIn")}</span>
                      <span className="block truncate text-xs text-[rgb(var(--reg-muted))]">{m.currentUser?.email}</span>
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
            </MaybeTip>
            <DropdownMenuContent side="top" align="start" className="w-56 rounded-2xl p-1.5">
              <DropdownMenuItem asChild className="h-11 gap-2 rounded-xl">
                <a href={supportHref}>
                  <LifeBuoy size={16} strokeWidth={1.75} className="text-[rgb(var(--reg-ink)/0.55)]" />
                  {t("layout.help")}
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="h-11 gap-2 rounded-xl">
                <NavLink to={m.getPath("/security")}>
                  <KeyRound size={16} strokeWidth={1.75} className="text-[rgb(var(--reg-ink)/0.55)]" />
                  {t("setup.passwordSecurity")}
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={m.handleLogout} className="gap-2 rounded-xl text-red-700 focus:text-red-700">
                <LogOut size={16} strokeWidth={1.75} />{" "}{t("layout.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      <button
        type="button"
        onClick={openQuickSearch}
        aria-label={t("nav.search.open")}
        className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[rgb(var(--reg-ink)/0.7)] hover:bg-[rgb(var(--reg-ink)/0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]"
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
  const find = (slug: string) => m.groups.find((g) => g.slug === slug);
  const calendar = find("calendar");
  const clients = find("clients");
  const sales = find("sales");
  // Clients and Sales go straight to their main page (first item), not the section list.
  const direct = (g?: NavGroup) => (g ? (g.items?.[0] ? m.getPath(g.items[0].path) : m.groupHref(g)) : null);

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
          {calendar && tab(m.groupHref(calendar), t("common.calendar"), calendar.icon, m.groupActive(calendar))}
          {clients && tab(direct(clients), t("common.clients"), clients.icon, m.groupActive(clients))}
          {calendar && (
            <li className="flex flex-1 justify-center">
              {/* The calendar opens its booking form on ?new=1. */}
              <button
                type="button"
                onClick={() => m.navigate(`${m.groupHref(calendar)}?new=1`)}
                aria-label={t("common.newBooking")}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--reg-ink))] text-white shadow-[0_8px_20px_-8px_rgb(var(--reg-ink)/0.6)] transition active:scale-95"
              >
                <Plus size={22} strokeWidth={2.25} />
              </button>
            </li>
          )}
          {sales && tab(direct(sales), t("common.sales"), sales.icon, m.groupActive(sales))}
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
            {(() => {
              // Single pages (Calendar, Messages, Reports…) share one card; each group gets its own.
              const singles = m.groups.filter((g) => !g.items?.length);
              const row = (href: string, label: string, Icon: React.ElementType) => {
                const on = m.matches(href);
                return (
                  <li key={href} className="border-b border-[rgb(var(--reg-line)/0.6)] last:border-0">
                    <NavLink
                      to={href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={on ? "page" : undefined}
                      className={cn("flex min-h-[48px] items-center gap-3 px-4 text-[15px] font-semibold", on && "text-[rgb(var(--reg-brand-strong))]")}
                    >
                      <Icon size={18} strokeWidth={1.75} className={on ? "text-[rgb(var(--reg-brand))]" : "text-[rgb(var(--reg-ink)/0.5)]"} aria-hidden />
                      {label}
                    </NavLink>
                  </li>
                );
              };
              const card = "overflow-hidden rounded-2xl bg-white ring-1 ring-[rgb(var(--reg-line))]";
              return (
                <>
                  <ul className={card}>
                    {singles.map((g) => row(m.groupHref(g), g.label, g.icon))}
                    {m.hasSettings && row(m.getPath("/setup"), t("nav.settings"), SettingsIcon)}
                  </ul>
                  {m.groups.filter((g) => g.items?.length).map((g) => {
                    const Icon = g.icon;
                    return (
                      <section key={g.slug}>
                        <p className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted))]">
                          <Icon size={14} aria-hidden /> {g.label}
                        </p>
                        <ul className={card}>{g.items!.map((i) => row(m.getPath(i.path), i.label, i.icon))}</ul>
                      </section>
                    );
                  })}
                </>
              );
            })()}
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
