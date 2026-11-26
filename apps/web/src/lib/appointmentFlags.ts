import {
  AlarmClock,
  BadgeCheck,
  Crown,
  Gift,
  Globe,
  Repeat,
  StickyNote,
  UserCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { t } from "@/i18n";

/**
 * The small icons on a calendar block (they replaced the big text tags).
 *
 * Every flag is derived ONLY from data the API already sends. Two have no backing field yet
 * and sit behind helpers that return false until the backend ships it:
 *   - VIP: the client list DTO has no `vip` (only GET /clients/{id}) -> `isVipClient`.
 *   - online booking: the appointment DTO has no `source` -> `isOnlineBooking`.
 */
export type FlagKey =
  | "late" | "vip" | "new" | "chosen" | "regular" | "birthday" | "group" | "paid" | "note" | "online";

export interface FlagSource {
  notes?: string | null;
  lateMinutes?: number | null;
  seriesId?: string | null;
  paymentStatus?: string | null;
  depositPaid?: boolean | null;
  isClass?: boolean;
  groupSize?: number;
  participants?: string[];
}

/** What the page knows about the client, beyond the appointment row. */
export interface FlagContext {
  /** Total visits of the client, when known. */
  visits?: number | null;
  /** The client's birthday falls on the day of this appointment. */
  birthday?: boolean;
  /** Client flagged VIP. Not in the list DTO yet: always undefined today. */
  vip?: boolean | null;
}

export interface FlagDef {
  key: FlagKey;
  Icon: LucideIcon;
  label: () => string;
  /** The only coloured flag is "late"; the rest are ink at reduced opacity. */
  tone: "ink" | "guava";
}

/** Display order = priority: what changes how you treat the booking comes first. */
export const FLAG_DEFS: FlagDef[] = [
  { key: "late", Icon: AlarmClock, label: () => t("calendar.flagLate"), tone: "guava" },
  { key: "vip", Icon: Crown, label: () => t("calendar.flagVip"), tone: "ink" },
  { key: "new", Icon: UserPlus, label: () => t("calendar.flagNew"), tone: "ink" },
  { key: "chosen", Icon: UserCheck, label: () => t("calendar.flagChosen"), tone: "ink" },
  { key: "regular", Icon: Repeat, label: () => t("calendar.flagRegular"), tone: "ink" },
  { key: "birthday", Icon: Gift, label: () => t("calendar.flagBirthday"), tone: "ink" },
  { key: "group", Icon: Users, label: () => t("calendar.flagGroup"), tone: "ink" },
  { key: "paid", Icon: BadgeCheck, label: () => t("calendar.flagPaid"), tone: "ink" },
  { key: "note", Icon: StickyNote, label: () => t("calendar.flagNote"), tone: "ink" },
  { key: "online", Icon: Globe, label: () => t("calendar.flagOnline"), tone: "ink" },
];

/** NEEDS BACKEND FIELD: `vip` on the client list rows. Returns false until it exists. */
export function isVipClient(ctx: FlagContext): boolean {
  return ctx.vip === true;
}

/** NEEDS BACKEND FIELD: booking `source` (online / salon) on the appointment. Returns false until it exists. */
export function isOnlineBooking(_a: FlagSource): boolean {
  return false;
}

/** "Requested by client" is stored as a prefix of the notes by the booking form. */
const CHOSEN_MARK = /^\s*Requested by client[.:\s-]*/i;

export function appointmentFlagKeys(a: FlagSource, ctx: FlagContext = {}): FlagKey[] {
  const notes = a.notes ?? "";
  const chosen = notes.includes("Requested by client");
  const realNote = notes.replace(CHOSEN_MARK, "").trim().length > 0;
  const on: Record<FlagKey, boolean> = {
    late: (a.lateMinutes ?? 0) > 0,
    vip: isVipClient(ctx),
    new: ctx.visits != null && ctx.visits <= 1,
    chosen,
    regular: (ctx.visits != null && ctx.visits >= 5) || !!a.seriesId,
    birthday: ctx.birthday === true,
    group: a.isClass === true || (a.groupSize ?? 0) > 1 || (a.participants?.length ?? 0) > 1,
    paid: a.paymentStatus === "PAID" || a.depositPaid === true,
    note: realNote,
    online: isOnlineBooking(a),
  };
  return FLAG_DEFS.filter((d) => on[d.key]).map((d) => d.key);
}

export const flagDef = (k: FlagKey): FlagDef => FLAG_DEFS.find((d) => d.key === k)!;
