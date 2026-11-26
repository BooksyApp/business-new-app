import { useMemo, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Btn, DataTable, Dialog, Field as BzField, FormGrid, Note, Tile, Tiles } from "@/components/bz";
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
    <Tiles cols={4}>
      {(["NEW", "MERGE_EXISTING", "MERGE_IN_FILE", "ERROR"] as const).map((s) => (
        <Tile key={s} label={t(`clients.importStatus${s}`)} value={p.counts[s] ?? 0} />
      ))}
    </Tiles>
  );

  if (!open) return null;
  return (
    <Dialog
      title={t("clients.importTitle")}
      width={720}
      onClose={() => { reset(); onOpenChange(false); }}
    >
      {done ? (
        <>
          <Note kind="gd">{t("clients.importDone")}</Note>
          {counts(done)}
          {(done.counts.ERROR ?? 0) > 0 && (
            <div>
              <Btn kind="ol" icon={<Download className="ic" />} onClick={() => errorsCsv(done)}>
                {t("clients.importErrorsCsv")}
              </Btn>
            </div>
          )}
        </>
      ) : !table ? (
        <label className="esx" style={{ cursor: "pointer" }}>
          <div className="ib"><Upload className="ic" aria-hidden /></div>
          <b>{t("clients.importChoose")}</b>
          <span>{t("clients.importHint")}</span>
          <input type="file" accept=".csv,.txt,.xlsx" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
      ) : (
        <>
          <div className="a-note">{t("clients.importMapHint", { count: body.length })}</div>
          <FormGrid cols={2}>
            {header.map((h, i) => (
              <BzField key={i} label={h || `#${i + 1}`} kind="sel">
                <select
                  value={map[i] ?? ""}
                  onChange={(e) => { const next = [...map]; next[i] = e.target.value as Field | ""; setMap(next); setPlan(null); }}
                >
                  <option value="">{t("clients.importSkip")}</option>
                  {FIELDS.map((f) => <option key={f} value={f}>{t(`clients.importField_${f}`)}</option>)}
                </select>
              </BzField>
            ))}
          </FormGrid>

          {plan && (
            <>
              {counts(plan)}
              <div style={{ maxHeight: 256, overflow: "auto" }}>
                <DataTable
                  grid="48px 1.4fr 1.4fr 2fr"
                  columns={["#", t("clients.importField_name"), t("clients.importField_phone"), ""]}
                  rows={plan.rows.slice(0, 200)}
                  rowKey={(r) => r.row}
                  render={(r) => [
                    r.row + 1,
                    r.name ?? "—",
                    r.phone ?? r.email ?? "",
                    <>
                      {t(`clients.importStatus${r.status}`)}
                      {r.matchedName ? ` · ${r.matchedName}` : ""}
                      {r.status === "ERROR" && r.reason ? ` · ${r.reason}` : ""}
                    </>,
                  ]}
                />
              </div>
            </>
          )}

          <div className="row gap8" style={{ flexWrap: "wrap" }}>
            <Btn kind="ol" onClick={reset} disabled={busy}>{t("clients.importAnotherFile")}</Btn>
            {!plan ? (
              <Btn kind="v" onClick={() => void preview()} disabled={busy || !map.some(Boolean)} icon={busy ? <Loader2 className="ic animate-spin" /> : undefined}>
                {t("clients.importPreview")}
              </Btn>
            ) : (
              <Btn
                kind="v"
                onClick={() => void run()}
                disabled={busy || (plan.counts.NEW ?? 0) + (plan.counts.MERGE_EXISTING ?? 0) + (plan.counts.MERGE_IN_FILE ?? 0) === 0}
                icon={busy ? <Loader2 className="ic animate-spin" /> : undefined}
              >
                {t("clients.importRun")}
              </Btn>
            )}
          </div>
          <div className="a-note">{t("clients.importConsentNote")}</div>
        </>
      )}
    </Dialog>
  );
}
