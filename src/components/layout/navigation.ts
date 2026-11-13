import type React from "react";
import {
  Users,
  ShieldCheck,
  Package,
  Clock as ClockIcon,
  Star,
  Gift,
  Percent,
  Landmark,
  Megaphone,
  Image as ImageIcon,
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
  { icon: CalendarIcon, label: "Calendar", slug: "calendar", path: "/calendar" },
  {
    icon: TaskIcon,
    label: "Sales",
    slug: "sales",
    items: [
      { icon: TaskIcon, label: "Till", path: "/sales", description: "Ring up a visit, take payment, see today's takings" },
      { icon: AnalyticsIcon, label: "Analytics", path: "/analytics", description: "Revenue, bookings and client trends over time" },
      { icon: Landmark, label: "Money", path: "/money", description: "Payouts, tips, the cash drawer, invoices and tax" },
      { icon: Megaphone, label: "Promotion", path: "/promotion", description: "Pay to appear at the top of the lists customers browse" },
    ],
  },
  {
    icon: Users,
    label: "Clients",
    slug: "clients",
    items: [
      { icon: Users, label: "All clients", path: "/clients", description: "Everyone who has booked, with their history and spend" },
      { icon: Star, label: "Reviews", path: "/reviews", description: "Read feedback, reply to it, ask for more" },
      { icon: Gift, label: "Referrals", path: "/referral-program", description: "Your code, and the clients your clients bring in", flag: "platform_referral" },
      { icon: MarketingIcon, label: "Marketing", path: "/marketing", description: "Campaigns and promo codes" },
      { icon: Percent, label: "Offers", path: "/offers", description: "Cut a price — it shows on your card in the app and on the web" },
      { icon: Star, label: "Loyalty", path: "/loyalty", description: "Come N times, one service free — and who is collecting", flag: "loyalty_cards" },
    ],
  },
  {
    icon: ItemCategoryIcon,
    label: "Catalogue",
    slug: "catalogue",
    items: [
      { icon: ItemCategoryIcon, label: "Services", path: "/items-category", description: "What you sell, how long it takes, what it costs" },
      { icon: Package, label: "Add-ons", path: "/addons", description: "Extras a client can add to a booking" },
      // #26: real stock with SKUs and reorder levels, not add-on management.
      { icon: Package, label: "Inventory", path: "/inventory", description: "Stock levels and reorder points" },
    ],
  },
  {
    icon: StaffIcon,
    label: "Team",
    slug: "team",
    items: [
      { icon: Users, label: "Team members", path: "/staff", description: "Who works here, their services, hours and invitations" },
      { icon: ShieldCheck, label: "Roles", path: "/roles", description: "What each role can see and do — owner only" },
    ],
  },
  {
    icon: SettingsIcon,
    label: "Business",
    slug: "business",
    items: [
      { icon: BusinessIcon, label: "Business profile", path: "/business", description: "Name, address and contact details" },
      { icon: ImageIcon, label: "Photos", path: "/photos", description: "Cover, logo and gallery customers see" },
      { icon: ClockIcon, label: "Opening hours", path: "/business-hours", description: "When the salon is open, and its closed days" },
      { icon: SettingsIcon, label: "Settings", path: "/setup", description: "Booking rules, deposits, payments, notifications, branding" },
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

