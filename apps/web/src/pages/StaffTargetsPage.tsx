import { useCallback, useEffect, useState } from "react";
import { Target, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Btn, EmptyState, Note, PageHead } from "@/components/bz";
import { BzPage, initialsOf } from "@/components/bz/p2-page";
import { money } from "@/components/page/kitStyles";
import { useBusinessId } from "@/hooks/useBusinessId";
import { currencySymbol } from "@/lib/currency";
import { t } from "@/i18n";
import { staffTargetService, type StaffTargetRow } from "@/services/staffTargetService";

const thisMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

/** How far a member is through the month's target, 0 to 100. A missing target shows 0. */
const pct = (actual: number, target: number) => (target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0);

function Progress({ actual, target }: { actual: number; target: number }) {
  const p = pct(actual, target);
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ height: 6, borderRadius: 99, background: "var(--bz-fill2)" }}>
        <div style={{ height: 6, borderRadius: 99, background: "var(--bz-ok)", width: `${p}%` }} />
      </div>
      <small style={{ color: "var(--bz-muted)", fontWeight: 600 }}>{target > 0 ? `${p}%` : t("staffTargets.noTarget")}</small>
    </div>
  );
}

const GRID = "1.6fr 1fr 1fr 1.1fr 1.1fr 100px";

function TargetRow({
  row,
  month,
  sym,
  onSaved,
}: {
  row: StaffTargetRow;
  month: string;
  sym: string;
  onSaved: () => void;
}) {
  const businessId = useBusinessId();
  const [rev, setRev] = useState(String(row.revenueTarget));
  const [book, setBook] = useState(String(row.bookingsTarget));
  const [busy, setBusy] = useState(false);
  const revNum = Number(rev);
  const bookNum = Number(book);
  const valid = rev !== "" && Number.isFinite(revNum) && revNum >= 0 && book !== "" && Number.isInteger(bookNum) && bookNum >= 0;
  const changed = valid && (revNum !== row.revenueTarget || bookNum !== row.bookingsTarget);

  const save = async () => {
    if (!businessId || !valid) return;
    setBusy(true);
    try {
      await staffTargetService.set(businessId, row.staffId, month, { revenueTarget: revNum, bookingsTarget: bookNum });
      onSaved();
    } catch {
      toast.error(t("staffTargets.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tdr2" style={{ gridTemplateColumns: GRID }}>
      <div>
        <div className="row gap8">
          <Avatar initials={initialsOf(row.staffName)} size={36} />
          {row.staffName}
        </div>
      </div>
      <div>
        {money(Math.round(row.revenueActual), sym)}
        <Progress actual={row.revenueActual} target={row.revenueTarget} />
      </div>
      <div>
        {row.bookingsActual}
        <Progress actual={row.bookingsActual} target={row.bookingsTarget} />
      </div>
      <div>
        <input className="inp" type="number" min={0} step="0.01" aria-label={t("staffTargets.revenueTarget")} value={rev} onChange={(e) => setRev(e.target.value)} />
      </div>
      <div>
        <input className="inp" type="number" min={0} step={1} aria-label={t("staffTargets.bookingsTarget")} value={book} onChange={(e) => setBook(e.target.value)} />
      </div>
      <div>
        <Btn kind="soft" disabled={!changed || busy} onClick={() => void save()}>
          {t("staffTargets.save")}
        </Btn>
      </div>
    </div>
  );
}

/** Owner and managers: each member's monthly revenue and bookings target, against the month so far. */
export default function StaffTargetsPage() {
  const businessId = useBusinessId();
  const sym = currencySymbol();
  const [month, setMonth] = useState(thisMonth);
  const [rows, setRows] = useState<StaffTargetRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!businessId) return;
    setBusy(true);
    staffTargetService
      .list(businessId, month)
      .then(setRows)
      .catch(() => toast.error(t("staffTargets.loadFailed")))
      .finally(() => setBusy(false));
  }, [businessId, month]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <BzPage>
      <PageHead
        title={t("staffTargets.title")}
        sub={t("staffTargets.subtitle")}
        right={<input id="st-month" type="month" className="inp" aria-label={t("staffTargets.month")} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />}
      />
      {rows.length === 0 && !busy ? (
        <EmptyState icon={<Users className="ic" />} title={t("staffTargets.empty")} text={t("staffTargets.emptyBody")} />
      ) : (
        <div className="tbx">
          <div className="tdr2 h" style={{ gridTemplateColumns: GRID }}>
            <div>{t("staffTargets.colStaff")}</div>
            <div>{t("staffTargets.revenueActual")}</div>
            <div>{t("staffTargets.bookingsActual")}</div>
            <div>{t("staffTargets.revenueTarget")}</div>
            <div>{t("staffTargets.bookingsTarget")}</div>
            <div />
          </div>
          {rows.map((r) => (
            <TargetRow key={`${r.staffId}-${month}-${r.revenueTarget}-${r.bookingsTarget}`} row={r} month={month} sym={sym} onSaved={load} />
          ))}
        </div>
      )}
      <Note kind="in" icon={<Target className="ic" />}>{t("staffTargets.note")}</Note>
    </BzPage>
  );
}
