import type { Id } from "@/types/id";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { Coverage } from "@/components/checkout/BenefitsAndTenders";
import { useBusinessId } from "@/hooks/useBusinessId";
import { currencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { businessService } from "@/services/businessService";
import { checkoutQuoteService, type CheckoutQuote } from "@/services/checkoutQuoteService";
import type { SalePayment } from "@/services/paymentConfirmationService";
import "@/components/auth/auth-tokens.css";
import { t } from "@/i18n";

/**
 * Take payment, POS v3.
 *
 * The cashier no longer picks a package, a membership or a wallet amount: the server prices
 * the bill (POST /businesses/{id}/checkout/quote) with everything the salon already knows
 * applied, and this screen shows it — each benefit under its line, removable with ✕ — then
 * asks one question: cash or card. The sale re-checks the same quote (quoteBillDue).
 */

type StaffLite = { id: Id; name: string; avatarUrl?: string; position?: string };

export interface PaymentData {
  tip: number;
  tipPercent: number;
  discountAmount: number;
  discountPercent: number;
  paymentMethod: string;
  amount: number;
  change: number;
  splitCashAmount?: number;
  splitCardAmount?: number;
  giftCardCode?: string;
  payments?: SalePayment[];
  coverage?: Coverage;
  leaveBalance?: boolean;
  /** The quote's bill; the sale refuses one that changed since (409). */
  quoteBillDue?: number;
  /** Old debt the client paid off with this visit; settled on their balance after the sale. */
  debtSettle?: { amount: number; method: "CASH" | "CARD_TERMINAL" };
}

interface PaymentMethodPageProps {
  orderItems?: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    duration?: string;
    serviceId?: Id;
    productId?: Id;
  }>;
  subtotal?: number;
  /** The bookings this ticket settles (public ids): deposit, promo, prepayment come from them. */
  appointmentIds?: string[];
  // Kept for callers; the quote now reads these from the bookings itself.
  depositPaid?: number;
  pointsCredit?: number;
  prepaidOnline?: number;
  bookedPromo?: { code: string; discount: number } | null;
  selectedClient?: { id: string; name: string; avatar?: string } | null;
  selectedStaff?: StaffLite | null;
  staffList?: StaffLite[];
  onStaffChange?: (staff: StaffLite) => void;
  onDiscard?: () => void;
  onConfirm?: (paymentData: PaymentData) => void | Promise<unknown>;
  onCancel?: () => void;
}

const LAST_METHOD_KEY = "booqi.till.lastMethod";
const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (s: string) => parseFloat(s.replace(",", ".")) || 0;

export default function PaymentMethodPage({
  orderItems = [],
  appointmentIds = [],
  selectedClient = null,
  selectedStaff: propStaff = null,
  staffList = [],
  onStaffChange,
  onConfirm,
  onCancel,
}: PaymentMethodPageProps) {
  const navigate = useNavigate();
  const businessId = useBusinessId();

  const [staff, setStaff] = useState<StaffLite | null>(propStaff);
  useEffect(() => setStaff(propStaff), [propStaff]);

  // What the salon takes (Setup › Payment methods).
  const [accepted, setAccepted] = useState<string[]>(["CASH", "CARD"]);
  useEffect(() => {
    if (!businessId) return;
    businessService
      .getBusiness(businessId)
      .then((b) => setAccepted((b.acceptedPaymentMethods ?? "CASH,CARD").split(",").map((m: string) => m.trim()).filter(Boolean)))
      .catch(() => setAccepted(["CASH", "CARD"]));
  }, [businessId]);
  const takesCash = accepted.includes("CASH");
  const takesCard = accepted.includes("CARD");

  // ── the cashier's few choices ──
  const [method, setMethod] = useState<"cash" | "card">(() => {
    try {
      return localStorage.getItem(LAST_METHOD_KEY) === "card-terminal" ? "card" : "cash";
    } catch {
      return "cash";
    }
  });
  useEffect(() => {
    if (method === "cash" && !takesCash && takesCard) setMethod("card");
    if (method === "card" && !takesCard && takesCash) setMethod("cash");
  }, [method, takesCash, takesCard]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [usePoints, setUsePoints] = useState(false);
  const [includeDebt, setIncludeDebt] = useState(false);
  const [giftCode, setGiftCode] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftApplied, setGiftApplied] = useState("");
  const [giftError, setGiftError] = useState<string | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipText, setTipText] = useState("");
  const [discount, setDiscount] = useState(0);
  const [cashText, setCashText] = useState<string | null>(null);
  const [split, setSplit] = useState<number | null>(null); // the cash part, when split
  const [owing, setOwing] = useState<number | null>(null); // paid now, when the rest stays owing
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [discountDraft, setDiscountDraft] = useState("");
  const [discountLetters, setDiscountLetters] = useState(false);
  const [splitDraft, setSplitDraft] = useState("");
  const [owingDraft, setOwingDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const tip = round2(num(tipText));

  // ── the quote ──
  const request = useMemo(
    () => ({
      clientId: selectedClient?.id ?? null,
      appointmentIds,
      items: orderItems.map((i) => ({
        lineId: i.id,
        serviceId: i.serviceId,
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.price,
        staffName: staff?.name,
      })),
      giftCardCode: giftApplied || undefined,
      removed,
      usePoints,
      includeDebt,
      discountAmount: discount || undefined,
      tipAmount: tip || undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedClient?.id, JSON.stringify(appointmentIds), JSON.stringify(orderItems), staff?.name, giftApplied, JSON.stringify(removed), usePoints, includeDebt, discount, tip],
  );
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!businessId) return;
    let alive = true;
    const timer = setTimeout(() => {
      checkoutQuoteService
        .quote(businessId, request)
        .then((q) => {
          if (!alive) return;
          setQuote(q);
          setQuoteError(null);
        })
        .catch((e: unknown) => {
          if (!alive) return;
          const msg = e instanceof Error ? e.message : String(e);
          // A bad gift card code: say so at the field and price without it.
          if (giftApplied) {
            setGiftError(/no gift card with that code/i.test(msg) ? t("pos.giftCodeInvalid") : /another salon/i.test(msg) ? t("pos.giftOtherSalon") : msg);
            setGiftApplied("");
            setGiftOpen(true);
            return;
          }
          setQuoteError(msg);
        });
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [businessId, request, giftApplied, reload]);

  const due = quote ? Number(quote.due) : 0;
  const saleDue = quote ? Number(quote.saleDue) : 0;
  const nothingToTake = quote !== null && due <= 0.009;
  const received = cashText === null ? due : num(cashText);
  const money = (n: number) => `${Number(n).toFixed(2)} ${currencySymbol()}`;

  const handleCancel = () => (onCancel ? onCancel() : navigate(-1));

  const handleConfirm = () => {
    if (busy || !quote || !onConfirm) return;
    const base: SalePayment[] = (quote.payments ?? []).map((p) => ({ ...p, amount: Number(p.amount) }));
    const cashCard = (m: "cash" | "card") => (m === "card" ? "CARD_TERMINAL" : "CASH") as "CASH" | "CARD_TERMINAL";
    let payments = base;
    let leaveBalance = false;
    let paymentMethod = method === "card" ? "card-terminal" : "cash";
    if (owing !== null) {
      const now = Math.min(saleDue, owing);
      payments = [...base, ...(now > 0 ? [{ method: cashCard(method), amount: round2(now) }] : [])];
      leaveBalance = saleDue - now > 0.009;
    } else if (split !== null) {
      const c = Math.min(saleDue, split);
      paymentMethod = "split";
      payments = [
        ...base,
        ...(c > 0 ? [{ method: "CASH" as const, amount: round2(c) }] : []),
        ...(saleDue - c > 0.009 ? [{ method: "CARD_TERMINAL" as const, amount: round2(saleDue - c) }] : []),
      ];
    } else if (saleDue > 0.009) {
      if (method === "cash" && received + 0.005 < due) {
        toast.error(t("pos.short", { value: money(due - received) }));
        return;
      }
      payments = [...base, { method: cashCard(method), amount: round2(saleDue) }];
    }
    if (payments.length === 0) {
      // Fully covered (package, deposit…): an explicit empty list takes no money.
      leaveBalance = true;
    }
    if (method === "card" || method === "cash") {
      try {
        localStorage.setItem(LAST_METHOD_KEY, method === "card" ? "card-terminal" : "cash");
      } catch {
        /* per-browser convenience only */
      }
    }
    const data: PaymentData = {
      tip,
      tipPercent: 0,
      discountAmount: Number(quote.discount ?? 0) > 0 && !quote.promoCode ? Number(quote.discount) : 0,
      discountPercent: 0,
      paymentMethod,
      amount: method === "cash" && split === null && owing === null ? received : saleDue,
      change: method === "cash" && split === null && owing === null ? Math.max(0, round2(received - due)) : 0,
      splitCashAmount: split ?? undefined,
      splitCardAmount: split !== null ? round2(Math.max(0, saleDue - split)) : undefined,
      payments,
      coverage: quote.coverage as Coverage,
      leaveBalance,
      quoteBillDue: Number(quote.billDue),
      debtSettle: quote.debt?.included && quote.debt.amount > 0 ? { amount: Number(quote.debt.amount), method: cashCard(method) } : undefined,
    };
    setBusy(true);
    void Promise.resolve(onConfirm(data) as unknown).finally(() => setBusy(false));
  };

  // Enter takes payment (not from a button, link or the sheet).
  const confirmRef = useRef(handleConfirm);
  confirmRef.current = handleConfirm;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (tag === "BUTTON" || tag === "TEXTAREA" || tag === "A" || tag === "SELECT") return;
      if (tag === "INPUT" && (e.target as HTMLInputElement).id === "gift-code") return;
      e.preventDefault();
      confirmRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── presentation: one calm panel ──
  const label = "text-[13px] text-[rgb(var(--reg-muted))]";
  const value = "text-[15px] text-[rgb(var(--reg-ink))]";
  const good = "text-[13px] text-[rgb(var(--reg-success))]";
  const field =
    "h-12 w-full rounded-xl bg-[rgb(var(--reg-canvas))] px-4 text-[15px] tabular-nums text-[rgb(var(--reg-ink))] outline-none transition focus:bg-white focus:ring-2 focus:ring-[rgb(var(--reg-brand)/0.35)]";
  const textBtn = "text-[13px] font-semibold text-[rgb(var(--reg-brand-strong))] hover:underline focus-visible:outline-none focus-visible:underline";
  const segBtn = (on: boolean) =>
    cn(
      "h-10 flex-1 rounded-[10px] text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]",
      on ? "bg-white text-[rgb(var(--reg-ink))] shadow-[0_1px_3px_rgb(var(--reg-ink)/0.12)]" : "text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]",
    );
  const removeBtn = (id: string, what: string) => (
    <button
      type="button"
      aria-label={t("pos.remove", { what })}
      onClick={() => setRemoved((r) => [...r, id])}
      className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[rgb(var(--reg-muted))] hover:bg-[rgb(var(--reg-ink)/0.06)] hover:text-[rgb(var(--reg-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]"
    >
      <X className="h-3 w-3" aria-hidden />
    </button>
  );
  const creditLabel = (kind: string, code?: string) =>
    kind === "PROMO" ? t("pos.promo", { code: code ?? "" })
      : kind === "DISCOUNT" ? t("common.discount")
        : kind === "DEPOSIT" ? t("pos.deposit")
          : t("pos.bookedPoints");
  const tenderLabel = (kind: string, extra?: string | number) =>
    kind === "PREPAID" ? t("pos.prepaid")
      : kind === "GIFT_CARD" ? t("pos.giftCard", { code: String(extra ?? "") })
        : kind === "WALLET" ? t("pos.wallet")
          : t("pos.points", { points: Number(extra ?? 0) });

  return (
    <div
      className="flex min-h-[100dvh] justify-center bg-[rgb(var(--reg-canvas))] px-4 py-6 text-[rgb(var(--reg-ink))] md:items-center md:py-10"
      style={{ fontFamily: '"Plus Jakarta Sans", Inter, system-ui, sans-serif' }}
    >
      <main className="w-full max-w-[480px] self-start rounded-[28px] bg-white px-6 py-7 shadow-[0_24px_60px_-30px_rgb(var(--reg-ink)/0.25)] md:self-center md:px-8">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="truncate text-[15px] font-semibold">{selectedClient ? selectedClient.name : t("pos.walkIn")}</h1>
          <button type="button" onClick={handleCancel} className={textBtn}>{t("pos.edit")}</button>
        </div>

        {/* Lines, each with what the system applied to it. */}
        <ul className="mt-3 space-y-2">
          {(quote?.lines ?? orderItems.map((i) => ({ lineId: i.id, name: i.name, quantity: i.quantity, amount: i.price * i.quantity, benefits: [] }))).map((line) => (
            <li key={line.lineId}>
              <div className="flex items-baseline justify-between gap-4">
                <span className={cn(value, "min-w-0 truncate")}>
                  {line.name}
                  {line.quantity > 1 ? ` ×${line.quantity}` : ""}
                  {staff && (
                    <span className={label}>
                      {" · "}
                      {staffList.length > 1 ? (
                        // #15: who gets the commission can still be corrected.
                        <select
                          aria-label={t("pos.staff")}
                          value={String(staff.id)}
                          onChange={(e) => {
                            const m = staffList.find((s) => String(s.id) === e.target.value);
                            if (m) {
                              setStaff(m);
                              onStaffChange?.(m);
                            }
                          }}
                          className="cursor-pointer appearance-none bg-transparent text-[13px] text-[rgb(var(--reg-muted))] underline decoration-dotted underline-offset-2 outline-none focus-visible:text-[rgb(var(--reg-ink))]"
                        >
                          {staffList.map((s) => (
                            <option key={s.id} value={String(s.id)}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        staff.name
                      )}
                    </span>
                  )}
                </span>
                <span className={cn(value, "shrink-0 tabular-nums")}>{money(line.amount)}</span>
              </div>
              {line.benefits.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-4 pl-4">
                  <span className={good}>
                    {t(b.kind === "PACKAGE" ? "pos.fromPackage" : "pos.fromMembership", { left: b.sessionsLeft, total: b.sessionsTotal })}
                    {b.removable && removeBtn(b.id, b.name)}
                  </span>
                  <span className={cn(good, "tabular-nums")}>−{money(b.amount)}</span>
                </div>
              ))}
            </li>
          ))}
        </ul>

        {/* Off the bill, then paid from what the client already has. */}
        {quote && (quote.credits.length > 0 || quote.tenders.length > 0 || tip > 0 || quote.debt?.included) && (
          <ul className="mt-3 space-y-1">
            {tip > 0 && (
              <li className="flex justify-between gap-4"><span className={label}>{t("pos.tip")}</span><span className={cn(label, "tabular-nums")}>+{money(tip)}</span></li>
            )}
            {quote.credits.map((c) => (
              <li key={c.id} className="flex justify-between gap-4">
                <span className={good}>{creditLabel(c.kind, c.code)}</span>
                <span className={cn(good, "tabular-nums")}>−{money(c.amount)}</span>
              </li>
            ))}
            {quote.tenders.map((tn) => (
              <li key={tn.id} className="flex items-center justify-between gap-4">
                <span className={good}>
                  {tenderLabel(tn.kind, tn.kind === "GIFT_CARD" ? tn.giftCardCode : tn.points)}
                  {tn.removable &&
                    (tn.kind === "POINTS" ? (
                      <button type="button" aria-label={t("pos.remove", { what: tenderLabel(tn.kind, tn.points) })} onClick={() => setUsePoints(false)} className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[rgb(var(--reg-muted))] hover:bg-[rgb(var(--reg-ink)/0.06)]"><X className="h-3 w-3" aria-hidden /></button>
                    ) : tn.kind === "GIFT_CARD" ? (
                      <button type="button" aria-label={t("pos.remove", { what: tenderLabel(tn.kind, tn.giftCardCode) })} onClick={() => { setGiftApplied(""); setGiftCode(""); }} className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[rgb(var(--reg-muted))] hover:bg-[rgb(var(--reg-ink)/0.06)]"><X className="h-3 w-3" aria-hidden /></button>
                    ) : (
                      removeBtn(tn.id, tenderLabel(tn.kind))
                    ))}
                </span>
                <span className={cn(good, "tabular-nums")}>−{money(tn.amount)}</span>
              </li>
            ))}
            {quote.debt?.included && (
              <li className="flex items-center justify-between gap-4">
                <span className={label}>
                  {t("pos.oldDebt")}
                  <button type="button" aria-label={t("pos.remove", { what: t("pos.oldDebt") })} onClick={() => setIncludeDebt(false)} className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[rgb(var(--reg-muted))] hover:bg-[rgb(var(--reg-ink)/0.06)]"><X className="h-3 w-3" aria-hidden /></button>
                </span>
                <span className={cn(label, "tabular-nums")}>+{money(quote.debt.amount)}</span>
              </li>
            )}
          </ul>
        )}

        {/* Offers the system will not take on its own: points, old debt, a gift card by code. */}
        <div className="mt-4 space-y-2">
          {quote?.pointsSuggestion && !quote.pointsSuggestion.applied && (
            <button type="button" className={cn(textBtn, "block")} onClick={() => setUsePoints(true)}>
              {t("pos.usePoints", { points: quote.pointsSuggestion.points, value: money(quote.pointsSuggestion.amount) })}
            </button>
          )}
          {quote?.debt && !quote.debt.included && split === null && owing === null && (
            <button type="button" className={cn(textBtn, "block")} onClick={() => setIncludeDebt(true)}>
              {t("pos.addDebt", { value: money(quote.debt.amount) })}
            </button>
          )}
          {!giftApplied &&
            (giftOpen ? (
              <div>
                <label htmlFor="gift-code" className={label}>{t("pos.giftCode")}</label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="gift-code"
                    value={giftCode}
                    autoComplete="off"
                    autoFocus
                    onChange={(e) => {
                      setGiftCode(e.target.value.toUpperCase());
                      setGiftError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && giftCode.trim()) {
                        e.preventDefault();
                        setGiftApplied(giftCode.trim());
                      }
                    }}
                    className={cn(field, "tracking-wider")}
                  />
                  <Button variant="ghost" className="h-12 rounded-xl px-4 text-[15px] font-semibold" disabled={!giftCode.trim()} onClick={() => setGiftApplied(giftCode.trim())}>
                    {t("pos.apply")}
                  </Button>
                </div>
                {giftError && <p className="mt-1.5 text-[13px] text-rose-700">{giftError}</p>}
              </div>
            ) : (
              <button type="button" className={cn(textBtn, "block")} onClick={() => setGiftOpen(true)}>{t("pos.giftCode")}</button>
            ))}
        </div>

        {/* The one number. */}
        <div className="mt-7">
          <p className={label}>{t("pos.due")}</p>
          <p className="mt-1 text-[44px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{quote ? money(due) : "…"}</p>
          {quoteError && (
            <p className="mt-2 text-[13px] text-rose-700">
              {quoteError}{" "}
              <button type="button" className={textBtn} onClick={() => setReload((n) => n + 1)}>{t("pos.retry")}</button>
            </p>
          )}
        </div>

        {/* Nothing to take (package, wallet, deposit covered it): no method to choose. */}
        {quote && !nothingToTake && (
          <>
            {split === null && owing === null && takesCash && takesCard && (
              <div className="mt-6 flex gap-1 rounded-xl bg-[rgb(var(--reg-canvas))] p-1" role="radiogroup" aria-label={t("pos.method")}>
                <button type="button" role="radio" aria-checked={method === "cash"} className={segBtn(method === "cash")} onClick={() => { setMethod("cash"); setCashText(null); }}>
                  {t("common.cash")}
                </button>
                <button type="button" role="radio" aria-checked={method === "card"} className={segBtn(method === "card")} onClick={() => setMethod("card")}>
                  {t("common.card")}
                </button>
              </div>
            )}
            <div className="mt-4">
              {split !== null ? (
                <p className={value}>
                  {t("pos.splitSummary", { value: money(Math.min(split, saleDue)), value2: money(Math.max(0, saleDue - split)) })}{" "}
                  <button type="button" className={textBtn} onClick={() => setSplit(null)}>{t("pos.undo")}</button>
                </p>
              ) : owing !== null ? (
                <p className={value}>
                  {t("pos.debtSummary", { value: money(Math.max(0, saleDue - owing)) })}{" "}
                  <button type="button" className={textBtn} onClick={() => setOwing(null)}>{t("pos.undo")}</button>
                </p>
              ) : method === "cash" ? (
                <>
                  <label htmlFor="cash-received" className={label}>{t("pos.received")}</label>
                  <input
                    id="cash-received"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={cashText ?? due.toFixed(2)}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setCashText(e.target.value.replace(/[^0-9.,]/g, ""))}
                    className={cn(field, "mt-1.5")}
                  />
                  <p className={cn(label, "mt-2")} aria-live="polite">
                    {received - due < -0.005 ? t("pos.short", { value: money(due - received) }) : t("pos.change", { value: money(received - due) })}
                  </p>
                </>
              ) : null}
            </div>
          </>
        )}

        <div className="mt-5 flex flex-col items-start gap-2">
          {!tipOpen && tip === 0 ? (
            <button type="button" className={textBtn} onClick={() => setTipOpen(true)}>{t("pos.addTip")}</button>
          ) : (
            <div className="w-full">
              <label htmlFor="tip" className={label}>{t("pos.tip")}</label>
              <input
                id="tip"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                autoFocus={tip === 0}
                value={tipText}
                placeholder="0"
                onChange={(e) => {
                  setTipText(e.target.value.replace(/[^0-9.,]/g, ""));
                  setCashText(null);
                }}
                className={cn(field, "mt-1.5")}
              />
            </div>
          )}
          {quote && !nothingToTake && (
            <button type="button" className={textBtn} onClick={() => setExtrasOpen(true)}>{t("pos.extras")}</button>
          )}
        </div>

        <Button
          onClick={handleConfirm}
          disabled={busy || !quote}
          className="mt-7 h-14 w-full rounded-2xl bg-[rgb(var(--reg-brand))] text-[16px] font-bold text-white hover:bg-[rgb(var(--reg-brand-strong))] disabled:opacity-60"
        >
          {nothingToTake ? t("pos.complete") : t("pos.pay", { value: money(due) })}
        </Button>
      </main>

      {/* Discount / split / leave owing: rarely needed. */}
      <Sheet open={extrasOpen} onOpenChange={setExtrasOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-[480px] rounded-t-[28px] border-0 bg-white px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-6 text-[rgb(var(--reg-ink))] [&>button]:hidden"
          style={{ fontFamily: '"Plus Jakarta Sans", Inter, system-ui, sans-serif' }}
        >
          <SheetTitle className="text-[15px] font-semibold">{t("pos.extras")}</SheetTitle>
          <div className="mt-5 space-y-6">
            {!quote?.promoCode && (
              <div>
                <label htmlFor="disc" className={label}>{t("pos.discountAmount")}</label>
                {discountLetters && <p role="alert" className="mt-1 text-xs font-semibold text-amber-700">{t("pos.discountNoLetters")}</p>}
                <div className="mt-1.5 flex gap-2">
                  <input id="disc" type="text" inputMode="decimal" autoComplete="off" value={discountDraft} placeholder={discount > 0 ? discount.toFixed(2) : "0"} onChange={(e) => { setDiscountLetters(/[^0-9.,%\s]/.test(e.target.value)); setDiscountDraft(e.target.value.replace(/[^0-9.,%]/g, "")); }} className={field} />
                  <Button
                    variant="ghost"
                    className="h-12 rounded-xl px-4 text-[15px] font-semibold"
                    onClick={() => {
                      const sub = Number(quote?.subtotal ?? 0);
                      const amt = discountDraft.trim().endsWith("%") ? round2((sub * num(discountDraft)) / 100) : round2(num(discountDraft));
                      setDiscount(Math.min(sub, amt));
                      setDiscountDraft("");
                      setDiscountLetters(false);
                      setCashText(null);
                      setExtrasOpen(false);
                    }}
                  >
                    {t("pos.apply")}
                  </Button>
                </div>
              </div>
            )}
            {takesCash && takesCard && (
              <div>
                <label htmlFor="split" className={label}>{t("pos.splitCash")}</label>
                <div className="mt-1.5 flex gap-2">
                  <input id="split" type="text" inputMode="decimal" autoComplete="off" value={splitDraft} placeholder="0" onChange={(e) => setSplitDraft(e.target.value.replace(/[^0-9.,]/g, ""))} className={field} />
                  <Button
                    variant="ghost"
                    className="h-12 rounded-xl px-4 text-[15px] font-semibold"
                    onClick={() => {
                      setSplit(Math.min(saleDue, round2(num(splitDraft))));
                      setOwing(null);
                      setIncludeDebt(false);
                      setSplitDraft("");
                      setExtrasOpen(false);
                    }}
                  >
                    {t("pos.apply")}
                  </Button>
                </div>
                <p className={cn(label, "mt-2")}>{t("pos.splitHint", { value: money(Math.max(0, saleDue - num(splitDraft))) })}</p>
              </div>
            )}
            {selectedClient && (
              <div>
                <label htmlFor="owing" className={label}>{t("pos.paidNow")}</label>
                <div className="mt-1.5 flex gap-2">
                  <input id="owing" type="text" inputMode="decimal" autoComplete="off" value={owingDraft} placeholder="0" onChange={(e) => setOwingDraft(e.target.value.replace(/[^0-9.,]/g, ""))} className={field} />
                  <Button
                    variant="ghost"
                    className="h-12 rounded-xl px-4 text-[15px] font-semibold"
                    onClick={() => {
                      // FG-W6-07: what is paid now is a tender; the rest stays on the client's balance.
                      setOwing(Math.min(saleDue, round2(num(owingDraft))));
                      setSplit(null);
                      setIncludeDebt(false);
                      setOwingDraft("");
                      setExtrasOpen(false);
                    }}
                  >
                    {t("pos.apply")}
                  </Button>
                </div>
                <p className={cn(label, "mt-2")}>{t("pos.debtHint", { value: money(Math.max(0, saleDue - num(owingDraft))) })}</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
