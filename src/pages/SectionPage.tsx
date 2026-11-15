import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { useVisibleNavGroups } from "@/components/layout/navigation";
import { useNavigation } from "@/utils/navigationUtils";
import { ChevronRight } from "lucide-react";
import { Navigate, NavLink, useParams } from "react-router-dom";
import { t } from "@/i18n";

const TONES = [
  "bg-violet-50 text-violet-600",
  "bg-sky-50 text-sky-600",
  "bg-emerald-50 text-emerald-600",
  "bg-amber-50 text-amber-600",
];

/**
 * The landing page for a nav section.
 *
 * The rail is icons, and icons cannot say what a page is for. This is where a section's
 * pages are actually named and explained — one click from the rail, and they stay put
 * instead of vanishing with the pointer the way a hover menu does.
 */
export default function SectionPage() {
  const { section } = useParams<{ section: string }>();
  const { getPath } = useNavigation();
  // The same filtered list the rail uses, so a switched-off page is missing from both.
  const group = useVisibleNavGroups().find((g) => g.slug === section);

  if (!group || !group.items) return <Navigate to={getPath("/calendar")} replace />;

  return (
    <AppLayout>
      <PageHeader title={group.label} subtitle={t("section.pagesInThisSection", { count: group.items.length })} />

      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {group.items.map((item, i) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={getPath(item.path)}
                className="group rounded-xl border bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      TONES[i % TONES.length]
                    }`}
                  >
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.label}</p>
                    {item.description && (
                      <p className="mt-1 text-sm leading-snug text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <ChevronRight
                    size={18}
                    className="mt-0.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </div>
              </NavLink>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
