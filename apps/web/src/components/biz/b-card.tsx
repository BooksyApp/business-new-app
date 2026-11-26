import * as React from "react";

import { cn } from "@/lib/utils";

/** Artifact `.crd2`: white 20px card with the soft ink-tinted shadow, optional title/subtitle. */
export function BCard({
  title,
  hint,
  icon,
  className,
  children,
}: {
  title?: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-[20px] bg-white p-5 shadow-[var(--shadow-sm)] ring-1 ring-[rgb(var(--reg-line)/0.6)] md:p-6", className)}>
      {(title || icon) && (
        <header className="mb-4 flex items-center gap-3">
          {icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand))]">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-[17px] font-extrabold leading-tight">{title}</h2>
            {hint && <p className="mt-0.5 text-sm text-[rgb(var(--reg-muted))]">{hint}</p>}
          </div>
        </header>
      )}
      {children}
    </section>
  );
}

/** Artifact `.fsec`: small uppercase label that opens a group of fields. */
export function BSectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mx-1 mt-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]", className)}>
      {children}
    </p>
  );
}

/** Artifact `.lr`: list row with a leading tile (swatch / avatar / icon), text, trailing actions. */
export function BListRow({
  lead,
  title,
  sub,
  actions,
  className,
}: {
  lead?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3.5 rounded-[18px] bg-white px-4 py-3 shadow-[var(--shadow-sm)] ring-1 ring-[rgb(var(--reg-line)/0.5)]", className)}>
      {lead}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15.5px] font-extrabold">{title}</p>
        {sub && <p className="mt-px truncate text-sm text-[rgb(var(--reg-muted))]">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Round avatar tile with initials, for rows of people and salons. */
export function BAvatar({ name, className, children }: { name?: string; className?: string; children?: React.ReactNode }) {
  const initials = (name ?? "").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
  return (
    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--reg-brand-soft))] text-sm font-extrabold text-[rgb(var(--reg-brand-strong))]", className)}>
      {children ?? initials}
    </span>
  );
}

/** Small pill: tone "brand" | "ok" | "warn" | "mute". */
export function BChip({ tone = "brand", children, className }: { tone?: "brand" | "ok" | "warn" | "mute"; children: React.ReactNode; className?: string }) {
  const tones = {
    brand: "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]",
    ok: "bg-emerald-50 text-emerald-800",
    warn: "bg-amber-50 text-amber-800",
    mute: "bg-[rgb(var(--reg-ink)/0.06)] text-[rgb(var(--reg-ink)/0.7)]",
  } as const;
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-bold", tones[tone], className)}>{children}</span>;
}

/** Loading / error / empty blocks shared by list pages. */
export function BSkeleton({ className }: { className?: string }) {
  return <div className={cn("h-32 animate-pulse rounded-[20px] bg-white shadow-[var(--shadow-sm)] ring-1 ring-[rgb(var(--reg-line)/0.6)]", className)} aria-busy />;
}

export function BError({ children }: { children: React.ReactNode }) {
  return <div role="alert" className="rounded-[20px] bg-rose-50 p-4 text-sm font-semibold text-rose-900 ring-1 ring-inset ring-rose-200">{children}</div>;
}

export function BEmpty({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[20px] border-2 border-dashed border-[rgb(var(--reg-line))] p-6 text-center text-sm text-[rgb(var(--reg-muted))]">
      {icon && <span className="text-[rgb(var(--reg-brand))]">{icon}</span>}
      {children}
    </div>
  );
}
