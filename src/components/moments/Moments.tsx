import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Moments" — small crafted cards, each one moment of the product (a booking lands, the week
 * fills up, a payment comes in). The same family as booqi-web's for-business page: white card,
 * hairline ring, booqi's warm shadow, an icon tile and two crisp lines. Decorative (aria-hidden):
 * the copy next to them says the same in words. No blur, no images — cheap to paint.
 */

const shell =
  "rounded-2xl bg-white ring-1 ring-[rgb(var(--reg-ink)/0.06)] shadow-[0_22px_44px_-24px_rgb(160_80_50/0.42),0_2px_6px_rgb(var(--reg-ink)/0.06)]";

type Tone = "brand" | "glow" | "ink" | "peach";
const tones: Record<Tone, string> = {
  brand: "bg-[linear-gradient(135deg,rgb(var(--reg-brand)),rgb(var(--reg-brand-strong)))] text-white",
  glow: "bg-[linear-gradient(135deg,rgb(var(--reg-mesh-1)),rgb(var(--reg-mesh-2)))] text-[rgb(var(--reg-ink))]",
  ink: "bg-[rgb(var(--reg-ink))] text-white",
  peach: "bg-[rgb(251_231_220)] text-[rgb(var(--reg-ink))]",
};

export function MomentLine({
  icon: Icon,
  tone = "brand",
  title,
  body,
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: string;
  body: string;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn(shell, "flex items-center gap-3 py-2.5 pl-2.5 pr-4", className)}>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-[13px] font-bold leading-5 text-[rgb(var(--reg-ink))]">{title}</span>
        <span className="block truncate text-xs leading-4 text-[rgb(var(--reg-muted))]">{body}</span>
      </span>
    </div>
  );
}

/** The week filling up: a figure and seven day bars. */
export function MomentOccupancy({ label, value, className }: { label: string; value: string; className?: string }) {
  const days = [72, 90, 64, 96, 100, 88, 52];
  return (
    <div aria-hidden className={cn(shell, "p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[rgb(var(--reg-ink)/0.55)]">{label}</span>
        <span className="whitespace-nowrap text-[22px] font-extrabold leading-none tracking-[-0.03em] text-[rgb(var(--reg-ink))]">{value}</span>
      </div>
      <div className="mt-3 flex h-12 items-end gap-1.5">
        {days.map((h, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 rounded-md",
              i === 4 ? "bg-[linear-gradient(180deg,rgb(var(--reg-brand)),rgb(var(--reg-brand-strong)))]" : "bg-[rgb(var(--reg-brand)/0.18)]",
            )}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** A client's review: stars, the score, one line of their words. */
export function MomentReview({ name, quote, className }: { name: string; quote: string; className?: string }) {
  return (
    <div aria-hidden className={cn(shell, "p-4 text-left", className)}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(251_231_220)] text-[13px] font-bold text-[rgb(var(--reg-ink))]">
          {name.slice(0, 1)}
        </span>
        <span className="text-[13px] font-bold text-[rgb(var(--reg-ink))]">{name}</span>
        <span className="ml-auto flex items-center gap-1 text-[13px] font-bold text-[rgb(var(--reg-ink))]">
          <span className="tracking-[-0.1em] text-[#F5A524]">★★★★★</span> 4.9
        </span>
      </div>
      <p className="mt-2.5 text-[13.5px] leading-5 text-[rgb(var(--reg-ink)/0.8)]">“{quote}”</p>
    </div>
  );
}
