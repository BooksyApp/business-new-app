import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { LucideIcon } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { BRAND_FONT, useBrandFont } from "@/components/auth/useBrandFont";
import "@/components/auth/auth-tokens.css";

/**
 * The booqi page template (as on the redesigned Clients page), as drop-in replacements for
 * the shadcn pieces the section pages already use — same props, booqi look: sand canvas,
 * sticky header, white rounded cards, chip tabs, stat tiles, right-side sheets.
 */

/** Wrap a page's content: canvas background + brand face. */
export function BooqiScope({ children }: { children: React.ReactNode }) {
  useBrandFont();
  return (
    <div className="min-h-full bg-[rgb(var(--reg-canvas))] text-[rgb(var(--reg-ink))]" style={{ fontFamily: BRAND_FONT }}>
      {children}
    </div>
  );
}

/** Sticky header: title, one-line description, the page's actions (primary last). */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
  helpSlug,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  /** Slug of a help article about this page: shows a "?" link to it. */
  helpSlug?: string;
}) {
  const { salonKey } = useParams<{ salonKey?: string }>();
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-[rgb(var(--reg-line)/0.8)] bg-[rgb(var(--reg-canvas)/0.92)] px-4 pb-4 pt-4 backdrop-blur-xl md:px-8 md:pt-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">
          {title}
          {helpSlug && salonKey && (
            <Link
              to={`/${salonKey}/help/${helpSlug}`}
              aria-label={t("helpCenter.helpLink")}
              title={t("helpCenter.helpLink")}
              className="ml-2 inline-flex h-6 w-6 -translate-y-1 items-center justify-center rounded-full bg-[rgb(var(--reg-ink)/0.07)] align-middle text-xs font-bold text-[rgb(var(--reg-ink)/0.7)] hover:bg-[rgb(var(--reg-ink)/0.12)]"
            >
              ?
            </Link>
          )}
        </h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-[rgb(var(--reg-muted))] md:text-[15px]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}



/* ── cards (same API as ui/card) ─────────────────────────────────────── */

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    {...props}
    className={cn(
      "rounded-[20px] bg-white text-[rgb(var(--reg-ink))] shadow-[0_1px_2px_rgb(var(--reg-ink)/0.04),0_12px_32px_-18px_rgb(var(--reg-ink)/0.12)] ring-1 ring-[rgb(var(--reg-line)/0.8)]",
      // Old per-page borders/backgrounds lose to the template.
      className?.replace(/\b(border(-[a-z]+)?-[a-z]+-\d+|border-l-4|bg-[a-z]+-\d+|bg-gradient-[^\s]+|from-[^\s]+|to-[^\s]+|shadow-sm|hover:shadow-md)\b/g, ""),
    )}
  />
));
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1 p-5 md:p-6", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-lg font-extrabold tracking-[-0.02em]", className, "font-extrabold")} {...props} />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-[rgb(var(--reg-muted))]", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-5 pb-5 pt-0 md:px-6 md:pb-6", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center px-5 pb-5 pt-0 md:px-6 md:pb-6", className)} {...props} />
));
CardFooter.displayName = "CardFooter";

/* ── stat tile + empty state (same API as ui/stat-card) ───────────────── */

type Tone = "violet" | "emerald" | "amber" | "sky" | "rose" | "slate";
const TONE_ICON: Record<Tone, string> = {
  violet: "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand))]",
  emerald: "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand))]",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-[rgb(var(--reg-ink)/0.05)] text-[rgb(var(--reg-ink)/0.6)]",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "violet",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[rgb(var(--reg-muted))]">{label}</p>
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", TONE_ICON[tone])}>
          <Icon size={18} strokeWidth={1.75} />
        </span>
      </div>
      <p className="mt-2 text-[28px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-[rgb(var(--reg-muted))]">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[20px] bg-white px-6 py-14 text-center ring-1 ring-[rgb(var(--reg-line)/0.8)]">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-mesh-1)),rgb(var(--reg-mesh-2))_55%,rgb(var(--reg-mesh-3)))]">
        <Icon size={24} strokeWidth={1.75} className="text-[rgb(var(--reg-ink))]" />
      </span>
      <p className="text-lg font-extrabold tracking-[-0.02em]">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-sm text-[rgb(var(--reg-muted))]">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── tabs as chips (same API as ui/tabs) ──────────────────────────────── */

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-[rgb(var(--reg-ink)/0.05)] p-1 [scrollbar-width:none]", className)}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold text-[rgb(var(--reg-muted))] transition-colors hover:text-[rgb(var(--reg-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)] data-[state=active]:bg-white data-[state=active]:text-[rgb(var(--reg-ink))] data-[state=active]:shadow-[0_1px_2px_rgb(var(--reg-ink)/0.06),0_4px_12px_-6px_rgb(var(--reg-ink)/0.15)]",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-4 focus-visible:outline-none", className)} {...props} />
));
TabsContent.displayName = "TabsContent";

/* ── right-side form sheet (as the calendar's) ─────────────────────────── */

export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  header,
}: {
  /** md = 480px (most forms); lg = 640px (long forms with sections). Full screen on a phone either way. */
  size?: "md" | "lg";
  /** Extra sticky content under the title (section tabs). */
  header?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Sticky footer: secondary + gradient primary. */
  footer?: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        style={{ fontFamily: BRAND_FONT }}
        className={`!max-w-full flex h-[100dvh] max-h-[100dvh] w-full flex-col gap-0 border-0 bg-[rgb(var(--reg-canvas))] p-0 text-[rgb(var(--reg-ink))] sm:border-l ${size === "lg" ? "sm:w-[640px]" : "sm:w-[480px]"} sm:border-[rgb(var(--reg-line))]`}
      >
        <div className="shrink-0 border-b border-[rgb(var(--reg-line)/0.8)] px-5 pb-4 pr-14 pt-5 md:px-6">
          <SheetTitle className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-[rgb(var(--reg-ink))]">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="mt-0.5 text-sm text-[rgb(var(--reg-muted))]">{description}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">{title}</SheetDescription>
          )}
          {header && <div className="mt-3">{header}</div>}
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 md:px-6">{children}</div>
        {footer && (
          <div className="flex shrink-0 gap-3 border-t border-[rgb(var(--reg-line)/0.8)] bg-white/90 px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:px-6">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}


