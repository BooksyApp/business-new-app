import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, History, Search } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { primaryBtn } from "@/components/page/booqiStyles";
import { Field } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { useBusinessId } from "@/hooks/useBusinessId";
import { getHubLocale } from "@/lib/hubLocale";
import { formatDate } from "@/i18n/format";
import { t } from "@/i18n";
import { auditLogService, type AuditLogEntry } from "@/services/auditLogService";
import { BooqiScope, EmptyState, PageHeader, pageBody } from "@/components/bz/p4-compat";

const PAGE = 50;
/** The most rows one CSV export takes; the server caps a page at 500 too. */
const EXPORT_MAX = 500;

const when = (ts: string) =>
  formatDate(getHubLocale(), ts, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** One CSV cell: quoted, and a leading = + - or @ is neutralised so a name cannot start a formula. */
const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** Owner-only, read-only view of the salon's audit log. The server answers only the owner. */
export default function AuditLogPage() {
  const businessId = useBusinessId();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actorInput, setActorInput] = useState("");
  const [applied, setApplied] = useState({ from: "", to: "", actor: "" });
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    let live = true;
    setBusy(true);
    auditLogService
      .list(businessId, { ...applied, limit: PAGE, offset })
      .then((r) => {
        if (live) setRows(r);
      })
      .catch(() => {
        if (live) {
          setRows([]);
          toast.error(t("auditLog.loadFailed"));
        }
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [businessId, applied, offset]);

  const search = () => {
    setOffset(0);
    setApplied({ from, to, actor: actorInput });
  };

  const exportCsv = async () => {
    if (!businessId) return;
    try {
      const all = await auditLogService.list(businessId, { ...applied, limit: EXPORT_MAX, offset: 0 });
      const head = ["created_at", "actor_name", "method", "path", "entity_type", "entity_id", "status", "summary"];
      const body = all.map((r) => head.map((k) => csvCell(r[k as keyof AuditLogEntry])).join(","));
      const blob = new Blob(["﻿" + [head.join(","), ...body].join("\r\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      if (all.length === EXPORT_MAX) toast.message(t("auditLog.exportCapped"));
    } catch {
      toast.error(t("auditLog.exportFailed"));
    }
  };

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("auditLog.title")} subtitle={t("auditLog.subtitle")} />
        <div className={pageBody}>
          <section className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
            <div className="flex flex-wrap items-end gap-3">
              <Field label={t("auditLog.from")} htmlFor="al-from">
                <input id="al-from" type="date" className={fieldCls} value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label={t("auditLog.to")} htmlFor="al-to">
                <input id="al-to" type="date" className={fieldCls} value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
              <Field label={t("auditLog.actor")} htmlFor="al-actor">
                <input
                  id="al-actor"
                  className={fieldCls}
                  placeholder={t("auditLog.actorPlaceholder")}
                  value={actorInput}
                  onChange={(e) => setActorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") search();
                  }}
                />
              </Field>
              <Button className={primaryBtn} disabled={busy} onClick={search}>
                <Search size={16} /> {t("auditLog.search")}
              </Button>
              <Button variant="outline" onClick={() => void exportCsv()}>
                <Download size={16} /> {t("auditLog.exportCsv")}
              </Button>
            </div>
          </section>

          {rows.length > 0 || offset > 0 ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" aria-label={t("auditLog.prev")} disabled={offset === 0 || busy} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm font-semibold">
                {offset + 1}–{offset + rows.length}
              </span>
              <Button variant="outline" size="icon" aria-label={t("auditLog.next")} disabled={rows.length < PAGE || busy} onClick={() => setOffset(offset + PAGE)}>
                <ChevronRight size={16} />
              </Button>
            </div>
          ) : null}

          {rows.length === 0 && !busy ? (
            <EmptyState icon={History} title={t("auditLog.empty")} body={t("auditLog.emptyBody")} />
          ) : (
            <div className="overflow-x-auto rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs font-semibold text-[rgb(var(--reg-muted))]">
                  <tr>
                    <th className="px-4 py-3">{t("auditLog.colTime")}</th>
                    <th className="px-4 py-3">{t("auditLog.colActor")}</th>
                    <th className="px-4 py-3">{t("auditLog.colAction")}</th>
                    <th className="px-4 py-3">{t("auditLog.colEntity")}</th>
                    <th className="px-4 py-3">{t("auditLog.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.created_at}-${r.path}-${i}`} className="border-t border-[rgb(var(--reg-line)/0.8)]">
                      <td className="whitespace-nowrap px-4 py-3">{when(r.created_at)}</td>
                      <td className="px-4 py-3">{r.actor_name || "—"}</td>
                      <td className="px-4 py-3">{r.summary || `${r.method} ${r.path}`}</td>
                      <td className="px-4 py-3">{r.entity_type ? `${r.entity_type}${r.entity_id ? ` ${r.entity_id}` : ""}` : "—"}</td>
                      <td className="px-4 py-3">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
