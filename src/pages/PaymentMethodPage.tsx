import { useState, useEffect } from "react";
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
  ArrowLeft, Check, X, User, Plus, Trash2, Pencil, Hand, 
  CreditCard, FileText, Split, UserCircle, Gift, Package, 
  MoreHorizontal, Share2, Percent, DollarSign
} from "lucide-react";

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
  selectedStaff?: { id: number; name: string; avatarUrl?: string; position?: string } | null;
  // #15: the full roster this sale's staff can be picked from, and a callback so the
  // parent (which is what actually sends staffId to the backend) learns about a change
  // made here via "CHANGE" — previously that button did nothing at all, so a walk-in
  // sale's staff (and therefore who commission gets attributed to) was locked to
  // whatever the caller defaulted to, with no way to correct it from this screen.
  staffList?: Array<{ id: number; name: string; avatarUrl?: string; position?: string }>;
  onStaffChange?: (staff: { id: number; name: string; avatarUrl?: string; position?: string }) => void;
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
  }) => void;
  onCancel?: () => void;
}

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
  }>({ coverage: {}, payments: [], due: 0, remaining: 0 });
  const [selectedTip, setSelectedTip] = useState<{ amount: number; percent: number } | null>(null);
  const [customTip, setCustomTip] = useState("");
  const [showCustomTip, setShowCustomTip] = useState(false);
  const [showCustomTipDialog, setShowCustomTipDialog] = useState(false);
  const [customTipType, setCustomTipType] = useState<"percentage" | "fixed">("percentage");
  const [customTipValue, setCustomTipValue] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash");
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
  const [selectedStaff, setSelectedStaff] = useState<{ id: number; name: string; avatarUrl?: string; position?: string } | null>(propSelectedStaff);
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
    // { id: "check", name: "Check", icon: FileText },
  ];

  // Split needs both halves to be accepted; offering it with one of them off would let a
  // salon record cash it does not take.
  const paymentMethods = allMethods.filter(m =>
    m.requires === "SPLIT"
      ? accepted.includes("CASH") && accepted.includes("CARD")
      : accepted.includes(m.requires)
  );

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

  const handleConfirm = () => {
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

      // When the cashier used the benefits panel, that is the payment: it already knows
      // what each line was covered by and how the rest was tendered.
      if (multi.payments.length > 0 || Object.values(multi.coverage).some(Boolean)) {
        paymentData.payments = multi.payments;
        paymentData.coverage = multi.coverage;
      }

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

      onConfirm(paymentData);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-y-auto bg-[rgb(var(--reg-canvas))] text-[rgb(var(--reg-ink))] md:flex-row md:overflow-hidden" style={{ fontFamily: '"Plus Jakarta Sans", Inter, system-ui, sans-serif' }}>
      {/* Left Panel - Payment Method & Tip */}
      <div className="flex w-full flex-col border-b border-[rgb(var(--reg-line))] bg-white md:w-1/2 md:overflow-y-auto md:border-b-0 md:border-r">
        {/* Header */}
        <div className="p-6 border-b border-[rgb(var(--reg-line)/0.8)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("paymentMethod.back")}
              onClick={handleCancel}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em]">{t("paymentMethod.takePayment")}</h1>
              <p className="text-sm text-[rgb(var(--reg-muted))]">{selectedClient ? t("paymentMethod.itemsForClient", { count: orderItems.length, name: selectedClient.name }) : t("paymentMethod.itemsWalkIn", { count: orderItems.length })}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleCancel}
            className="h-10 rounded-full border-[rgb(var(--reg-line))] px-4 text-sm font-semibold"
          >
            {t("paymentMethod.backToTicket")}
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Tip Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold text-[rgb(var(--reg-ink))]">{t("paymentMethod.tip")}</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {tipOptions.map((tip) => (
                <button
                  key={tip.percent}
                  onClick={() => handleTipSelect(tip)}
                  className={`relative min-h-[64px] rounded-2xl p-4 text-left ring-1 ring-inset transition-all ${
                    selectedTip?.percent === tip.percent && !showCustomTip
                      ? "bg-[rgb(var(--reg-brand-soft))] ring-2 ring-[rgb(var(--reg-brand))]"
                      : "bg-white ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-brand)/0.4)]"
                  }`}
                >
                  {selectedTip?.percent === tip.percent && !showCustomTip && (
                    <div className="absolute top-2 right-2">
                      <div className="w-5 h-5 bg-[rgb(var(--reg-brand))] rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  )}
                  <p className="text-sm font-medium text-[rgb(var(--reg-ink))]">{tip.label}</p>
                </button>
              ))}
              <button
                onClick={handleCustomTip}
                className={`relative min-h-[64px] rounded-2xl p-4 text-left ring-1 ring-inset transition-all ${
                  showCustomTip
                    ? "bg-[rgb(var(--reg-brand-soft))] ring-2 ring-[rgb(var(--reg-brand))]"
                    : "bg-white ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-brand)/0.4)]"
                }`}
              >
                {showCustomTip && (
                  <div className="absolute top-2 right-2">
                    <div className="w-5 h-5 bg-[rgb(var(--reg-brand))] rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <MoreHorizontal className="h-5 w-5 text-[rgb(var(--reg-muted)/0.8)]" />
                  <p className="text-sm font-medium text-[rgb(var(--reg-ink))]">{t("paymentMethod.custom")}</p>
                </div>
              </button>
            </div>
            {showCustomTip && (
              <div className="mt-2 p-3 bg-[rgb(var(--reg-canvas))] rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[rgb(var(--reg-muted))]">
                    {t("paymentMethod.customTip", { value: selectedTip ? (selectedTip.percent > 0 ? `${selectedTip.percent.toFixed(1)}%` : `${selectedTip.amount.toFixed(2)} ${currencySymbol()}`) : `${parseFloat(customTip).toFixed(2)} ${currencySymbol()}` })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowCustomTip(false);
                      setCustomTip("");
                      setSelectedTip(null);
                      setPaymentAmount(subtotal);
                    }}
                    className="h-7 text-xs"
                  >
                    {t("common.remove")}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Payment Method Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold text-[rgb(var(--reg-ink))]">{t("paymentMethod.paymentMethod")}</Label>
            <div className="grid grid-cols-2 gap-3">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.id}
                    onClick={() => {
                      setSelectedPaymentMethod(method.id);
                      if (method.id === "cash") {
                        // Start from the exact total; the calculator below takes what was handed over.
                        if (paymentAmount < total) setPaymentAmount(Number(Math.max(0, total).toFixed(2)));
                      } else if (method.id === "card-terminal") {
                        // For card, set payment amount to total (exact amount)
                        const currentTotal = subtotal - discountAmount + (selectedTip?.amount || parseFloat(customTip) || 0) - depositCredit;
                        setPaymentAmount(currentTotal);
                      } else if (method.id === "split") {
                        // For split payment, open split dialog
                        const currentTotal = subtotal - discountAmount + (selectedTip?.amount || parseFloat(customTip) || 0) - depositCredit;
                        setSplitCashAmount("");
                        setSplitCardAmount("");
                        setShowSplitDialog(true);
                      } else {
                        // Gift card, package, membership: the customer has already paid,
                        // so there is nothing to hand over and no change to give.
                        const currentTotal = subtotal - discountAmount + (selectedTip?.amount || parseFloat(customTip) || 0) - depositCredit;
                        setPaymentAmount(currentTotal);
                      }
                    }}
                    className={`relative min-h-[64px] rounded-2xl p-4 text-left ring-1 ring-inset transition-all ${
                      selectedPaymentMethod === method.id
                        ? "bg-[rgb(var(--reg-brand-soft))] ring-2 ring-[rgb(var(--reg-brand))]"
                        : "bg-white ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-brand)/0.4)]"
                    }`}
                  >
                    {selectedPaymentMethod === method.id && (
                      <div className="absolute top-2 right-2">
                        <div className="w-5 h-5 bg-[rgb(var(--reg-brand))] rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      </div>
                    )}
                    <Icon className="h-6 w-6 text-[rgb(var(--reg-ink)/0.85)] mb-2" />
                    <p className="text-sm font-medium text-[rgb(var(--reg-ink))]">{method.name}</p>
                  </button>
                );
              })}
            </div>
            {selectedPaymentMethod === "cash" && (
              <div className="rounded-2xl bg-[rgb(var(--reg-canvas))] p-4 ring-1 ring-inset ring-[rgb(var(--reg-line))]">
                <label htmlFor="cash-received" className="text-sm font-semibold">{t("paymentMethod.cashReceived")}</label>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    id="cash-received"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={Number.isFinite(paymentAmount) ? String(paymentAmount) : ""}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="h-12 rounded-[14px] border-[rgb(var(--reg-line))] bg-white text-lg font-bold tabular-nums"
                  />
                  <span className="text-sm font-semibold text-[rgb(var(--reg-muted))]">{currencySymbol()}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[...new Set([Math.max(0, total), ...[5, 10, 20, 50, 100].map((n) => Math.ceil(Math.max(0, total) / n) * n)])]
                    .filter((v) => v > 0)
                    .slice(0, 5)
                    .map((v, k) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setPaymentAmount(Number(v.toFixed(2)))}
                        className={`h-9 rounded-full px-3.5 text-sm font-semibold tabular-nums ring-1 ring-inset ${Math.abs(paymentAmount - v) < 0.005 ? "bg-[rgb(var(--reg-ink))] text-white ring-[rgb(var(--reg-ink))]" : "bg-white ring-[rgb(var(--reg-line))]"}`}
                      >
                        {k === 0 ? t("paymentMethod.exact") : `${v.toFixed(0)} ${currencySymbol()}`}
                      </button>
                    ))}
                </div>
                <div className={`mt-3 flex items-center justify-between rounded-xl px-3 py-2.5 ${paymentAmount - total < -0.005 ? "bg-rose-50 text-rose-800" : "bg-[rgb(var(--reg-success-soft))] text-[rgb(var(--reg-success))]"}`}>
                  <span className="text-sm font-semibold">{paymentAmount - total < -0.005 ? t("paymentMethod.stillToPay") : t("paymentMethod.changeToGive")}</span>
                  <span className="text-xl font-extrabold tabular-nums">{Math.abs(paymentAmount - total).toFixed(2)} {currencySymbol()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Order Summary */}
      <div className="flex w-full flex-col bg-[rgb(var(--reg-canvas))] md:w-1/2 md:overflow-y-auto">
        <div className="p-6 pb-0 shrink-0">
          <BenefitsAndTenders
            businessId={checkoutBusinessId}
            clientId={selectedClient?.id ? Number(selectedClient.id) : null}
            orderItems={orderItems.map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              serviceId: (item as { serviceId?: number }).serviceId,
            }))}
            total={subtotal - discountAmount + (selectedTip?.amount || parseFloat(customTip) || 0) - depositCredit}
            onChange={setMulti}
          />
        </div>
        {/* Header */}
        <div className="p-6 border-b border-[rgb(var(--reg-line)/0.8)] shrink-0">
          <h2 className="text-lg font-semibold text-[rgb(var(--reg-ink))] mb-4">{t("paymentMethod.orderSummary")}</h2>
          
          {/* Client Selection */}
          <div className="border-2 border-dashed border-[rgb(var(--reg-line))] rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-gray-400 transition-colors">
            <div className="flex items-center gap-3">
              {selectedClient ? (
                <>
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-[rgb(var(--reg-muted))]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[rgb(var(--reg-ink))]">{selectedClient.name}</p>
                    <p className="text-xs text-[rgb(var(--reg-muted))]">{t("common.client")}</p>
                  </div>
                </>
              ) : (
                <>
                  <User className="h-5 w-5 text-[rgb(var(--reg-muted)/0.8)]" />
                  <span className="text-sm text-[rgb(var(--reg-muted))]">{t("paymentMethod.selectClientOrLeaveEmpty")}</span>
                </>
              )}
            </div>
            <Plus className="h-5 w-5 text-[rgb(var(--reg-muted)/0.8)]" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Item Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm font-medium text-[rgb(var(--reg-muted))] pb-2 border-b border-[rgb(var(--reg-line)/0.8)]">
              <span>{t("paymentMethod.item")}</span>
              <span>{t("paymentMethod.amount")}</span>
            </div>
            {orderItems.length > 0 ? (
              <div className="space-y-3">
                {orderItems.map((item) => (
                  <div key={item.id} className="flex items-start justify-between p-3 bg-[rgb(var(--reg-canvas))] rounded-2xl cursor-pointer hover:bg-[rgb(var(--reg-ink)/0.05)] transition-colors">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[rgb(var(--reg-ink))]">{item.name}</p>
                      {item.duration && (
                        <p className="text-xs text-[rgb(var(--reg-muted))] mt-0.5">{item.duration}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[rgb(var(--reg-muted))]">{t("paymentMethod.x", { quantity: item.quantity })}</p>
                      <p className="text-sm font-semibold text-[rgb(var(--reg-ink))] mt-0.5">{item.price.toFixed(2)} {currencySymbol()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-[rgb(var(--reg-canvas))] rounded-2xl">
                <p className="text-sm text-[rgb(var(--reg-muted))]">{t("paymentMethod.pedicureKlasycznyHM")}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-[rgb(var(--reg-muted))]">{t("paymentMethod.x1")}</span>
                  <span className="text-sm font-medium text-[rgb(var(--reg-ink))]">{`100,00 ${currencySymbol()}`}</span>
                </div>
                <p className="text-xs text-[rgb(var(--reg-muted))] mt-2">{t("paymentMethod.discount")}</p>
              </div>
            )}
          </div>

          {/* Staff Info */}
          {selectedStaff && (
            <div className="p-3 bg-[rgb(var(--reg-canvas))] rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                    {selectedStaff.avatarUrl ? (
                      <img
                        src={assetUrl(selectedStaff.avatarUrl)}
                        alt={selectedStaff.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-[rgb(var(--reg-muted))]">
                        {(selectedStaff.name || '').split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[rgb(var(--reg-ink))]">{selectedStaff.name}</p>
                    {selectedStaff.position && (
                      <p className="text-xs text-[rgb(var(--reg-muted))]">{selectedStaff.position}</p>
                    )}
                  </div>
                </div>
                {/* #15: this used to have no onClick at all — the sale's staff (and so
                    who gets commission credit) could never actually be changed here. */}
                {staffList.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setShowStaffPicker(v => !v)}
                  >
                    <User className="h-3.5 w-3.5 mr-1.5" />
                    <Pencil className="h-3.5 w-3.5" />
                    {t("paymentMethod.change")}
                  </Button>
                )}
              </div>
              {showStaffPicker && staffList.length > 1 && (
                <div className="mt-2 space-y-1 border-t border-[rgb(var(--reg-line)/0.8)] pt-2">
                  {staffList.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        setSelectedStaff(member);
                        onStaffChange?.(member);
                        setShowStaffPicker(false);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-[rgb(var(--reg-ink)/0.05)] transition-colors ${
                        member.id === selectedStaff.id ? "font-medium text-[rgb(var(--reg-ink))]" : "text-[rgb(var(--reg-muted))]"
                      }`}
                    >
                      {member.name}
                      {member.position && <span className="text-xs text-[rgb(var(--reg-muted)/0.8)] ml-1.5">{member.position}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="text-center">
            <p className="text-xs text-[rgb(var(--reg-muted))] flex items-center justify-center gap-1">
              <span>👆</span>
              {t("paymentMethod.tapItemToChange")}
            </p>
          </div>

          {/* Summary Breakdown */}
          <div className="space-y-2 pt-4 border-t border-[rgb(var(--reg-line)/0.8)]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[rgb(var(--reg-muted))]">{t("paymentMethod.subtotal")}</span>
              <span className="font-medium text-[rgb(var(--reg-ink))]">{subtotal.toFixed(2)} {currencySymbol()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-[rgb(var(--reg-muted))]">{t("common.discount")}</span>
                <Button 
                  variant="ghost" 
                  size="icon"
                  aria-label={t("paymentMethod.editDiscount")}
                  className="h-5 w-5"
                  onClick={() => {
                    setDiscountValue("");
                    setDiscountType("percentage");
                    setShowDiscountDialog(true);
                  }}
                >
                  <Plus className="h-3 w-3 text-[rgb(var(--reg-muted)/0.8)]" />
                </Button>
              </div>
              <span className="font-medium text-[rgb(var(--reg-ink))]">
                {discountAmount > 0 ? `-${discountAmount.toFixed(2)} ${currencySymbol()}` : `0,00 ${currencySymbol()}`}
              </span>
            </div>
            {/* Usage section disabled */}
            {/* <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-[rgb(var(--reg-muted)/0.8)]" />
                <span className="text-[rgb(var(--reg-muted))]">Usage</span>
              </div>
              <span className="font-medium text-[rgb(var(--reg-ink))]">-</span>
            </div> */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[rgb(var(--reg-muted))]">{t("paymentMethod.tip")}</span>
              <span className="font-medium text-[rgb(var(--reg-ink))]">
                {(selectedTip?.amount || parseFloat(customTip) || 0).toFixed(2)} {currencySymbol()}
              </span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-[rgb(var(--reg-line)/0.8)]">
              <span className="text-base font-bold text-[rgb(var(--reg-ink))]">{t("paymentMethod.total")}</span>
              <span className="text-lg font-bold text-[rgb(var(--reg-ink))]">{total.toFixed(2)} {currencySymbol()}</span>
            </div>
          </div>

          {/* Payment Details Section */}
          <div className="space-y-2 pt-4 border-t border-[rgb(var(--reg-line)/0.8)]">
            {/* #117: named, because a total that is simply lower than the services reads as
                a pricing error and gets "corrected" by the cashier. */}
            {depositCredit > 0 ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[rgb(var(--reg-muted))]">
                  {pointsCovered > 0 && depositOnly + prepaidCredit === 0
                    ? t("paymentMethod.paidWithPointsAtBooking")
                    : pointsCovered > 0
                      ? t("paymentMethod.alreadyPaidDepositGiftCard")
                      : prepaidCredit > 0
                        ? t("paymentMethod.alreadyPaidDepositGiftCard2")
                        : t("paymentMethod.depositAlreadyPaid")}
                </span>
                <span className="font-medium text-[rgb(var(--reg-success))]">
                  -{depositCredit.toFixed(2)} {currencySymbol()}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[rgb(var(--reg-muted))]">{depositCredit > 0 ? t("paymentMethod.leftToPay") : t("common.total")}</span>
              <span className="font-medium text-[rgb(var(--reg-ink))]">{total.toFixed(2)} {currencySymbol()}</span>
            </div>
            {selectedPaymentMethod === "gift-card" ? (
              <div className="space-y-1.5">
                <label className="text-sm text-[rgb(var(--reg-muted))]">{t("paymentMethod.giftCardCode")}</label>
                <Input
                  value={giftCardCode}
                  onChange={e => setGiftCardCode(e.target.value.toUpperCase())}
                  placeholder={t("paymentMethod.cardCode")}
                  autoComplete="off"
                />
                <p className="text-xs text-[rgb(var(--reg-muted))]">
                  {t("paymentMethod.theCardMustHaveBeen")}
                </p>
              </div>
            ) : selectedPaymentMethod === "package" || selectedPaymentMethod === "membership" ? (
              <p className="text-xs text-[rgb(var(--reg-muted))]">
                {t("paymentMethod.oneSessionComesOffThis")}
              </p>
            ) : selectedPaymentMethod === "split" ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[rgb(var(--reg-muted))]">{t("common.cash")}</span>
                  <span className="font-medium text-[rgb(var(--reg-ink))]">{parseFloat(splitCashAmount) || 0} {currencySymbol()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[rgb(var(--reg-muted))]">{t("common.card")}</span>
                  <span className="font-medium text-[rgb(var(--reg-ink))]">{parseFloat(splitCardAmount) || 0} {currencySymbol()}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[rgb(var(--reg-muted))]">{t("paymentMethod.customerGives")}</span>
                  <span className="font-medium text-[rgb(var(--reg-ink))]">{paymentAmount.toFixed(2)} {currencySymbol()}</span>
                </div>
                {change > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[rgb(var(--reg-muted))]">{t("paymentMethod.return")}</span>
                    <span className="font-medium text-[rgb(var(--reg-ink))]">{change.toFixed(2)} {currencySymbol()}</span>
                  </div>
                )}
                {change < 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[rgb(var(--reg-muted))]">{t("paymentMethod.dueTo")}</span>
                    <span className="font-medium text-red-600">{Math.abs(change).toFixed(2)} {currencySymbol()}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* The receipt as it prints: the salon's colour on top, its footer at the bottom. */}
        <div className="px-6 pb-6">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted))]">{t("paymentMethod.receiptPreview")}</p>
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
              {(selectedTip?.amount || parseFloat(customTip) || 0) > 0 && <p className="flex justify-between"><span>{t("paymentMethod.tip")}</span><span className="tabular-nums">{(selectedTip?.amount || parseFloat(customTip) || 0).toFixed(2)}</span></p>}
              {depositCredit > 0 && <p className="flex justify-between"><span>{t("paymentMethod.alreadyPaid")}</span><span className="tabular-nums">-{depositCredit.toFixed(2)}</span></p>}
              <div className="my-2 border-t border-dashed border-[rgb(var(--reg-line))]" />
              <p className="flex justify-between font-bold"><span>{t("common.total")}</span><span className="tabular-nums">{total.toFixed(2)} {currencySymbol()}</span></p>
              {receiptLook.footer.trim() && <p className="mt-3 whitespace-pre-wrap break-words text-center text-[rgb(var(--reg-muted))]">{receiptLook.footer}</p>}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 flex shrink-0 items-center justify-end gap-3 border-t border-[rgb(var(--reg-line)/0.8)] bg-white/95 p-4 pb-[max(16px,env(safe-area-inset-bottom))] backdrop-blur md:p-6">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("paymentMethod.discardThisSale")}
            title={t("paymentMethod.discardThisSale")}
            className="h-12 w-12 rounded-full text-red-600 hover:bg-red-50"
            onClick={() => {
              // It had no handler at all. It now throws the ticket away (Back keeps it).
              if (!confirm(t("paymentMethod.discardThisSaleTheTicket"))) return;
              if (onDiscard) onDiscard();
              else handleCancel();
            }}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
          <Button
            onClick={handleConfirm}
            className="h-[52px] flex-1 rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] px-8 text-base font-semibold text-white shadow-[0_10px_24px_-8px_rgb(var(--reg-brand-strong)/0.6)] hover:brightness-110 md:flex-none"
          >
            {t("paymentMethod.charge", { value: Math.max(0, total).toFixed(2), value2: currencySymbol() })}
          </Button>
        </div>
      </div>

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

      {/* Split Payment Dialog */}
      <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("paymentMethod.splitPayment")}</DialogTitle>
            <DialogDescription>
              {t("paymentMethod.enterHowMuchToPay")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-[rgb(var(--reg-canvas))] rounded-2xl">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-[rgb(var(--reg-muted))]">{t("paymentMethod.totalAmount")}</span>
                <span className="font-semibold text-[rgb(var(--reg-ink))]">{total.toFixed(2)} {currencySymbol()}</span>
              </div>
            </div>

            {/* Cash Amount Input */}
            <div className="space-y-2">
              <Label>{t("paymentMethod.cashAmount", { value: currencySymbol() })}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))] font-medium">{currencySymbol()}</span>
                <Input
                  type="number"
                  placeholder={t("paymentMethod.enterCashAmount")}
                  value={splitCashAmount}
                  onChange={(e) => {
                    setSplitCashAmount(e.target.value);
                    const cash = parseFloat(e.target.value) || 0;
                    const card = total - cash;
                    setSplitCardAmount(card > 0 ? card.toFixed(2) : "");
                  }}
                  className="h-12 pl-12 text-lg font-semibold"
                  step="0.01"
                />
              </div>
            </div>

            {/* Card Amount Input */}
            <div className="space-y-2">
              <Label>{t("paymentMethod.cardAmount", { value: currencySymbol() })}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))] font-medium">{currencySymbol()}</span>
                <Input
                  type="number"
                  placeholder={t("paymentMethod.enterCardAmount")}
                  value={splitCardAmount}
                  onChange={(e) => {
                    setSplitCardAmount(e.target.value);
                    const card = parseFloat(e.target.value) || 0;
                    const cash = total - card;
                    setSplitCashAmount(cash > 0 ? cash.toFixed(2) : "");
                  }}
                  className="h-12 pl-12 text-lg font-semibold"
                  step="0.01"
                />
              </div>
            </div>

            {/* Split Summary */}
            {(splitCashAmount || splitCardAmount) && (
              <div className="mt-3 p-3 bg-[rgb(var(--reg-canvas))] rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[rgb(var(--reg-muted))]">{t("common.cash")}</span>
                  <span className="font-medium text-[rgb(var(--reg-ink))]">{parseFloat(splitCashAmount) || 0} {currencySymbol()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[rgb(var(--reg-muted))]">{t("common.card")}</span>
                  <span className="font-medium text-[rgb(var(--reg-ink))]">{parseFloat(splitCardAmount) || 0} {currencySymbol()}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-[rgb(var(--reg-line)/0.8)]">
                  <span className="text-[rgb(var(--reg-muted))] font-semibold">{t("common.total")}</span>
                  <span className={`font-semibold ${
                    Math.abs((parseFloat(splitCashAmount) || 0) + (parseFloat(splitCardAmount) || 0) - total) < 0.01
                      ? "text-[rgb(var(--reg-success))]"
                      : "text-red-600"
                  }`}>
                    {((parseFloat(splitCashAmount) || 0) + (parseFloat(splitCardAmount) || 0)).toFixed(2)} {currencySymbol()}
                  </span>
                </div>
                {Math.abs((parseFloat(splitCashAmount) || 0) + (parseFloat(splitCardAmount) || 0) - total) >= 0.01 && (
                  <p className="text-xs text-red-600 mt-1">
                    {t("paymentMethod.amountsMustEqual", { value: total.toFixed(2), value2: currencySymbol() })}
                  </p>
                )}
              </div>
            )}

            {/* Dialog Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSplitDialog(false);
                  setSplitCashAmount("");
                  setSplitCardAmount("");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleSplitConfirm}
                disabled={
                  !splitCashAmount || 
                  !splitCardAmount || 
                  parseFloat(splitCashAmount) < 0 || 
                  parseFloat(splitCardAmount) < 0 ||
                  Math.abs((parseFloat(splitCashAmount) || 0) + (parseFloat(splitCardAmount) || 0) - total) >= 0.01
                }
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











