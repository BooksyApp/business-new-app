import { t } from "@/i18n";
/**
 * One status palette for every appointment surface (calendar blocks, the appointment
 * sheet). Confirmed is the brand violet because it is most of the day; the rarer states
 * use their own hue so they catch the eye. Colours read the brand tokens in
 * components/auth/auth-tokens.css.
 *
 * accent — the solid stripe/band; fill — the soft block tint; chip — a label pill.
 */
export interface StatusStyle {
  accent: string;
  fill: string;
  chip: string;
  label: string;
  /** Solid colour for the status dot on a calendar block. */
  dot: string;
}

const STATUS_STYLE: Record<string, StatusStyle> = {
  PENDING: {
    accent: "bg-amber-500",
    fill: "bg-amber-50 hover:bg-amber-100/80",
    chip: "bg-amber-100 text-amber-900",
    get label() { return t("utils.awaitingConfirmation"); },
    dot: "#F59E0B",
  },
  CONFIRMED: {
    accent: "bg-[rgb(var(--reg-brand))]",
    fill: "bg-[rgb(var(--reg-brand-soft))] hover:bg-[rgb(236_231_255)]",
    chip: "bg-[rgb(var(--reg-brand)/0.12)] text-[rgb(var(--reg-brand-strong))]",
    get label() { return t("utils.confirmed"); },
    dot: "#7C3AED",
  },
  IN_PROGRESS: {
    accent: "bg-sky-500",
    fill: "bg-sky-50 hover:bg-sky-100/80",
    chip: "bg-sky-100 text-sky-900",
    get label() { return t("utils.inProgress"); },
    dot: "#0EA5E9",
  },
  COMPLETED: {
    accent: "bg-slate-400",
    fill: "bg-slate-100 hover:bg-slate-200/70",
    chip: "bg-slate-200 text-slate-900",
    get label() { return t("utils.completed"); },
    dot: "#64748B",
  },
  NO_SHOW: {
    accent: "bg-rose-500",
    fill: "bg-rose-50 hover:bg-rose-100/80",
    chip: "bg-rose-100 text-rose-900",
    get label() { return t("utils.noShow"); },
    dot: "#E11D48",
  },
  CANCELLED: {
    accent: "bg-red-500",
    fill: "bg-slate-50 hover:bg-slate-100",
    chip: "bg-red-100 text-red-900",
    get label() { return t("common.cancelled"); },
    dot: "#DC2626",
  },
};

export function appointmentStatusStyle(status?: string | null, fallback = "CONFIRMED"): StatusStyle {
  return STATUS_STYLE[(status || fallback).toUpperCase()] ?? STATUS_STYLE[fallback];
}
