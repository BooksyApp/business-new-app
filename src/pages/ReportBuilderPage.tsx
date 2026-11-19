import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Download, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, EmptyState, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { Field } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { useBusinessId } from "@/hooks/useBusinessId";
import { t, tDynamic } from "@/i18n";
import {
  customReportService,
  toCsv,
  type ReportDatasetInfo,
  type ReportDefinition,
  type ReportResult,
  type SavedReport,
} from "@/services/customReportService";
import { serviceService, type Service } from "@/services/serviceService";
import { staffService, type Staff } from "@/services/staffService";

const card = "rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]";
const chip = (on: boolean) =>
  `inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition ${
    on ? "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))] ring-[rgb(var(--reg-brand)/0.4)]" : "bg-white text-[rgb(var(--reg-muted))] ring-[rgb(var(--reg-line))]"
  }`;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
};

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Owner and managers with the reports permission: pick a dataset, columns, filters and a grouping. */
export default function ReportBuilderPage() {
  const businessId = useBusinessId();
  const [catalog, setCatalog] = useState<ReportDatasetInfo[]>([]);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [dataset, setDataset] = useState("bookings");
  const [columns, setColumns] = useState<string[]>(["date", "service", "staff", "status"]);
  const [groupBy, setGroupBy] = useState<string>("");
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(iso(new Date()));
  const [staffId, setStaffId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);

  const [result, setResult] = useState<ReportResult | null>(null);
  const [chartKey, setChartKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");

  const ds = useMemo(() => catalog.find((d) => d.key === dataset), [catalog, dataset]);
  const effectiveGroup = groupBy || ds?.defaultGroupBy || "";
  const grouped = effectiveGroup !== "";
  const label = (kind: "ds" | "col" | "grp", key: string, fallback: string) => tDynamic(`reportBuilder.${kind}.${key}`, fallback);

  const reloadSaved = useCallback(() => {
    if (!businessId) return;
    customReportService.list(businessId).then(setSaved).catch(() => toast.error(t("reportBuilder.loadFailed")));
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    customReportService.catalog(businessId).then(setCatalog).catch(() => toast.error(t("reportBuilder.loadFailed")));
    staffService.getStaffByBusiness(businessId).then(setStaff).catch(() => setStaff([]));
    serviceService.getServicesByBusiness(businessId).then(setServices).catch(() => setServices([]));
    reloadSaved();
  }, [businessId, reloadSaved]);

  // The columns a dataset offers depend on whether the report is grouped.
  const offered = useMemo(
    () => (ds ? ds.columns.filter((c) => (grouped ? c.aggregate : c.rowLevel)) : []),
    [ds, grouped],
  );

  const pickDataset = (key: string) => {
    const next = catalog.find((d) => d.key === key);
    setDataset(key);
    setGroupBy("");
    setStaffId("");
    setServiceId("");
    setStatuses([]);
    setSources([]);
    setResult(null);
    if (next) {
      const g = next.defaultGroupBy;
      const pool = next.columns.filter((c) => (g ? c.aggregate : c.rowLevel));
      setColumns(pool.slice(0, 4).map((c) => c.key));
    }
  };

  const pickGroup = (key: string) => {
    setGroupBy(key);
    setResult(null);
    const g = key || ds?.defaultGroupBy || "";
    if (!ds) return;
    const pool = ds.columns.filter((c) => (g ? c.aggregate : c.rowLevel));
    setColumns(pool.slice(0, g ? 2 : 4).map((c) => c.key));
  };

  const definition = (): ReportDefinition => ({
    dataset,
    columns,
    groupBy: groupBy || null,
    from: from || null,
    to: to || null,
    staffId: staffId || null,
    serviceId: serviceId || null,
    statuses,
    sources,
  });

  const apply = (d: ReportDefinition) => {
    setDataset(d.dataset);
    setColumns(d.columns);
    setGroupBy(d.groupBy ?? "");
    setFrom(d.from ?? "");
    setTo(d.to ?? "");
    setStaffId(d.staffId ?? "");
    setServiceId(d.serviceId ?? "");
    setStatuses(d.statuses ?? []);
    setSources(d.sources ?? []);
    setResult(null);
  };

  const run = async (d: ReportDefinition = definition()) => {
    if (!businessId) return;
    if (d.columns.length === 0) {
      toast.error(t("reportBuilder.pickColumns"));
      return;
    }
    setBusy(true);
    try {
      const r = await customReportService.run(businessId, d);
      setResult(r);
      setChartKey(r.columns.find((c, i) => i > 0 && (c.type === "number" || c.type === "money"))?.key ?? "");
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t("reportBuilder.runFailed"));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!businessId || !name.trim()) return;
    try {
      await customReportService.save(businessId, name.trim(), definition());
      toast.success(t("reportBuilder.saved"));
      setName("");
      reloadSaved();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t("reportBuilder.saveFailed"));
    }
  };

  const remove = async (id: string) => {
    if (!businessId) return;
    try {
      await customReportService.remove(businessId, id);
      toast.success(t("reportBuilder.deleted"));
      reloadSaved();
    } catch {
      toast.error(t("reportBuilder.deleteFailed"));
    }
  };

  const exportCsv = () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([toCsv(result)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${dataset}-${iso(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const chartData = useMemo(() => {
    if (!result || !chartKey) return [];
    const xi = 0;
    const yi = result.columns.findIndex((c) => c.key === chartKey);
    if (yi < 0) return [];
    return result.rows.slice(0, 60).map((r) => ({ x: String(r[xi] ?? ""), y: Number(r[yi] ?? 0) }));
  }, [result, chartKey]);
  const numericCols = result ? result.columns.filter((c, i) => i > 0 && (c.type === "number" || c.type === "money")) : [];
  const showChart = grouped && chartData.length > 0;

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("reportBuilder.title")} subtitle={t("reportBuilder.subtitle")} />
        <div className={pageBody}>
          <section className={`${card} space-y-5`}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("reportBuilder.dataset")} htmlFor="rb-ds">
                <select id="rb-ds" className={fieldCls} value={dataset} onChange={(e) => pickDataset(e.target.value)}>
                  {catalog.map((d) => (
                    <option key={d.key} value={d.key}>
                      {label("ds", d.key, d.label)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("reportBuilder.groupBy")} htmlFor="rb-group">
                <select id="rb-group" className={fieldCls} value={effectiveGroup} onChange={(e) => pickGroup(e.target.value)} disabled={!ds}>
                  {!ds?.defaultGroupBy && <option value="">{t("reportBuilder.noGrouping")}</option>}
                  {ds?.groupBys.map((g) => (
                    <option key={g.key} value={g.key}>
                      {label("grp", g.key, g.label)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">{grouped ? t("reportBuilder.columnsGrouped") : t("reportBuilder.columnsRows")}</p>
              <div className="flex flex-wrap gap-2">
                {offered.map((c) => (
                  <button key={c.key} type="button" className={chip(columns.includes(c.key))} aria-pressed={columns.includes(c.key)} onClick={() => setColumns(toggle(columns, c.key))}>
                    {label("col", c.key, c.label)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">{t("reportBuilder.filters")}</p>
              <div className="grid gap-4 md:grid-cols-4">
                <Field label={t("reportBuilder.from")} htmlFor="rb-from">
                  <input id="rb-from" type="date" className={fieldCls} value={from} onChange={(e) => setFrom(e.target.value)} />
                </Field>
                <Field label={t("reportBuilder.to")} htmlFor="rb-to">
                  <input id="rb-to" type="date" className={fieldCls} value={to} onChange={(e) => setTo(e.target.value)} />
                </Field>
                {ds?.filters.includes("staff") && (
                  <Field label={t("reportBuilder.staff")} htmlFor="rb-staff">
                    <select id="rb-staff" className={fieldCls} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                      <option value="">{t("reportBuilder.anyStaff")}</option>
                      {staff.map((s) => (
                        <option key={String(s.id)} value={String(s.id)}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {ds?.filters.includes("service") && (
                  <Field label={t("reportBuilder.service")} htmlFor="rb-service">
                    <select id="rb-service" className={fieldCls} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                      <option value="">{t("reportBuilder.anyService")}</option>
                      {services.map((s) => (
                        <option key={String(s.id)} value={String(s.id)}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
              {ds?.filters.includes("status") && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-[rgb(var(--reg-muted))]">{t("reportBuilder.status")}</p>
                  <div className="flex flex-wrap gap-2">
                    {ds.statuses.map((s) => (
                      <button key={s} type="button" className={chip(statuses.includes(s))} aria-pressed={statuses.includes(s)} onClick={() => setStatuses(toggle(statuses, s))}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {ds?.filters.includes("source") && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-[rgb(var(--reg-muted))]">{t("reportBuilder.source")}</p>
                  <div className="flex flex-wrap gap-2">
                    {ds.sources.map((s) => (
                      <button key={s} type="button" className={chip(sources.includes(s))} aria-pressed={sources.includes(s)} onClick={() => setSources(toggle(sources, s))}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className={primaryBtn} disabled={busy || !ds} onClick={() => void run()}>
                <BarChart3 size={16} /> {busy ? t("reportBuilder.running") : t("reportBuilder.run")}
              </Button>
            </div>
          </section>

          {result && (
            <section className={`${card} space-y-4`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">
                  {t("reportBuilder.result")} <span className="text-sm font-normal text-[rgb(var(--reg-muted))]">· {t("reportBuilder.rows", { count: result.rows.length })}</span>
                </h2>
                <Button className={secondaryBtn} onClick={exportCsv} disabled={result.rows.length === 0}>
                  <Download size={16} /> {t("reportBuilder.exportCsv")}
                </Button>
              </div>
              {result.truncated && <p className="text-sm text-amber-700">{t("reportBuilder.truncated")}</p>}

              {result.rows.length === 0 ? (
                <EmptyState icon={BarChart3} title={t("reportBuilder.noRows")} body="" />
              ) : (
                <>
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <p className="text-sm font-semibold">{t("reportBuilder.chart")}</p>
                      {showChart && numericCols.length > 1 && (
                        <label className="flex items-center gap-2 text-sm">
                          {t("reportBuilder.chartMetric")}
                          <select className="rounded-lg border border-[rgb(var(--reg-line))] bg-white px-2 py-1" value={chartKey} onChange={(e) => setChartKey(e.target.value)}>
                            {numericCols.map((c) => (
                              <option key={c.key} value={c.key}>
                                {label("col", c.key, c.label)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    {showChart ? (
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="x" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} width={48} />
                            <Tooltip />
                            <Bar dataKey="y" name={label("col", chartKey, chartKey)} fill="rgb(var(--reg-brand))" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-sm text-[rgb(var(--reg-muted))]">{t("reportBuilder.chartNeedsGroup")}</p>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-2xl ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead className="bg-[rgb(var(--reg-canvas))] text-xs font-semibold text-[rgb(var(--reg-muted))]">
                        <tr>
                          {result.columns.map((c) => (
                            <th key={c.key} className={`px-4 py-3 ${c.type === "number" || c.type === "money" ? "text-right" : ""}`}>
                              {label("col", c.key, c.label)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, ri) => (
                          <tr key={ri} className="border-t border-[rgb(var(--reg-line)/0.8)]">
                            {row.map((cell, ci) => (
                              <td key={ci} className={`px-4 py-2.5 ${result.columns[ci].type === "number" || result.columns[ci].type === "money" ? "text-right tabular-nums" : ""}`}>
                                {cell === null ? "" : String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="flex flex-wrap items-end gap-3 border-t border-[rgb(var(--reg-line)/0.8)] pt-4">
                <Field label={t("reportBuilder.saveTitle")} htmlFor="rb-name" className="min-w-[240px] flex-1">
                  <input id="rb-name" className={fieldCls} maxLength={120} placeholder={t("reportBuilder.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Button className={primaryBtn} disabled={!name.trim()} onClick={() => void save()}>
                  <Save size={16} /> {t("reportBuilder.save")}
                </Button>
              </div>
            </section>
          )}

          <section className={card}>
            <h2 className="mb-3 text-lg font-bold">{t("reportBuilder.savedReports")}</h2>
            {saved.length === 0 ? (
              <p className="text-sm text-[rgb(var(--reg-muted))]">{t("reportBuilder.savedEmpty")}</p>
            ) : (
              <ul className="divide-y divide-[rgb(var(--reg-line)/0.8)]">
                {saved.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="font-semibold">{r.name}</span>
                    <span className="flex gap-2">
                      <Button
                        className={secondaryBtn}
                        disabled={!r.definition}
                        onClick={() => {
                          if (!r.definition) return;
                          apply(r.definition);
                          void run(r.definition);
                        }}
                      >
                        {t("reportBuilder.open")}
                      </Button>
                      <Button className={secondaryBtn} onClick={() => void remove(r.id)} aria-label={t("reportBuilder.delete")}>
                        <Trash2 size={16} />
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
