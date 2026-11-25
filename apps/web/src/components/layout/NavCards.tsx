import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** A small live figure on a card: "12 low on stock". `attention` marks something to act on. */
export interface CardStat {
  text: string;
  attention?: boolean;
}

/**
 * One page of a category, as a card: icon, name, one line on what it is for and, when it is
 * cheap to know, a live figure. The whole card is the link.
 */
export function NavCard({
  to,
  icon: Icon,
  title,
  description,
  stat,
}: {
  to: string;
  icon: React.ElementType;
  title: string;
  description?: string;
  stat?: CardStat | null;
}) {
  return (
    <Link
      to={to}
      className="group relative flex min-h-[148px] flex-col rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-18px_rgb(var(--reg-ink)/0.35)] hover:ring-[rgb(var(--reg-brand)/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.6)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]">
          <Icon size={20} strokeWidth={1.8} aria-hidden />
        </span>
        <ArrowUpRight
          size={18}
          aria-hidden
          className="text-[rgb(var(--reg-ink)/0.25)] transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[rgb(var(--reg-brand))] motion-reduce:transition-none"
        />
      </div>
      <h2 className="mt-4 text-[16px] font-extrabold leading-snug tracking-[-0.01em]">{title}</h2>
      {description && <p className="mt-1 text-sm leading-snug text-[rgb(var(--reg-muted))]">{description}</p>}
      {stat && (
        <div className="mt-auto pt-4">
          <p
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold tabular-nums",
              stat.attention
                ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                : "bg-[rgb(var(--reg-ink)/0.05)] text-[rgb(var(--reg-ink)/0.75)]",
            )}
          >
            {stat.attention && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />}
            {stat.text}
          </p>
        </div>
      )}
    </Link>
  );
}

/** The grid the cards sit in: one column on a phone, two on a tablet, three on a laptop. */
export function NavCardGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-3", className)}>{children}</div>;
}
