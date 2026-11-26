import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Plus } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn } from "@/components/page/booqiStyles";
import { BAvatar, BChip, BEmpty, BError, BListRow, BSkeleton } from "@/components/biz/b-card";
import { Button } from "@/components/ui/button";
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
            <BSkeleton />
          ) : error ? (
            <BError>{t("locations.couldNotLoadYourLocations")}</BError>
          ) : salons.length === 0 ? (
            <BEmpty icon={<MapPin size={22} />}>{t("locations.oneLocationSoFarAdd")}</BEmpty>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {salons.map((s) => {
                const isCurrent = String(s.id) === String(currentId);
                return (
                  <li key={String(s.id)}>
                    <BListRow
                      lead={<BAvatar name={s.name} className={isCurrent ? "" : "bg-[rgb(var(--reg-ink)/0.05)] text-[rgb(var(--reg-ink)/0.7)]"}><MapPin size={20} /></BAvatar>}
                      title={<span className="flex items-center gap-2"><span className="truncate">{s.name}</span>{isCurrent && <BChip>{t("locations.mainLocation")}</BChip>}</span>}
                      sub={s.address || t("locations.noAddressSet")}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
