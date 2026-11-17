import type React from "react";
import {
  Clock,
  Receipt,
  Wallet,
  Users,
  ShieldCheck,
  Package,
  Clock as ClockIcon,
  Gift,
  Percent,
  Landmark,
  Megaphone,
  Image as ImageIcon,
  MessageSquareText,
  Stamp,
  Rocket,
} from "lucide-react";
import { useFeatureFlags } from "@/services/platformService";
import {
  CalendarIcon,
  TaskIcon,
  ItemCategoryIcon,
  MarketingIcon,
  CouponIcon,
  AnalyticsIcon,
  StaffIcon,
  BusinessIcon,
  SettingsIcon,
  HelpIcon,
} from "./navIcons";
import { t } from "@/i18n";

/**
 * The manager app's menu and who may open what. Kept out of Sidebar.tsx so that file
 * exports only components (fast refresh needs that); the Sidebar, the section pages and
 * the route guard all read the menu and the role rules from here.
 */

// Custom Globe Icon Component
export interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  /** One line saying what the page is for, shown on the section page. */
  description?: string;
  /**
   * The platform flag this page needs, if any.
   *
   * A feature the platform has switched off should not be a menu item that leads to an
   * empty screen — and switching it back on should not need a release.
   */
  flag?: string;
}

/**
 * The rail is grouped, not a list of fifteen icons.
 *
 * Everything was flat and in no particular order — Inventory next to Add-ons, Reviews
 * three rows from Clients, Hours nowhere near Staff — so finding a page meant hovering
 * along the rail reading tooltips. A group opens a panel with its pages named, which is
 * the only way a nav this size stays learnable.
 */
export interface NavGroup {
  icon: React.ElementType;
  label: string;
  slug: string;
  /** Groups with one destination navigate straight there. */
  path?: string;
  items?: NavItem[];
}

// Language options for flag display
/**
 * The nav, in one place. The rail and the section pages both read it, so a page cannot
 * exist in one and be missing from the other — which is how half these screens ended up
 * unreachable.
 */
export const navGroups: NavGroup[] = [
  { icon: CalendarIcon, get label() { return t("common.calendar"); }, slug: "calendar", path: "/calendar" },
  {
    icon: TaskIcon,
    get label() { return t("common.sales"); },
    slug: "sales",
    items: [
      { icon: TaskIcon, get label() { return t("common.till"); }, path: "/sales", get description() { return t("layout.ringUpAVisitTake"); } },
      { icon: AnalyticsIcon, get label() { return t("layout.analytics"); }, path: "/analytics", get description() { return t("layout.revenueBookingsAndClientTrends"); } },
      { icon: Landmark, get label() { return t("common.money"); }, path: "/money", get description() { return t("layout.payoutsTipsTheCashDrawer"); } },
      { icon: Wallet, get label() { return t("payroll.title"); }, path: "/payroll", get description() { return t("payroll.navHint"); } },
      { icon: Receipt, get label() { return t("expenses.title"); }, path: "/expenses", get description() { return t("expenses.navHint"); } },
      { icon: Rocket, get label() { return t("layout.promotion"); }, path: "/promotion", get description() { return t("layout.payToAppearAtThe"); } },
    ],
  },
  {
    icon: Users,
    get label() { return t("common.clients"); },
    slug: "clients",
    items: [
      { icon: Users, get label() { return t("layout.allClients"); }, path: "/clients", get description() { return t("layout.everyoneWhoHasBookedWith"); } },
      { icon: MessageSquareText, get label() { return t("common.reviews"); }, path: "/reviews", get description() { return t("layout.readFeedbackReplyToIt"); } },
    ],
  },
  {
    // Growing the book of clients, apart from the clients themselves: these five used to
    // sit under Clients, so "who are my clients" and "how do I get more" were one list.
    icon: Megaphone,
    get label() { return t("layout.marketing"); },
    slug: "marketing",
    items: [
      { icon: MarketingIcon, get label() { return t("layout.campaignsCodes"); }, path: "/marketing", get description() { return t("layout.messagesToClientsAndPromo"); } },
      { icon: Percent, get label() { return t("common.offers"); }, path: "/offers", get description() { return t("layout.cutAPriceItShows"); } },
      { icon: Stamp, get label() { return t("common.loyalty"); }, path: "/loyalty", get description() { return t("layout.comeNTimesOneService"); }, flag: "loyalty_cards" },
      { icon: Gift, get label() { return t("common.referrals"); }, path: "/referral-program", get description() { return t("layout.yourCodeAndTheClients"); }, flag: "platform_referral" },
    ],
  },
  {
    icon: ItemCategoryIcon,
    get label() { return t("layout.catalogue"); },
    slug: "catalogue",
    items: [
      { icon: ItemCategoryIcon, get label() { return t("common.services"); }, path: "/items-category", get description() { return t("layout.whatYouSellHowLong"); } },
      { icon: Package, get label() { return t("layout.addOns"); }, path: "/addons", get description() { return t("layout.extrasYouAddToA"); } },
      // #26: real stock with SKUs and reorder levels, not add-on management.
      { icon: Package, get label() { return t("layout.inventory"); }, path: "/inventory", get description() { return t("layout.stockLevelsAndReorderPoints"); } },
    ],
  },
  {
    icon: StaffIcon,
    get label() { return t("common.team"); },
    slug: "team",
    items: [
      { icon: Users, get label() { return t("layout.teamMembers"); }, path: "/staff", get description() { return t("layout.whoWorksHereTheirServices"); } },
      { icon: ShieldCheck, get label() { return t("layout.roles"); }, path: "/roles", get description() { return t("layout.whatEachRoleCanSee"); } },
      { icon: Clock, get label() { return t("timesheet.title"); }, path: "/timesheet", get description() { return t("timesheet.navHint"); } },
    ],
  },
  {
    icon: SettingsIcon,
    get label() { return t("common.business"); },
    slug: "business",
    items: [
      { icon: BusinessIcon, get label() { return t("common.businessProfile"); }, path: "/business", get description() { return t("layout.nameAddressAndContactDetails"); } },
      { icon: ImageIcon, get label() { return t("common.photos"); }, path: "/photos", get description() { return t("layout.coverLogoAndGalleryCustomers"); } },
      { icon: ClockIcon, get label() { return t("common.openingHours"); }, path: "/business-hours", get description() { return t("layout.whenTheSalonIsOpen"); } },
      { icon: SettingsIcon, get label() { return t("layout.settings"); }, path: "/setup", get description() { return t("layout.bookingRulesDepositsPaymentsNotifications"); } },
    ],
  },
];

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
  return navGroups
    .filter((group) => group.items || allowed(group.path))
    .map((group) =>
      group.items ? { ...group, items: group.items.filter((item) => on(item.flag) && allowed(item.path)) } : group
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
  "/add-staff": ["TEAM"],
  "/edit-staff": ["TEAM"],
  "/roles": null,
  "/business": ["SETTINGS"],
  "/photos": ["SETTINGS"],
  "/branding": ["SETTINGS"],
  "/business-hours": ["SETTINGS"],
  "/setup": ["SETTINGS"],
};

export function pageAllowed(access: MyAccess, path?: string): boolean {
  if (!path || access.isOwner) return true;
  if (!(path in PAGE_NEEDS)) return true;
  const needs = PAGE_NEEDS[path];
  return needs !== null && needs.some((p) => access.permissions.includes(p));
}

/** For the route guard: the page at this address is one the person's role leaves out. */
export function pageClosedToRole(access: MyAccess, path: string): boolean {
  const top = "/" + (path.split("/").filter(Boolean)[1] ?? "");
  return !pageAllowed(access, top);
}

