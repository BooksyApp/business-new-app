import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { SECTION_REDIRECTS, useVisibleNav, type NavEntry } from "@/components/layout/navigation";
import { NavCard, NavCardGrid, type CardStat } from "@/components/layout/NavCards";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody } from "@/components/page/booqiStyles";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useNavigation } from "@/utils/navigationUtils";
import { productService } from "@/services/productService";
import { reviewService } from "@/services/reviewService";
import { staffService } from "@/services/staffService";
import { onlineSalesService } from "@/services/onlineSalesService";
import { t } from "@/i18n";
import type { Id } from "@/types/id";

/**
 * A category's own page (/section/<slug>): one card per page inside it, each saying what the
 * page is for and, where it is cheap, a live figure. The founder's rule (2026-11-19, v3):
 * the owner should see what a category holds before choosing — not tabs on top of a page.
 *
 * Old /section/<slug> addresses of v1 groups that are no longer categories still redirect.
 */
export default function SectionPage() {
  const { section } = useParams<{ section: string }>();
  const { getPath } = useNavigation();
  const entry = useVisibleNav()
    .flatMap((s) => s.entries)
    .find((e) => e.slug === section);
  const pages = entry?.pages ?? [];
  const stats = useCardStats(pages.map((p) => p.path));

  if (!entry || pages.length < 2) {
    const to = pages[0]?.path ?? entry?.path ?? SECTION_REDIRECTS[section ?? ""] ?? "/calendar";
    return <Navigate to={getPath(to)} replace />;
  }

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={entry.label} subtitle={entry.description} />
        <div className={pageBody}>
          <CategoryCards entry={entry} stats={stats} getPath={getPath} />
        </div>
      </BooqiScope>
    </AppLayout>
  );
}

function CategoryCards({ entry, stats, getPath }: { entry: NavEntry; stats: Record<string, CardStat | null>; getPath: (p: string) => string }) {
  return (
    <NavCardGrid>
      {(entry.pages ?? []).map((p) => (
        <NavCard key={p.path} to={getPath(p.path)} icon={p.icon} title={p.label} description={p.description} stat={stats[p.path]} />
      ))}
    </NavCardGrid>
  );
}

/**
 * Live figures for the cards that have a cheap source: each is one small request the page
 * already makes, fetched only when its card is shown (so only for pages the role may open).
 * A failed request just leaves the card without a figure.
 */
function useCardStats(paths: string[]): Record<string, CardStat | null> {
  const businessId = useBusinessId();
  const has = (p: string) => Boolean(businessId) && paths.includes(p);
  const opts = { staleTime: 60_000, retry: false } as const;

  const low = useQuery({ queryKey: ["nav-card", "low-stock", businessId], queryFn: () => productService.lowStock(businessId as Id), enabled: has("/inventory"), ...opts });
  const reviews = useQuery({ queryKey: ["nav-card", "reviews", businessId], queryFn: () => reviewService.getSummary(businessId as Id), enabled: has("/reviews"), ...opts });
  const team = useQuery({ queryKey: ["nav-card", "staff", businessId], queryFn: () => staffService.getStaffByBusiness(businessId as Id), enabled: has("/staff"), ...opts });
  const orders = useQuery({ queryKey: ["nav-card", "orders", businessId], queryFn: () => onlineSalesService.orders(businessId as Id, "PAID"), enabled: has("/shop-orders"), ...opts });

  const out: Record<string, CardStat | null> = {};
  if (low.data) {
    out["/inventory"] = low.data.length
      ? { text: t("nav.live.lowStock", { count: low.data.length }), attention: true }
      : { text: t("nav.live.allStocked") };
  }
  if (reviews.data && reviews.data.count > 0 && reviews.data.average != null) {
    out["/reviews"] = { text: t("nav.live.rating", { avg: reviews.data.average.toFixed(1), count: reviews.data.count }) };
  }
  if (team.data) out["/staff"] = { text: t("nav.live.people", { count: team.data.length }) };
  if (orders.data && orders.data.length) out["/shop-orders"] = { text: t("nav.live.toPrepare", { count: orders.data.length }), attention: true };
  return out;
}
