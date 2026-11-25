import { useMemo, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { t } from "@/i18n";
import { readSheet, toCsv } from "@/lib/sheet";
import { clientImportService, type ImportPlan, type ImportRow } from "@/services/clientImportService";
import type { Id } from "@/types/id";

const FIELDS = ["name", "firstName", "lastName", "phone", "email", "birthday", "note", "tags"] as const;
type Field = (typeof FIELDS)[number];

/** Header words (az / en / ru) that suggest a field; the owner can change every choice. */
const GUESS: [Field, RegExp][] = [
  ["firstName", /first|^ad$|имя/i],
  ["lastName", /last|soyad|фамил/i],
  ["name", /name|^ad\b|müştəri|client|клиент|фио/i],
  ["phone", /phone|tel|mobil|telefon|телеф/i],
  ["email", /mail|почт|poçt/i],
  ["birthday", /birth|doğum|дата рожд|день рожд/i],
  ["note", /note|qeyd|comment|заметк|коммент/i],
  ["tags", /tag|teq|тег|kateqor|categ/i],
];

const btn = "inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition disabled:opacity-60";
const primary = `${btn} bg-[rgb(var(--reg-brand-strong))] text-white hover:brightness-110`;
const secondary = `${btn} bg-white ring-1 ring-[rgb(var(--reg-line))] hover:bg-[rgb(var(--reg-brand-soft))]`;

export function ClientImportDialog({ businessId, open, onOpenChange, onImported }: {
  businessId: Id;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [table, setTable] = useState<string[][] | null>(null);
  const [map, setMap] = useState<(Field | "")[]>([]);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [done, setDone] = useState<ImportPlan | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setTable(null); setMap([]); setPlan(null); setDone(null); };

  const header = table?.[0] ?? [];
  const body = useMemo(() => table?.slice(1) ?? [], [table]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const rows = await readSheet(file);
      if (rows.length < 2) throw new Error("EMPTY");
      const used = new Set<Field>();
      setMap(rows[0].map((h) => {
        const hit = GUESS.find(([f, re]) => !used.has(f) && re.test(h.trim()));
        if (!hit) return "";
        used.add(hit[0]);
        return hit[0];
      }));
      setTable(rows);
      setPlan(null);
    } catch (e) {
      toast.error(e instanceof Error && e.message === "XLS" ? t("clients.importXlsOld") : t("clients.importReadFailed"));
    }
  };

  const mapped = (): ImportRow[] =>
    body.map((r) => {
      const row: ImportRow = {};
      map.forEach((f, i) => {
        const v = (r[i] ?? "").trim();
        if (f && v) row[f] = row[f] ? `${row[f]} ${v}` : v;
      });
      return row;
    });

  const preview = async () => {
    setBusy(true);
    try {
      setPlan(await clientImportService.preview(businessId, mapped()));
    } catch {
      toast.error(t("clients.importFailed"));
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    setBusy(true);
    try {
      const result = await clientImportService.run(businessId, mapped());
      setDone(result);
      onImported();
    } catch {
      toast.error(t("clients.importFailed"));
    } finally {
      setBusy(false);
    }
  };

  const errorsCsv = (p: ImportPlan) => {
    const bad = p.rows.filter((r) => r.status === "ERROR");
    const csv = toCsv([[...header, t("clients.importReason")], ...bad.map((r) => [...(body[r.row - 1] ?? []), r.reason ?? ""])]);
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const counts = (p: ImportPlan) => (
    <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      {(["NEW", "MERGE_EXISTING", "MERGE_IN_FILE", "ERROR"] as const).map((s) => (
        <li key={s} className="rounded-2xl bg-[rgb(var(--reg-brand-soft))] p-3">
          <p className="text-xl font-extrabold">{p.counts[s] ?? 0}</p>
          <p className="text-[rgb(var(--reg-muted))]">{t(`clients.importStatus${s}`)}</p>
        </li>
      ))}
    </ul>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("clients.importTitle")}</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="space-y-4">
            <p className="text-sm">{t("clients.importDone")}</p>
            {counts(done)}
            {(done.counts.ERROR ?? 0) > 0 && (
              <button type="button" className={secondary} onClick={() => errorsCsv(done)}>
                <Download size={16} /> {t("clients.importErrorsCsv")}
              </button>
            )}
          </div>
        ) : !table ? (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[rgb(var(--reg-line))] p-8 text-center">
            <Upload size={24} aria-hidden />
            <span className="font-semibold">{t("clients.importChoose")}</span>
            <span className="text-sm text-[rgb(var(--reg-muted))]">{t("clients.importHint")}</span>
            <input type="file" accept=".csv,.txt,.xlsx" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-[rgb(var(--reg-muted))]">{t("clients.importMapHint", { count: body.length })}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {header.map((h, i) => (
                <label key={i} className="flex items-center justify-between gap-2 rounded-xl bg-white p-2 text-sm ring-1 ring-[rgb(var(--reg-line))]">
                  <span className="min-w-0 truncate font-semibold" title={h}>{h || `#${i + 1}`}</span>
                  <select
                    value={map[i] ?? ""}
                    onChange={(e) => { const next = [...map]; next[i] = e.target.value as Field | ""; setMap(next); setPlan(null); }}
                    className="h-9 rounded-lg border border-[rgb(var(--reg-line))] bg-white px-2"
                  >
                    <option value="">{t("clients.importSkip")}</option>
                    {FIELDS.map((f) => <option key={f} value={f}>{t(`clients.importField_${f}`)}</option>)}
                  </select>
                </label>
              ))}
            </div>

            {plan && (
              <>
                {counts(plan)}
                <div className="max-h-64 overflow-auto rounded-xl ring-1 ring-[rgb(var(--reg-line))]">
                  <table className="w-full text-left text-sm">
                    <tbody>
                      {plan.rows.slice(0, 200).map((r) => (
                        <tr key={r.row} className="border-b border-[rgb(var(--reg-line))] last:border-0">
                          <td className="p-2 text-[rgb(var(--reg-muted))]">{r.row + 1}</td>
                          <td className="p-2">{r.name ?? "—"}</td>
                          <td className="p-2">{r.phone ?? r.email ?? ""}</td>
                          <td className="p-2">
                            {t(`clients.importStatus${r.status}`)}
                            {r.matchedName ? ` · ${r.matchedName}` : ""}
                            {r.status === "ERROR" && r.reason ? ` · ${r.reason}` : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" className={secondary} onClick={reset} disabled={busy}>{t("clients.importAnotherFile")}</button>
              {!plan ? (
                <button type="button" className={primary} onClick={() => void preview()} disabled={busy || !map.some(Boolean)}>
                  {busy && <Loader2 size={16} className="animate-spin" />} {t("clients.importPreview")}
                </button>
              ) : (
                <button
                  type="button"
                  className={primary}
                  onClick={() => void run()}
                  disabled={busy || (plan.counts.NEW ?? 0) + (plan.counts.MERGE_EXISTING ?? 0) + (plan.counts.MERGE_IN_FILE ?? 0) === 0}
                >
                  {busy && <Loader2 size={16} className="animate-spin" />} {t("clients.importRun")}
                </button>
              )}
            </div>
            <p className="text-xs text-[rgb(var(--reg-muted))]">{t("clients.importConsentNote")}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
