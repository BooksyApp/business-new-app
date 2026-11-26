import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Plus } from "lucide-react";

import { Avatar, Btn, EmptyState, ErrorState, PageHead, RowItem, Skeleton, Tag } from "@/components/bz";
import { BzPage, initialsOf } from "@/components/bz/p2-page";
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
    <BzPage>
      <PageHead
        title={t("locations.locations")}
        sub={t("locations.yourSalonAndAnyOther")}
        right={
          <>
            <Btn kind="ol" onClick={() => navigate("../branch-comparison")}>{t("cmp.compareSalons")}</Btn>
            <Btn kind="ol" onClick={() => navigate("../central-prices")}>{t("cp.title")}</Btn>
            <Btn kind="v" icon={<Plus className="ic" />} onClick={() => navigate("/create-business")}>{t("layout.addSalon")}</Btn>
          </>
        }
      />
      {salons === null && !error ? (
        <Skeleton />
      ) : error ? (
        <ErrorState icon={<MapPin className="ic" />} title={t("locations.couldNotLoadYourLocations")} />
      ) : salons.length === 0 ? (
        <EmptyState icon={<MapPin className="ic" />} title={t("locations.oneLocationSoFarAdd")} />
      ) : (
        <div className="tbx">
          {salons.map((s) => {
            const isCurrent = String(s.id) === String(currentId);
            return (
              <RowItem
                key={String(s.id)}
                left={<Avatar initials={initialsOf(s.name)} size={46} />}
                title={s.name}
                sub={s.address || t("locations.noAddressSet")}
                right={isCurrent ? <Tag kind="v">{t("locations.mainLocation")}</Tag> : undefined}
              />
            );
          })}
        </div>
      )}
    </BzPage>
  );
}
