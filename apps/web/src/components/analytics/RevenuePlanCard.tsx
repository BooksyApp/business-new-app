import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { primaryBtn } from "@/components/page/booqiStyles";
import { fieldCls } from "@/components/page/kitStyles";
import { useBusinessId } from "@/hooks/useBusinessId";
import { currencySymbol } from "@/lib/currency";
import { getHubLocale } from "@/lib/hubLocale";
import { money } from "@/lib/utils";
import { t } from "@/i18n";
import { revenuePlanService, type RevenuePlanMonth } from "@/services/revenuePlanService";

/** Monthly revenue plan for one year, against the revenue each month actually brought in. */
export default function RevenuePlanCard() {
  const businessId = useBusinessId();
  const sym = currencySymbol();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [rows, setRows] = useState<RevenuePlanMonth[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!businessId) return;
    let live = true;
    setBusy(true);
    revenuePlanService
      .list(businessId, year)
      .then((r) => {
        if (live) {
          setRows(r);
          setDrafts({});
        }
      })
      .catch(() => {
        if (live) toast.error(t("revenuePlan.loadFailed"));
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [businessId, year, reloadKey]);

  const valid = (v: string) => v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0;
  const dirty = rows.filter((r) => drafts[r.month] !== undefined && drafts[r.month] !== String(r.plan));
  const canSave = dirty.length > 0 && dirty.every((r) => valid(drafts[r.month]));

  const save = async () => {
    if (!businessId || !canSave) return;
    setBusy(true);
    try {
      await Promise.all(dirty.map((r) => revenuePlanService.set(businessId, r.month, Number(drafts[r.month]))));
      setReloadKey((k) => k + 1);
    } catch {
      toast.error(t("revenuePlan.saveFailed"));
      setBusy(false);
    }
  };

  const label = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString(getHubLocale(), { month: "short" });
  const planTotal = rows.reduce((s, r) => s + r.plan, 0);
  const actualTotal = rows.reduce((s, r) => s + r.actual, 0);
  const chart = rows.map((r) => ({ label: label(r.month), plan: r.plan, actual: r.actual }));

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>{t("revenuePlan.title")}</CardTitle>
          <CardDescription>{t("revenuePlan.subtitle")}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label={t("revenuePlan.prevYear")} onClick={() => setYear(year - 1)}>
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm font-semibold">{year}</span>
          <Button variant="outline" size="icon" aria-label={t("revenuePlan.nextYear")} onClick={() => setYear(year + 1)}>
            <ChevronRight size={16} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="plan" name={t("revenuePlan.plan")} fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name={t("revenuePlan.actual")} fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-sm font-semibold">
          {t("revenuePlan.totals", { plan: `${money(planTotal)} ${sym}`, actual: `${money(actualTotal)} ${sym}` })}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="py-2">{t("revenuePlan.month")}</th>
                <th className="py-2">{t("revenuePlan.plan")}</th>
                <th className="py-2">{t("revenuePlan.actual")}</th>
                <th className="py-2">{t("revenuePlan.achieved")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const value = drafts[r.month] ?? String(r.plan);
                const achieved = r.plan > 0 ? `${Math.round((r.actual / r.plan) * 100)}%` : "—";
                return (
                  <tr key={r.month} className="border-t border-border/60">
                    <td className="py-2 font-semibold">{label(r.month)}</td>
                    <td className="py-2">
                      <input
                        className={fieldCls}
                        type="number"
                        min={0}
                        step="0.01"
                        aria-label={`${t("revenuePlan.plan")} ${label(r.month)}`}
                        value={value}
                        onChange={(e) => setDrafts({ ...drafts, [r.month]: e.target.value })}
                      />
                    </td>
                    <td className="py-2">{money(r.actual)} {sym}</td>
                    <td className="py-2">{achieved}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <Button className={primaryBtn} disabled={busy || !canSave} onClick={() => void save()}>
            {t("revenuePlan.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
