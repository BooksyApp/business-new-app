import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { t } from "@/i18n";
import { fmtDate } from "@/i18n";
import { currencySymbol } from "@/lib/currency";
import { clientBalanceService, type BalanceMethod, type ClientBalance } from "@/services/clientBalanceService";
import type { Id } from "@/types/id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const METHODS: Array<{ value: BalanceMethod; label: () => string }> = [
  { value: "CASH", label: () => t("common.cash") },
  { value: "CARD_TERMINAL", label: () => t("common.card") },
];

const methodLabel = (m: string | null) =>
  m === "CASH" ? t("common.cash") : m === "CARD_TERMINAL" ? t("common.card") : m ? m : "";

/**
 * FG-W6-07: what the client still owes this salon, the recent entries, and a way to settle.
 * Renders nothing while the balance is zero and there is no history. Used on the client card
 * and on the till.
 */
export function ClientBalanceSection({ clientId, showEntries = true, labelClass, boxClass, onChange }: {
  clientId: Id;
  showEntries?: boolean;
  labelClass?: string;
  boxClass?: string;
  /** Called with the new balance after a settlement. */
  onChange?: (balance: ClientBalance) => void;
}) {
  const [balance, setBalance] = useState<ClientBalance | null>(null);
  const [settling, setSettling] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<BalanceMethod>("CASH");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    clientBalanceService.get(clientId).then(setBalance).catch(() => setBalance(null));
  }, [clientId]);

  useEffect(() => {
    setBalance(null);
    setSettling(false);
    load();
  }, [load]);

  if (!balance || (balance.outstanding <= 0 && balance.entries.length === 0)) return null;

  const outstanding = balance.outstanding;
  const value = parseFloat(amount);
  const valid = Number.isFinite(value) && value > 0 && value <= outstanding + 0.001;

  const settle = async () => {
    setBusy(true);
    try {
      const next = await clientBalanceService.settle(clientId, { amount: Number(value.toFixed(2)), method });
      setBalance(next);
      setSettling(false);
      setAmount("");
      toast.success(t("clientBalance.settled"));
      onChange?.(next);
    } catch {
      toast.error(t("clientBalance.settleFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cn(boxClass, "space-y-3")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={labelClass}>{t("clientBalance.title")}</p>
          <p className={cn("text-lg font-semibold", outstanding > 0 && "text-destructive")}>
            {outstanding.toFixed(2)} {currencySymbol()}
          </p>
        </div>
        {outstanding > 0 && !settling && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAmount(outstanding.toFixed(2));
              setSettling(true);
            }}
          >
            {t("clientBalance.settle")}
          </Button>
        )}
      </div>

      {settling && (
        <div className="space-y-2 rounded-md border p-3">
          <label className="text-xs text-muted-foreground">{t("clientBalance.amount", { value: currencySymbol() })}</label>
          <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          {amount !== "" && !valid && (
            <p className="text-xs text-destructive">
              {t("clientBalance.amountRange", { value: outstanding.toFixed(2), value2: currencySymbol() })}
            </p>
          )}
          <div className="flex gap-1">
            {METHODS.map((m) => (
              <Button
                key={m.value}
                size="sm"
                variant={method === m.value ? "default" : "outline"}
                onClick={() => setMethod(m.value)}
              >
                {m.label()}
              </Button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSettling(false)}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" disabled={!valid || busy} onClick={() => void settle()}>
              {t("clientBalance.confirmSettle")}
            </Button>
          </div>
        </div>
      )}

      {showEntries && balance.entries.length > 0 && (
        <ul className="space-y-1 text-sm">
          {balance.entries.map((e, i) => (
            <li key={`${e.created_at}-${i}`} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                {fmtDate(e.created_at)} · {e.kind === "DEBT" ? t("clientBalance.debt") : t("clientBalance.settlement")}
                {e.kind === "SETTLEMENT" && methodLabel(e.method) ? ` · ${methodLabel(e.method)}` : ""}
              </span>
              <span className={e.kind === "DEBT" ? "text-destructive" : "text-[rgb(var(--reg-success))]"}>
                {e.kind === "DEBT" ? "+" : "-"}
                {e.amount.toFixed(2)} {currencySymbol()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
