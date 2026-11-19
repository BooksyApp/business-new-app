import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Plus } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn } from "@/components/page/booqiStyles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentBusinessId } from "@/config/api";
import { getUserBusinesses } from "@/utils/businessUtils";
import { t } from "@/i18n";

type OwnerSalon = { id: number | string; name: string; address?: string | null };

/**
 * FG-W5-11 follow-up: a "branch" is simply another salon on the same owner account. The
 * separate branch form is gone; this page lists the owner's salons and adds one through the
 * existing add-salon flow (/create-business), the same entry the salon switcher uses.
 */
export default function LocationsPage() {
  const navigate = useNavigate();
  const currentId = getCurrentBusinessId();
  const [salons, setSalons] = useState<OwnerSalon[] | null>(null);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    getUserBusinesses()
      .then((list) => setSalons((list as OwnerSalon[]) ?? []))
      // An empty list must not stand in for a failed load.
      .catch(() => setError(true));
  };

  useEffect(load, []);

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("locations.locations")}
          subtitle={t("locations.yourSalonAndAnyOther")}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigate("../branch-comparison")}>{t("cmp.compareSalons")}</Button>
              <Button variant="outline" onClick={() => navigate("../central-prices")}>{t("cp.title")}</Button>
              <Button className={primaryBtn} onClick={() => navigate("/create-business")}>
                <Plus size={16} />{" "}{t("layout.addSalon")}
              </Button>
            </div>
          }
        />
        <div className={pageBody}>
          {salons === null && !error ? (
            <div className="h-32 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy />
          ) : error ? (
            <div className="rounded-[20px] bg-rose-50 p-4 text-sm text-rose-900 ring-1 ring-inset ring-rose-200">
              {t("locations.couldNotLoadYourLocations")}
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {salons.map((s) => {
                const isCurrent = String(s.id) === String(currentId);
                return (
                  <li key={String(s.id)} className="flex items-start gap-3 rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-5">
                    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", isCurrent ? "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand))]" : "bg-[rgb(var(--reg-ink)/0.05)] text-[rgb(var(--reg-ink)/0.7)]")}>
                      <MapPin size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[16px] font-bold">{s.name}</span>
                        {isCurrent && <span className="rounded-full bg-[rgb(var(--reg-brand-soft))] px-2 py-0.5 text-[11px] font-bold text-[rgb(var(--reg-brand-strong))]">{t("locations.mainLocation")}</span>}
                      </p>
                      <p className="mt-1 text-sm text-[rgb(var(--reg-muted))]">{s.address || t("locations.noAddressSet")}</p>
                    </div>
                  </li>
                );
              })}
              {salons.length === 0 && (
                <li className="rounded-[20px] border-2 border-dashed border-[rgb(var(--reg-line))] p-5 text-sm text-[rgb(var(--reg-muted))]">
                  {t("locations.oneLocationSoFarAdd")}
                </li>
              )}
            </ul>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
