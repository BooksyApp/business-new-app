import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Section card used by area A sheets and dialogs: small caps title, soft rounded card. */
export function ASection({ title, children, className }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-3.5 shadow-sm", className)}>
      {title != null && (
        <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** Pill-style segmented switch (modes, tabs). Presentational wrapper only. */
export function APillGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("inline-flex flex-wrap gap-1 rounded-full bg-muted p-1", className)}>{children}</div>;
}
