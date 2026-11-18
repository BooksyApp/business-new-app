import { useMemo, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { t } from "@/i18n";
import { parseIcs } from "@/lib/ics";
import { readSheet } from "@/lib/sheet";
import { bookingImportService, type BookingImportPlan, type BookingImportRow } from "@/services/bookingImportService";
import { serviceService } from "@/services/serviceService";
import { staffService } from "@/services/staffService";
import type { Id } from "@/types/id";

const FIELDS = ["date", "startTime", "endTime", "staff", "service", "clientName", "clientPhone", "clientEmail", "price", "note"] as const;
type Field = (typeof FIELDS)[number];

/** Header words (az / en / ru, and the ICS export keys) that suggest a field; the owner can change every choice. */
const GUESS: [Field, RegExp][] = [
  ["date", /^date$|tarix|дата/i],
  ["startTime", /start|başla|начал|^time$/i],
  ["endTime", /end|bitm|конец|finish/i],
  ["staff", /staff|usta|master|мастер|specialist/i],
  ["service", /service|xidmət|услуг|^summary$/i],
  ["clientName", /^client$|client|müştəri|клиент/i],
  ["clientPhone", /phone|tel|mobil|telefon|телеф/i],
  ["clientEmail", /mail|почт|poçt/i],
  ["price", /price|qiymət|цена|məbləğ/i],
  ["note", /note|qeyd|comment|заметк|коммент|description/i],
];

const btn = "inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition disabled:opacity-60";
const primary = `${btn} bg-[rgb(var(--reg-brand-strong))] text-white hover:brightness-110`;
const secondary = `${btn} bg-white ring-1 ring-[rgb(var(--reg-line))] hover:bg-[rgb(var(--reg-brand-soft))]`;

type Staff = { id: Id; name: string };
type Service = { id: Id; name: string };

export function BookingImportDialog({ businessId, timeZone, open, onOpenChange, onImported }: {
  businessId: Id;
  timeZone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [table, setTable] = useState<string[][] | null>(null);
  const [map, setMap] = useState<(Field | "")[]>([]);
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffPick, setStaffPick] = useState<Record<string, Id | "">>({});
  const [servicePick, setServicePick] = useState<Record<string, Id | "">>({});
  const [plan, setPlan] = useState<BookingImportPlan | null>(null);
  const [done, setDone] = useState<BookingImportPlan | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setTable(null); setMap([]); setPlan(null); setDone(null); setStaffPick({}); setServicePick({}); };

  const body = useMemo(() => table?.slice(1) ?? [], [table]);
  const colOf = (f: Field) => map.indexOf(f);
  const distinct = (f: Field) => {
    const i = colOf(f);
    if (i < 0) return [] as string[];
    return [...new Set(body.map((r) => (r[i] ?? "").trim()))];
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const [rows, staffList, serviceList] = await Promise.all([
        /\.ics$/i.test(file.name) ? file.text().then((text) => parseIcs(text, timeZone)) : readSheet(file),
        staffService.getStaffByBusiness(businessId),
        serviceService.getServicesByBusiness(businessId),
      ]);
      if (rows.length < 2) throw new Error("EMPTY");
      const used = new Set<Field>();
      setMap(rows[0].map((h) => {
        const hit = GUESS.find(([f, re]) => !used.has(f) && re.test(h.trim()));
        if (!hit) return "";
        used.add(hit[0]);
        return hit[0];
      }));
      setStaffs(staffList as Staff[]);
      setServices(serviceList as Service[]);
      setTable(rows);
      setPlan(null);
    } catch {
      toast.error(t("bookingImport.readFailed"));
    }
  };

  // Auto-select a salon staff or service whose name matches a file value (case-insensitive).
  const preselect = (names: string[], list: { id: Id; name: string }[]) =>
    Object.fromEntries(names.map((n) => [n, list.find((x) => x.name.trim().toLowerCase() === n.toLowerCase())?.id ?? ""]));

  const staffNames = distinct("staff");
  const serviceNames = distinct("service");
  const staffValue = (n: string) => staffPick[n] ?? preselect([n], staffs)[n];
  const serviceValue = (n: string) => servicePick[n] ?? preselect([n], services)[n];

  const mapped = (): BookingImportRow[] =>
    body.map((r) => {
      const get = (f: Field) => {
        const i = colOf(f);
        return i < 0 ? "" : (r[i] ?? "").trim();
      };
      const staffName = get("staff");
      const serviceName = get("service");
      return {
        date: get("date") || undefined,
        startTime: get("startTime") || undefined,
        endTime: get("endTime") || undefined,
        staffId: (staffName && staffValue(staffName)) || undefined,
        serviceId: (serviceName && serviceValue(serviceName)) || undefined,
        clientName: get("clientName") || undefined,
        clientPhone: get("clientPhone") || undefined,
        clientEmail: get("clientEmail") || undefined,
        price: get("price") || undefined,
        note: get("note") || undefined,
      };
    });

  const preview = async () => {
    setBusy(true);
    try {
      setPlan(await bookingImportService.preview(businessId, mapped()));
    } catch {
      toast.error(t("bookingImport.failed"));
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    setBusy(true);
    try {
      const result = await bookingImportService.run(businessId, mapped());
      setDone(result);
      onImported();
    } catch {
      toast.error(t("bookingImport.failed"));
    } finally {
      setBusy(false);
    }
  };

  const counts = (p: BookingImportPlan) => (
    <ul className="grid grid-cols-3 gap-2 text-sm">
      {(["NEW", "CONFLICT", "ERROR"] as const).map((s) => (
        <li key={s} className="rounded-2xl bg-[rgb(var(--reg-brand-soft))] p-3">
          <p className="text-xl font-extrabold">{p.counts[s] ?? 0}</p>
          <p className="text-[rgb(var(--reg-muted))]">{t(`bookingImport.status${s}`)}</p>
        </li>
      ))}
    </ul>
  );

  const selectCls = "h-9 rounded-lg border border-[rgb(var(--reg-line))] bg-white px-2";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("bookingImport.title")}</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="space-y-4">
            <p className="text-sm">{t("bookingImport.done")}</p>
            {counts(done)}
          </div>
        ) : !table ? (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[rgb(var(--reg-line))] p-8 text-center">
            <Upload size={24} aria-hidden />
            <span className="font-semibold">{t("bookingImport.choose")}</span>
            <span className="text-sm text-[rgb(var(--reg-muted))]">{t("bookingImport.hint")}</span>
            <input type="file" accept=".ics,.csv,.txt,.xlsx" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-[rgb(var(--reg-muted))]">{t("bookingImport.mapHint", { count: body.length })}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(table[0] ?? []).map((h, i) => (
                <label key={i} className="flex items-center justify-between gap-2 rounded-xl bg-white p-2 text-sm ring-1 ring-[rgb(var(--reg-line))]">
                  <span className="min-w-0 truncate font-semibold" title={h}>{h || `#${i + 1}`}</span>
                  <select
                    value={map[i] ?? ""}
                    onChange={(e) => { const next = [...map]; next[i] = e.target.value as Field | ""; setMap(next); setPlan(null); }}
                    className={selectCls}
                  >
                    <option value="">{t("bookingImport.skip")}</option>
                    {FIELDS.map((f) => <option key={f} value={f}>{t(`bookingImport.field_${f}`)}</option>)}
                  </select>
                </label>
              ))}
            </div>

            {(staffNames.length > 0 || serviceNames.length > 0) && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">{t("bookingImport.mapNamesHint")}</p>
                {staffNames.length > 0 && (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {staffNames.map((n) => (
                      <li key={`s-${n}`} className="flex items-center justify-between gap-2 rounded-xl bg-white p-2 text-sm ring-1 ring-[rgb(var(--reg-line))]">
                        <span className="min-w-0 truncate">{t("bookingImport.staffLabel")}: {n || t("bookingImport.emptyName")}</span>
                        <select value={staffValue(n) ?? ""} onChange={(e) => { setStaffPick({ ...staffPick, [n]: e.target.value }); setPlan(null); }} className={selectCls}>
                          <option value="">{t("bookingImport.unmapped")}</option>
                          {staffs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </li>
                    ))}
                  </ul>
                )}
                {serviceNames.length > 0 && (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {serviceNames.map((n) => (
                      <li key={`v-${n}`} className="flex items-center justify-between gap-2 rounded-xl bg-white p-2 text-sm ring-1 ring-[rgb(var(--reg-line))]">
                        <span className="min-w-0 truncate">{t("bookingImport.serviceLabel")}: {n || t("bookingImport.emptyName")}</span>
                        <select value={serviceValue(n) ?? ""} onChange={(e) => { setServicePick({ ...servicePick, [n]: e.target.value }); setPlan(null); }} className={selectCls}>
                          <option value="">{t("bookingImport.unmapped")}</option>
                          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {plan && (
              <>
                {counts(plan)}
                <div className="max-h-64 overflow-auto rounded-xl ring-1 ring-[rgb(var(--reg-line))]">
                  <table className="w-full text-left text-sm">
                    <tbody>
                      {plan.rows.slice(0, 200).map((r) => (
                        <tr key={r.row} className="border-b border-[rgb(var(--reg-line))] last:border-0">
                          <td className="p-2 text-[rgb(var(--reg-muted))]">{r.row}</td>
                          <td className="p-2">{r.date} {r.startTime ?? ""}</td>
                          <td className="p-2">{r.clientName ?? "—"}</td>
                          <td className="p-2">
                            {t(`bookingImport.status${r.status}`)}
                            {r.reason ? ` · ${r.reason}` : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" className={secondary} onClick={reset} disabled={busy}>{t("bookingImport.anotherFile")}</button>
              {!plan ? (
                <button type="button" className={primary} onClick={() => void preview()} disabled={busy || !map.includes("date") || !map.includes("startTime")}>
                  {busy && <Loader2 size={16} className="animate-spin" />} {t("bookingImport.preview")}
                </button>
              ) : (
                <button type="button" className={primary} onClick={() => void run()} disabled={busy || (plan.counts.NEW ?? 0) === 0}>
                  {busy && <Loader2 size={16} className="animate-spin" />} {t("bookingImport.run")}
                </button>
              )}
            </div>
            <p className="text-xs text-[rgb(var(--reg-muted))]">{t("bookingImport.noEmailNote")}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
