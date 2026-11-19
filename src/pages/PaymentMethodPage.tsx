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

import { BenefitsAndTenders, type Coverage } from "@/components/checkout/BenefitsAndTenders";
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

  // Keyboard: Enter takes payment; typing digits goes straight into the amount field.
  const amountRef = useRef<HTMLInputElement | null>(null);
  const confirmRef = useRef(handleConfirm);
  confirmRef.current = handleConfirm;
  const [cashText, setCashText] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName ?? "";
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable;
      if (e.key === "Enter") {
        if (tag === "BUTTON" || tag === "TEXTAREA" || tag === "A") return;
        e.preventDefault();
        confirmRef.current();
        return;
      }
      if (!typing && /^[0-9]$/.test(e.key) && amountRef.current) {
        e.preventDefault();
        amountRef.current.focus();
        const input = amountRef.current;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, e.key);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [moreOpen, setMoreOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const tipNow = selectedTip?.amount || parseFloat(customTip) || 0;
  const money = (n: number) => `${n.toFixed(2)} ${currencySymbol()}`;
  const due = Math.max(0, total);
  const multiActive = multi.payments.length > 0 || Object.values(multi.coverage).some(Boolean) || multi.leaveBalance;
  const fromWallet = Math.min(walletCredit, due);
  const splitCash = parseFloat(splitCashAmount) || 0;

  const pickMethod = (id: string) => {
    setSelectedPaymentMethod(id);
    setCashText(null);
    if (id === "cash") {
      // Start from the exact total; the field takes what was handed over.
      if (paymentAmount < total) setPaymentAmount(Number(due.toFixed(2)));
    } else if (id === "split") {
      setSplitCashAmount("");
      setSplitCardAmount(due.toFixed(2));
    } else {
      // Card, gift card, wallet, package, membership: exactly what is due, no change.
      setPaymentAmount(Number(due.toFixed(2)));
    }
  };

  const chip = (on: boolean) =>
    cn(
      "h-9 rounded-full px-3.5 text-[13px] font-semibold tabular-nums ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.6)]",
      on ? "bg-[rgb(var(--reg-ink))] text-white ring-[rgb(var(--reg-ink))]" : "bg-white text-[rgb(var(--reg-ink))] ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-ink)/0.3)]",
    );
  const amountField = "h-12 w-full rounded-[14px] border border-[rgb(var(--reg-line))] bg-white px-3.5 text-lg font-bold tabular-nums outline-none focus:border-[rgb(var(--reg-brand))] focus:ring-2 focus:ring-[rgb(var(--reg-brand)/0.2)]";
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-[rgb(var(--reg-canvas))] pb-[calc(92px+env(safe-area-inset-bottom))] text-[rgb(var(--reg-ink))] md:h-[100dvh] md:flex-row md:overflow-hidden md:pb-0"
      style={{ fontFamily: '"Plus Jakarta Sans", Inter, system-ui, sans-serif' }}
    >
      {/* ── Left: the ticket. Everything here comes from the booking; nothing to type. ── */}
      <section aria-label={t("paymentMethod.orderSummary")} className="flex min-w-0 flex-col md:min-h-0 md:flex-1">
        <header className="flex shrink-0 items-center gap-2 border-b border-[rgb(var(--reg-line)/0.8)] bg-[rgb(var(--reg-canvas))] px-3 py-3 md:px-6">
          <Button variant="ghost" size="icon" aria-label={t("paymentMethod.backToTicket")} title={t("paymentMethod.backToTicket")} onClick={handleCancel} className="h-10 w-10 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold leading-tight tracking-[-0.02em]">{t("paymentMethod.takePayment")}</h1>
            <p className="truncate text-[13px] text-[rgb(var(--reg-muted))]">
              {selectedClient ? t("paymentMethod.itemsForClient", { count: orderItems.length, name: selectedClient.name }) : t("paymentMethod.itemsWalkIn", { count: orderItems.length })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("paymentMethod.discardThisSale")}
            title={t("paymentMethod.discardThisSale")}
            className="h-10 w-10 rounded-full text-red-600 hover:bg-red-50"
            onClick={() => {
              if (!confirm(t("paymentMethod.discardThisSaleTheTicket"))) return;
              if (onDiscard) onDiscard();
              else handleCancel();
            }}
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </Button>
        </header>

        <div className="space-y-4 px-3 py-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:px-6">
          {/* Who: the client and the staff member, read from the booking. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 items-center gap-2 rounded-full bg-white pl-1 pr-3 text-[13px] font-semibold ring-1 ring-[rgb(var(--reg-line))]">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgb(var(--reg-ink)/0.06)]"><User className="h-3.5 w-3.5" aria-hidden /></span>
              {selectedClient ? selectedClient.name : t("pos.walkIn")}
            </span>
            {selectedStaff && (
              <button
                type="button"
                disabled={staffList.length < 2}
                aria-expanded={showStaffPicker}
                onClick={() => setShowStaffPicker((v) => !v)}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-white pl-1 pr-3 text-[13px] font-semibold ring-1 ring-[rgb(var(--reg-line))] transition enabled:hover:ring-[rgb(var(--reg-brand)/0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.6)]"
              >
                <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[rgb(var(--reg-brand-soft))] text-[10px] font-bold text-[rgb(var(--reg-brand-strong))]">
                  {selectedStaff.avatarUrl ? <img src={assetUrl(selectedStaff.avatarUrl)} alt="" className="h-full w-full object-cover" /> : initials(selectedStaff.name || "")}
                </span>
                {selectedStaff.name}
                {staffList.length > 1 && <ChevronDown className={cn("h-3.5 w-3.5 text-[rgb(var(--reg-muted))] transition-transform", showStaffPicker && "rotate-180")} aria-hidden />}
              </button>
            )}
          </div>
          {/* #15: the sale's staff (who gets the commission) can be corrected here. */}
          {showStaffPicker && staffList.length > 1 && selectedStaff && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("paymentMethod.change")}>
              {staffList.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    setSelectedStaff(member);
                    onStaffChange?.(member);
                    setShowStaffPicker(false);
                  }}
                  className={chip(member.id === selectedStaff.id)}
                >
                  {member.name}
                </button>
              ))}
            </div>
          )}

          {/* The lines, from the ticket. Changing them is "Back to ticket". */}
          <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
            {orderItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 border-b border-[rgb(var(--reg-line)/0.6)] px-4 py-3 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold">{item.name}</p>
                  <p className="text-xs text-[rgb(var(--reg-muted))]">
                    {[item.duration, item.quantity > 1 ? t("paymentMethod.x", { quantity: item.quantity }) : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 text-[14px] font-semibold tabular-nums">{money(item.price * item.quantity)}</span>
              </li>
            ))}
            {depositCredit > 0 && (
              // #117: named, so a lower total does not read as a pricing error.
              <li className="flex items-center justify-between gap-3 bg-[rgb(var(--reg-success-soft))] px-4 py-2.5 text-[13px] text-[rgb(var(--reg-success))]">
                <span className="font-semibold">
                  {pointsCovered > 0 && depositOnly + prepaidCredit === 0
                    ? t("paymentMethod.paidWithPointsAtBooking")
                    : pointsCovered > 0
                      ? t("paymentMethod.alreadyPaidDepositGiftCard")
                      : prepaidCredit > 0
                        ? t("paymentMethod.alreadyPaidDepositGiftCard2")
                        : t("paymentMethod.depositAlreadyPaid")}
                </span>
                <span className="font-bold tabular-nums">-{money(depositCredit)}</span>
              </li>
            )}
          </ul>

          {/* Rarely needed: discount, benefits and several tenders, leaving the rest on the
              client's balance, the receipt. Folded so the usual sale is one screen. */}
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--reg-brand)/0.6)]"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{t("pos.more")}</span>
                <span className="block truncate text-xs text-[rgb(var(--reg-muted))]">{t("pos.moreHint")}</span>
              </span>
              {(discountAmount > 0 || multiActive) && <span className="h-2 w-2 shrink-0 rounded-full bg-[rgb(var(--reg-brand))]" aria-hidden />}
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-[rgb(var(--reg-muted))] transition-transform motion-reduce:transition-none", moreOpen && "rotate-180")} aria-hidden />
            </button>
            {moreOpen && (
              <div className="space-y-4 border-t border-[rgb(var(--reg-line)/0.6)] px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={chip(discountAmount > 0)}
                    onClick={() => {
                      setDiscountValue("");
                      setDiscountType("percentage");
                      setShowDiscountDialog(true);
                    }}
                  >
                    <Percent className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                    {discountAmount > 0 ? `${t("common.discount")} −${money(discountAmount)}` : t("pos.addDiscount")}
                  </button>
                  {discountAmount > 0 && (
                    <button
                      type="button"
                      className="h-9 rounded-full px-3 text-[13px] font-semibold text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]"
                      onClick={() => {
                        setDiscountAmount(0);
                        setDiscountPercent(0);
                      }}
                    >
                      {t("common.remove")}
                    </button>
                  )}
                  <button type="button" className={chip(receiptOpen)} aria-expanded={receiptOpen} onClick={() => setReceiptOpen((v) => !v)}>
                    <Receipt className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                    {t("paymentMethod.receiptPreview")}
                  </button>
                </div>
                <BenefitsAndTenders
                  businessId={checkoutBusinessId}
                  clientId={selectedClient?.id ? selectedClient.id : null}
                  orderItems={orderItems.map((item) => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    serviceId: (item as { serviceId?: Id }).serviceId,
                  }))}
                  total={subtotal - discountAmount + tipNow - depositCredit}
                  onChange={setMulti}
                />
                {receiptOpen && (
                  <div className="mx-auto max-w-[320px] overflow-hidden rounded-xl bg-white font-mono text-[12px] leading-relaxed shadow-[0_8px_20px_-14px_rgb(var(--reg-ink)/0.4)] ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                    <div className="h-1.5" style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(receiptLook.brandColor) ? receiptLook.brandColor : "rgb(var(--reg-brand))" }} aria-hidden />
                    <div className="px-5 py-4">
                      <p className="text-center text-[13px] font-bold">{receiptLook.name || t("common.yourSalon")}</p>
                      <p className="text-center text-[rgb(var(--reg-muted))]">{formatLocaleDate(new Date(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                      <div className="my-2 border-t border-dashed border-[rgb(var(--reg-line))]" />
                      {orderItems.map((it) => (
                        <p key={it.id} className="flex justify-between gap-3"><span className="truncate">{it.name}</span><span className="tabular-nums">{(it.price * it.quantity).toFixed(2)}</span></p>
                      ))}
                      {discountAmount > 0 && <p className="flex justify-between"><span>{t("common.discount")}</span><span className="tabular-nums">-{discountAmount.toFixed(2)}</span></p>}
                      {tipNow > 0 && <p className="flex justify-between"><span>{t("paymentMethod.tip")}</span><span className="tabular-nums">{tipNow.toFixed(2)}</span></p>}
                      {depositCredit > 0 && <p className="flex justify-between"><span>{t("paymentMethod.alreadyPaid")}</span><span className="tabular-nums">-{depositCredit.toFixed(2)}</span></p>}
                      <div className="my-2 border-t border-dashed border-[rgb(var(--reg-line))]" />
                      <p className="flex justify-between font-bold"><span>{t("common.total")}</span><span className="tabular-nums">{money(total)}</span></p>
                      {receiptLook.footer.trim() && <p className="mt-3 whitespace-pre-wrap break-words text-center text-[rgb(var(--reg-muted))]">{receiptLook.footer}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Right: what is due and how it is paid. One screen, one button. ── */}
      <aside aria-label={t("paymentMethod.paymentMethod")} className="flex shrink-0 flex-col border-t border-[rgb(var(--reg-line)/0.8)] bg-white md:w-[400px] md:border-l md:border-t-0 lg:w-[440px]">
        <div className="space-y-5 px-4 py-5 md:min-h-0 md:flex-1 md:overflow-y-auto md:px-6">
          {/* The number the cashier asks for, and only the lines that changed it. */}
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted))]">{depositCredit > 0 ? t("paymentMethod.leftToPay") : t("pos.due")}</p>
            <p className="mt-0.5 text-[40px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{money(due)}</p>
            {(discountAmount > 0 || tipNow > 0 || depositCredit > 0) && (
              <dl className="mt-2 space-y-0.5 text-[13px] text-[rgb(var(--reg-muted))]">
                <div className="flex justify-between"><dt>{t("paymentMethod.subtotal")}</dt><dd className="tabular-nums">{money(subtotal)}</dd></div>
                {discountAmount > 0 && <div className="flex justify-between"><dt>{t("common.discount")}</dt><dd className="tabular-nums">−{money(discountAmount)}</dd></div>}
                {tipNow > 0 && <div className="flex justify-between"><dt>{t("paymentMethod.tip")}</dt><dd className="tabular-nums">+{money(tipNow)}</dd></div>}
                {depositCredit > 0 && <div className="flex justify-between"><dt>{t("paymentMethod.alreadyPaid")}</dt><dd className="tabular-nums">−{money(depositCredit)}</dd></div>}
              </dl>
            )}
          </div>

          {/* Tip: one tap. */}
          <div>
            <p className="mb-2 text-[13px] font-semibold">{t("paymentMethod.tip")}</p>
            <div className="flex flex-wrap gap-1.5">
              {tipOptions.map((tip) => (
                <button
                  key={tip.percent}
                  type="button"
                  aria-pressed={(selectedTip?.percent ?? 0) === tip.percent && !showCustomTip}
                  onClick={() => {
                    handleTipSelect(tip);
                    setCashText(null);
                  }}
                  className={chip((selectedTip?.percent ?? 0) === tip.percent && !showCustomTip)}
                >
                  {tip.label}
                </button>
              ))}
              <button type="button" aria-pressed={showCustomTip} onClick={handleCustomTip} className={chip(showCustomTip)}>
                {showCustomTip ? money(tipNow) : t("paymentMethod.custom")}
              </button>
            </div>
          </div>

          {/* Method: what the salon accepts; the last one used is already picked. */}
          <div>
            <p className="mb-2 text-[13px] font-semibold">{t("paymentMethod.paymentMethod")}</p>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={t("paymentMethod.paymentMethod")}>
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                const on = selectedPaymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pickMethod(method.id)}
                    className={cn(
                      "flex h-[60px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[12.5px] font-semibold ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.6)]",
                      on
                        ? "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))] ring-2 ring-[rgb(var(--reg-brand))]"
                        : "bg-white text-[rgb(var(--reg-ink))] ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-brand)/0.4)]",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                    <span className="max-w-full truncate">{method.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Only what the chosen method needs. */}
          {multiActive ? (
            <p className="rounded-xl bg-[rgb(var(--reg-brand-soft))] px-3.5 py-3 text-[13px] font-semibold text-[rgb(var(--reg-brand-strong))]">{t("pos.combinedActive")}</p>
          ) : selectedPaymentMethod === "cash" ? (
            <div className="space-y-2.5">
              <label htmlFor="cash-received" className="text-[13px] font-semibold">{t("paymentMethod.cashReceived")}</label>
              <input
                id="cash-received"
                ref={amountRef}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={cashText ?? (Number.isFinite(paymentAmount) ? String(Number(paymentAmount.toFixed(2))) : "")}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.,]/g, "");
                  setCashText(v);
                  setPaymentAmount(parseFloat(v.replace(",", ".")) || 0);
                }}
                className={amountField}
              />
              <div className="flex flex-wrap gap-1.5">
                {[...new Set([due, ...[5, 10, 20, 50, 100].map((n) => Math.ceil(due / n) * n)])]
                  .filter((v) => v > 0)
                  .slice(0, 5)
                  .map((v, k) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setCashText(null);
                        setPaymentAmount(Number(v.toFixed(2)));
                      }}
                      className={chip(Math.abs(paymentAmount - v) < 0.005)}
                    >
                      {k === 0 ? t("paymentMethod.exact") : `${v.toFixed(0)} ${currencySymbol()}`}
                    </button>
                  ))}
              </div>
              <div className={cn("flex items-center justify-between rounded-xl px-3.5 py-2.5", paymentAmount - total < -0.005 ? "bg-rose-50 text-rose-800" : "bg-[rgb(var(--reg-success-soft))] text-[rgb(var(--reg-success))]")} aria-live="polite">
                <span className="text-[13px] font-semibold">{paymentAmount - total < -0.005 ? t("paymentMethod.stillToPay") : t("paymentMethod.changeToGive")}</span>
                <span className="text-xl font-extrabold tabular-nums">{money(Math.abs(paymentAmount - total))}</span>
              </div>
            </div>
          ) : selectedPaymentMethod === "split" ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="split-cash" className="text-[13px] font-semibold">{t("common.cash")}</label>
                <input
                  id="split-cash"
                  ref={amountRef}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={splitCashAmount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.,]/g, "");
                    setSplitCashAmount(v);
                    // The card takes the rest, so the two always add up to the bill.
                    setSplitCardAmount(Math.max(0, due - (parseFloat(v.replace(",", ".")) || 0)).toFixed(2));
                  }}
                  placeholder="0"
                  className={cn(amountField, "mt-1.5")}
                />
              </div>
              <div>
                <p className="text-[13px] font-semibold">{t("pos.cardRest")}</p>
                <p className="mt-1.5 flex h-12 items-center rounded-[14px] bg-[rgb(var(--reg-canvas))] px-3.5 text-lg font-bold tabular-nums">{money(Math.max(0, due - splitCash))}</p>
              </div>
            </div>
          ) : selectedPaymentMethod === "gift-card" ? (
            <div className="space-y-1.5">
              <label htmlFor="gift-code" className="text-[13px] font-semibold">{t("paymentMethod.giftCardCode")}</label>
              <Input id="gift-code" value={giftCardCode} onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())} placeholder={t("paymentMethod.cardCode")} autoComplete="off" className="h-12 rounded-[14px] text-base font-semibold tracking-wider" />
              <p className="text-xs text-[rgb(var(--reg-muted))]">{t("paymentMethod.theCardMustHaveBeen")}</p>
            </div>
          ) : selectedPaymentMethod === "wallet" ? (
            <div className="space-y-2.5 rounded-xl bg-[rgb(var(--reg-canvas))] px-3.5 py-3 text-[13px]">
              <p className="font-semibold">{t("pos.walletCovers", { value: money(walletCredit), value2: money(fromWallet) })}</p>
              {due - fromWallet > 0.009 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[rgb(var(--reg-muted))]">{t("pos.restBy", { value: money(due - fromWallet) })}</span>
                  {accepted.includes("CASH") && <button type="button" className={chip(walletRest === "cash")} onClick={() => setWalletRest("cash")}>{t("common.cash")}</button>}
                  {accepted.includes("CARD") && <button type="button" className={chip(walletRest === "card")} onClick={() => setWalletRest("card")}>{t("common.card")}</button>}
                </div>
              )}
            </div>
          ) : selectedPaymentMethod === "card-terminal" ? (
            <p className="rounded-xl bg-[rgb(var(--reg-canvas))] px-3.5 py-3 text-[13px] text-[rgb(var(--reg-muted))]">{t("pos.cardNote", { value: money(due) })}</p>
          ) : (
            <p className="rounded-xl bg-[rgb(var(--reg-canvas))] px-3.5 py-3 text-[13px] text-[rgb(var(--reg-muted))]">{t("paymentMethod.oneSessionComesOffThis")}</p>
          )}
        </div>

        {/* The one action. Fixed to the bottom on a phone. */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[rgb(var(--reg-line)/0.8)] bg-white/95 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:static md:px-6 md:pb-5">
          <Button
            onClick={handleConfirm}
            disabled={busy}
            className="h-14 w-full rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] text-[17px] font-bold text-white shadow-[0_10px_24px_-8px_rgb(var(--reg-brand-strong)/0.6)] hover:brightness-110 disabled:opacity-60"
          >
            {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden /> : <Check className="mr-1.5 h-5 w-5" aria-hidden />}
            {t("pos.takePayment", { value: money(due) })}
          </Button>
          <p className="mt-2 hidden items-center justify-center gap-1.5 text-xs text-[rgb(var(--reg-muted))] md:flex">
            <CornerDownLeft className="h-3.5 w-3.5" aria-hidden /> {t("pos.keysHint")}
          </p>
        </div>
      </aside>

      {/* Custom Tip Dialog */}
      <Dialog open={showCustomTipDialog} onOpenChange={setShowCustomTipDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("paymentMethod.customTip2")}</DialogTitle>
            <DialogDescription>
              {t("paymentMethod.chooseWhetherToEnterA")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Tip Type Selection */}
            <div className="flex gap-3">
              <button
                onClick={() => setCustomTipType("percentage")}
                className={`flex-1 p-4 border-2 rounded-2xl text-left transition-all ${
                  customTipType === "percentage"
                    ? "bg-[rgb(var(--reg-brand-soft))] ring-2 ring-[rgb(var(--reg-brand))]"
                    : "bg-white ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-brand)/0.4)]"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="h-5 w-5 text-[rgb(var(--reg-ink)/0.85)]" />
                  <span className="text-sm font-medium text-[rgb(var(--reg-ink))]">{t("common.percentage")}</span>
                </div>
                <p className="text-xs text-[rgb(var(--reg-muted))]">{t("paymentMethod.enterTipAsPercentageOf")}</p>
              </button>
              <button
                onClick={() => setCustomTipType("fixed")}
                className={`flex-1 p-4 border-2 rounded-2xl text-left transition-all ${
                  customTipType === "fixed"
                    ? "bg-[rgb(var(--reg-brand-soft))] ring-2 ring-[rgb(var(--reg-brand))]"
                    : "bg-white ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-brand)/0.4)]"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5 text-[rgb(var(--reg-ink)/0.85)]" />
                  <span className="text-sm font-medium text-[rgb(var(--reg-ink))]">{t("paymentMethod.fixedAmount")}</span>
                </div>
                <p className="text-xs text-[rgb(var(--reg-muted))]">{t("paymentMethod.enterTipAsFixedAmount")}</p>
              </button>
            </div>

            {/* Tip Value Input */}
            <div className="space-y-2">
              <Label>
                {customTipType === "percentage" ? t("paymentMethod.tipPercentage") : t("paymentMethod.tipAmount", { value: currencySymbol() })}
              </Label>
              <div className="relative">
                {customTipType === "percentage" ? (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))] font-medium">%</span>
                ) : (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))] font-medium">{currencySymbol()}</span>
                )}
                <Input
                  type="number"
                  placeholder={customTipType === "percentage" ? t("paymentMethod.enterPercentage") : t("paymentMethod.enterAmount")}
                  value={customTipValue}
                  onChange={(e) => setCustomTipValue(e.target.value)}
                  className={customTipType === "percentage" ? "pr-10" : "pl-10"}
                  step={customTipType === "percentage" ? "0.1" : "0.01"}
                />
              </div>
              {customTipValue && (
                <p className="text-xs text-[rgb(var(--reg-muted))]">
                  {customTipType === "percentage" ? (
                    <>{t("paymentMethod.tipAmount2", { value: (subtotal * (parseFloat(customTipValue) || 0) / 100).toFixed(2), value2: currencySymbol() })}</>
                  ) : (
                    <>{t("paymentMethod.tipPercentage2", { value: subtotal > 0 ? ((parseFloat(customTipValue) || 0) / subtotal * 100).toFixed(2) : 0 })}</>
                  )}
                </p>
              )}
            </div>

            {/* Dialog Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCustomTipDialog(false);
                  setCustomTipValue("");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleCustomTipConfirm}
                disabled={!customTipValue || parseFloat(customTipValue) <= 0}
                className="bg-gray-900 hover:bg-gray-800"
              >
                {t("paymentMethod.confirm")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Amount Dialog (for Cash) */}
      <Dialog open={showPaymentAmountDialog} onOpenChange={setShowPaymentAmountDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("paymentMethod.customerPayment")}</DialogTitle>
            <DialogDescription>
              {t("paymentMethod.enterTheAmountTheCustomer")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("common.amount", { value: currencySymbol() })}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))] font-medium">{currencySymbol()}</span>
                <Input
                  type="number"
                  placeholder={t("paymentMethod.enterAmount")}
                  value={tempPaymentAmount}
                  onChange={(e) => setTempPaymentAmount(e.target.value)}
                  className="h-12 pl-12 text-lg font-semibold"
                  step="0.01"
                  autoFocus
                />
              </div>
              {tempPaymentAmount && (
                <div className="mt-3 p-3 bg-[rgb(var(--reg-canvas))] rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[rgb(var(--reg-muted))]">{t("common.total")}</span>
                    <span className="font-medium text-[rgb(var(--reg-ink))]">{total.toFixed(2)} {currencySymbol()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[rgb(var(--reg-muted))]">{t("paymentMethod.customerGives")}</span>
                    <span className="font-medium text-[rgb(var(--reg-ink))]">{parseFloat(tempPaymentAmount) || 0} {currencySymbol()}</span>
                  </div>
                  {parseFloat(tempPaymentAmount) > total && (
                    <div className="flex items-center justify-between text-sm pt-1 border-t border-[rgb(var(--reg-line)/0.8)]">
                      <span className="text-[rgb(var(--reg-muted))]">{t("paymentMethod.return")}</span>
                      <span className="font-medium text-[rgb(var(--reg-success))]">{(parseFloat(tempPaymentAmount) - total).toFixed(2)} {currencySymbol()}</span>
                    </div>
                  )}
                  {parseFloat(tempPaymentAmount) < total && (
                    <div className="flex items-center justify-between text-sm pt-1 border-t border-[rgb(var(--reg-line)/0.8)]">
                      <span className="text-[rgb(var(--reg-muted))]">{t("paymentMethod.dueTo")}</span>
                      <span className="font-medium text-red-600">{(total - parseFloat(tempPaymentAmount)).toFixed(2)} {currencySymbol()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dialog Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPaymentAmountDialog(false);
                  setTempPaymentAmount("");
                }}
              >
                {t("common.cancel")}
              </Button>
              {/* #23: this button read "Confirm", so staff took it as the end of checkout,
                  watched the dialog close with the cart unchanged and no /api/sales call,
                  and only discovered by accident that CONFIRM AND PAY still had to be
                  pressed. It is NOT the final step — the dialog opens when cash is
                  selected, before the tip is chosen — so submitting from here would be
                  the worse bug. Name it for what it does instead. */}
              <Button
                onClick={() => {
                  const amount = parseFloat(tempPaymentAmount) || total;
                  setPaymentAmount(amount);
                  setShowPaymentAmountDialog(false);
                  setTempPaymentAmount("");
                }}
                disabled={!tempPaymentAmount || parseFloat(tempPaymentAmount) < 0}
                className="bg-gray-900 hover:bg-gray-800"
              >
                {t("paymentMethod.setAmount")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
      <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("paymentMethod.addDiscount")}</DialogTitle>
            <DialogDescription>
              {t("paymentMethod.chooseWhetherToEnterA")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Discount Type Selection */}
            <div className="flex gap-3">
              <button
                onClick={() => setDiscountType("percentage")}
                className={`flex-1 p-4 border-2 rounded-2xl text-left transition-all ${
                  discountType === "percentage"
                    ? "bg-[rgb(var(--reg-brand-soft))] ring-2 ring-[rgb(var(--reg-brand))]"
                    : "bg-white ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-brand)/0.4)]"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="h-5 w-5 text-[rgb(var(--reg-ink)/0.85)]" />
                  <span className="text-sm font-medium text-[rgb(var(--reg-ink))]">{t("common.percentage")}</span>
                </div>
                <p className="text-xs text-[rgb(var(--reg-muted))]">{t("paymentMethod.enterDiscountAsPercentageOf")}</p>
              </button>
              <button
                onClick={() => setDiscountType("fixed")}
                className={`flex-1 p-4 border-2 rounded-2xl text-left transition-all ${
                  discountType === "fixed"
                    ? "bg-[rgb(var(--reg-brand-soft))] ring-2 ring-[rgb(var(--reg-brand))]"
                    : "bg-white ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-brand)/0.4)]"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5 text-[rgb(var(--reg-ink)/0.85)]" />
                  <span className="text-sm font-medium text-[rgb(var(--reg-ink))]">{t("paymentMethod.fixedAmount")}</span>
                </div>
                <p className="text-xs text-[rgb(var(--reg-muted))]">{t("paymentMethod.enterDiscountAsFixedAmount")}</p>
              </button>
            </div>

            {/* Discount Value Input */}
            <div className="space-y-2">
              <Label>
                {discountType === "percentage" ? t("paymentMethod.discountPercentage") : t("paymentMethod.discountAmount", { value: currencySymbol() })}
              </Label>
              <div className="relative">
                {discountType === "percentage" ? (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))] font-medium">%</span>
                ) : (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))] font-medium">{currencySymbol()}</span>
                )}
                <Input
                  type="number"
                  placeholder={discountType === "percentage" ? t("paymentMethod.enterPercentage") : t("paymentMethod.enterAmount")}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className={discountType === "percentage" ? "pr-10" : "pl-10"}
                  step={discountType === "percentage" ? "0.1" : "0.01"}
                />
              </div>
              {discountValue && (
                <p className="text-xs text-[rgb(var(--reg-muted))]">
                  {discountType === "percentage" ? (
                    <>{t("paymentMethod.discountAmount2", { value: (subtotal * (parseFloat(discountValue) || 0) / 100).toFixed(2), value2: currencySymbol() })}</>
                  ) : (
                    <>{t("paymentMethod.discountPercentage2", { value: subtotal > 0 ? ((parseFloat(discountValue) || 0) / subtotal * 100).toFixed(2) : 0 })}</>
                  )}
                </p>
              )}
            </div>

            {/* Dialog Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDiscountDialog(false);
                  setDiscountValue("");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleDiscountConfirm}
                disabled={!discountValue || parseFloat(discountValue) <= 0}
                className="bg-gray-900 hover:bg-gray-800"
              >
                {t("paymentMethod.confirm")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}











