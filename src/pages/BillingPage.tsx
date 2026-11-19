import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader, Card, CardContent, CardHeader, CardTitle } from "@/components/page/booqi";
import { pageBody } from "@/components/page/booqiStyles";
import { PaymentReturnBanner } from "@/components/page/PaymentReturnBanner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBusinessId } from "@/hooks/useBusinessId";
import { salonPath } from "@/lib/salonKey";
import { getLocale, t, tDynamic, fmtDate } from "@/i18n";
import {
  billingService,
  type BillingOverview,
  type BillingPlan,
  type CommissionStatement,
  type MessagePack,
} from "@/services/billingService";
import type { Id } from "@/types/id";

const date = (iso: string | null | undefined) =>
  iso ? fmtDate(new Date(iso), { year: "numeric", month: "numeric", day: "numeric" }) : "—";

function money(amount: number, currency: string | null | undefined): string {
  const n = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(getLocale(), { style: "currency", currency: currency || "AZN" }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency ?? ""}`.trim();
  }
}

/** The plan's name and feature list in the panel language. */
function planName(p: BillingPlan): string {
  const l = getLocale();
  return (l === "az" ? p.nameAz : l === "ru" ? p.nameRu : p.nameEn) || p.nameEn || p.planKey;
}
function packName(p: MessagePack): string {
  const l = getLocale();
  return (l === "az" ? p.nameAz : l === "ru" ? p.nameRu : p.nameEn) || p.nameEn;
}
function planFeatures(p: BillingPlan): string[] {
  const l = getLocale() as "az" | "en" | "ru";
  return p.features?.[l]?.length ? p.features[l] : (p.features?.en ?? []);
}

/** "2026-11" -> "November 2026" in the panel language. */
function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return fmtDate(new Date(y, m - 1, 1), { year: "numeric", month: "long" });
}

type PendingChange = { plan: BillingPlan; kind: "start" | "upgrade" | "downgrade" };

export default function BillingPage() {
  const businessId = useBusinessId();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const returnFlag = params.get("return");
  const returnFor = params.get("for") === "messages" ? "messages" : "plan";
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [polling, setPolling] = useState(returnFlag === "1");

  // Back from checkout the webhook, not the redirect, moves the state; poll for a short while.
  useEffect(() => {
    if (returnFlag !== "1") return;
    const stop = setTimeout(() => setPolling(false), 40000);
    return () => clearTimeout(stop);
  }, [returnFlag]);

  const overview = useQuery({
    queryKey: ["billing", businessId],
    queryFn: () => billingService.overview(businessId),
    enabled: Boolean(businessId),
    refetchInterval: polling ? 2500 : false,
  });
  const invoices = useQuery({
    queryKey: ["billing", businessId, "invoices"],
    queryFn: () => billingService.invoices(businessId),
    enabled: Boolean(businessId),
  });
  const commissions = useQuery({
    queryKey: ["billing", businessId, "commissions"],
    queryFn: () => billingService.commissions(businessId),
    enabled: Boolean(businessId),
  });
  const messages = useQuery({
    queryKey: ["billing", businessId, "messages"],
    queryFn: () => billingService.messages(businessId),
    enabled: Boolean(businessId),
    refetchInterval: polling && returnFor === "messages" ? 2500 : false,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["billing", businessId] });
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : t("billing.failed"));
  const back = (flag: string, forWhat: string) =>
    `${window.location.origin}${salonPath(businessId, "billing")}?return=${flag}&for=${forWhat}`;

  const change = useMutation({
    mutationFn: (planId: Id) => billingService.changeSubscription(businessId, planId, back("1", "plan"), back("0", "plan")),
    onSuccess: (res) => {
      if (res.action === "CHECKOUT" && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      toast.success(
        res.action === "FREE_ACTIVATED"
          ? t("billing.toast.freeActivated")
          : res.action === "CANCEL_SCHEDULED"
            ? t("billing.toast.cancelScheduled")
            : t("billing.toast.changed"),
      );
      void refresh();
    },
    onError: fail,
  });
  const cancel = useMutation({
    mutationFn: () => billingService.cancelSubscription(businessId),
    onSuccess: () => {
      toast.success(t("billing.toast.cancelScheduled"));
      void refresh();
    },
    onError: fail,
  });
  const resume = useMutation({
    mutationFn: () => billingService.resumeSubscription(businessId),
    onSuccess: () => {
      toast.success(t("billing.toast.resumed"));
      void refresh();
    },
    onError: fail,
  });
  const buyPack = useMutation({
    mutationFn: (packId: Id) => billingService.purchaseMessages(businessId, packId, back("1", "messages"), back("0", "messages")),
    onSuccess: (res) => {
      window.location.href = res.checkoutUrl;
    },
    onError: fail,
  });

  const data = overview.data;
  const sub = data?.subscription;
  const planConfirmed = sub?.status === "ACTIVE" || sub?.status === "TRIALING";
  const busy = change.isPending || cancel.isPending || resume.isPending || buyPack.isPending;
  const payOff = data ? !data.providerEnabled : false;

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={t("billing.title")} subtitle={t("billing.subtitle")} />
        <div className={pageBody}>
          {returnFor === "plan" ? (
            <PaymentReturnBanner kind="subscription" flag={returnFlag} confirmed={planConfirmed} />
          ) : (
            (returnFlag === "1" || returnFlag === "0") && (
              <div role="status" className="rounded-lg border p-4 text-sm">
                {returnFlag === "1" ? t("billing.return.messages") : t("paymentReturn.cancelledBody")}
              </div>
            )
          )}

          {overview.isLoading && <p className="text-sm text-muted-foreground">{t("billing.loading")}</p>}
          {overview.isError && (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3 py-6 text-sm">
                <span className="text-destructive">{t("billing.loadFailed")}</span>
                <Button variant="outline" size="sm" onClick={() => void overview.refetch()}>
                  {t("billing.retry")}
                </Button>
              </CardContent>
            </Card>
          )}

          {data && payOff && (
            <Card>
              <CardContent className="py-5 text-sm">
                <p className="font-medium">{t("billing.notConfigured")}</p>
                <p className="mt-1 text-muted-foreground">{t("billing.notConfiguredBody")}</p>
              </CardContent>
            </Card>
          )}

          {data && sub && (
            <>
              <CurrentPlan
                data={data}
                busy={busy}
                onCancel={() => setConfirmCancel(true)}
                onResume={() => resume.mutate()}
              />

              <Card>
                <CardHeader>
                  <CardTitle>{t("billing.plans.title")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.plans.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("billing.plans.none")}</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {data.plans.map((p) => (
                        <PlanCard
                          key={p.id}
                          plan={p}
                          current={data.plan}
                          status={sub.status}
                          disabled={busy || payOff}
                          onPick={(kind) => setPending({ plan: p, kind })}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <NextInvoice data={data} />
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t("billing.invoices.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("billing.loading")}</p>
              ) : !invoices.data?.length ? (
                <p className="text-sm text-muted-foreground">{t("billing.invoices.none")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 font-medium">{t("billing.invoices.number")}</th>
                        <th className="py-2 font-medium">{t("billing.invoices.period")}</th>
                        <th className="py-2 font-medium">{t("billing.invoices.amount")}</th>
                        <th className="py-2 font-medium">{t("billing.invoices.status")}</th>
                        <th className="py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.data.map((inv) => (
                        <tr key={inv.id} className="border-b last:border-0">
                          <td className="py-2">{inv.number || "—"}</td>
                          <td className="py-2 text-muted-foreground">
                            {inv.periodStart ? `${date(inv.periodStart)} – ${date(inv.periodEnd)}` : date(inv.createdAt)}
                          </td>
                          <td className="py-2">{money(inv.status === "PAID" ? inv.amountPaid : inv.amountDue, inv.currency)}</td>
                          <td className="py-2">{tDynamic(`billing.invoices.st.${inv.status}`, inv.status)}</td>
                          <td className="space-x-3 py-2 text-right">
                            {inv.hostedUrl && (
                              <a className="inline-flex items-center gap-1 underline" href={inv.hostedUrl} target="_blank" rel="noopener noreferrer">
                                {t("billing.invoices.open")} <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {inv.pdfUrl && (
                              <a className="underline" href={inv.pdfUrl} target="_blank" rel="noopener noreferrer">
                                PDF
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("billing.commission.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("billing.commission.explain", { pct: data?.commissionPct ?? commissions.data?.currentMonth.pct ?? 0 })}
              </p>
              {commissions.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("billing.loading")}</p>
              ) : commissions.data ? (
                <>
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    <p className="font-medium">
                      {t("billing.commission.current", { month: monthLabel(commissions.data.currentMonth.month) })}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {t("billing.commission.summary", {
                        bookings: commissions.data.currentMonth.bookings,
                        base: money(commissions.data.currentMonth.base, commissions.data.currentMonth.currency),
                        pct: commissions.data.currentMonth.pct,
                      })}
                    </p>
                    <p className="mt-1 font-semibold">
                      {money(commissions.data.currentMonth.commission, commissions.data.currentMonth.currency)}
                    </p>
                  </div>
                  {commissions.data.statements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("billing.commission.none")}</p>
                  ) : (
                    <div className="divide-y rounded-lg border">
                      {commissions.data.statements.map((s) => (
                        <StatementRow key={s.id} businessId={businessId} s={s} />
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("billing.messages.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                {t("billing.messages.notLive")}
              </p>
              {messages.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("billing.loading")}</p>
              ) : messages.data ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["WHATSAPP", "SMS"] as const).map((ch) => (
                      <div key={ch} className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">{t(ch === "SMS" ? "billing.messages.sms" : "billing.messages.whatsapp")}</p>
                        <p className="text-lg font-semibold">{(messages.data.balances[ch] ?? 0).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                  {messages.data.packs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("billing.messages.noPacks")}</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {messages.data.packs.map((p) => (
                        <div key={p.id} className="flex flex-col justify-between gap-3 rounded-lg border p-3">
                          <div>
                            <p className="font-medium">{packName(p)}</p>
                            <p className="text-xs text-muted-foreground">
                              {t(p.channel === "SMS" ? "billing.messages.sms" : "billing.messages.whatsapp")} ·{" "}
                              {t("billing.messages.quantity", { count: p.quantity })}
                            </p>
                          </div>
                          <Button size="sm" disabled={busy || payOff} onClick={() => buyPack.mutate(p.id)}>
                            {t("billing.messages.buy", { price: money(p.price, p.currency) })}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {messages.data.purchases.length > 0 && (
                    <div className="overflow-x-auto">
                      <p className="mb-1 text-sm font-medium">{t("billing.messages.history")}</p>
                      <table className="w-full text-sm">
                        <tbody>
                          {messages.data.purchases.map((p) => (
                            <tr key={p.id} className="border-b last:border-0">
                              <td className="py-2">{date(p.paidAt ?? p.createdAt)}</td>
                              <td className="py-2 text-muted-foreground">
                                {t(p.channel === "SMS" ? "billing.messages.sms" : "billing.messages.whatsapp")} · {p.quantity.toLocaleString()}
                              </td>
                              <td className="py-2">{money(p.amount, p.currency)}</td>
                              <td className="py-2 text-muted-foreground">{tDynamic(`billing.messages.st.${p.status}`, p.status)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{pending ? t("billing.confirm.title", { plan: planName(pending.plan) }) : ""}</AlertDialogTitle>
              <AlertDialogDescription>
                {pending
                  ? t(
                      pending.kind === "upgrade"
                        ? "billing.confirm.upgrade"
                        : pending.kind === "downgrade"
                          ? "billing.confirm.downgrade"
                          : "billing.confirm.start",
                      { price: money(pending.plan.monthlyPrice, pending.plan.currency), days: pending.plan.trialDays },
                    )
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("billing.confirm.back")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pending) change.mutate(pending.plan.id);
                  setPending(null);
                }}
              >
                {t("billing.confirm.go")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("billing.cancel.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("billing.cancel.body", { date: date(sub?.currentPeriodEnd ?? sub?.trialEnd) })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("billing.confirm.back")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  cancel.mutate();
                  setConfirmCancel(false);
                }}
              >
                {t("billing.cancel.go")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </BooqiScope>
    </AppLayout>
  );
}

function CurrentPlan({
  data,
  busy,
  onCancel,
  onResume,
}: {
  data: BillingOverview;
  busy: boolean;
  onCancel: () => void;
  onResume: () => void;
}) {
  const sub = data.subscription;
  const active = sub.status === "ACTIVE" || sub.status === "TRIALING" || sub.status === "PAST_DUE";
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("billing.current.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {sub.status === "NONE" ? (
          <p className="text-muted-foreground">{t("billing.current.none")}</p>
        ) : (
          <p>
            <span className="text-base font-semibold">{data.plan ? planName(data.plan) : sub.planKey || "—"}</span>
            {" · "}
            <span className="text-muted-foreground">{tDynamic(`billing.status.${sub.status}`, sub.status)}</span>
          </p>
        )}
        {sub.status === "TRIALING" && sub.trialEnd && (
          <p className="text-muted-foreground">{t("billing.current.trialUntil", { date: date(sub.trialEnd) })}</p>
        )}
        {sub.status === "ACTIVE" && sub.currentPeriodEnd && !sub.cancelAtPeriodEnd && (
          <p className="text-muted-foreground">{t("billing.current.renews", { date: date(sub.currentPeriodEnd) })}</p>
        )}
        {sub.cancelAtPeriodEnd && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
            {t("billing.current.endsOn", { date: date(sub.currentPeriodEnd ?? sub.trialEnd) })}
          </p>
        )}
        {sub.pastDue && (
          <p
            className={`rounded-lg border p-3 ${sub.restricted ? "border-red-300 bg-red-50 text-red-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}
          >
            {sub.restricted
              ? t("billing.current.restricted")
              : t("billing.current.pastDue", { date: date(sub.graceUntil) })}
          </p>
        )}
        {active && (
          <div className="flex flex-wrap gap-3 pt-1">
            {sub.cancelAtPeriodEnd ? (
              <Button disabled={busy || !data.providerEnabled} onClick={onResume}>
                {t("billing.current.resume")}
              </Button>
            ) : (
              <Button variant="outline" disabled={busy || !data.providerEnabled} onClick={onCancel}>
                {t("billing.current.cancel")}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlanCard({
  plan,
  current,
  status,
  disabled,
  onPick,
}: {
  plan: BillingPlan;
  current: BillingPlan | null;
  status: string;
  disabled: boolean;
  onPick: (kind: PendingChange["kind"]) => void;
}) {
  const hasPlan = current !== null && (status === "ACTIVE" || status === "TRIALING" || status === "PAST_DUE");
  const isCurrent = hasPlan && current.id === plan.id;
  const kind: PendingChange["kind"] = !hasPlan ? "start" : plan.monthlyPrice > current.monthlyPrice ? "upgrade" : "downgrade";
  const label = isCurrent
    ? t("billing.plans.current")
    : kind === "upgrade"
      ? t("billing.plans.upgrade")
      : kind === "downgrade"
        ? t("billing.plans.downgrade")
        : plan.trialDays > 0
          ? t("billing.plans.startTrial")
          : t("billing.plans.choose");
  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-4 ${isCurrent ? "border-[rgb(var(--reg-brand))] ring-1 ring-[rgb(var(--reg-brand))]" : ""}`}>
      <div>
        <p className="font-semibold">{planName(plan)}</p>
        <p className="text-2xl font-semibold">
          {plan.monthlyPrice > 0 ? t("billing.plans.perMonth", { price: money(plan.monthlyPrice, plan.currency) }) : t("billing.plans.free")}
        </p>
        {plan.trialDays > 0 && <p className="text-xs text-muted-foreground">{t("billing.plans.trial", { days: plan.trialDays })}</p>}
        <p className="text-xs text-muted-foreground">
          {plan.maxStaff ? t("billing.plans.staff", { count: plan.maxStaff }) : t("billing.plans.unlimitedStaff")}
        </p>
      </div>
      <ul className="flex-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
        {planFeatures(plan).map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <Button variant={isCurrent ? "outline" : "default"} disabled={disabled || isCurrent} onClick={() => onPick(kind)}>
        {label}
      </Button>
    </div>
  );
}

function NextInvoice({ data }: { data: BillingOverview }) {
  const n = data.nextInvoice;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("billing.next.title")}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {!n ? (
          <p className="text-muted-foreground">{t("billing.next.none")}</p>
        ) : (
          <div className="space-y-1">
            <p className="text-muted-foreground">{t("billing.next.on", { date: date(n.date) })}</p>
            <p>
              {t("billing.next.plan")}: {money(n.planAmount, n.currency)}
            </p>
            <p>
              {t("billing.next.commission")}: {money(n.commissionAmount, n.currency)}
            </p>
            <p className="font-semibold">
              {t("billing.next.total")}: {money(n.total, n.currency)}
            </p>
            {n.estimate && <p className="text-xs text-muted-foreground">{t("billing.next.estimate")}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatementRow({ businessId, s }: { businessId: Id; s: CommissionStatement }) {
  const [open, setOpen] = useState(false);
  const lines = useQuery({
    queryKey: ["billing", businessId, "commissions", s.month],
    queryFn: () => billingService.commissionLines(businessId, s.month),
    enabled: open,
  });
  return (
    <div className="p-3 text-sm">
      <button type="button" className="flex w-full items-center gap-2 text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="flex-1 font-medium">{monthLabel(s.month)}</span>
        <span className="text-muted-foreground">
          {t("billing.commission.row", { bookings: s.bookings, pct: s.pct })}
        </span>
        <span className="font-semibold">{money(s.commission, s.currency)}</span>
        <span className="w-24 text-right text-xs text-muted-foreground">{tDynamic(`billing.commission.st.${s.status}`, s.status)}</span>
      </button>
      {open && (
        <div className="mt-2 pl-6">
          {lines.isLoading ? (
            <p className="text-muted-foreground">{t("billing.loading")}</p>
          ) : lines.isError ? (
            <p className="text-destructive">{t("billing.loadFailed")}</p>
          ) : !lines.data?.lines.length ? (
            <p className="text-muted-foreground">{t("billing.commission.noLines")}</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">{t("billing.commission.lineDate")}</th>
                  <th className="py-1 font-medium">{t("billing.commission.linePrice")}</th>
                  <th className="py-1 font-medium">{t("billing.commission.lineCommission")}</th>
                </tr>
              </thead>
              <tbody>
                {lines.data.lines.map((l, i) => (
                  <tr key={`${l.date}-${i}`}>
                    <td className="py-1">{date(l.date)}</td>
                    <td className="py-1">{money(l.price, s.currency)}</td>
                    <td className="py-1">{money(l.commission, s.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
