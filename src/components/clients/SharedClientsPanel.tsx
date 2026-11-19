import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Users } from "lucide-react";

import type { Id } from "@/types/id";
import { getUserBusinesses } from "@/utils/businessUtils";
import { sharedClientService, type SharedClientRow } from "@/services/sharedClientService";
import { t } from "@/i18n";

/**
 * FG-W5-08: the clients of the owner's other salons, when the owner has switched sharing on.
 * Shown only to an owner with more than one salon. Name, contact, notes and visit summary;
 * consent answers are never sent here. "Add to this salon" copies the client into this
 * salon so the normal booking flow can book them.
 */
export function SharedClientsPanel({ businessId }: { businessId: Id }) {
  const [multiSalon, setMultiSalon] = useState(false);
  const [sharing, setSharing] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [includeOwn, setIncludeOwn] = useState(false);
  const [rows, setRows] = useState<SharedClientRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    getUserBusinesses()
      .then((list) => setMultiSalon(Array.isArray(list) && list.length > 1))
      .catch(() => setMultiSalon(false));
    sharedClientService
      .getSharing()
      .then((v) => setSharing(v.shareClients))
      .catch(() => setSharing(false));
  }, []);

  useEffect(() => {
    if (!open || !sharing) return;
    const handle = window.setTimeout(() => {
      sharedClientService
        .search(businessId, q, includeOwn)
        .then(setRows)
        .catch(() => setRows([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [open, sharing, q, businessId, includeOwn]);

  if (!multiSalon) return null;

  const toggleSharing = () => {
    if (sharing === null) return;
    const next = !sharing;
    setSharing(next);
    sharedClientService
      .setSharing(next)
      .then((v) => setSharing(v.shareClients))
      .catch(() => {
        setSharing(!next);
        toast.error(t("shc.couldNotSave"));
      });
  };

  const add = (row: SharedClientRow) => {
    setBusyId(String(row.id));
    sharedClientService
      .adopt(businessId, row.id)
      .then(() => {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, alreadyAdded: true } : r)));
        toast.success(t("shc.added"));
      })
      .catch(() => toast.error(t("shc.couldNotAdd")))
      .finally(() => setBusyId(null));
  };

  return (
    <section className="mb-5 rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Users size={18} className="text-[rgb(var(--reg-brand))]" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold">{t("shc.title")}</p>
          <p className="text-sm text-[rgb(var(--reg-muted))]">{t("shc.hint")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!sharing}
          aria-label={t("shc.shareSwitch")}
          disabled={sharing === null}
          onClick={toggleSharing}
          className={`relative h-6 w-11 rounded-full transition-colors ${sharing ? "bg-[rgb(var(--reg-brand))]" : "bg-[rgb(var(--reg-ink)/0.15)]"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${sharing ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
        {sharing && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-sm font-semibold text-[rgb(var(--reg-brand-strong))]">
            {open ? t("shc.hide") : t("shc.browse")}
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {sharing && open && (
        <div className="mt-4 space-y-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("shc.searchPlaceholder")}
            aria-label={t("shc.searchPlaceholder")}
            className="h-10 w-full rounded-full bg-[rgb(var(--reg-canvas))] px-4 text-sm outline-none ring-1 ring-[rgb(var(--reg-line))] focus:ring-2"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeOwn} onChange={(e) => setIncludeOwn(e.target.checked)} />
            {t("shc.includeOwn")}
          </label>
          {rows.length === 0 ? (
            <p className="text-sm text-[rgb(var(--reg-muted))]">{t("shc.none")}</p>
          ) : (
            <ul className="divide-y divide-[rgb(var(--reg-line)/0.6)]">
              {rows.map((r) => (
                <li key={String(r.id)} className="flex flex-wrap items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {r.firstName} {r.lastName ?? ""}{" "}
                      <span className="text-xs font-medium text-[rgb(var(--reg-muted))]">· {r.salonName}</span>
                    </p>
                    <p className="text-sm text-[rgb(var(--reg-muted))]">
                      {[r.phone, r.email].filter(Boolean).join(" · ") || t("shc.noContact")}
                    </p>
                    <p className="text-xs text-[rgb(var(--reg-muted))]">
                      {t("shc.visits", { count: r.visits ?? 0 })}
                      {r.lastVisit ? ` · ${t("shc.lastVisit")} ${r.lastVisit}` : ""}
                    </p>
                    {r.notes && <p className="mt-1 text-sm">{r.notes}</p>}
                  </div>
                  <button
                    type="button"
                    disabled={r.alreadyAdded || r.ownSalon || busyId === String(r.id)}
                    onClick={() => add(r)}
                    className="h-9 rounded-full px-4 text-sm font-semibold ring-1 ring-[rgb(var(--reg-line))] disabled:opacity-50"
                  >
                    {r.ownSalon || r.alreadyAdded ? t("shc.alreadyHere") : t("shc.addHere")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
