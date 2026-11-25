import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { t } from "@/i18n";
import { BRAND_FONT } from "@/components/auth/useBrandFont";
import { usePageTrail } from "./navigation";

/**
 * "Marketing › Offers" above a page that lives inside a category, so the way back to the
 * category's cards is one click. It replaces the v2 tabs: the founder found tabs on top of
 * every page harder to read than a page of cards that says what is in the category.
 * On a phone it is just "‹ Marketing".
 */
export function PageTrail({ base, current }: { base: string; current: string }) {
  const trail = usePageTrail(current);
  if (!trail) return null;
  const parent = `${base}${trail.parentPath}`;
  return (
    <nav
      aria-label={t("nav.trail")}
      style={{ fontFamily: BRAND_FONT }}
      className="shrink-0 border-b border-[rgb(var(--reg-line)/0.6)] bg-[rgb(var(--reg-canvas))] px-2 text-[13px] text-[rgb(var(--reg-ink))] md:px-8"
    >
      <Link
        to={parent}
        className="flex h-10 items-center gap-0.5 rounded-lg px-2 font-semibold text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)] md:hidden"
      >
        <ChevronLeft size={16} aria-hidden />
        {trail.parentLabel}
      </Link>
      <ol className="hidden h-10 items-center gap-1.5 md:flex">
        <li>
          <Link
            to={parent}
            className="rounded-md font-semibold text-[rgb(var(--reg-muted))] underline-offset-4 hover:text-[rgb(var(--reg-ink))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]"
          >
            {trail.parentLabel}
          </Link>
        </li>
        <li aria-hidden className="text-[rgb(var(--reg-ink)/0.3)]">
          <ChevronRight size={14} />
        </li>
        <li aria-current="page" className="truncate font-semibold text-[rgb(var(--reg-ink))]">
          {trail.label}
        </li>
      </ol>
    </nav>
  );
}
