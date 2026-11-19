import { AppLayout } from "@/components/layout/AppLayout";
import { useVisibleNavGroups } from "@/components/layout/navigation";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody } from "@/components/page/booqiStyles";
import { useNavigation } from "@/utils/navigationUtils";
import { ChevronRight } from "lucide-react";
import { Navigate, NavLink, useParams } from "react-router-dom";
import { t } from "@/i18n";

/**
 * The landing page for a nav group (/section/<slug>): where the collapsed icon rail sends
 * you, and where old links to a section still land. Each page is named and explained.
 */
export default function SectionPage() {
  const { section } = useParams<{ section: string }>();
  const { getPath } = useNavigation();
  // The same filtered list the rail uses, so a switched-off page is missing from both.
  const group = useVisibleNavGroups().find((g) => g.slug === section);
  if (!group || !group.items) return <Navigate to={getPath("/calendar")} replace />;
  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={group.label} subtitle={t("section.pagesInThisSection", { count: group.items.length })} />
        <div className={pageBody}>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <NavLink
                    to={getPath(item.path)}
                    className="group flex h-full items-start gap-3 rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)] transition hover:ring-[rgb(var(--reg-brand)/0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.6)]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]">
                      <Icon size={18} strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold">{item.label}</span>
                      {item.description && <span className="mt-0.5 block text-sm leading-snug text-[rgb(var(--reg-muted))]">{item.description}</span>}
                    </span>
                    <ChevronRight size={18} className="mt-0.5 shrink-0 text-[rgb(var(--reg-ink)/0.35)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
