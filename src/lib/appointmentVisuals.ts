import { Crown, Percent, Sparkles, Star, type LucideIcon } from "lucide-react";
import { t } from "@/i18n";

/**
 * How an appointment looks on the calendar.
 *
 * Colour used to come off a `color` field that repeated every few appointments, so two
 * different clients on the same morning could share one and the same client changed colour
 * from one week to the next. Here it is derived from the client, which makes the calendar
 * readable at a glance: the same person is the same colour, always, everywhere.
 */

const PALETTE = [
  "bg-sky-100 text-sky-900 border-sky-300",
  "bg-violet-100 text-violet-900 border-violet-300",
  "bg-emerald-100 text-emerald-900 border-emerald-300",
  "bg-amber-100 text-amber-900 border-amber-300",
  "bg-rose-100 text-rose-900 border-rose-300",
  "bg-cyan-100 text-cyan-900 border-cyan-300",
  "bg-lime-100 text-lime-900 border-lime-300",
  "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300",
  "bg-orange-100 text-orange-900 border-orange-300",
  "bg-teal-100 text-teal-900 border-teal-300",
  "bg-indigo-100 text-indigo-900 border-indigo-300",
  "bg-pink-100 text-pink-900 border-pink-300",
];

/** Same input, same colour, for the life of the client. */
export function clientColorClasses(key: string | undefined | null): string {
  if (!key || !key.trim()) return "bg-slate-100 text-slate-900 border-slate-300";
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export type AppointmentTag = {
  /** A lucide icon component. Drawn, not typed: a letter in a circle reads as text. */
  Icon: LucideIcon;
  label: string;
  className: string;
};

/**
 * The small badges on a block.
 *
 * Three facts a receptionist wants without opening the appointment: did this client ask
 * for this particular person, is this their first time, and are they a regular. Everything
 * else belongs in the detail panel.
 */
export function appointmentTags(input: {
  notes?: string | null;
  /** Total visits this client has had, when known. */
  visits?: number | null;
  /** The percentage off, when this booking was taken on an offer. */
  discountPercent?: number | null;
}): AppointmentTag[] {
  const tags: AppointmentTag[] = [];

  // First, because it is the one that changes the number on the bill. A receptionist
  // reading a block should not have to open it to find out why the price is short.
  if (input.discountPercent != null && input.discountPercent > 0) {
    tags.push({
      Icon: Percent,
      label: t("utils.offBookedOnAnOffer", { value: Math.round(input.discountPercent) }),
      className: "bg-rose-500 text-white",
    });
  }

  // "Requested by client" is stored as a prefix on the notes by the booking form, so that
  // is where it is read back from.
  if (input.notes && input.notes.includes("Requested by client")) {
    tags.push({
      Icon: Star,
      label: t("utils.askedForThisStaffMember"),
      className: "bg-amber-500 text-white",
    });
  }

  if (input.visits != null) {
    if (input.visits <= 1) {
      tags.push({ Icon: Sparkles, label: t("utils.newClient"), className: "bg-[rgb(var(--reg-brand))] text-white" });
    } else if (input.visits >= 5) {
      tags.push({ Icon: Crown, label: t("utils.regularClient"), className: "bg-rose-600 text-white" });
    }
  }

  return tags;
}
