import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, EmptyState, PageHeader } from "@/components/page/booqi";
import { pageBody } from "@/components/page/booqiStyles";
import { useBusinessId } from "@/hooks/useBusinessId";
import { fmtDate, t, tDynamic } from "@/i18n";
import { currencySymbol } from "@/lib/currency";
import { onlineSalesService, type GiftCardRow } from "@/services/onlineSalesService";

const SYMS: Record<string, string> = { AZN: "₼", PLN: "zł", USD: "$", EUR: "€", GBP: "£", CZK: "Kč" };
const sym = (c: string) => SYMS[(c || "").toUpperCase()] ?? c ?? currencySymbol();

/** The salon's gift cards, newest first. Cards bought on the salon page say who bought them and for whom. */
export default function GiftCardsPage() {
  const businessId = useBusinessId();
  const [rows, setRows] = useState<GiftCardRow[] | null>(null);

  useEffect(() => {
    if (!businessId) return;
    onlineSalesService
      .giftCards(businessId)
      .then(setRows)
      .catch(() => {
        setRows([]);
        toast.error(t("onlineSales.loadFailed"));
      });
  }, [businessId]);

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("onlineSales.giftCardsTitle")} subtitle={t("onlineSales.giftCardsSubtitle")} />
        <div className={pageBody}>
          {rows && rows.length === 0 ? (
            <EmptyState icon={Gift} title={t("onlineSales.noGiftCards")} body={t("onlineSales.noGiftCardsBody")} />
          ) : (
            <div className="overflow-x-auto rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs font-semibold text-[rgb(var(--reg-muted))]">
                  <tr>
                    <th className="px-4 py-3">{t("onlineSales.colDate")}</th>
                    <th className="px-4 py-3">{t("onlineSales.colCard")}</th>
                    <th className="px-4 py-3">{t("onlineSales.colSource")}</th>
                    <th className="px-4 py-3">{t("onlineSales.colFor")}</th>
                    <th className="px-4 py-3">{t("onlineSales.colValue")}</th>
                    <th className="px-4 py-3">{t("onlineSales.colBalance")}</th>
                    <th className="px-4 py-3">{t("onlineSales.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows ?? []).map((g) => (
                    <tr key={g.id} className="border-t border-[rgb(var(--reg-line)/0.8)] align-top">
                      <td className="px-4 py-3">{fmtDate(g.created_at)}</td>
                      <td className="px-4 py-3 font-mono">…{g.codeTail}</td>
                      <td className="px-4 py-3">{g.source === "ONLINE" ? t("onlineSales.sourceOnline") : t("onlineSales.sourceCounter")}</td>
                      <td className="px-4 py-3">
                        {g.source === "ONLINE" ? (
                          <>
                            <span className="block font-semibold">{g.recipient_name}</span>
                            <span className="block text-xs text-[rgb(var(--reg-muted))]">{g.recipient_email}</span>
                            <span className="block text-xs text-[rgb(var(--reg-muted))]">{t("onlineSales.boughtBy", { value: g.buyer_name || g.buyer_email || "" })}</span>
                          </>
                        ) : (
                          g.issued_to_email ?? "—"
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{g.initial_amount.toFixed(2)} {sym(g.currency)}</td>
                      <td className="px-4 py-3 tabular-nums">{g.balance.toFixed(2)} {sym(g.currency)}</td>
                      <td className="px-4 py-3">{tDynamic(`onlineSales.gc${g.status.charAt(0)}${g.status.slice(1).toLowerCase()}`, g.status)}</td>
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
