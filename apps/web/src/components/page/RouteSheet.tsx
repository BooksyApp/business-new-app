import * as React from "react";
import { FormSheet } from "./booqi";

/**
 * A create/edit form that has its own route (deep links, the browser's back button) but
 * looks like every other form in the hub: the list it belongs to stays underneath, the
 * form slides in from the right (full screen on a phone), and closing it goes back.
 */
export function RouteSheet({
  backdrop,
  onClose,
  ...sheet
}: {
  backdrop: React.ReactNode;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  return (
    <>
      {backdrop}
      <FormSheet open onOpenChange={(o) => !o && onClose()} {...sheet} />
    </>
  );
}

/** Section tabs inside a sheet header (General / Staff / Settings …). */
export function SheetTabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: string }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-full bg-[rgb(var(--reg-ink)/0.05)] p-1 [scrollbar-width:none]">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={
            "h-9 shrink-0 flex-1 whitespace-nowrap rounded-full px-3 text-sm font-semibold transition-colors " +
            (value === t.id
              ? "bg-white text-[rgb(var(--reg-ink))] shadow-[0_1px_2px_rgb(var(--reg-ink)/0.08)]"
              : "text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]")
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
