import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { hasPermission, myAccess } from "@/components/layout/navigation";
import { useT } from "@/i18n/useT";
import { analysisService, type ClientSources } from "@/services/analysisService";

/**
 * R02 "booqi brought you X clients". Two numbers the salon can tell apart: new clients who
 * found the salon on booqi's marketplace, and the salon's own clients who booked online through
 * its link or QR code (booqi takes nothing from those). Last 30 days, and all time.
 */
export function BooqiBroughtCard({ businessId }: { businessId: number }) {
  const { t } = useT();
  const [data, setData] = useState<ClientSources | null>(null);
  const [failed, setFailed] = useState(false);
  const allowed = hasPermission(myAccess(), "ANALYTICS");

  useEffect(() => {
    if (!allowed) return;
    let live = true;
    analysisService
      .getClientSources(businessId)
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [businessId, allowed]);

  if (!allowed || failed) return null;

  const block = (label: string, hint: string, n30?: number, all?: number) => (
    <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {data ? (
        <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{n30}</p>
      ) : (
        <Skeleton className="mt-1 h-9 w-12" />
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {t("home.r02Last30Days")} · {t("home.r02AllTime", { count: all ?? 0 })}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <CardTitle className="text-lg font-bold">
            {data
              ? t("home.r02BooqiBroughtTitle", { count: data.last30Days.booqiClients })
              : t("home.r02BooqiBroughtTitleLoading")}
          </CardTitle>
          <CardDescription className="mt-1">{t("home.r02BooqiBroughtSub")}</CardDescription>
        </div>
        <div className="rounded-xl bg-accent/10 p-2.5">
          <Sparkles className="h-5 w-5 text-accent" />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {block(
          t("home.r02FromBooqi"),
          t("home.r02FromBooqiHint"),
          data?.last30Days.booqiClients,
          data?.allTime.booqiClients,
        )}
        {block(
          t("home.r02YourOwn"),
          t("home.r02YourOwnHint"),
          data?.last30Days.ownOnlineClients,
          data?.allTime.ownOnlineClients,
        )}
      </CardContent>
    </Card>
  );
}
