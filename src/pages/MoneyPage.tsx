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

import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  return (
    <AppLayout>
      <PageHeader
        title="Money"
        subtitle="Payouts, tips, the drawer, invoices and the tax settings behind them."
      />
      <div className="p-4 md:p-6">
        <Tabs defaultValue="payouts" className="w-full">
          <TabsList className="mb-6 flex w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="payouts" className="gap-2">
              <Landmark className="h-4 w-4" /> Payouts
            </TabsTrigger>
            <TabsTrigger value="tips" className="gap-2">
              <HandCoins className="h-4 w-4" /> Tips
            </TabsTrigger>
            <TabsTrigger value="drawer" className="gap-2">
              <Coins className="h-4 w-4" /> Cash drawer
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2">
              <FileText className="h-4 w-4" /> Invoices
            </TabsTrigger>
            <TabsTrigger value="deposits" className="gap-2">
              <ShieldMinus className="h-4 w-4" /> Deposits kept
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Receipt className="h-4 w-4" /> Tax &amp; bank
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payouts"><PayoutsTab businessId={businessId} /></TabsContent>
          <TabsContent value="tips"><TipsTab businessId={businessId} /></TabsContent>
          <TabsContent value="drawer"><DrawerTab businessId={businessId} /></TabsContent>
          <TabsContent value="invoices"><InvoicesTab businessId={businessId} /></TabsContent>
          <TabsContent value="deposits"><DepositsTab businessId={businessId} /></TabsContent>
          <TabsContent value="settings"><SettingsTab businessId={businessId} /></TabsContent>
        </Tabs>
      </div>
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
    tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : "text-foreground";
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

function PayoutsTab({ businessId }: { businessId: number }) {
  const [data, setData] = useState<PayoutOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [openBatch, setOpenBatch] = useState<number | null>(null);
  const [items, setItems] = useState<Record<number, PayoutOverview["batches"][number]["items"]>>({});

  const load = useCallback(() => {
    if (!businessId) { setLoading(false); return; }
    moneyService
      .getPayouts(businessId)
      .then(setData)
      .catch(() => toast.error("Could not load your payouts"))
      .finally(() => setLoading(false));
  }, [businessId]);

  useEffect(load, [load]);

  const expand = async (batchId: number) => {
    if (openBatch === batchId) { setOpenBatch(null); return; }
    setOpenBatch(batchId);
    if (items[batchId]) return;
    try {
      const batch = await moneyService.getPayout(businessId, batchId);
      setItems(prev => ({ ...prev, [batchId]: batch.items ?? [] }));
    } catch {
      toast.error("Could not open that payout");
    }
  };

  if (loading) return <Empty>Loading…</Empty>;
  if (!data) return <Empty>Nothing to show yet.</Empty>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" /> Building now
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Figure label="Taken online" value={formatPrice(data.pending.gross)} />
            <Figure label="Refunded" value={formatPrice(data.pending.refunds)} tone="bad" />
            <Figure
              label="Platform fee"
              value={formatPrice(data.pending.fee)}
              hint={`${data.feePercent}% of what you keep`}
              tone="bad"
            />
            <Figure
              label="Arriving"
              value={formatPrice(data.pending.net)}
              hint={`Expected ${day(data.pending.expectedOn)}`}
              tone="good"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Covers {day(data.pending.periodStart)} to {day(data.pending.periodEnd)}. Cash and
            card-terminal takings are not here — that money never leaves the salon, so there is
            nothing to pay out.
          </p>
          {data.bank.payout_iban ? (
            <p className="text-sm text-muted-foreground">
              Going to {data.bank.payout_account_name ?? "your account"} ending{" "}
              {data.bank.payout_iban.slice(-4)}.
            </p>
          ) : (
            <p className="text-sm text-amber-600">
              No bank account on file. Add one under Tax &amp; bank or nothing can be sent.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Figure label="Paid out so far" value={formatPrice(data.totals.paid)} tone="good" />
        <Figure label="On the way" value={formatPrice(data.totals.on_the_way)} />
        <Figure label="Fees to date" value={formatPrice(data.totals.fees)} tone="bad" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Every payout</CardTitle></CardHeader>
        <CardContent>
          {data.batches.length === 0 ? (
            <Empty>No payout has been sent yet.</Empty>
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
                          ? `Paid ${day(batch.paid_at)}`
                          : `Expected ${day(batch.expected_on)}`}
                        {batch.reference ? ` · ${batch.reference}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{formatPrice(batch.net_amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(batch.gross_amount)} less {formatPrice(batch.fee_amount)} fee
                      </p>
                    </div>
                  </button>
                  {openBatch === batch.id ? (
                    <div className="border-t bg-muted/20 p-4">
                      {(items[batch.id] ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nothing itemised.</p>
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

function TipsTab({ businessId }: { businessId: number }) {
  const [data, setData] = useState<TipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<number | "all" | null>(null);

  const load = useCallback(() => {
    if (!businessId) { setLoading(false); return; }
    moneyService
      .getTips(businessId)
      .then(setData)
      .catch(() => toast.error("Could not load tips"))
      .finally(() => setLoading(false));
  }, [businessId]);

  useEffect(load, [load]);

  const settle = async (staffId?: number) => {
    setPaying(staffId ?? "all");
    try {
      const result = await moneyService.payOutTips(businessId, staffId);
      toast.success(`Marked ${formatPrice(result.amount)} as paid out`);
      load();
    } catch {
      toast.error("Could not record that payout");
    } finally {
      setPaying(null);
    }
  };

  if (loading) return <Empty>Loading…</Empty>;
  if (!data) return <Empty>Nothing to show yet.</Empty>;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Tips taken" value={formatPrice(data.totals.total)} />
        <Figure label="Still owed" value={formatPrice(data.totals.outstanding)} tone="bad" />
        <Figure label="On cards" value={formatPrice(data.totals.card)} hint="Owed at payroll" />
        <Figure label="In cash" value={formatPrice(data.totals.cash)} hint="Already handed over" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Who is owed what</CardTitle>
          {data.totals.outstanding > 0 ? (
            <Button size="sm" onClick={() => settle()} disabled={paying !== null}>
              {paying === "all" ? "Recording…" : "Settle everyone"}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {data.byStaff.length === 0 ? (
            <Empty>No tips recorded. They appear here as soon as the till takes one.</Empty>
          ) : (
            <div className="space-y-2">
              {data.byStaff.map(person => (
                <div
                  key={person.staff_id ?? "unassigned"}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium">{person.staff_name ?? "Not assigned"}</p>
                    <p className="text-xs text-muted-foreground">
                      {person.lines} tip{person.lines === 1 ? "" : "s"} · {formatPrice(person.earned)} earned
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`tabular-nums font-semibold ${person.outstanding > 0 ? "text-rose-600" : "text-muted-foreground"}`}
                    >
                      {formatPrice(person.outstanding)} owed
                    </span>
                    {person.outstanding > 0 && person.staff_id ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={paying !== null}
                        onClick={() => settle(person.staff_id!)}
                      >
                        {paying === person.staff_id ? "…" : "Settle"}
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
        A cash tip is settled the moment it is rung up, because it left the drawer into the
        person&apos;s hand. A card tip arrived with the payment and stays owed until you settle it.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function DrawerTab({ businessId }: { businessId: number }) {
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
      .catch(() => toast.error("Could not load the drawer"))
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
      toast.success("Drawer open");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open the drawer");
    } finally { setBusy(false); }
  };

  const closeDrawer = async () => {
    if (!session) return;
    if (counted.trim() === "") { toast.error("Count the cash first"); return; }
    setBusy(true);
    try {
      const closed = await moneyService.closeDrawer(businessId, session.id, Number(counted), notes || undefined);
      const diff = Number(closed.variance ?? 0);
      if (Math.abs(diff) < 0.005) toast.success("Drawer balanced exactly");
      else if (diff > 0) toast.warning(`${formatPrice(diff)} more than expected`);
      else toast.warning(`${formatPrice(Math.abs(diff))} short`);
      setCounted(""); setNotes("");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not close the drawer");
    } finally { setBusy(false); }
  };

  const move = async (direction: "IN" | "OUT") => {
    if (!session) return;
    if (!moveAmount.trim() || !moveReason.trim()) {
      toast.error("A movement needs an amount and a reason");
      return;
    }
    setBusy(true);
    try {
      await moneyService.moveCash(businessId, session.id, direction, Number(moveAmount), moveReason);
      setMoveAmount(""); setMoveReason("");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not record that");
    } finally { setBusy(false); }
  };

  if (loading) return <Empty>Loading…</Empty>;

  return (
    <div className="space-y-6">
      {session ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-4 w-4" /> Open since {String(session.opened_at).slice(0, 16).replace("T", " ")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Figure label="Opening float" value={formatPrice(session.opening_float)} />
              <Figure
                label="Should be in the drawer"
                value={formatPrice(session.expected ?? 0)}
                hint="Float plus cash taken, less anything paid out"
              />
              <Figure
                label="Difference"
                value={variance === null ? "—" : formatPrice(variance)}
                tone={variance === null ? "plain" : Math.abs(variance) < 0.005 ? "good" : "bad"}
                hint={variance === null ? "Count to see" : variance < 0 ? "Short" : "Over"}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Money in or out</p>
                <p className="text-xs text-muted-foreground">
                  A float top-up, paying a supplier from the till, a cash tip handed over. Without
                  these the count never balances.
                </p>
                <div className="flex gap-2">
                  <Input
                    inputMode="decimal"
                    placeholder="Amount"
                    value={moveAmount}
                    onChange={e => setMoveAmount(e.target.value)}
                  />
                  <Input
                    placeholder="What for"
                    value={moveReason}
                    onChange={e => setMoveReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => move("IN")}>Paid in</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => move("OUT")}>Paid out</Button>
                </div>
                {(session.movements ?? []).length > 0 ? (
                  <ul className="space-y-1 pt-1 text-xs text-muted-foreground">
                    {(session.movements ?? []).map(m => (
                      <li key={m.id} className="flex justify-between gap-3">
                        <span>{m.reason ?? (m.direction === "IN" ? "Paid in" : "Paid out")}</span>
                        <span className={m.direction === "OUT" ? "text-rose-600" : ""}>
                          {m.direction === "OUT" ? "−" : "+"}{formatPrice(m.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Close the drawer</p>
                <div className="space-y-2">
                  <Label htmlFor="counted">What you counted</Label>
                  <Input
                    id="counted"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={counted}
                    onChange={e => setCounted(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-notes">Anything to note</Label>
                  <Textarea
                    id="drawer-notes"
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Only if the count is off"
                  />
                </div>
                <Button disabled={busy} onClick={closeDrawer}>Count and close</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">The drawer is shut</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Open it at the start of the day with whatever float is in it. Cash sales are then
              counted against it, so closing tells you whether the till balances.
            </p>
            <div className="flex max-w-sm gap-2">
              <Input
                inputMode="decimal"
                placeholder="Opening float"
                value={openingFloat}
                onChange={e => setOpeningFloat(e.target.value)}
              />
              <Button disabled={busy} onClick={openDrawer}>Open</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Previous days</CardTitle></CardHeader>
        <CardContent>
          {history.filter(h => h.status === "CLOSED").length === 0 ? (
            <Empty>No day has been closed yet.</Empty>
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
                        Expected {formatPrice(past.expected_cash ?? 0)} · counted {formatPrice(past.counted_cash ?? 0)}
                        {past.notes ? ` · ${past.notes}` : ""}
                      </p>
                    </div>
                    <span className={`tabular-nums font-semibold ${balanced ? "text-emerald-600" : "text-rose-600"}`}>
                      {balanced ? "Balanced" : `${diff > 0 ? "+" : "−"}${formatPrice(Math.abs(diff))}`}
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

function InvoicesTab({ businessId }: { businessId: number }) {
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
      .catch(() => toast.error("Could not load invoices"))
      .finally(() => setLoading(false));
  }, [businessId]);

  useEffect(load, [load]);

  const issue = async () => {
    if (!saleId.trim()) { toast.error("Which sale?"); return; }
    setBusy(true);
    try {
      const invoice = await moneyService.issueInvoice(businessId, Number(saleId), {
        buyerName: buyerName || undefined,
        buyerTaxNumber: buyerTax || undefined,
      });
      toast.success(`Issued ${invoice.number}`);
      setSaleId(""); setBuyerName(""); setBuyerTax("");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not issue that invoice");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Issue one</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Numbered in one unbroken run per year. A customer expensing a visit needs the number
            and your tax number on it, which a receipt does not have.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="sale-id">Sale number</Label>
              <Input id="sale-id" inputMode="numeric" value={saleId} onChange={e => setSaleId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer">Bill to</Label>
              <Input id="buyer" value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="Their company" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-tax">Their tax number</Label>
              <Input id="buyer-tax" value={buyerTax} onChange={e => setBuyerTax(e.target.value)} />
            </div>
          </div>
          <Button disabled={busy} onClick={issue}>Issue invoice</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Issued</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Empty>Loading…</Empty> : rows.length === 0 ? (
            <Empty>No invoice has been issued yet.</Empty>
          ) : (
            <div className="space-y-2">
              {rows.map(invoice => (
                <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                  <div>
                    <p className="font-medium">
                      {invoice.number}
                      {invoice.status === "VOID" ? <span className="ml-2 text-xs text-rose-600">void</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {day(invoice.issued_on)} · {invoice.buyer_name ?? "No name"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{formatPrice(invoice.gross_amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatPrice(invoice.net_amount)} net · {formatPrice(invoice.tax_amount)} tax
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

function DepositsTab({ businessId }: { businessId: number }) {
  const [report, setReport] = useState<ForfeitReport | null>(null);
  const [candidates, setCandidates] = useState<ForfeitCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!businessId) { setLoading(false); return; }
    Promise.all([moneyService.getForfeits(businessId), moneyService.getForfeitCandidates(businessId)])
      .then(([r, c]) => { setReport(r); setCandidates(c); })
      .catch(() => toast.error("Could not load deposits"))
      .finally(() => setLoading(false));
  }, [businessId]);

  useEffect(load, [load]);

  const keep = async (bookingId: number) => {
    setBusy(bookingId);
    try {
      await moneyService.keepDeposit(businessId, bookingId, "No-show");
      toast.success("Recorded as kept");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not record that");
    } finally { setBusy(null); }
  };

  if (loading) return <Empty>Loading…</Empty>;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Figure
          label="Deposits kept"
          value={formatPrice(report?.totals.kept ?? 0)}
          hint={`${report?.totals.bookings ?? 0} bookings`}
          tone="good"
        />
        <Figure
          label="Lost to no-shows"
          value={formatPrice(report?.uncovered.lost ?? 0)}
          hint={`${report?.uncovered.bookings ?? 0} with no deposit taken`}
          tone="bad"
        />
        <Figure label="Waiting on a decision" value={String(candidates.length)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Decide</CardTitle></CardHeader>
        <CardContent>
          {candidates.length === 0 ? (
            <Empty>Nothing waiting. Deposits appear here when a booking is missed or cancelled.</Empty>
          ) : (
            <div className="space-y-2">
              {candidates.map(row => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{row.client_name ?? "Walk-in"}</p>
                    <p className="text-xs text-muted-foreground">
                      {day(row.appointment_date)} {String(row.start_time).slice(0, 5)} ·{" "}
                      {row.status === "NO_SHOW" ? "Did not turn up" : "Cancelled"}
                      {row.staff_name ? ` · ${row.staff_name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-semibold">{formatPrice(row.deposit_amount)}</span>
                    <Button size="sm" disabled={busy !== null} onClick={() => keep(row.id)}>
                      {busy === row.id ? "…" : "Keep it"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Keeping a deposit is a decision, not something that happens on its own. The customer whose
        bus broke down gets theirs back; refund them from the booking instead.
      </p>

      {report && report.kept.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Kept</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {report.kept.map(row => (
                <li key={row.id} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    {day(row.deposit_forfeited_at)} · {row.client_name ?? "Walk-in"}
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

function SettingsTab({ businessId }: { businessId: number }) {
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
      .catch(() => toast.error("Could not load your settings"))
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
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally { setSaving(false); }
  };

  if (loading) return <Empty>Loading…</Empty>;

  const rate = Number(form.taxRate || 0);
  const example = pricesIncludeTax
    ? `A 100 service is ${(100 / (1 + rate / 100)).toFixed(2)} plus ${(100 - 100 / (1 + rate / 100)).toFixed(2)} tax.`
    : `A 100 service is charged at ${(100 * (1 + rate / 100)).toFixed(2)}.`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Tax</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tax-rate">Rate</Label>
              <Input
                id="tax-rate"
                inputMode="decimal"
                placeholder="23"
                value={form.taxRate}
                onChange={e => setForm({ ...form, taxRate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">A percentage. 23 in Poland.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-number">Your tax number</Label>
              <Input
                id="tax-number"
                value={form.taxNumber}
                onChange={e => setForm({ ...form, taxNumber: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Appears on every invoice you issue.</p>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">My prices already include tax</p>
              <p className="text-xs text-muted-foreground">
                {rate > 0 ? example : "The usual answer in Europe. Turn it off to add tax on top."}
              </p>
            </div>
            <Switch checked={pricesIncludeTax} onCheckedChange={setPricesIncludeTax} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legal-name">Registered name</Label>
              <Input
                id="legal-name"
                value={form.legalName}
                onChange={e => setForm({ ...form, legalName: e.target.value })}
                placeholder="If it differs from the salon name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal-address">Registered address</Label>
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
        <CardHeader><CardTitle className="text-base">Tips</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Ask for a tip at checkout</p>
              <p className="text-xs text-muted-foreground">
                Off means the app never asks, which is the right answer in some markets.
              </p>
            </div>
            <Switch checked={tipsEnabled} onCheckedChange={setTipsEnabled} />
          </div>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="tip-presets">Percentages to offer</Label>
            <Input
              id="tip-presets"
              value={form.tipPresets}
              onChange={e => setForm({ ...form, tipPresets: e.target.value })}
              placeholder="10,15,20"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Where payouts go</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="iban">Account number</Label>
              <Input
                id="iban"
                value={form.payoutIban}
                onChange={e => setForm({ ...form, payoutIban: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-name">Account name</Label>
              <Input
                id="account-name"
                value={form.payoutAccountName}
                onChange={e => setForm({ ...form, payoutAccountName: e.target.value })}
              />
            </div>
          </div>
          {settings?.platform_fee_percent != null ? (
            <p className="text-sm text-muted-foreground">
              Your agreed platform fee is {settings.platform_fee_percent}%.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</Button>
    </div>
  );
}
