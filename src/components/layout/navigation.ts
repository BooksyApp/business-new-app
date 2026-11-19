import type React from "react";
import type { Id } from "@/types/id";
import {
  BarChart3,
  Bell,
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
  LifeBuoy,
  Mail,
  MapPin,
  Megaphone,
  Network,
  Package,
  Palette,
  Percent,
  PiggyBank,
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
 * IA (2026-11-19, business/product/hub-ia-2026-11-19.md): grouped by the owner's day, not
 * by the backlog. Every page has exactly one home; Settings is one hub with its own
 * sub-nav, so the rail stays short.
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

/** A rail entry: one page (`path`) or a collapsible group of pages (`items`). */
export interface NavGroup {
  icon: React.ElementType;
  label: string;
  slug: string;
  /** Groups with one destination navigate straight there. */
  path?: string;
  items?: NavItem[];
  /** Only a team member has this page (single-page entries). */
  staffOnly?: boolean;
  labelKey?: TKey;
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
function group(icon: React.ElementType, label: TKey, slug: string, rest: Omit<NavGroup, "icon" | "label" | "slug">): NavGroup {
  return { icon, slug, labelKey: label, ...rest, get label() { return t(label); } };
}

/**
 * The rail, top to bottom. The phone drawer and the section pages read the same list, so a
 * page cannot be in one and missing from the other.
 */
export const navGroups: NavGroup[] = [
  // Every day: the diary and the conversation with clients.
  group(CalendarDays, "nav.calendar", "calendar", { path: "/calendar" }),
  group(CalendarCheck, "nav.myDay", "my-day", { path: "/my-day", staffOnly: true }),
  group(Inbox, "nav.inbox", "inbox", { path: "/inbox" }),
  group(Wallet, "nav.g.sales", "sales", {
    items: [
      item(Receipt, "nav.till", "/sales", "layout.ringUpAVisitTake"),
      item(Landmark, "nav.payments", "/money", "layout.payoutsTipsTheCashDrawer"),
      item(ShoppingBag, "nav.shopOrders", "/shop-orders", "onlineSales.navOrdersHint"),
      item(Gift, "nav.giftCards", "/gift-cards", "onlineSales.navGiftCardsHint"),
      item(PiggyBank, "expenses.title", "/expenses", "expenses.navHint"),
    ],
  }),
  group(Users, "nav.g.clients", "clients", {
    items: [
      item(Users, "nav.allClients", "/clients", "layout.everyoneWhoHasBookedWith"),
      item(ClipboardList, "nav.forms", "/setup/consent-forms", "consentForms.hint"),
    ],
  }),
  // Getting more clients, apart from the clients themselves.
  group(Megaphone, "nav.g.marketing", "marketing", {
    items: [
      item(Megaphone, "nav.campaigns", "/marketing", "layout.messagesToClientsAndPromo"),
      item(Percent, "nav.offers", "/offers", "layout.cutAPriceItShows"),
      item(Stamp, "nav.loyalty", "/loyalty", "layout.comeNTimesOneService", {flag: "loyalty_cards"}),
      item(Gift, "nav.referrals", "/referral-program", "layout.yourCodeAndTheClients", {flag: "platform_referral"}),
      item(Star, "nav.reviews", "/reviews", "layout.readFeedbackReplyToIt"),
      item(Rocket, "nav.promotion", "/promotion", "layout.payToAppearAtThe"),
    ],
  }),
  // Running the business.
  group(Scissors, "nav.g.catalogue", "catalogue", {
    items: [
      item(Scissors, "nav.services", "/items-category", "layout.whatYouSellHowLong"),
      item(Sparkles, "nav.addons", "/addons", "layout.extrasYouAddToA"),
    ],
  }),
  group(Boxes, "nav.g.inventory", "inventory", {
    items: [
      item(Package, "nav.products", "/inventory", "layout.stockLevelsAndReorderPoints"),
      item(ClipboardCheck, "nav.stockCount", "/inventory/count", "nav.hint.stockCount"),
      item(Truck, "inventory.suppliersAndOrders", "/inventory/suppliers", "nav.hint.suppliers"),
    ],
  }),
  group(UsersRound, "nav.g.team", "team", {
    items: [
      item(UsersRound, "layout.teamMembers", "/staff", "layout.whoWorksHereTheirServices"),
      item(Clock, "timesheet.title", "/timesheet", "timesheet.navHint"),
      item(Coins, "payroll.title", "/payroll", "payroll.navHint"),
      item(Target, "nav.targets", "/staff-targets", "layout.staffTargetsHint"),
    ],
  }),
  group(BarChart3, "nav.reports", "reports", { path: "/analytics" }),
  group(Network, "nav.g.branches", "branches", {
    items: [
      item(MapPin, "nav.allLocations", "/locations", "nav.hint.locations"),
      item(GitCompare, "nav.compare", "/branch-comparison", "nav.hint.compare"),
      item(Tags, "nav.centralPrices", "/central-prices", "nav.hint.centralPrices"),
    ],
  }),
];

/** How the rail is sectioned (headings on a desktop). Settings sits at the foot, not here. */
export const NAV_SECTIONS: { key: TKey; slugs: string[] }[] = [
  { key: "common.daily", slugs: ["calendar", "my-day", "inbox", "sales", "clients"] },
  { key: "layout.grow", slugs: ["marketing"] },
  { key: "nav.sec.manage", slugs: ["catalogue", "inventory", "team", "reports", "branches"] },
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

/**
 * Every setting, once. A row is a screen that changes how the salon behaves; the daily
 * work (calendar, till, catalogue, team) lives in the rail.
 */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "business",
    get title() { return t("nav.set.salon"); },
    get description() { return t("setup.whoYouAreAndWhere"); },
    icon: Store,
    rows: [
      R("common.businessProfile", "setup.nameCategoryDescriptionContact", "/business", Store),
      R("common.photos", "setup.coverLogoAndGallery", "/photos", ImageIcon),
      R("common.openingHours", "setup.weeklyHoursClosedDays", "/business-hours", Clock),
      R("setup.brandColourReceiptFooter", "setup.yourColourTheLineUnder", "/branding", Palette),
    ],
  },
  {
    id: "booking",
    get title() { return t("setup.onlineBooking"); },
    get description() { return t("setup.howAndWhenClientsCan"); },
    icon: CalendarClock,
    rows: [
      R("nav.set.bookingRules", "setup.onOrOffNoticeHow", "/setup/online-booking", CalendarClock),
      R("nav.set.cancellation", "setup.howLateAClientCan", "/setup/cancellation", Shield),
    ],
  },
  {
    id: "money",
    get title() { return t("nav.set.payments"); },
    get description() { return t("setup.clientsPayWhenTheyVisit"); },
    icon: CreditCard,
    rows: [
      R("bookingRules.paymentMethods", "setup.paymentMethodsHint", "/setup/payment-methods", CreditCard),
      R("setup.currencyTax", "setup.whatYourPricesAreIn", "/setup/currency-tax", Receipt),
      R("nav.set.onlineSales", "onlineSales.navSettingsHint", "/setup/online-sales", Gift),
    ],
  },
  {
    id: "notifications",
    get title() { return t("setup.notifications"); },
    get description() { return t("setup.whatClientsHearFromYou"); },
    icon: Bell,
    rows: [
      R("setup.emailReminders", "setup.confirmationsAndReminderTiming", "/setup/email", Mail),
      R("setup.smsPush", "setup.textsAndAppNotifications", "/setup/sms-push", Smartphone),
    ],
  },
  {
    id: "access",
    get title() { return t("nav.set.access"); },
    get description() { return t("nav.set.accessHint"); },
    icon: ShieldCheck,
    rows: [
      R("setup.rolesPermissions", "setup.whatEachRoleCanDo", "/roles", ShieldCheck),
      R("auditLog.title", "layout.auditLogHint", "/audit-log", History),
    ],
  },
  {
    id: "account",
    get title() { return t("setup.account"); },
    get description() { return t("setup.yourOwnSignIn"); },
    icon: KeyRound,
    rows: [
      R("setup.passwordSecurity", "setup.changeYourPassword", "/security", KeyRound),
      R("setup.support", "setup.supportHint", "/support", LifeBuoy),
    ],
  },
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
  return path === "/setup" || SETTINGS_SECTIONS.some((s) => s.rows.some((r) => r.path === path)) || path === "/notifications" || path === "/booking-rules";
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
  { key: "revenuePlan", path: "/analytics", icon: BarChart3 },
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
 * The nav with the switched-off features removed.
 *
 * Both the rail and the section pages read this rather than `navGroups` directly, so a
 * page the platform has turned off cannot be reachable from one and missing from the
 * other — which is exactly how half these screens became unreachable the first time.
 */
export function useVisibleNavGroups(): NavGroup[] {
  const flags = useFeatureFlags();
  const access = myAccess();
  const on = (flag?: string) => !flag || flags[flag] !== false;
  const allowed = (path?: string) => pageAllowed(access, path);
  const mine = (staffOnly?: boolean) => !staffOnly || myStaffRecord() !== undefined;
  return navGroups
    .filter((group) => group.items || (allowed(group.path) && mine(group.staffOnly)))
    .map((group) =>
      group.items ? { ...group, items: group.items.filter((item) => on(item.flag) && allowed(item.path) && mine(item.staffOnly)) } : group
    )
    .filter((group) => !group.items || group.items.length > 0);
}

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
  "/money": ["MONEY"],
  "/gift-cards": ["TILL", "SALES_VIEW"],
  "/shop-orders": ["TILL"],
  "/setup/online-sales": ["SETTINGS"],
  "/payroll": ["MONEY"],
  "/expenses": ["MONEY"],
  "/promotion": null,
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

