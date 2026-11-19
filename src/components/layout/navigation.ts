import type React from "react";
import type { Id } from "@/types/id";
import {
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Coins,
  Clock,
  CreditCard,
  GitCompare,
  Gift,
  History,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  Landmark,
  Mail,
  MapPin,
  Megaphone,
  Network,
  Package,
  Palette,
  Percent,
  PiggyBank,
  Plug,
  Receipt,
  Rocket,
  Scissors,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Stamp,
  Star,
  Store,
  Tags,
  Table2,
  Target,
  Truck,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import { useFeatureFlags } from "@/services/platformService";
import { t, type TKey } from "@/i18n";

/**
 * The manager app's menu, the settings map and who may open what. Kept out of Sidebar.tsx
 * so that file exports only components (fast refresh needs that); the sidebar, the phone
 * drawer, the settings hub, the quick search and the route guard all read from here.
 *
 * IA (2026-11-19, business/product/hub-ia-2026-11-19.md, v3): grouped by the owner's day,
 * not by the backlog. Every page has exactly one home; a category opens a page of cards, and
 * Settings is one page of grouped cards, so the rail stays short.
 */

export interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  /** One line saying what the page is for, shown on the section page and in search. */
  description?: string;
  /**
   * The platform flag this page needs, if any.
   *
   * A feature the platform has switched off should not be a menu item that leads to an
   * empty screen — and switching it back on should not need a release.
   */
  flag?: string;
  /** Only a team member has this page: hidden from an owner with no team record here. */
  staffOnly?: boolean;
  /** The i18n key of the label: quick search matches it in every language. */
  labelKey?: TKey;
}

/**
 * A rail link. With `pages`, it is a category: the rail shows one link that opens a page of
 * cards (one per page, SectionPage), and each page shows "Category › Page" to go back.
 */
export interface NavEntry extends NavItem {
  slug: string;
  pages?: NavItem[];
}

/** A block of the rail, optionally under a small label. */
export interface NavSection {
  slug: string;
  key?: TKey;
  entries: NavEntry[];
}

// Labels are getters, read at render time: the menu is built once at import, before the
// panel's language has loaded, so a plain value would freeze the wrong language. (Spreading
// a getter would evaluate it, hence these builders rather than `...{ get label() }`.)
function item(icon: React.ElementType, label: TKey, path: string, hint?: TKey, extra: Partial<NavItem> = {}): NavItem {
  return {
    icon,
    path,
    labelKey: label,
    ...extra,
    get label() { return t(label); },
    get description() { return hint ? t(hint) : undefined; },
  };
}
function entry(slug: string, base: NavItem, pages?: NavItem[], landing?: string): NavEntry {
  const e = base as NavEntry;
  e.slug = slug;
  if (pages) {
    e.pages = pages;
    // A category whose first page already is a page of blocks (Reports' dashboard of
    // tiles) opens on that page instead of a card page.
    e.path = landing ?? categoryPath(slug);
  }
  return e;
}

/** Where a category's card page lives. */
export const categoryPath = (slug: string) => `/section/${slug}`;

/**
 * The rail, v3 (2026-11-19, business/product/hub-ia-2026-11-19.md). The three things a salon
 * does all day (calendar, messages, till) are direct links; everything else is a category
 * that opens a page of cards — the owner sees what is inside before choosing. No tabs.
 */
export const NAV: NavSection[] = [
  {
    slug: "today",
    entries: [
      entry("calendar", item(CalendarDays, "nav.calendar", "/calendar")),
      entry("my-day", item(CalendarCheck, "nav.myDay", "/my-day", "myDay.navHint", { staffOnly: true })),
      entry("inbox", item(Inbox, "nav.inbox", "/inbox", "inbox.navDescription")),
      entry("sales", item(Receipt, "nav.till", "/sales", "layout.ringUpAVisitTake")),
    ],
  },
  {
    slug: "business",
    key: "common.business",
    entries: [
      entry("clients", item(Users, "nav.g.clients", "/clients", "nav.cat.clients"), [
        item(Users, "nav.allClients", "/clients", "layout.everyoneWhoHasBookedWith"),
        item(ClipboardList, "nav.forms", "/setup/consent-forms", "consentForms.hint"),
      ]),
      entry("payments", item(Landmark, "nav.g.sales", "/money", "nav.cat.payments"), [
        item(Landmark, "nav.payments", "/money", "layout.payoutsTipsTheCashDrawer"),
        item(ShoppingBag, "nav.shopOrders", "/shop-orders", "onlineSales.navOrdersHint"),
        item(Gift, "nav.giftCards", "/gift-cards", "onlineSales.navGiftCardsHint"),
        item(PiggyBank, "expenses.title", "/expenses", "expenses.navHint"),
      ]),
      entry("marketing", item(Megaphone, "nav.g.marketing", "/marketing", "nav.cat.marketing"), [
        item(Megaphone, "nav.campaigns", "/marketing", "layout.messagesToClientsAndPromo"),
        item(Percent, "nav.offers", "/offers", "layout.cutAPriceItShows"),
        item(Stamp, "nav.loyalty", "/loyalty", "layout.comeNTimesOneService", { flag: "loyalty_cards" }),
        item(Gift, "nav.referrals", "/referral-program", "layout.yourCodeAndTheClients", { flag: "platform_referral" }),
        item(Star, "nav.reviews", "/reviews", "layout.readFeedbackReplyToIt"),
        item(Rocket, "nav.promotion", "/promotion", "layout.payToAppearAtThe"),
      ]),
      entry("team", item(UsersRound, "nav.g.team", "/staff", "nav.cat.team"), [
        item(UsersRound, "layout.teamMembers", "/staff", "layout.whoWorksHereTheirServices"),
        item(Clock, "timesheet.title", "/timesheet", "timesheet.navHint"),
        item(Coins, "payroll.title", "/payroll", "payroll.navHint"),
        item(Target, "nav.targets", "/staff-targets", "layout.staffTargetsHint"),
      ]),
      entry("inventory", item(Boxes, "nav.g.inventory", "/inventory", "nav.cat.inventory"), [
        item(Package, "nav.products", "/inventory", "layout.stockLevelsAndReorderPoints"),
        item(ClipboardCheck, "nav.stockCount", "/inventory/count", "nav.hint.stockCount"),
        item(Truck, "inventory.suppliersAndOrders", "/inventory/suppliers", "nav.hint.suppliers"),
      ]),
      entry("reports", item(BarChart3, "nav.reports", "/analytics", "nav.cat.reports"), [
        item(BarChart3, "nav.overview", "/analytics", "layout.revenueBookingsAndClientTrends"),
        item(Table2, "nav.reportBuilder", "/report-builder", "nav.hint.reportBuilder"),
      ], "/analytics"),
      entry("branches", item(Network, "nav.g.branches", "/locations", "nav.cat.branches"), [
        item(MapPin, "nav.allLocations", "/locations", "nav.hint.locations"),
        item(GitCompare, "nav.compare", "/branch-comparison", "nav.hint.compare"),
      ]),
    ],
  },
];

/* ── settings: one hub, its own sub-nav ─────────────────────────────────── */

export interface SettingRow {
  label: string;
  labelKey: TKey;
  hint: string;
  path: string;
  icon: React.ElementType;
}

export interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  rows: SettingRow[];
}

const R = (label: TKey, hint: TKey, path: string, icon: React.ElementType): SettingRow => ({
  get label() { return t(label); },
  get hint() { return t(hint); },
  labelKey: label,
  path,
  icon,
});
function S(id: string, title: TKey, description: TKey, icon: React.ElementType, rows: SettingRow[]): SettingsSection {
  return { id, icon, rows, get title() { return t(title); }, get description() { return t(description); } };
}

/**
 * Every setting, once, in groups. The Settings page shows each group as a block of cards;
 * a settings page shows "Settings › Page" to go back. Daily work stays in the rail.
 */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  S("business", "common.business", "setup.whoYouAreAndWhere", Store, [
    R("common.businessProfile", "setup.nameCategoryDescriptionContact", "/business", Store),
    R("common.photos", "setup.coverLogoAndGallery", "/photos", ImageIcon),
    R("common.openingHours", "setup.weeklyHoursClosedDays", "/business-hours", Clock),
    R("nav.set.branding", "setup.yourColourTheLineUnder", "/branding", Palette),
  ]),
  S("booking", "nav.set.bookingGroup", "setup.howAndWhenClientsCan", CalendarClock, [
    R("setup.onlineBooking", "setup.onOrOffNoticeHow", "/setup/online-booking", CalendarClock),
    R("nav.set.cancellation", "setup.howLateAClientCan", "/setup/cancellation", Shield),
  ]),
  S("catalogue", "nav.set.catalogue", "layout.whatYouSellHowLong", Scissors, [
    R("nav.services", "layout.whatYouSellHowLong", "/items-category", Scissors),
    R("nav.addons", "layout.extrasYouAddToA", "/addons", Sparkles),
    R("nav.centralPrices", "nav.hint.centralPrices", "/central-prices", Tags),
  ]),
  S("money", "nav.set.paymentsGroup", "setup.clientsPayWhenTheyVisit", CreditCard, [
    R("bookingRules.paymentMethods", "setup.paymentMethodsHint", "/setup/payment-methods", CreditCard),
    R("setup.currencyTax", "setup.whatYourPricesAreIn", "/setup/currency-tax", Receipt),
    R("nav.set.onlineSales", "onlineSales.navSettingsHint", "/setup/online-sales", Gift),
    R("billing.navRow", "billing.navHint", "/billing", Wallet),
  ]),
  S("notifications", "setup.notifications", "setup.whatClientsHearFromYou", Bell, [
    R("setup.emailReminders", "setup.confirmationsAndReminderTiming", "/setup/email", Mail),
    R("setup.smsPush", "setup.textsAndAppNotifications", "/setup/sms-push", Smartphone),
  ]),
  S("team", "nav.set.teamRoles", "setup.whatEachRoleCanDo", ShieldCheck, [
    R("setup.rolesPermissions", "setup.whatEachRoleCanDo", "/roles", ShieldCheck),
  ]),
  // FG-W5-11: owner-only; the pages guard themselves and the server refuses everyone else.
  S("integrations", "nav.set.integrations", "nav.set.integrationsHint", Plug, [
    R("nav.set.apiKeysRow", "nav.hint.apiKeysRow", "/integrations", KeyRound),
    R("nav.apiDocs", "nav.hint.apiDocs", "/api-docs", BookOpen),
  ]),
  S("security", "nav.set.securityAudit", "nav.set.securityHint", KeyRound, [
    R("setup.passwordSecurity", "setup.changeYourPassword", "/security", KeyRound),
    R("auditLog.title", "layout.auditLogHint", "/audit-log", History),
  ]),
];

/** The settings icon, for the rail foot and search. */
export const SettingsIcon = Settings;

/** Settings the person may open (the hub, the sub-nav and search all use this). */
export function useVisibleSettings(): SettingsSection[] {
  const access = myAccess();
  return SETTINGS_SECTIONS.map((s) => ({ ...s, rows: s.rows.filter((r) => pageAllowed(access, r.path)) })).filter((s) => s.rows.length);
}

/** True when this salon-relative path ("/setup/email") belongs to Settings. */
export function isSettingsPath(path: string): boolean {
  return path === "/setup" || SETTINGS_SECTIONS.some((s) => s.rows.some((r) => r.path === path));
}

/* ── quick search: things that live inside a page ───────────────────────── */

/**
 * Features that are a card or a tab inside a page, not a page of their own. Search finds
 * them by name and opens the page that holds them. `key` is under nav.find.* in every
 * locale; search matches all three languages at once.
 */
export const SEARCH_EXTRAS: { key: string; path: string; icon: React.ElementType; /** Outside the salon (no salon key). */ absolute?: boolean }[] = [
  { key: "newBooking", path: "/calendar?new=1", icon: CalendarDays },
  { key: "waitlist", path: "/calendar", icon: CalendarDays },
  { key: "paymentLinks", path: "/calendar", icon: CreditCard },
  { key: "quickSale", path: "/sales", icon: Receipt },
  { key: "giftCards", path: "/gift-cards", icon: Gift },
  { key: "onlineSales", path: "/setup/online-sales", icon: Gift },
  { key: "shopOrders", path: "/shop-orders", icon: ShoppingBag },
  { key: "wallet", path: "/clients", icon: Wallet },
  { key: "memberships", path: "/sales", icon: Stamp },
  { key: "invoices", path: "/money", icon: Landmark },
  { key: "tips", path: "/money", icon: Landmark },
  { key: "cashDrawer", path: "/money", icon: Landmark },
  { key: "deposits", path: "/money", icon: Landmark },
  { key: "debts", path: "/clients", icon: Users },
  { key: "clientTags", path: "/clients", icon: Users },
  { key: "promoCodes", path: "/marketing", icon: Megaphone },
  { key: "automations", path: "/marketing", icon: Megaphone },
  { key: "loyaltyTiers", path: "/marketing", icon: Stamp },
  { key: "packages", path: "/items-category", icon: Scissors },
  { key: "peakPricing", path: "/items-category", icon: Scissors },
  { key: "stockLocations", path: "/inventory", icon: Package },
  { key: "shifts", path: "/staff", icon: UsersRound },
  { key: "commissions", path: "/staff", icon: UsersRound },
  { key: "chairRental", path: "/staff", icon: UsersRound },
  { key: "resources", path: "/staff", icon: UsersRound },
  { key: "revenuePlan", path: "/analytics/revenue", icon: BarChart3 },
  { key: "savedReports", path: "/report-builder", icon: Table2 },
  { key: "apiKeys", path: "/integrations", icon: KeyRound },
  { key: "webhooks", path: "/integrations", icon: Plug },
  { key: "slotOffers", path: "/setup/online-booking", icon: CalendarClock },
  { key: "googleReview", path: "/setup/online-booking", icon: Star },
  { key: "messageTexts", path: "/setup/email", icon: Mail },
  { key: "addSalon", path: "/create-business", icon: Store, absolute: true },
];

/** Opens the quick search from anywhere (a button, the phone drawer); ⌘K / Ctrl+K also do. */
export const QUICK_SEARCH_EVENT = "booqi:quick-search";
export function openQuickSearch(): void {
  window.dispatchEvent(new Event(QUICK_SEARCH_EVENT));
}

/**
 * The rail with switched-off features and pages the role leaves out removed. A category
 * with one page left for this person links straight to that page (a card page of one card
 * is just an extra click).
 */
export function useVisibleNav(): NavSection[] {
  const flags = useFeatureFlags();
  const access = myAccess();
  const ok = (i: NavItem) =>
    (!i.flag || flags[i.flag] !== false) && pageAllowed(access, i.path) && (!i.staffOnly || myStaffRecord() !== undefined);
  return NAV.map((sec) => ({
    ...sec,
    entries: sec.entries
      .map((e): NavEntry | null => {
        if (!e.pages) return ok(e) ? e : null;
        const pages = e.pages.filter(ok);
        if (!pages.length) return null;
        const path = pages.length === 1 ? pages[0].path : e.path;
        return Object.defineProperties({ ...e, path, pages } as NavEntry, {
          label: { get: () => e.label, enumerable: true },
          description: { get: () => e.description, enumerable: true },
        });
      })
      .filter((e): e is NavEntry => e !== null),
  })).filter((sec) => sec.entries.length);
}

/** Where a page sits: its category (or Settings) and the page itself, for "Category › Page". */
export interface TrailInfo {
  parentLabel: string;
  parentPath: string;
  label: string;
}

/**
 * The trail for this salon-relative path, or null on a page that is not inside a category
 * (Calendar, Till, a category's own card page). The longest matching page wins, so
 * /inventory/count is Stock count, not Products.
 */
export function usePageTrail(rel: string): TrailInfo | null {
  const sections = useVisibleNav();
  const settings = useVisibleSettings();
  const bare = rel.split("?")[0];
  const hit = (p: string) => bare === p || bare.startsWith(p + "/");
  let best: { len: number; trail: TrailInfo } | null = null;
  for (const e of sections.flatMap((s) => s.entries)) {
    if (!e.pages || e.pages.length < 2) continue;
    for (const p of e.pages) {
      // The category's own landing page has no trail, nor do the pages under it (Reports'
      // drill-downs draw their own).
      if (p.path === e.path) continue;
      if (hit(p.path) && (!best || p.path.length > best.len)) {
        best = { len: p.path.length, trail: { parentLabel: e.label, parentPath: e.path, label: p.label } };
      }
    }
  }
  if (best) return best.trail;
  for (const s of settings) {
    const r = s.rows.find((x) => x.path === bare);
    if (r) return { parentLabel: t("nav.settings"), parentPath: `/setup?focus=${s.id}`, label: r.label };
  }
  return null;
}

/** /section/<slug> addresses that are not a category (v1 group pages) → where they live now. */
export const SECTION_REDIRECTS: Record<string, string> = {
  calendar: "/calendar",
  sales: "/sales",
  catalogue: "/items-category",
  business: "/setup",
  settings: "/setup",
};

export interface MyAccess {
  isOwner: boolean;
  roleName: string;
  permissions: string[];
}

/** What the signed-in person may do in the open salon: the owner, or a team member's role. */
export function myAccess(): MyAccess {
  try {
    const raw = localStorage.getItem("currentBusiness");
    // Nothing chosen yet: show nothing extra (the server decides either way).
    if (!raw) return { isOwner: false, roleName: "", permissions: [] };
    const b = JSON.parse(raw);
    // An entry cached before roles existed has no myPermissions: only owners had one then.
    if (b?.isOwner || !Array.isArray(b?.myPermissions)) {
      return { isOwner: true, roleName: "Owner", permissions: [] };
    }
    return { isOwner: false, roleName: b.myRole || "Staff", permissions: b.myPermissions };
  } catch {
    return { isOwner: true, roleName: "Owner", permissions: [] };
  }
}

/** The team-member record this person has in the open salon, if any (an owner usually has none). */
export function myStaffRecord(): Id | undefined {
  try {
    const b = JSON.parse(localStorage.getItem("currentBusiness") || "{}") as { myStaffId?: Id };
    return b.myStaffId || undefined;
  } catch {
    return undefined;
  }
}

export function hasPermission(access: MyAccess, permission: string): boolean {
  return access.isOwner || access.permissions.includes(permission);
}

// Which permission opens which page. The server enforces the same permissions; hiding
// what a role leaves out keeps people from opening pages that would only say no.
// null = owner only. A page not listed is open to everyone on the team.
const PAGE_NEEDS: Record<string, string[] | null> = {
  "/sales": ["TILL", "SALES_VIEW"],
  "/analytics": ["ANALYTICS"],
  "/report-builder": ["ANALYTICS"],
  // FG-W5-11: keys and webhooks hand out the salon's data; the server allows the owner only.
  "/integrations": null,
  "/api-docs": null,
  "/money": ["MONEY"],
  "/gift-cards": ["TILL", "SALES_VIEW"],
  "/shop-orders": ["TILL"],
  "/setup/online-sales": ["SETTINGS"],
  "/payroll": ["MONEY"],
  "/expenses": ["MONEY"],
  "/promotion": null,
  "/billing": null,
  "/clients": ["CLIENTS_VIEW"],
  "/referral-program": ["MARKETING"],
  "/marketing": ["MARKETING"],
  "/offers": ["MARKETING"],
  "/loyalty": ["MARKETING"],
  "/items-category": ["CATALOG"],
  "/addons": ["CATALOG"],
  "/inventory": ["CATALOG"],
  "/staff": ["TEAM"],
  "/staff-targets": ["TEAM"],
  "/add-staff": ["TEAM"],
  "/edit-staff": ["TEAM"],
  "/roles": null,
  "/business": ["SETTINGS"],
  "/setup/consent-forms": ["SETTINGS"],
  "/photos": ["SETTINGS"],
  "/branding": ["SETTINGS"],
  "/business-hours": ["SETTINGS"],
  "/setup": ["SETTINGS"],
  "/audit-log": null,
  "/booking-rules": ["SETTINGS"],
  "/notifications": ["SETTINGS"],
  "/locations": ["SETTINGS"],
  "/branch-comparison": ["ANALYTICS"],
  "/central-prices": ["CATALOG"],
};

export function pageAllowed(access: MyAccess, path?: string): boolean {
  if (!path || access.isOwner) return true;
  // "/setup/email" is ruled by "/setup" unless it has a rule of its own (the route guard
  // already reads the first segment; the menu now does too).
  const bare = path.split("?")[0];
  const key = bare in PAGE_NEEDS ? bare : "/" + (bare.split("/").filter(Boolean)[0] ?? "");
  if (!(key in PAGE_NEEDS)) return true;
  const needs = PAGE_NEEDS[key];
  return needs !== null && needs.some((p) => access.permissions.includes(p));
}

/** For the route guard: the page at this address is one the person's role leaves out. */
export function pageClosedToRole(access: MyAccess, path: string): boolean {
  const top = "/" + (path.split("/").filter(Boolean)[1] ?? "");
  return !pageAllowed(access, top);
}

