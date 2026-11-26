import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BooqiScope, PageHeader, pageBody } from "@/components/bz/p4-compat";

import { AppLayout } from "@/components/layout/AppLayout";
import { primaryBtn, sheetSecondary } from "@/components/page/booqiStyles";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/currency";
import { getCurrentBusinessId } from "@/config/api";
import { getUserBusinesses } from "@/utils/businessUtils";
import { serviceService, type Service } from "@/services/serviceService";
import { centralCatalogService, type CentralPlanRow } from "@/services/centralCatalogService";
import type { Id } from "@/types/id";
import { t } from "@/i18n";

type Salon = { id: Id; name: string };

/**
 * FG-W5-10: push services (name, duration, price, category) from this salon to the owner's
 * other salons. Always previews first; applying runs the same plan. A salon that overrode a
 * price keeps it unless the owner locks the price for the push.
 */
export default function CentralPricesPage() {
  const navigate = useNavigate();
  const sourceId = getCurrentBusinessId();
  const [services, setServices] = useState<Service[] | null>(null);
  const [salons, setSalons] = useState<Salon[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [targets, setTargets] = useState<Set<string>>(new Set());
  const [lock, setLock] = useState(false);
  const [plan, setPlan] = useState<CentralPlanRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  // A price typed for one service in one salon ("serviceId|salonId" -> text); the plan must be re-previewed after a change.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [stale, setStale] = useState(false);

  useEffect(() => {
    serviceService
      .getServicesByBusiness(sourceId)
      .then((list) => {
        setServices(list);
        setPicked(new Set(list.map((s) => String(s.id))));
      })
      .catch(() => setServices([]));
    getUserBusinesses()
      .then((list) => {
        const others = (list as Salon[]).filter((b) => String(b.id) !== String(sourceId));
        setSalons(others);
        setTargets(new Set(others.map((b) => String(b.id))));
      })
      .catch(() => setSalons([]));
  }, [sourceId]);

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
    setPlan(null);
  };

  const input = () => ({
    serviceIds: Array.from(picked),
    targetBusinessIds: Array.from(targets),
    lockPrice: lock,
    overrides: lock
      ? undefined
      : Object.entries(overrides)
          .map(([k, v]) => ({ k, n: Number(v.replace(",", ".")) }))
          .filter((o) => o.k && Number.isFinite(o.n) && o.n >= 0 && overrides[o.k].trim() !== "")
          .map((o) => {
            const [serviceId, targetBusinessId] = o.k.split("|");
            return { serviceId, targetBusinessId, price: o.n };
          }),
  });
  const canRun = picked.size > 0 && targets.size > 0 && !busy;

  const runPreview = () => {
    setBusy(true);
    centralCatalogService
      .preview(sourceId, input())
      .then((rows) => {
        setPlan(rows);
        setStale(false);
      })
      .catch(() => toast.error(t("cp.couldNotPreview")))
      .finally(() => setBusy(false));
  };

  const apply = () => {
    setBusy(true);
    centralCatalogService
      .apply(sourceId, input())
      .then((rows) => {
        setPlan(rows);
        toast.success(t("cp.applied"));
      })
      .catch(() => toast.error(t("cp.couldNotApply")))
      .finally(() => setBusy(false));
  };

  const salonName = useMemo(() => {
    const m = new Map((salons ?? []).map((s) => [String(s.id), s.name]));
    return (id: Id) => m.get(String(id)) ?? "";
  }, [salons]);

  const actionLabel = (r: CentralPlanRow) => {
    if (r.action === "BLOCKED") return t("cp.blockedName");
    if (r.action === "CREATE") return t("cp.willCreate");
    if (r.action === "UPDATE") return t("cp.willUpdate");
    return t("cp.noChange");
  };

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("cp.title")} subtitle={t("cp.hint")} />
        <div className={pageBody}>
          {services === null || salons === null ? (
            <div className="h-32 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy />
          ) : salons.length === 0 ? (
            <div className="rounded-[20px] border-2 border-dashed border-[rgb(var(--reg-line))] p-5 text-sm text-[rgb(var(--reg-muted))]">{t("cp.noOtherSalons")}</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                <p className="mb-2 font-bold">{t("cp.servicesToPush")}</p>
                <ul className="space-y-1">
                  {services.map((s) => (
                    <li key={String(s.id)}>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={picked.has(String(s.id))} onChange={() => toggle(picked, String(s.id), setPicked)} />
                        <span className="font-semibold">{s.name}</span>
                        <span className="text-[rgb(var(--reg-muted))]">· {formatPrice(s.price ?? 0)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                <p className="mb-2 font-bold">{t("cp.toSalons")}</p>
                <ul className="space-y-1">
                  {salons.map((b) => (
                    <li key={String(b.id)}>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={targets.has(String(b.id))} onChange={() => toggle(targets, String(b.id), setTargets)} />
                        <span className="font-semibold">{b.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <label className="mt-4 flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={lock} onChange={(e) => { setLock(e.target.checked); setPlan(null); }} />
                  <span>
                    <span className="font-semibold">{t("cp.lockPrice")}</span>
                    <span className="block text-[rgb(var(--reg-muted))]">{t("cp.lockHint")}</span>
                  </span>
                </label>
              </section>
            </div>
          )}

          {salons && salons.length > 0 && services && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" className={sheetSecondary} disabled={!canRun} onClick={runPreview}>{t("cp.preview")}</Button>
              <Button className={primaryBtn} disabled={!plan || stale || busy || plan.length === 0} onClick={apply}>{t("cp.apply")}</Button>
              <Button variant="ghost" onClick={() => navigate("../locations")}>{t("cp.backToLocations")}</Button>
            </div>
          )}

          {plan && stale && <p className="mt-3 text-sm text-amber-900">{t("cp.previewAgain")}</p>}
          {plan && (
            <div className="mt-4 overflow-x-auto rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-[12px] text-[rgb(var(--reg-muted))]">
                    <th className="px-3 py-2">{t("cp.salon")}</th>
                    <th className="px-3 py-2">{t("cp.service")}</th>
                    <th className="px-3 py-2">{t("cp.change")}</th>
                    <th className="px-3 py-2 text-right">{t("cp.price")}</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.map((r, i) => (
                    <tr key={`${r.targetBusinessId}-${r.serviceId}-${i}`} className="border-t border-[rgb(var(--reg-line)/0.6)]">
                      <td className="px-3 py-3.5">{salonName(r.targetBusinessId)}</td>
                      <td className="px-3 py-3.5">{r.serviceName}</td>
                      <td className="px-3 py-3.5">
                        {actionLabel(r)}
                        {r.priceAction === "KEEP_LOCAL" && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">{t("cp.keepsLocalPrice")}</span>}
                        {r.categoryToCreate && <span className="ml-2 text-[11px] text-[rgb(var(--reg-muted))]">{t("cp.newCategory")}</span>}
                      </td>
                      <td className="px-3 py-3.5 text-right tabular-nums">
                        {r.currentPrice !== null && r.currentPrice !== undefined ? `${formatPrice(r.currentPrice)} → ` : ""}
                        {formatPrice(r.newPrice ?? 0)}
                        {!lock && r.action !== "BLOCKED" && (
                          <input
                            inputMode="decimal"
                            aria-label={t("cp.overridePrice")}
                            placeholder={t("cp.overridePrice")}
                            value={overrides[`${r.serviceId}|${r.targetBusinessId}`] ?? ""}
                            onChange={(e) => {
                              const key = `${r.serviceId}|${r.targetBusinessId}`;
                              setOverrides((prev) => ({ ...prev, [key]: e.target.value }));
                              setStale(true);
                            }}
                            className="ml-3 h-8 w-24 rounded-lg border px-2 text-right text-xs"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                  {plan.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-3 text-[rgb(var(--reg-muted))]">{t("cp.nothingToDo")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
