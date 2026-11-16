import type { Id } from "@/types/id";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Banknote,
  Coins,
  FileText,
  HandCoins,
  Landmark,
  Receipt,
  ShieldMinus,
  Wallet,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader, Card, CardContent, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/page/booqi";
import { pageBody, primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentBusinessId } from "@/config/api";
import { formatPrice } from "@/lib/currency";
import {
  moneyService,
  type DrawerSession,
  type ForfeitCandidate,
  type ForfeitReport,
  type InvoiceSummary,
  type MoneySettings,
  type PayoutOverview,
  type TipSummary,
} from "@/services/moneyService";
import { useOnlinePayments } from "@/services/platformService";
import { t } from "@/i18n";

/**
 * Everything a salon does with money once the customer has paid.
 *
 * Six things lived nowhere: what the platform owes and when it lands, whose tips are
 * whose, whether the drawer balances, an invoice a business customer can expense, the
 * VAT rate, and which no-show deposits were kept. They are one screen because they are
 * one job — the owner sits down on a Sunday and does all six.
 */
export default function MoneyPage() {
  const businessId = getCurrentBusinessId();
  // v1 is pay-at-the-salon: payouts, platform fee and kept deposits only exist when the
  // platform has online payments on (the flag the web reads). Off = hidden, not zeroed.
  const onlinePayments = useOnlinePayments();

  return (
    <AppLayout>
      <BooqiScope>
      <PageHeader
        title={t("common.money")}
        subtitle={onlinePayments ? t("money.payoutsTipsTheDrawerInvoices") : t("money.tipsTheDrawerInvoices")}
      />
      <div className={pageBody}>
        <Tabs key={onlinePayments ? "online" : "salon"} defaultValue={onlinePayments ? "payouts" : "tips"} className="w-full">
          <TabsList className="mb-6 flex w-full flex-wrap justify-start gap-1">
            {onlinePayments && (
              <TabsTrigger value="payouts" className="gap-2">
                <Landmark className="h-4 w-4" />{" "}{t("money.payouts")}
              </TabsTrigger>
            )}
            <TabsTrigger value="tips" className="gap-2">
              <HandCoins className="h-4 w-4" />{" "}{t("money.tips")}
            </TabsTrigger>
            <TabsTrigger value="drawer" className="gap-2">
              <Coins className="h-4 w-4" />{" "}{t("money.cashDrawer")}
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="h-4 w-4" />{" "}{t("money.invoices")}
            </TabsTrigger>
            {onlinePayments && (
              <TabsTrigger value="deposits" className="gap-2">
                <ShieldMinus className="h-4 w-4" />{" "}{t("money.depositsKept")}
              </TabsTrigger>
            )}
            <TabsTrigger value="settings" className="gap-2">
              <Receipt className="h-4 w-4" />{" "}{t("money.taxBank")}
            </TabsTrigger>
          </TabsList>

          {onlinePayments && <TabsContent value="payouts"><PayoutsTab businessId={businessId} /></TabsContent>}
          <TabsContent value="tips"><TipsTab businessId={businessId} /></TabsContent>
          <TabsContent value="drawer"><DrawerTab businessId={businessId} /></TabsContent>
          <TabsContent value="invoices"><InvoicesTab businessId={businessId} /></TabsContent>
          {onlinePayments && <TabsContent value="deposits"><DepositsTab businessId={businessId} /></TabsContent>}
          <TabsContent value="settings"><SettingsTab businessId={businessId} /></TabsContent>
        </Tabs>
      </div>
    </BooqiScope>
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------

function Figure({ label, value, hint, tone }: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad" | "plain";
}) {
  const colour =
    tone === "good" ? "text-[rgb(var(--reg-success))]" : tone === "bad" ? "text-rose-600" : "text-foreground";
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${colour}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>;
}

const day = (value: string | null | undefined) => (value ? String(value).slice(0, 10) : "—");

// ---------------------------------------------------------------------------

function PayoutsTab({ businessId }: { businessId: Id }) {
  const [data, setData] = useState<PayoutOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [openBatch, setOpenBatch] = useState<Id | null>(null);
  const [items, setItems] = useState<Record<number, PayoutOverview["batches"][number]["items"]>>({});

  const load = useCallback(() => {
    if (!businessId) { setLoading(false); return; }
    moneyService
      .getPayouts(businessId)
      .then(setData)
      .catch(() => toast.error(t("money.couldNotLoadYourPayouts")))
      .finally(() => setLoading(false));
  }, [businessId]);

  useEffect(load, [load]);

  const expand = async (batchId: Id) => {
    if (openBatch === batchId) { setOpenBatch(null); return; }
    setOpenBatch(batchId);
    if (items[batchId]) return;
    try {
      const batch = await moneyService.getPayout(businessId, batchId);
      setItems(prev => ({ ...prev, [batchId]: batch.items ?? [] }));
    } catch {
      toast.error(t("money.couldNotOpenThatPayout"));
    }
  };

  if (loading) return <Empty>{t("common.loading2")}</Empty>;
  if (!data) return <Empty>{t("money.nothingToShowYet")}</Empty>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" />{" "}{t("money.buildingNow")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Figure label={t("money.takenOnline")} value={formatPrice(data.pending.gross)} />
            <Figure label={t("money.refunded2")} value={formatPrice(data.pending.refunds)} tone="bad" />
            <Figure
              label={t("money.platformFee")}
              value={formatPrice(data.pending.fee)}
              hint={t("money.ofWhatYouKeep", { feePercent: data.feePercent })}
              tone="bad"
            />
            <Figure
              label={t("money.arriving")}
              value={formatPrice(data.pending.net)}
              hint={t("money.expected", { value: day(data.pending.expectedOn) })}
              tone="good"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {t("money.coversToCashAndCard", { value: day(data.pending.periodStart), value2: day(data.pending.periodEnd) })}
          </p>
          {data.bank.payout_iban ? (
            <p className="text-sm text-muted-foreground">
              {t("money.goingToEnding", { value: data.bank.payout_account_name ?? t("money.yourAccount") })}{" "}
              {data.bank.payout_iban.slice(-4)}.
            </p>
          ) : (
            <p className="text-sm text-amber-600">
              {t("money.noBankAccountOnFile")}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Figure label={t("money.paidOutSoFar")} value={formatPrice(data.totals.paid)} tone="good" />
        <Figure label={t("money.onTheWay")} value={formatPrice(data.totals.on_the_way)} />
        <Figure label={t("money.feesToDate")} value={formatPrice(data.totals.fees)} tone="bad" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("money.everyPayout")}</CardTitle></CardHeader>
        <CardContent>
          {data.batches.length === 0 ? (
            <Empty>{t("money.noPayoutHasBeenSent")}</Empty>
          ) : (
            <div className="space-y-2">
              {data.batches.map(batch => (
                <div key={batch.id} className="rounded-lg border">
                  <button
                    type="button"
                    onClick={() => expand(batch.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-muted/40"
                  >
                    <div>
                      <p className="font-medium">
                        {day(batch.period_start)} – {day(batch.period_end)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {batch.status === "PAID"
                          ? t("money.paid", { value: day(batch.paid_at) })
                          : t("money.expected", { value: day(batch.expected_on) })}
                        {batch.reference ? ` · ${batch.reference}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{formatPrice(batch.net_amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("money.lessFee", { value: formatPrice(batch.gross_amount), value2: formatPrice(batch.fee_amount) })}
                      </p>
                    </div>
                  </button>
                  {openBatch === batch.id ? (
                    <div className="border-t bg-muted/20 p-4">
                      {(items[batch.id] ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("money.nothingItemised")}</p>
                      ) : (
                        <ul className="space-y-1 text-sm">
                          {(items[batch.id] ?? []).map(item => (
                            <li key={item.id} className="flex justify-between gap-4">
                              <span className="text-muted-foreground">
                                {day(item.occurred_on)} · {item.description}
                              </span>
                              <span
                                className={`tabular-nums ${item.amount < 0 ? "text-rose-600" : ""}`}
                              >
                                {formatPrice(item.amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TipsTab({ businessId }: { businessId: Id }) {
  const [data, setData] = useState<TipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<Id | "all" | null>(null);

  const load = useCallback(() => {
    if (!businessId) { setLoading(false); return; }
    moneyService
      .getTips(businessId)
      .then(setData)
      .catch(() => toast.error(t("money.couldNotLoadTips")))
      .finally(() => setLoading(false));
  }, [businessId]);

  useEffect(load, [load]);

  const settle = async (staffId?: Id) => {
    setPaying(staffId ?? "all");
    try {
      const result = await moneyService.payOutTips(businessId, staffId);
      toast.success(t("money.markedAsPaidOut", { value: formatPrice(result.amount) }));
      load();
    } catch {
      toast.error(t("money.couldNotRecordThatPayout"));
    } finally {
      setPaying(null);
    }
  };

  if (loading) return <Empty>{t("common.loading2")}</Empty>;
  if (!data) return <Empty>{t("money.nothingToShowYet")}</Empty>;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label={t("money.tipsTaken")} value={formatPrice(data.totals.total)} />
        <Figure label={t("money.stillOwed")} value={formatPrice(data.totals.outstanding)} tone="bad" />
        <Figure label={t("money.onCards")} value={formatPrice(data.totals.card)} hint={t("money.owedAtPayroll")} />
        <Figure label={t("money.inCash")} value={formatPrice(data.totals.cash)} hint={t("money.alreadyHandedOver")} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">{t("money.whoIsOwedWhat")}</CardTitle>
          {data.totals.outstanding > 0 ? (
            <Button size="sm" onClick={() => settle()} disabled={paying !== null}>
              {paying === "all" ? t("money.recording") : t("money.settleEveryone")}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {data.byStaff.length === 0 ? (
            <Empty>{t("money.noTipsRecordedTheyAppear")}</Empty>
          ) : (
            <div className="space-y-2">
              {data.byStaff.map(person => (
                <div
                  key={person.staff_id ?? "unassigned"}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium">{person.staff_name ?? t("money.notAssigned")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("money.tipsEarned", { count: person.lines, earned: formatPrice(person.earned) })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`tabular-nums font-semibold ${person.outstanding > 0 ? "text-rose-600" : "text-muted-foreground"}`}
                    >
                      {t("money.owed", { value: formatPrice(person.outstanding) })}
                    </span>
                    {person.outstanding > 0 && person.staff_id ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={paying !== null}
                        onClick={() => settle(person.staff_id!)}
                      >
                        {paying === person.staff_id ? "…" : t("money.settle")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {t("money.aCashTipIsSettled")}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function DrawerTab({ businessId }: { businessId: Id }) {
  const [session, setSession] = useState<DrawerSession | null>(null);
  const [history, setHistory] = useState<DrawerSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("");
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [moveAmount, setMoveAmount] = useState("");
  const [moveReason, setMoveReason] = useState("");

  const load = useCallback(() => {
    if (!businessId) { setLoading(false); return; }
    Promise.all([moneyService.getDrawer(businessId), moneyService.getDrawerHistory(businessId)])
      .then(([live, past]) => { setSession(live); setHistory(past); })
      .catch(() => toast.error(t("money.couldNotLoadTheDrawer")))
      .finally(() => setLoading(false));
  }, [businessId]);

  useEffect(load, [load]);

  const variance = useMemo(() => {
    if (!session || counted.trim() === "") return null;
    const value = Number(counted);
    if (Number.isNaN(value)) return null;
    return value - (session.expected ?? 0);
  }, [counted, session]);

  const openDrawer = async () => {
    setBusy(true);
    try {
      await moneyService.openDrawer(businessId, Number(openingFloat || 0));
      setOpeningFloat("");
      toast.success(t("money.drawerOpen"));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("money.couldNotOpenTheDrawer"));
    } finally { setBusy(false); }
  };

  const closeDrawer = async () => {
    if (!session) return;
    if (counted.trim() === "") { toast.error(t("money.countTheCashFirst")); return; }
    setBusy(true);
    try {
      const closed = await moneyService.closeDrawer(businessId, session.id, Number(counted), notes || undefined);
      const diff = Number(closed.variance ?? 0);
      if (Math.abs(diff) < 0.005) toast.success(t("money.drawerBalancedExactly"));
      else if (diff > 0) toast.warning(t("money.moreThanExpected", { value: formatPrice(diff) }));
      else toast.warning(`${formatPrice(Math.abs(diff))} short`);
      setCounted(""); setNotes("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("money.couldNotCloseTheDrawer"));
    } finally { setBusy(false); }
  };

  const move = async (direction: "IN" | "OUT") => {
    if (!session) return;
    if (!moveAmount.trim() || !moveReason.trim()) {
      toast.error(t("money.aMovementNeedsAnAmount"));
      return;
    }
    setBusy(true);
    try {
      await moneyService.moveCash(businessId, session.id, direction, Number(moveAmount), moveReason);
      setMoveAmount(""); setMoveReason("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("money.couldNotRecordThat"));
    } finally { setBusy(false); }
  };

  if (loading) return <Empty>{t("common.loading2")}</Empty>;

  return (
    <div className="space-y-6">
      {session ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-4 w-4" />{" "}{t("money.openSince", { value: String(session.opened_at).slice(0, 16).replace("T", " ") })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Figure label={t("money.openingFloat")} value={formatPrice(session.opening_float)} />
              <Figure
                label={t("money.shouldBeInTheDrawer")}
                value={formatPrice(session.expected ?? 0)}
                hint={t("money.floatPlusCashTakenLess")}
              />
              <Figure
                label={t("money.difference")}
                value={variance === null ? "—" : formatPrice(variance)}
                tone={variance === null ? "plain" : Math.abs(variance) < 0.005 ? "good" : "bad"}
                hint={variance === null ? t("money.countToSee") : variance < 0 ? t("money.short") : t("money.over")}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">{t("money.moneyInOrOut")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("money.aFloatTopUpPaying")}
                </p>
                <div className="flex gap-2">
                  <Input
                    inputMode="decimal"
                    placeholder={t("money.amount")}
                    value={moveAmount}
                    onChange={e => setMoveAmount(e.target.value)}
                  />
                  <Input
                    placeholder={t("money.whatFor")}
                    value={moveReason}
                    onChange={e => setMoveReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => move("IN")}>{t("money.paidIn")}</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => move("OUT")}>{t("money.paidOut")}</Button>
                </div>
                {(session.movements ?? []).length > 0 ? (
                  <ul className="space-y-1 pt-1 text-xs text-muted-foreground">
                    {(session.movements ?? []).map(m => (
                      <li key={m.id} className="flex justify-between gap-3">
                        <span>{m.reason ?? (m.direction === "IN" ? t("money.paidIn") : t("money.paidOut"))}</span>
                        <span className={m.direction === "OUT" ? "text-rose-600" : ""}>
                          {m.direction === "OUT" ? "−" : "+"}{formatPrice(m.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">{t("money.closeTheDrawer")}</p>
                <div className="space-y-2">
                  <Label htmlFor="counted">{t("money.whatYouCounted")}</Label>
                  <Input
                    id="counted"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={counted}
                    onChange={e => setCounted(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-notes">{t("money.anythingToNote")}</Label>
                  <Textarea
                    id="drawer-notes"
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder={t("money.onlyIfTheCountIs")}
                  />
                </div>
                <Button disabled={busy} onClick={closeDrawer}>{t("money.countAndClose")}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("money.theDrawerIsShut")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("money.openItAtTheStart")}
            </p>
            <div className="flex max-w-sm gap-2">
              <Input
                inputMode="decimal"
                placeholder={t("money.openingFloat")}
                value={openingFloat}
                onChange={e => setOpeningFloat(e.target.value)}
              />
              <Button disabled={busy} onClick={openDrawer}>{t("money.open")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{t("money.previousDays")}</CardTitle></CardHeader>
        <CardContent>
          {history.filter(h => h.status === "CLOSED").length === 0 ? (
            <Empty>{t("money.noDayHasBeenClosed")}</Empty>
          ) : (
            <div className="space-y-2">
              {history.filter(h => h.status === "CLOSED").map(past => {
                const diff = Number(past.variance ?? 0);
                const balanced = Math.abs(diff) < 0.005;
                return (
                  <div key={past.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{String(past.opened_at).slice(0, 10)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("money.expectedCounted", { value: formatPrice(past.expected_cash ?? 0), value2: formatPrice(past.counted_cash ?? 0), value3: past.notes ? ` · ${past.notes}` : "" })}
                      </p>
                    </div>
                    <span className={`tabular-nums font-semibold ${balanced ? "text-[rgb(var(--reg-success))]" : "text-rose-600"}`}>
                      {balanced ? t("money.balanced") : `${diff > 0 ? "+" : "−"}${formatPrice(Math.abs(diff))}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function InvoicesTab({ businessId }: { businessId: Id }) {
  const [rows, setRows] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saleId, setSaleId] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerTax, setBuyerTax] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!businessId) { setLoading(false); return; }
    moneyService
      .getInvoices(businessId)
      .then(setRows)
      .catch(() => toast.error(t("money.couldNotLoadInvoices")))
      .finally(() => setLoading(false));
  }, [businessId]);

  useEffect(load, [load]);

  const issue = async () => {
    if (!saleId.trim()) { toast.error(t("money.whichSale")); return; }
    setBusy(true);
    try {
      const invoice = await moneyService.issueInvoice(businessId, saleId, {
        buyerName: buyerName || undefined,
        buyerTaxNumber: buyerTax || undefined,
      });
      toast.success(t("money.issued", { number: invoice.number }));
      setSaleId(""); setBuyerName(""); setBuyerTax("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("money.couldNotIssueThatInvoice"));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">{t("money.issueOne")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("money.numberedInOneUnbrokenRun")}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="sale-id">{t("money.saleNumber")}</Label>
              <Input id="sale-id" inputMode="numeric" value={saleId} onChange={e => setSaleId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer">{t("money.billTo")}</Label>
              <Input id="buyer" value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder={t("money.theirCompany")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-tax">{t("money.theirTaxNumber")}</Label>
              <Input id="buyer-tax" value={buyerTax} onChange={e => setBuyerTax(e.target.value)} />
            </div>
          </div>
          <Button disabled={busy} onClick={issue}>{t("money.issueInvoice")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("money.issued2")}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Empty>{t("common.loading2")}</Empty> : rows.length === 0 ? (
            <Empty>{t("money.noInvoiceHasBeenIssued")}</Empty>
          ) : (
            <div className="space-y-2">
              {rows.map(invoice => (
                <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                  <div>
                    <p className="font-medium">
                      {invoice.number}
                      {invoice.status === "VOID" ? <span className="ml-2 text-xs text-rose-600">{t("money.void")}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {day(invoice.issued_on)} · {invoice.buyer_name ?? t("money.noName")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{formatPrice(invoice.gross_amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("money.netTax", { value: formatPrice(invoice.net_amount), value2: formatPrice(invoice.tax_amount) })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function DepositsTab({ businessId }: { businessId: Id }) {
  const [report, setReport] = useState<ForfeitReport | null>(null);
  const [candidates, setCandidates] = useState<ForfeitCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!businessId) { setLoading(false); return; }
    Promise.all([moneyService.getForfeits(businessId), moneyService.getForfeitCandidates(businessId)])
      .then(([r, c]) => { setReport(r); setCandidates(c); })
      .catch(() => toast.error(t("money.couldNotLoadDeposits")))
      .finally(() => setLoading(false));
  }, [businessId]);

  useEffect(load, [load]);

  const keep = async (bookingId: string) => {
    setBusy(bookingId);
    try {
      await moneyService.keepDeposit(businessId, bookingId, "No-show");
      toast.success(t("money.recordedAsKept"));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("money.couldNotRecordThat"));
    } finally { setBusy(null); }
  };

  if (loading) return <Empty>{t("common.loading2")}</Empty>;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Figure
          label={t("money.depositsKept")}
          value={formatPrice(report?.totals.kept ?? 0)}
          hint={t("common.bookingCount", { count: report?.totals.bookings ?? 0 })}
          tone="good"
        />
        <Figure
          label={t("money.lostToNoShows")}
          value={formatPrice(report?.uncovered.lost ?? 0)}
          hint={t("money.withNoDepositTaken", { value: report?.uncovered.bookings ?? 0 })}
          tone="bad"
        />
        <Figure label={t("money.waitingOnADecision")} value={String(candidates.length)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("money.decide")}</CardTitle></CardHeader>
        <CardContent>
          {candidates.length === 0 ? (
            <Empty>{t("money.nothingWaitingDepositsAppearHere")}</Empty>
          ) : (
            <div className="space-y-2">
              {candidates.map(row => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{row.client_name ?? t("common.walkIn")}</p>
                    <p className="text-xs text-muted-foreground">
                      {day(row.appointment_date)} {String(row.start_time).slice(0, 5)} ·{" "}
                      {row.status === "NO_SHOW" ? t("money.didNotTurnUp") : t("common.cancelled")}
                      {row.staff_name ? ` · ${row.staff_name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-semibold">{formatPrice(row.deposit_amount)}</span>
                    <Button size="sm" disabled={busy !== null} onClick={() => keep(row.id)}>
                      {busy === row.id ? "…" : t("money.keepIt")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {t("money.keepingADepositIsA")}
      </p>

      {report && report.kept.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("money.kept")}</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {report.kept.map(row => (
                <li key={row.id} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    {day(row.deposit_forfeited_at)} · {row.client_name ?? t("common.walkIn")}
                    {row.reason ? ` · ${row.reason}` : ""}
                  </span>
                  <span className="tabular-nums">{formatPrice(row.amount)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SettingsTab({ businessId }: { businessId: Id }) {
  const onlinePayments = useOnlinePayments();
  const [settings, setSettings] = useState<MoneySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    taxRate: "",
    taxNumber: "",
    legalName: "",
    legalAddress: "",
    tipPresets: "",
    payoutIban: "",
    payoutAccountName: "",
  });
  const [pricesIncludeTax, setPricesIncludeTax] = useState(true);
  const [tipsEnabled, setTipsEnabled] = useState(true);

  useEffect(() => {
    if (!businessId) { setLoading(false); return; }
    moneyService
      .getSettings(businessId)
      .then(s => {
        setSettings(s);
        setForm({
          taxRate: s.tax_rate != null ? String(s.tax_rate) : "",
          taxNumber: s.tax_number ?? "",
          legalName: s.legal_name ?? "",
          legalAddress: s.legal_address ?? "",
          tipPresets: s.tip_presets ?? "10,15,20",
          payoutIban: s.payout_iban ?? "",
          payoutAccountName: s.payout_account_name ?? "",
        });
        setPricesIncludeTax(s.prices_include_tax !== false);
        setTipsEnabled(s.tips_enabled !== false);
      })
      .catch(() => toast.error(t("money.couldNotLoadYourSettings")))
      .finally(() => setLoading(false));
  }, [businessId]);

  const save = async () => {
    setSaving(true);
    try {
      // Blank means "leave it alone" — the server COALESCEs nulls, so an empty box must
      // not be sent as 0 and quietly turn a 23% rate into none.
      const text = (v: string) => (v.trim() === "" ? undefined : v.trim());
      const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
      const updated = await moneyService.updateSettings(businessId, {
        taxRatePercent: num(form.taxRate),
        pricesIncludeTax,
        taxNumber: text(form.taxNumber),
        legalName: text(form.legalName),
        legalAddress: text(form.legalAddress),
        tipsEnabled,
        tipPresets: text(form.tipPresets),
        payoutIban: text(form.payoutIban),
        payoutAccountName: text(form.payoutAccountName),
      });
      setSettings(updated);
      toast.success(t("common.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("money.couldNotSave"));
    } finally { setSaving(false); }
  };

  if (loading) return <Empty>{t("common.loading2")}</Empty>;

  const rate = Number(form.taxRate || 0);
  const example = pricesIncludeTax
    ? t("money.aServiceIsPlusTax", { value: (100 / (1 + rate / 100)).toFixed(2), value2: (100 - 100 / (1 + rate / 100)).toFixed(2) })
    : t("money.aServiceIsChargedAt", { value: (100 * (1 + rate / 100)).toFixed(2) });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">{t("money.tax")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tax-rate">{t("money.rate")}</Label>
              <Input
                id="tax-rate"
                inputMode="decimal"
                placeholder="23"
                value={form.taxRate}
                onChange={e => setForm({ ...form, taxRate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t("money.aPercentageInPoland")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-number">{t("money.yourTaxNumber")}</Label>
              <Input
                id="tax-number"
                value={form.taxNumber}
                onChange={e => setForm({ ...form, taxNumber: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t("money.appearsOnEveryInvoiceYou")}</p>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">{t("money.myPricesAlreadyIncludeTax")}</p>
              <p className="text-xs text-muted-foreground">
                {rate > 0 ? example : t("money.theUsualAnswerInEurope")}
              </p>
            </div>
            <Switch checked={pricesIncludeTax} onCheckedChange={setPricesIncludeTax} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legal-name">{t("money.registeredName")}</Label>
              <Input
                id="legal-name"
                value={form.legalName}
                onChange={e => setForm({ ...form, legalName: e.target.value })}
                placeholder={t("money.ifItDiffersFromThe")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal-address">{t("money.registeredAddress")}</Label>
              <Input
                id="legal-address"
                value={form.legalAddress}
                onChange={e => setForm({ ...form, legalAddress: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("money.tips")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">{t("money.askForATipAt")}</p>
              <p className="text-xs text-muted-foreground">
                {t("money.offMeansTheAppNever")}
              </p>
            </div>
            <Switch checked={tipsEnabled} onCheckedChange={setTipsEnabled} />
          </div>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="tip-presets">{t("money.percentagesToOffer")}</Label>
            <Input
              id="tip-presets"
              value={form.tipPresets}
              onChange={e => setForm({ ...form, tipPresets: e.target.value })}
              placeholder="10,15,20"
            />
          </div>
        </CardContent>
      </Card>

      {onlinePayments && <Card>
        <CardHeader><CardTitle className="text-base">{t("money.wherePayoutsGo")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="iban">{t("money.accountNumber")}</Label>
              <Input
                id="iban"
                value={form.payoutIban}
                onChange={e => setForm({ ...form, payoutIban: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-name">{t("money.accountName")}</Label>
              <Input
                id="account-name"
                value={form.payoutAccountName}
                onChange={e => setForm({ ...form, payoutAccountName: e.target.value })}
              />
            </div>
          </div>
          {settings?.platform_fee_percent != null ? (
            <p className="text-sm text-muted-foreground">
              {t("money.yourAgreedPlatformFeeIs", { platform_fee_percent: settings.platform_fee_percent })}
            </p>
          ) : null}
        </CardContent>
      </Card>}

      <Button disabled={saving} onClick={save}>{saving ? t("common.saving") : t("common.save")}</Button>
    </div>
  );
}
