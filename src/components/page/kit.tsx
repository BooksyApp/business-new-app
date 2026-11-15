import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Small pieces the section pages share on top of the page template (./booqi.tsx):
 * lifecycle chips, form fields, a quick-action menu, the "how clients see it" frame,
 * filter chips. Colours read the brand tokens in components/auth/auth-tokens.css.
 */

/* ── lifecycle status chip ─────────────────────────────────────────────── */

import type { Lifecycle } from "./kitStyles";
import { t } from "@/i18n";

const LIFECYCLE: Record<Lifecycle, { label: string; cls: string; dot: string }> = {
  active: { get label() { return t("common.active"); }, cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  scheduled: { get label() { return t("common.scheduled"); }, cls: "bg-sky-50 text-sky-800 ring-sky-200", dot: "bg-sky-500" },
  ended: { get label() { return t("common.ended"); }, cls: "bg-[rgb(var(--reg-ink)/0.05)] text-[rgb(var(--reg-ink)/0.7)] ring-[rgb(var(--reg-line))]", dot: "bg-[rgb(var(--reg-ink)/0.35)]" },
  draft: { get label() { return t("page.draft"); }, cls: "bg-amber-50 text-amber-900 ring-amber-200", dot: "bg-amber-500" },
  queued: { get label() { return t("page.queued"); }, cls: "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))] ring-[rgb(var(--reg-brand)/0.25)]", dot: "bg-[rgb(var(--reg-brand))]" },
  failed: { get label() { return t("page.failed"); }, cls: "bg-rose-50 text-rose-800 ring-rose-200", dot: "bg-rose-500" },
  paused: { get label() { return t("page.paused"); }, cls: "bg-amber-50 text-amber-900 ring-amber-200", dot: "bg-amber-500" },
};

export function StatusChip({ status, label, className }: { status: Lifecycle; label?: string; className?: string }) {
  const s = LIFECYCLE[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset", s.cls, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden />
      {label ?? s.label}
    </span>
  );
}



/* ── form fields ───────────────────────────────────────────────────────── */


export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-[rgb(var(--reg-ink))]">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-[rgb(var(--reg-muted))]">{hint}</p>}
    </div>
  );
}

/** A segmented choice (radio group) for 2–4 options; reads better than a select. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: LucideIcon; hint?: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-12 flex-col items-start justify-center rounded-[14px] px-3.5 py-2 text-left ring-1 ring-inset transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.6)]",
              on
                ? "bg-[rgb(var(--reg-brand-soft))] ring-[rgb(var(--reg-brand))] text-[rgb(var(--reg-brand-strong))]"
                : "bg-white ring-[rgb(var(--reg-line))] text-[rgb(var(--reg-ink))] hover:ring-[rgb(var(--reg-brand)/0.4)]",
            )}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              {Icon && <Icon size={15} strokeWidth={2} />}
              {o.label}
            </span>
            {o.hint && <span className="mt-0.5 text-xs text-[rgb(var(--reg-muted))]">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── filter chips with counts ─────────────────────────────────────────── */

export function FilterChips<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex max-w-full gap-1.5 overflow-x-auto [scrollbar-width:none]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]",
              on
                ? "bg-[rgb(var(--reg-ink))] text-white"
                : "bg-white text-[rgb(var(--reg-ink)/0.75)] ring-1 ring-inset ring-[rgb(var(--reg-line))] hover:text-[rgb(var(--reg-ink))]",
            )}
          >
            {o.label}
            {o.count != null && <span className={cn("tabular-nums", on ? "text-white/70" : "text-[rgb(var(--reg-muted))]")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── quick actions ─────────────────────────────────────────────────────── */

export interface QuickAction {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** "…" menu for the secondary actions on a row or card. */
export function ActionMenu({ actions, label }: { actions: QuickAction[]; label: string }) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[rgb(var(--reg-ink)/0.65)] transition hover:bg-[rgb(var(--reg-ink)/0.06)] hover:text-[rgb(var(--reg-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]"
        >
          <MoreHorizontal size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px] rounded-2xl p-1.5">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <DropdownMenuItem
              key={a.label}
              disabled={a.disabled}
              onSelect={a.onSelect}
              className={cn("gap-2 rounded-xl px-3 py-2 text-sm font-medium", a.danger && "text-rose-700 focus:text-rose-700")}
            >
              {Icon && <Icon size={15} />}
              {a.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A small text button for the one action a row is for. */
export function RowAction({
  children,
  onClick,
  disabled,
  icon: Icon,
  tone = "brand",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
  tone?: "brand" | "ink";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1 ring-inset transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]",
        tone === "brand"
          ? "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))] ring-[rgb(var(--reg-brand)/0.2)] hover:bg-[rgb(236_231_255)]"
          : "bg-white text-[rgb(var(--reg-ink))] ring-[rgb(var(--reg-line))] hover:bg-[rgb(var(--reg-canvas))]",
      )}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

/* ── "how clients see it" ──────────────────────────────────────────────── */

/**
 * Frames a preview of a customer-facing surface. The contents are drawn with booqi-web's
 * own look (white cards, ink text, guava for offers) so the salon sees what clients see.
 */
export function ClientPreview({
  where,
  who = t("kit.clientsSee"),
  children,
  className,
}: {
  where: string;
  /** Whose view this is; "Clients see" unless the surface is the salon's own. */
  who?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={`Preview: ${where}`} className={cn("rounded-[20px] bg-[rgb(var(--reg-ink)/0.04)] p-3 ring-1 ring-inset ring-[rgb(var(--reg-line)/0.8)]", className)}>
      <p className="mb-2.5 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted))]">
        <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--reg-brand))]" aria-hidden />
        {who} · {where}
      </p>
      {children}
    </section>
  );
}


/** Section heading inside a page body. */
export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <h2 className="text-base font-extrabold tracking-[-0.01em]">{children}</h2>
      {aside}
    </div>
  );
}

/** Thin progress bar (uses of a code, stamps on a card). */
export function Meter({ value, max, label, className, tone = "brand" }: { value: number; max: number; label: string; className?: string; tone?: "brand" | "rose" }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--reg-ink)/0.07)]", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", tone === "rose" ? "bg-rose-500" : "bg-[rgb(var(--reg-brand))]")} style={{ width: `${pct}%` }} />
    </div>
  );
}

