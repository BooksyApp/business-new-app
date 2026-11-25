import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody } from "@/components/page/booqiStyles";
import { Empty } from "@/components/reports/ReportsKit";
import { fmtMoney } from "@/components/reports/reportsFormat";
import { useBusinessId } from "@/hooks/useBusinessId";
import { booqiWalletService } from "@/services/booqiWalletService";
import { t, type TKey } from "@/i18n";

const day = (iso: string) => new Date(/(?:[zZ]|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`).toLocaleDateString();

/** Money › "Pending payout from booqi": customer payments made with booqi balance, and when booqi pays them out. */
export default function BooqiPayoutsPage() {
  const businessId = useBusinessId();
  const q = useQuery({
    queryKey: ["booqi-payouts", businessId],
    queryFn: () => booqiWalletService.payouts(businessId),
    enabled: Boolean(businessId),
    retry: false,
  });
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86400000);
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const split = useQuery({
    queryKey: ["booqi-revenue-split", businessId, iso(from), iso(to)],
    queryFn: () => booqiWalletService.revenueSplit(businessId, iso(from), iso(to)),
    enabled: Boolean(businessId) && q.isSuccess,
    retry: false,
  });
  const d = q.data;
  const via = d ? d.bySource.reduce((a, r) => ({ gross: a.gross + Number(r.gross), commission: a.commission + Number(r.commission), net: a.net + Number(r.net), paid: a.paid + Number(r.paid), pending: a.pending + Number(r.pending) }), { gross: 0, commission: 0, net: 0, paid: 0, pending: 0 }) : null;
  // The route answers 404 while the platform has the wallet off: the page must not exist then either.
  const navigate = useNavigate();
  useEffect(() => {
    if (q.isError) navigate("..", { relative: "path", replace: true });
  }, [q.isError, navigate]);
  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("bwallet.navTitle")} subtitle={t("bwallet.pendingHint")} />
        <div className={pageBody}>
          {q.isError ? (
            <Empty>{t("bwallet.loadFailed")}</Empty>
          ) : !d ? (
            <div className="h-[200px] animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy="true" />
          ) : (
            <>
              {split.data && (
                <section className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]" data-testid="revenue-split">
                  <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">{t("bwallet.splitTitle")}</h2>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div><p className="text-[13px] text-[rgb(var(--reg-muted))]">{t("bwallet.atSalon")}</p><p className="text-[22px] font-extrabold tabular-nums" data-testid="split-salon">{fmtMoney(split.data.atSalon)}</p></div>
                    <div><p className="text-[13px] text-[rgb(var(--reg-muted))]">{t("bwallet.online")}</p><p className="text-[22px] font-extrabold tabular-nums" data-testid="split-online">{fmtMoney(split.data.online)}</p></div>
                    <div><p className="text-[13px] text-[rgb(var(--reg-muted))]">{t("bwallet.wallet")}</p><p className="text-[22px] font-extrabold tabular-nums" data-testid="split-wallet">{fmtMoney(split.data.wallet)}</p></div>
                  </div>
                  <p className="mt-3 text-[12px] text-[rgb(var(--reg-muted))]">{t("bwallet.splitNote")}</p>
                </section>
              )}

              {via && (
                <section className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]" data-testid="via-booqi">
                  <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">{t("bwallet.sumTitle")}</h2>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div><p className="text-[13px] text-[rgb(var(--reg-muted))]">{t("bwallet.sumGross")}</p><p className="text-[20px] font-extrabold tabular-nums" data-testid="via-gross">{fmtMoney(via.gross)}</p></div>
                    <div><p className="text-[13px] text-[rgb(var(--reg-muted))]">{t("bwallet.sumCommission")} ({Number(d.commissionPercent)}%)</p><p className="text-[20px] font-extrabold tabular-nums" data-testid="via-commission">{fmtMoney(via.commission)}</p></div>
                    <div><p className="text-[13px] text-[rgb(var(--reg-muted))]">{t("bwallet.sumNet")}</p><p className="text-[20px] font-extrabold tabular-nums" data-testid="via-net">{fmtMoney(via.net)}</p></div>
                  </div>
                  <p className="mt-2 text-[12px] text-[rgb(var(--reg-muted))]">{t("bwallet.refundNote")}</p>
                </section>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]" data-testid="booqi-pending">
                  <p className="text-[13px] text-[rgb(var(--reg-muted))]">{t("bwallet.sumPending")}</p>
                  <p className="mt-1 text-[32px] font-extrabold tabular-nums">{fmtMoney(d.pending)}</p>
                </div>
                <div className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                  <p className="text-[13px] text-[rgb(var(--reg-muted))]">{t("bwallet.sumPaid")}</p>
                  <p className="mt-1 text-[32px] font-extrabold tabular-nums">{fmtMoney(d.paidTotal)}</p>
                </div>
              </div>

              <h2 className="px-1 text-[13px] font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">{t("bwallet.payments")}</h2>
              {d.items.length === 0 ? (
                <Empty>{t("bwallet.empty")}</Empty>
              ) : (
                <ul className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                  {d.items.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 border-t border-[rgb(var(--reg-line)/0.6)] px-4 py-3 first:border-t-0 md:px-5">
                      <span className="w-24 shrink-0 text-[13px] tabular-nums text-[rgb(var(--reg-muted))]">{day(i.created_at)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{t(`bwallet.k_${i.kind}` as TKey)} · {t(`bwallet.src_${i.source ?? "WALLET"}` as TKey)}</span>
                        <span className="block truncate text-[13px] text-[rgb(var(--reg-muted))]">
                          {fmtMoney(i.gross_amount)}
                          {Number(i.commission_amount) !== 0 ? ` · ${t("bwallet.colCommission")} ${fmtMoney(Math.abs(i.commission_amount))}` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end">
                        <span className="text-[15px] font-bold tabular-nums">{fmtMoney(i.net_amount)}</span>
                        <span className="text-[12px] text-[rgb(var(--reg-muted))]">{t(`bwallet.s_${i.status}` as TKey)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {d.batches.length > 0 && (
                <>
                  <h2 className="px-1 text-[13px] font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">{t("bwallet.payouts")}</h2>
                  <ul className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                    {d.batches.map((b) => (
                      <li key={b.id} className="flex items-center gap-3 border-t border-[rgb(var(--reg-line)/0.6)] px-4 py-3 first:border-t-0 md:px-5">
                        <span className="w-24 shrink-0 text-[13px] tabular-nums text-[rgb(var(--reg-muted))]">{day(b.paid_at)}</span>
                        <span className="min-w-0 flex-1 truncate text-[14px]">{b.reference || t("bwallet.batch")}</span>
                        <span className="text-[15px] font-bold tabular-nums">{fmtMoney(b.total)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
