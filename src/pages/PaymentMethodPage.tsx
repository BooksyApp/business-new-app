import type { Id } from "@/types/id";
import { useState, useEffect, useRef } from "react";
import { currencySymbol } from "@/lib/currency";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { businessService } from "@/services/businessService";
import { assetUrl, getCurrentBusinessId } from "@/config/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Check, User, Trash2, Hand, ChevronDown, Receipt,
  CreditCard, Split, UserCircle, Gift, Package, Wallet, Percent, CornerDownLeft, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clientBalanceService } from "@/services/clientBalanceService";

import type { Coverage } from "@/components/checkout/BenefitsAndTenders";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useBusinessId } from "@/hooks/useBusinessId";
import "@/components/auth/auth-tokens.css";
import type { SalePayment } from "@/services/paymentConfirmationService";
import { t, fmtDate as formatLocaleDate } from "@/i18n";

interface PaymentMethodPageProps {
  orderItems?: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    duration?: string;
  }>;
  subtotal?: number;
  /**
   * #117: a deposit the customer has already paid on this booking.
   *
   * The till showed the full service price and the cashier collected it, so a customer who
   * had paid a 12 deposit on a 40 service handed over 40 more. The backend has subtracted
   * it since PaymentConfirmationService was written — the money recorded was always right
   * — but the number on the screen is what the cashier actually asks for.
   *
   * Not taken off `subtotal`: the sale is still worth what the services cost, and a
   * discount percentage computed off a reduced base would be wrong. It comes off what is
   * due, which is what a deposit is.
   */
  depositPaid?: number;
  /**
   * Value of loyalty points the customer spent when booking (UX-26). Comes off what is due
   * but is NOT sent as a tender: the server records it as a POINTS payment itself.
   */
  pointsCredit?: number;
  /** Paid online from a gift card at booking time; sent as a PREPAID tender. */
  prepaidOnline?: number;
  /** The promo code the customer booked with, and what it takes off. */
  bookedPromo?: { code: string; discount: number } | null;
  selectedClient?: { id: string; name: string; avatar?: string } | null;
  selectedStaff?: { id: Id; name: string; avatarUrl?: string; position?: string } | null;
  // #15: the full roster this sale's staff can be picked from, and a callback so the
  // parent (which is what actually sends staffId to the backend) learns about a change
  // made here via "CHANGE" — previously that button did nothing at all, so a walk-in
  // sale's staff (and therefore who commission gets attributed to) was locked to
  // whatever the caller defaulted to, with no way to correct it from this screen.
  staffList?: Array<{ id: Id; name: string; avatarUrl?: string; position?: string }>;
  onStaffChange?: (staff: { id: Id; name: string; avatarUrl?: string; position?: string }) => void;
  /** Throws the ticket away (the bin in the footer). Back keeps it. */
  onDiscard?: () => void;
  onConfirm?: (paymentData: {
    tip: number;
    tipPercent: number;
    // #31: the discount was applied on screen, shown in the summary and used for the
    // change calculation, but never left this component — so the sale was recorded at
    // full price while the customer paid the discounted total.
    discountAmount: number;
    discountPercent: number;
    paymentMethod: string;
    amount: number;
    change: number;
    splitCashAmount?: number;
    splitCardAmount?: number;
    /** Required when paying by gift card — the card is spent by code. */
    giftCardCode?: string;
    /** Several tenders on one bill, when the cashier used more than one. */
    payments?: SalePayment[];
    /** Which line each benefit paid for, keyed by order item id. */
    coverage?: Coverage;
    /** FG-W6-07: tenders fall short and the rest stays on the client's balance. */
    leaveBalance?: boolean;
  }) => void;
  onCancel?: () => void;
}

const LAST_METHOD_KEY = "booqi.till.lastMethod";

export default function PaymentMethodPage({
  orderItems = [],
  subtotal = 80.00,
  depositPaid = 0,
  prepaidOnline = 0,
  pointsCredit = 0,
  bookedPromo = null,
  selectedClient: propSelectedClient = null,
  selectedStaff: propSelectedStaff = null,
  staffList = [],
  onStaffChange,
  onConfirm,
  onCancel,
  onDiscard,
}: PaymentMethodPageProps) {
  const navigate = useNavigate();
  const checkoutBusinessId = useBusinessId();
  // Benefits and tenders live in their own panel: they are per line and per method, which
  // the single-method tiles below cannot express.
  const [multi, setMulti] = useState<{
    coverage: Coverage;
    payments: SalePayment[];
    due: number;
    remaining: number;
    leaveBalance: boolean;
  }>({ coverage: {}, payments: [], due: 0, remaining: 0, leaveBalance: false });
  const [selectedTip, setSelectedTip] = useState<{ amount: number; percent: number } | null>(null);
  const [customTip, setCustomTip] = useState("");
  const [showCustomTip, setShowCustomTip] = useState(false);
  const [showCustomTipDialog, setShowCustomTipDialog] = useState(false);
  const [customTipType, setCustomTipType] = useState<"percentage" | "fixed">("percentage");
  const [customTipValue, setCustomTipValue] = useState("");
  // The method the till used last (cash or card), so a card-only salon is not re-picking
  // "Card" on every sale. Per browser; storage may be blocked.
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(() => {
    try {
      const last = localStorage.getItem(LAST_METHOD_KEY);
      return last === "card-terminal" ? last : "cash";
    } catch {
      return "cash";
    }
  });
  /** Never negative and never more than the bill: a deposit larger than the sale would
      otherwise ask the cashier to hand money back through the "change" field. */
  const depositOnly = Math.max(0, Math.min(depositPaid ?? 0, subtotal));
  // Paid online from a gift card. Comes off what is due like a deposit, but unlike one the
  // server does not subtract it — it is sent as a PREPAID tender (see handleConfirm).
  const prepaidCredit = Math.max(0, Math.min(prepaidOnline ?? 0, subtotal - depositOnly));
  const pointsCovered = Math.max(0, Math.min(pointsCredit ?? 0, subtotal - depositOnly - prepaidCredit));
  const depositCredit = depositOnly + prepaidCredit + pointsCovered;
  const [paymentAmount, setPaymentAmount] = useState(Math.max(0, subtotal - depositCredit));
  const [showPaymentAmountDialog, setShowPaymentAmountDialog] = useState(false);
  const [tempPaymentAmount, setTempPaymentAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  // The customer was shown this price when they booked: start the till from it instead
  // of the full price. The server applies the same code, so the two totals agree.
  useEffect(() => {
    if (bookedPromo && bookedPromo.discount > 0) {
      setDiscountAmount(bookedPromo.discount);
      setDiscountPercent(subtotal > 0 ? (bookedPromo.discount / subtotal) * 100 : 0);
      setPaymentAmount((prev) => Math.max(0, prev - bookedPromo.discount));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookedPromo?.code, bookedPromo?.discount]);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitCashAmount, setSplitCashAmount] = useState("");
  const [splitCardAmount, setSplitCardAmount] = useState("");
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string; avatar?: string } | null>(propSelectedClient);
  const [selectedStaff, setSelectedStaff] = useState<{ id: Id; name: string; avatarUrl?: string; position?: string } | null>(propSelectedStaff);
  const [showStaffPicker, setShowStaffPicker] = useState(false);

  // Update selected client when prop changes
  useEffect(() => {
    setSelectedClient(propSelectedClient);
  }, [propSelectedClient]);

  // Update selected staff when prop changes
  useEffect(() => {
    setSelectedStaff(propSelectedStaff);
  }, [propSelectedStaff]);

  // Update payment amount when card is selected and total changes (due to discount or tip)
  useEffect(() => {
    if (selectedPaymentMethod === "card-terminal") {
      const currentTotal = subtotal - discountAmount + (selectedTip?.amount || parseFloat(customTip) || 0) - depositCredit;
      setPaymentAmount(currentTotal);
    }
  }, [selectedPaymentMethod, subtotal, discountAmount, selectedTip, customTip, depositCredit]);

  const tipOptions = [
    { amount: 0, percent: 0, label: t("paymentMethod.noTip") },
    { amount: subtotal * 0.05, percent: 5, label: "5%" },
    { amount: subtotal * 0.10, percent: 10, label: "10%" },
    { amount: subtotal * 0.15, percent: 15, label: "15%" },
  ];

  // What this salon said it accepts (Setup > Booking policy). The till used to offer
  // cash and card to everyone regardless — a salon that takes no cash still had a Cash
  // button, and pressing it recorded a payment that never happened.
  const [accepted, setAccepted] = useState<string[]>(["CASH", "CARD"]);
  const [receiptLook, setReceiptLook] = useState({ name: "", brandColor: "", footer: "" });
  useEffect(() => {
    const businessId = getCurrentBusinessId();
    if (!businessId) return;
    businessService
      .getBusiness(businessId)
      .then(b => {
        setAccepted((b.acceptedPaymentMethods ?? "CASH,CARD").split(",").map(m => m.trim()).filter(Boolean));
        setReceiptLook({ name: b.name ?? "", brandColor: b.brandColor ?? "", footer: b.receiptFooter ?? "" });
      })
      // Unknown means offer both, which is what happened before the setting existed.
      .catch(() => setAccepted(["CASH", "CARD"]));
  }, []);

  const allMethods = [
    { id: "cash", get name() { return t("common.cash"); }, icon: Hand, requires: "CASH" },
    { id: "card-terminal", get name() { return t("common.card"); }, icon: CreditCard, requires: "CARD" },
    { id: "split", get name() { return t("paymentMethod.splitPayment"); }, icon: Split, requires: "SPLIT" },
    // Value the customer already paid for. These were commented out because nothing
    // behind them existed: a salon could sell a package and hand over a gift card and
    // then had no way to accept either. booksy-backend takes both at checkout now.
    { id: "gift-card", get name() { return t("paymentMethod.giftCard"); }, icon: Gift, requires: "GIFT_CARD" },
    { id: "package", get name() { return t("paymentMethod.package"); }, icon: Package, requires: "PACKAGE" },
    { id: "membership", get name() { return t("paymentMethod.membership"); }, icon: UserCircle, requires: "MEMBERSHIP" },
    // FG-W6-06: the client's wallet, offered only when there is credit on it (below).
    { id: "wallet", get name() { return t("pos.wallet"); }, icon: Wallet, requires: "WALLET" },
  ];

  // Split needs both halves to be accepted; offering it with one of them off would let a
  // salon record cash it does not take.
  // The client's wallet credit: a tender of its own when there is any.
  const [walletCredit, setWalletCredit] = useState(0);
  useEffect(() => {
    setWalletCredit(0);
    if (!selectedClient?.id) return;
    let alive = true;
    clientBalanceService
      .get(selectedClient.id)
      .then((b) => alive && setWalletCredit(Number(b.credit ?? 0)))
      .catch(() => alive && setWalletCredit(0));
    return () => {
      alive = false;
    };
  }, [selectedClient?.id]);
  /** What the rest is paid with when the wallet does not cover the whole bill. */
  const [walletRest, setWalletRest] = useState<"cash" | "card">("cash");

  const paymentMethods = allMethods.filter(m =>
    m.requires === "SPLIT"
      ? accepted.includes("CASH") && accepted.includes("CARD")
      : m.requires === "WALLET"
        ? walletCredit > 0.009
        : accepted.includes(m.requires)
  );
  // A remembered method the salon no longer takes falls back to the first one it does.
  useEffect(() => {
    if (paymentMethods.length && !paymentMethods.some((m) => m.id === selectedPaymentMethod)) {
      setSelectedPaymentMethod(paymentMethods[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethods.map((m) => m.id).join(","), selectedPaymentMethod]);

  // A gift card is spent by code, so the till has to ask for it before it can take one.
  const [giftCardCode, setGiftCardCode] = useState("");

  const total = subtotal - discountAmount + (selectedTip?.amount || parseFloat(customTip) || 0) - depositCredit;
  const change = paymentAmount > total ? paymentAmount - total : 0;

  const handleTipSelect = (tip: typeof tipOptions[0]) => {
    setSelectedTip({ amount: tip.amount, percent: tip.percent });
    setShowCustomTip(false);
    setCustomTip("");
    setPaymentAmount(subtotal + tip.amount - depositCredit);
  };

  const handleCustomTip = () => {
    setShowCustomTipDialog(true);
    setCustomTipValue("");
    setCustomTipType("percentage");
  };

  const handleCustomTipConfirm = () => {
    const value = parseFloat(customTipValue) || 0;
    let tipAmount = 0;
    let tipPercent = 0;

    if (customTipType === "percentage") {
      tipPercent = value;
      tipAmount = subtotal * (value / 100);
    } else {
      tipAmount = value;
      tipPercent = subtotal > 0 ? (value / subtotal) * 100 : 0;
    }

    setCustomTip(tipAmount.toString());
    setSelectedTip({ amount: tipAmount, percent: tipPercent });
    setShowCustomTip(true);
    setShowCustomTipDialog(false);
    setPaymentAmount(subtotal + tipAmount - depositCredit);
  };

  const handleCustomTipChange = (value: string) => {
    setCustomTip(value);
    const tipAmount = parseFloat(value) || 0;
    setPaymentAmount(subtotal + tipAmount - depositCredit);
  };

  const handleDiscountConfirm = () => {
    const value = parseFloat(discountValue) || 0;
    let discount = 0;
    let discountPct = 0;

    if (discountType === "percentage") {
      discountPct = value;
      discount = subtotal * (value / 100);
    } else {
      discount = value;
      discountPct = subtotal > 0 ? (value / subtotal) * 100 : 0;
    }

    // Discount cannot exceed subtotal
    if (discount > subtotal + 0.01) {
      toast.error(t("paymentMethod.discountCannotExceedSubtotal", { value: discount.toFixed(2), value2: subtotal.toFixed(2) }));
      return;
    }

    setDiscountAmount(discount);
    setDiscountPercent(discountPct);
    setShowDiscountDialog(false);
    setDiscountValue("");
    
    // Update payment amount if card is selected (should equal total)
    if (selectedPaymentMethod === "card-terminal") {
      const newTotal = subtotal - discount + (selectedTip?.amount || parseFloat(customTip) || 0) - depositCredit;
      setPaymentAmount(newTotal);
    }
  };

  const handleSplitConfirm = () => {
    const cashAmount = parseFloat(splitCashAmount) || 0;
    const cardAmount = parseFloat(splitCardAmount) || 0;
    const currentTotal = subtotal - discountAmount + (selectedTip?.amount || parseFloat(customTip) || 0) - depositCredit;
    
    // Set payment amount to total (cash + card)
    setPaymentAmount(cashAmount + cardAmount);
    setShowSplitDialog(false);
  };

  const [busy, setBusy] = useState(false);
  const handleConfirm = () => {
    if (busy) return;
    // Split payment must sum to total
    if (selectedPaymentMethod === "split") {
      const splitSum = (parseFloat(splitCashAmount) || 0) + (parseFloat(splitCardAmount) || 0);
      if (Math.abs(splitSum - total) > 0.01) {
        toast.error(t("paymentMethod.splitAmountsMustEqualTotal", { value: splitSum.toFixed(2), value2: total.toFixed(2) }));
        return;
      }
    }

    // The server refuses a gift-card sale without a code; asking here saves the trip.
    if (selectedPaymentMethod === "gift-card" && !giftCardCode.trim()) {
      toast.error(t("paymentMethod.enterTheGiftCardCode"));
      return;
    }

    if (onConfirm) {
      const paymentData: {
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
      } = {
        tip: selectedTip?.amount || parseFloat(customTip) || 0,
        tipPercent: selectedTip?.percent || 0,
        // #31: carry the applied discount out with the rest of the payment.
        discountAmount,
        discountPercent,
        paymentMethod: selectedPaymentMethod,
        amount: paymentAmount,
        change: paymentAmount - (subtotal - discountAmount + (selectedTip?.amount || parseFloat(customTip) || 0) - depositCredit),
      };

      if (selectedPaymentMethod === "gift-card") {
        paymentData.giftCardCode = giftCardCode.trim().toUpperCase();
      }

      // Wallet: as much as the client holds, the rest by cash or card. Sent as tenders,
      // the same way the combined-tenders panel sends a WALLET part.
      if (selectedPaymentMethod === "wallet") {
        const due = Math.max(0, Number(total.toFixed(2)));
        const fromWallet = Number(Math.min(walletCredit, due).toFixed(2));
        const rest = Number((due - fromWallet).toFixed(2));
        paymentData.paymentMethod = walletRest === "card" ? "card-terminal" : "cash";
        paymentData.amount = due;
        paymentData.change = 0;
        paymentData.payments = [
          { method: "WALLET", amount: fromWallet },
          ...(rest > 0 ? [{ method: walletRest === "card" ? "CARD_TERMINAL" : "CASH", amount: rest } as SalePayment] : []),
        ];
      }

      // When the cashier used the benefits panel, that is the payment: it already knows
      // what each line was covered by and how the rest was tendered.
      if (multi.payments.length > 0 || Object.values(multi.coverage).some(Boolean) || multi.leaveBalance) {
        paymentData.payments = multi.payments;
        paymentData.coverage = multi.coverage;
      }
      if (multi.leaveBalance) paymentData.leaveBalance = true;

      // Add split amounts if payment method is split
      if (selectedPaymentMethod === "split") {
        paymentData.splitCashAmount = parseFloat(splitCashAmount) || 0;
        paymentData.splitCardAmount = parseFloat(splitCardAmount) || 0;
      }

      // Paid online at booking: always on the bill as PREPAID, with whatever the cashier
      // took for the rest — otherwise the server refuses the sale as a double charge.
      if (prepaidCredit > 0) {
        const rest: SalePayment[] = paymentData.payments
          ? paymentData.payments
          : selectedPaymentMethod === "split"
            ? [
                { method: "CASH", amount: paymentData.splitCashAmount ?? 0 },
                { method: "CARD_TERMINAL", amount: paymentData.splitCardAmount ?? 0 },
              ]
            : selectedPaymentMethod === "gift-card"
              ? [{ method: "GIFT_CARD", amount: total, giftCardCode: paymentData.giftCardCode }]
              : [{ method: selectedPaymentMethod === "card-terminal" ? "CARD_TERMINAL" : "CASH", amount: total }];
        paymentData.payments = [
          { method: "PREPAID", amount: Number(prepaidCredit.toFixed(2)) },
          ...rest.filter((p) => p.amount > 0),
        ];
      }

      if (selectedPaymentMethod === "cash" || selectedPaymentMethod === "card-terminal") {
        try {
          localStorage.setItem(LAST_METHOD_KEY, selectedPaymentMethod);
        } catch {
          /* per-browser convenience only */
        }
      }
      // The parent saves the sale (async): one press, one sale, even with Enter held down.
      setBusy(true);
      void Promise.resolve(onConfirm(paymentData) as unknown).finally(() => setBusy(false));
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  };

  // ── Presentation v2: one calm panel. The logic above is unchanged. ──

  // Keyboard: Enter takes payment (outside buttons and the sheet).
  const confirmRef = useRef(handleConfirm);
  confirmRef.current = handleConfirm;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (tag === "BUTTON" || tag === "TEXTAREA" || tag === "A" || tag === "SELECT") return;
      e.preventDefault();
      confirmRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tipNow = selectedTip?.amount || parseFloat(customTip) || 0;
  const due = Math.max(0, Number(total.toFixed(2)));
  const money = (n: number) => `${n.toFixed(2)} ${currencySymbol()}`;

  // Cash received: prefilled with what is due and kept there until the cashier types.
  const [cashText, setCashText] = useState<string | null>(null);
  useEffect(() => {
    if (cashText === null) setPaymentAmount(due);
  }, [due, cashText]);
  // The wallet's remainder goes on whichever of cash or card the salon takes.
  useEffect(() => {
    setWalletRest(accepted.includes("CASH") ? "cash" : "card");
  }, [accepted]);

  const [tipOpen, setTipOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);
  // Sheet drafts: nothing changes on the bill until "Apply".
  const [discountDraft, setDiscountDraft] = useState("");
  const [splitDraft, setSplitDraft] = useState("");
  const [debtDraft, setDebtDraft] = useState("");

  const others = paymentMethods.filter((m) => ["gift-card", "wallet", "package", "membership"].includes(m.id));
  const canSplit = paymentMethods.some((m) => m.id === "split");
  const isOther = others.some((m) => m.id === selectedPaymentMethod);
  const segment: "cash" | "card" | "other" | "split" =
    selectedPaymentMethod === "card-terminal" ? "card" : selectedPaymentMethod === "split" ? "split" : isOther ? "other" : "cash";
  const debt = multi.leaveBalance ? Math.max(0, due - multi.payments.reduce((s, p) => s + p.amount, 0)) : 0;
  const choose = (id: string) => {
    setSelectedPaymentMethod(id);
    setCashText(null);
    setPaymentAmount(due);
  };
  const clearDebt = () => setMulti({ coverage: {}, payments: [], due: 0, remaining: 0, leaveBalance: false });

  const label = "text-[13px] text-[rgb(var(--reg-muted))]";
  const value = "text-[15px] text-[rgb(var(--reg-ink))]";
  const field =
    "h-12 w-full rounded-xl bg-[rgb(var(--reg-canvas))] px-4 text-[15px] tabular-nums text-[rgb(var(--reg-ink))] outline-none transition focus:bg-white focus:ring-2 focus:ring-[rgb(var(--reg-brand)/0.35)]";
  const textBtn =
    "text-[13px] font-semibold text-[rgb(var(--reg-brand-strong))] hover:underline focus-visible:outline-none focus-visible:underline";
  const segBtn = (on: boolean) =>
    cn(
      "h-10 flex-1 rounded-[10px] text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]",
      on ? "bg-white text-[rgb(var(--reg-ink))] shadow-[0_1px_3px_rgb(var(--reg-ink)/0.12)]" : "text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]",
    );
  const received = cashText === null ? due : parseFloat(cashText.replace(",", ".")) || 0;

  return (
    <div
      className="flex min-h-[100dvh] justify-center bg-[rgb(var(--reg-canvas))] px-4 py-6 text-[rgb(var(--reg-ink))] md:items-center md:py-10"
      style={{ fontFamily: '"Plus Jakarta Sans", Inter, system-ui, sans-serif' }}
    >
      <main className="w-full max-w-[480px] self-start rounded-[28px] bg-white px-6 py-7 shadow-[0_24px_60px_-30px_rgb(var(--reg-ink)/0.25)] md:self-center md:px-8">
        {/* Who and what, read-only. "Edit" goes back to the ticket. */}
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="truncate text-[15px] font-semibold">{selectedClient ? selectedClient.name : t("pos.walkIn")}</h1>
          <button type="button" onClick={handleCancel} className={textBtn}>{t("pos.edit")}</button>
        </div>
        <ul className="mt-3 space-y-1.5">
          {orderItems.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-4">
              <span className={cn(label, "min-w-0 truncate")}>
                {item.name}
                {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                {selectedStaff && (
                  <>
                    {" · "}
                    {staffList.length > 1 ? (
                      // #15: who gets the commission can still be corrected, without a picker on screen.
                      <select
                        aria-label={t("paymentMethod.change")}
                        value={String(selectedStaff.id)}
                        onChange={(e) => {
                          const m = staffList.find((s) => String(s.id) === e.target.value);
                          if (m) {
                            setSelectedStaff(m);
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
                      selectedStaff.name
                    )}
                  </>
                )}
              </span>
              <span className={cn(label, "shrink-0 tabular-nums")}>{money(item.price * item.quantity)}</span>
            </li>
          ))}
          {depositCredit > 0 && (
            <li className="flex items-baseline justify-between gap-4">
              <span className={label}>{t("paymentMethod.alreadyPaid")}</span>
              <span className={cn(label, "tabular-nums")}>−{money(depositCredit)}</span>
            </li>
          )}
          {discountAmount > 0 && (
            <li className="flex items-baseline justify-between gap-4">
              <span className={label}>{t("common.discount")}</span>
              <span className={cn(label, "tabular-nums")}>−{money(discountAmount)}</span>
            </li>
          )}
          {tipNow > 0 && (
            <li className="flex items-baseline justify-between gap-4">
              <span className={label}>{t("paymentMethod.tip")}</span>
              <span className={cn(label, "tabular-nums")}>+{money(tipNow)}</span>
            </li>
          )}
        </ul>

        {/* The one number. */}
        <div className="mt-8">
          <p className={label}>{t("pos.due")}</p>
          <p className="mt-1 text-[44px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{money(due)}</p>
        </div>

        {/* Method: cash | card (| other). */}
        <div className="mt-8 flex gap-1 rounded-xl bg-[rgb(var(--reg-canvas))] p-1" role="radiogroup" aria-label={t("paymentMethod.paymentMethod")}>
          {paymentMethods.some((m) => m.id === "cash") && (
            <button type="button" role="radio" aria-checked={segment === "cash"} className={segBtn(segment === "cash")} onClick={() => { choose("cash"); setOtherOpen(false); }}>
              {t("common.cash")}
            </button>
          )}
          {paymentMethods.some((m) => m.id === "card-terminal") && (
            <button type="button" role="radio" aria-checked={segment === "card"} className={segBtn(segment === "card")} onClick={() => { choose("card-terminal"); setOtherOpen(false); }}>
              {t("common.card")}
            </button>
          )}
          {others.length > 0 && (
            <button type="button" role="radio" aria-checked={segment === "other"} aria-expanded={otherOpen} className={segBtn(segment === "other")} onClick={() => setOtherOpen((v) => !v)}>
              {isOther ? others.find((m) => m.id === selectedPaymentMethod)?.name : t("pos.other")}
            </button>
          )}
        </div>
        {otherOpen && (
          <ul className="mt-2">
            {others.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => { choose(m.id); setOtherOpen(false); }}
                  className={cn("flex h-11 w-full items-center justify-between rounded-lg px-3 text-left", value, "hover:bg-[rgb(var(--reg-canvas))]")}
                >
                  {m.name}
                  {m.id === "wallet" && <span className={label}>{money(walletCredit)}</span>}
                  {selectedPaymentMethod === m.id && <Check className="h-4 w-4 text-[rgb(var(--reg-brand))]" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Only what the method needs. Card needs nothing. */}
        <div className="mt-5 min-h-[20px]">
          {segment === "cash" && !multi.leaveBalance && (
            <>
              <label htmlFor="cash-received" className={label}>{t("pos.received")}</label>
              <input
                id="cash-received"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={cashText ?? due.toFixed(2)}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.,]/g, "");
                  setCashText(v);
                  setPaymentAmount(parseFloat(v.replace(",", ".")) || 0);
                }}
                className={cn(field, "mt-1.5")}
              />
              <p className={cn(label, "mt-2")} aria-live="polite">
                {received - due < -0.005 ? t("pos.short", { value: money(due - received) }) : t("pos.change", { value: money(received - due) })}
              </p>
            </>
          )}
          {segment === "split" && (
            <p className={value}>
              {t("pos.splitSummary", { value: money(parseFloat(splitCashAmount) || 0), value2: money(parseFloat(splitCardAmount) || 0) })}{" "}
              <button type="button" className={textBtn} onClick={() => choose(accepted.includes("CASH") ? "cash" : "card-terminal")}>{t("pos.undo")}</button>
            </p>
          )}
          {selectedPaymentMethod === "gift-card" && (
            <>
              <label htmlFor="gift-code" className={label}>{t("paymentMethod.giftCardCode")}</label>
              <input id="gift-code" value={giftCardCode} onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())} autoComplete="off" className={cn(field, "mt-1.5 tracking-wider")} />
            </>
          )}
          {selectedPaymentMethod === "wallet" && (
            <p className={label}>
              {due - walletCredit > 0.009
                ? t("pos.walletRest", { value: money(Math.min(walletCredit, due)), value2: money(due - walletCredit), method: walletRest === "card" ? t("common.card") : t("common.cash") })
                : t("pos.walletAll", { value: money(due) })}
            </p>
          )}
          {(selectedPaymentMethod === "package" || selectedPaymentMethod === "membership") && (
            <p className={label}>{t("paymentMethod.oneSessionComesOffThis")}</p>
          )}
          {multi.leaveBalance && (
            <p className={value}>
              {t("pos.debtSummary", { value: money(debt) })}{" "}
              <button type="button" className={textBtn} onClick={clearDebt}>{t("pos.undo")}</button>
            </p>
          )}
        </div>

        {/* Tip: one line, folded. */}
        <div className="mt-6">
          {!tipOpen && tipNow === 0 ? (
            <button type="button" className={textBtn} onClick={() => setTipOpen(true)}>{t("pos.addTip")}</button>
          ) : (
            <>
              <label htmlFor="tip" className={label}>{t("paymentMethod.tip")}</label>
              <input
                id="tip"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                autoFocus={tipOpen && tipNow === 0}
                value={customTip}
                placeholder="0"
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.]/g, "");
                  setSelectedTip(null);
                  setShowCustomTip(v !== "");
                  setCustomTip(v);
                  setCashText(null);
                }}
                className={cn(field, "mt-1.5")}
              />
            </>
          )}
        </div>
        <div className="mt-3">
          <button type="button" className={textBtn} onClick={() => setExtrasOpen(true)}>{t("pos.extras")}</button>
        </div>

        <Button
          onClick={handleConfirm}
          disabled={busy}
          className="mt-8 h-14 w-full rounded-2xl bg-[rgb(var(--reg-brand))] text-[16px] font-bold text-white hover:bg-[rgb(var(--reg-brand-strong))] disabled:opacity-60"
        >
          {t("pos.pay", { value: money(due) })}
        </Button>
      </main>

      {/* Discount / split / debt: rarely needed, so in a small sheet. */}
      <Sheet open={extrasOpen} onOpenChange={setExtrasOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-[480px] rounded-t-[28px] border-0 bg-white px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-6 text-[rgb(var(--reg-ink))] [&>button]:hidden"
          style={{ fontFamily: '"Plus Jakarta Sans", Inter, system-ui, sans-serif' }}
        >
          <SheetTitle className="text-[15px] font-semibold">{t("pos.extras")}</SheetTitle>
          <div className="mt-5 space-y-6">
            <div>
              <label htmlFor="disc" className={label}>{t("pos.discountAmount")}</label>
              <div className="mt-1.5 flex gap-2">
                <input id="disc" type="text" inputMode="decimal" autoComplete="off" value={discountDraft} placeholder={discountAmount > 0 ? discountAmount.toFixed(2) : "0"} onChange={(e) => setDiscountDraft(e.target.value.replace(/[^0-9.%]/g, ""))} className={field} />
                <Button
                  variant="ghost"
                  className="h-12 rounded-xl px-4 text-[15px] font-semibold"
                  onClick={() => {
                    const pct = discountDraft.trim().endsWith("%");
                    const n = parseFloat(discountDraft) || 0;
                    const amt = pct ? (subtotal * n) / 100 : n;
                    if (amt > subtotal + 0.01) {
                      toast.error(t("paymentMethod.discountCannotExceedSubtotal", { value: amt.toFixed(2), value2: subtotal.toFixed(2) }));
                      return;
                    }
                    setDiscountAmount(amt);
                    setDiscountPercent(subtotal > 0 ? (amt / subtotal) * 100 : 0);
                    setCashText(null);
                    setDiscountDraft("");
                    setExtrasOpen(false);
                  }}
                >
                  {t("pos.apply")}
                </Button>
              </div>
            </div>
            {canSplit && (
              <div>
                <label htmlFor="split" className={label}>{t("pos.splitCash")}</label>
                <div className="mt-1.5 flex gap-2">
                  <input id="split" type="text" inputMode="decimal" autoComplete="off" value={splitDraft} placeholder="0" onChange={(e) => setSplitDraft(e.target.value.replace(/[^0-9.]/g, ""))} className={field} />
                  <Button
                    variant="ghost"
                    className="h-12 rounded-xl px-4 text-[15px] font-semibold"
                    onClick={() => {
                      const c = Math.min(due, parseFloat(splitDraft) || 0);
                      clearDebt();
                      setSelectedPaymentMethod("split");
                      setSplitCashAmount(c.toFixed(2));
                      setSplitCardAmount((due - c).toFixed(2));
                      setPaymentAmount(due);
                      setSplitDraft("");
                      setExtrasOpen(false);
                    }}
                  >
                    {t("pos.apply")}
                  </Button>
                </div>
                <p className={cn(label, "mt-2")}>{t("pos.splitHint", { value: money(Math.max(0, due - (parseFloat(splitDraft) || 0))) })}</p>
              </div>
            )}
            {selectedClient && (
              <div>
                <label htmlFor="debt" className={label}>{t("pos.paidNow")}</label>
                <div className="mt-1.5 flex gap-2">
                  <input id="debt" type="text" inputMode="decimal" autoComplete="off" value={debtDraft} placeholder="0" onChange={(e) => setDebtDraft(e.target.value.replace(/[^0-9.]/g, ""))} className={field} />
                  <Button
                    variant="ghost"
                    className="h-12 rounded-xl px-4 text-[15px] font-semibold"
                    onClick={() => {
                      // FG-W6-07: what is paid now goes as a tender, the rest stays on the client's balance.
                      const now = Math.min(due, parseFloat(debtDraft) || 0);
                      const method = selectedPaymentMethod === "card-terminal" ? "CARD_TERMINAL" : "CASH";
                      if (segment !== "card") setSelectedPaymentMethod("cash");
                      setMulti({
                        coverage: {},
                        payments: now > 0 ? [{ method, amount: Number(now.toFixed(2)) }] : [],
                        due,
                        remaining: Number((due - now).toFixed(2)),
                        leaveBalance: due - now > 0.009,
                      });
                      setDebtDraft("");
                      setExtrasOpen(false);
                    }}
                  >
                    {t("pos.apply")}
                  </Button>
                </div>
                <p className={cn(label, "mt-2")}>{t("pos.debtHint", { value: money(Math.max(0, due - (parseFloat(debtDraft) || 0))) })}</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
