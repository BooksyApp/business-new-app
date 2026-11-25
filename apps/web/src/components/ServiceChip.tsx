import { useEffect, useId, useRef, useState } from "react";
import { t } from "@/i18n";

type ServiceRef = { name: string; staffName?: string | null };

/**
 * What a review was for. One service reads as text; a visit with several shows the first
 * and a "+N" chip that opens a small list of all of them (hover on desktop, tap on a
 * phone). One row: the first name truncates, the chip does not.
 */
export function ServiceChip({
  services,
  fallback,
}: {
  services?: ServiceRef[] | null;
  fallback?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const list = services && services.length > 1 ? services : null;
  if (!list) return <span className="min-w-0 truncate">{fallback ?? services?.[0]?.name ?? ""}</span>;
  const differ = new Set(list.map((s) => s.staffName ?? "")).size > 1;
  const hover = () => typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover)").matches;

  return (
    <span
      ref={box}
      className="relative inline-flex min-w-0 max-w-full items-baseline gap-1"
      onMouseEnter={() => hover() && setOpen(true)}
      onMouseLeave={() => hover() && setOpen(false)}
    >
      <span className="min-w-0 truncate">{list[0].name}</span>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={t("serviceChip.showAllServices", { count: list.length })}
        onClick={() => setOpen((v) => !v)}
        className="shrink-0 rounded-full bg-[rgb(var(--reg-brand)/0.12)] px-2 py-px text-[11px] font-bold leading-4 text-[rgb(var(--reg-brand-strong))]"
      >
        +{list.length - 1}
      </button>
      {open && (
        <span
          id={id}
          role="dialog"
          aria-label={t("serviceChip.allServices")}
          className="absolute left-0 top-full z-20 mt-1 block min-w-[200px] max-w-[260px] whitespace-normal rounded-xl bg-white p-3 text-left text-[13px] text-[rgb(var(--reg-ink))] shadow-lg ring-1 ring-[rgb(var(--reg-line))]"
        >
          <span className="block text-[11px] font-bold uppercase tracking-wide text-[rgb(var(--reg-muted))]">{t("serviceChip.allServices")}</span>
          <span className="mt-1 block space-y-1">
            {list.map((s, i) => (
              <span key={i} className="block">
                {s.name}
                {differ && s.staffName ? <span className="text-[rgb(var(--reg-muted))]"> · {s.staffName}</span> : null}
              </span>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}
