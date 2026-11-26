import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { DataTable, EmptyState, Skeleton, StatusPill } from "@/components/bz";
import { P4Page } from "@/components/bz/p4-kit";
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

  const kind = (st: string) => (st === "ACTIVE" ? "c" : st === "EXPIRED" || st === "CANCELLED" ? "x" : "d") as "c" | "x" | "d";
  return (
    <AppLayout>
      <P4Page title={t("onlineSales.giftCardsTitle")} sub={t("onlineSales.giftCardsSubtitle")}>
        {!rows ? (
          <Skeleton lines={[100, 85, 92, 70]} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Gift className="ic" />} title={t("onlineSales.noGiftCards")} text={t("onlineSales.noGiftCardsBody")} />
        ) : (
          <DataTable
            grid="1fr 1fr 1fr 1.6fr 1fr 1fr 1fr"
            rows={rows}
            rowKey={(g) => g.id}
            columns={[t("onlineSales.colDate"), t("onlineSales.colCard"), t("onlineSales.colSource"), t("onlineSales.colFor"), t("onlineSales.colValue"), t("onlineSales.colBalance"), t("onlineSales.colStatus")]}
            render={(g) => [
              fmtDate(g.created_at),
              <span className="font-mono">…{g.codeTail}</span>,
              g.source === "ONLINE" ? t("onlineSales.sourceOnline") : t("onlineSales.sourceCounter"),
              g.source === "ONLINE" ? (
                <>
                  <b style={{ display: "block" }}>{g.recipient_name}</b>
                  <small style={{ display: "block" }}>{g.recipient_email}</small>
                  <small style={{ display: "block" }}>{t("onlineSales.boughtBy", { value: g.buyer_name || g.buyer_email || "" })}</small>
                </>
              ) : (
                g.issued_to_email ?? "—"
              ),
              `${g.initial_amount.toFixed(2)} ${sym(g.currency)}`,
              `${g.balance.toFixed(2)} ${sym(g.currency)}`,
              <StatusPill kind={kind(g.status)}>{tDynamic(`onlineSales.gc${g.status.charAt(0)}${g.status.slice(1).toLowerCase()}`, g.status)}</StatusPill>,
            ]}
          />
        )}
      </P4Page>
    </AppLayout>
  );
}
