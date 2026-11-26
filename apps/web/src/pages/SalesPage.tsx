import type { Id } from "@/types/id";
import { useState, useEffect, useMemo, Suspense } from "react";
import { lazyWithReload } from "@/lib/lazyWithReload";
import { clientBalanceService } from "@/services/clientBalanceService";
import { salonNow, salonToday } from "@/lib/salonClock";
import { currencySymbol } from "@/lib/currency";
import { useLocation, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { BRAND_FONT, useBrandFont } from "@/components/auth/useBrandFont";
import "@/components/auth/auth-tokens.css";
import { Button } from "@/components/ui/button";
import { User, Plus, Minus, Trash2, ArrowLeft, Search, Receipt, CreditCard, X, Send, MoreVertical, Edit2, Save, Check, X as XIcon } from "lucide-react";
import { format } from "@/i18n/dateFns";
// The payment step is its own chunk (fetched on idle once the till has painted), not part
// of the till's first load.
const loadPaymentMethodPage = () => import("./PaymentMethodPage");
const PaymentMethodPage = lazyWithReload(loadPaymentMethodPage);
import { useServices } from "@/hooks/useServices";
import { useAddons } from "@/hooks/useAddons";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useStaff } from "@/hooks/useStaff";
import { useServiceOffers } from "@/hooks/useServiceOffers";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SaleRefundDialog } from "@/components/sales/SaleRefundDialog";
import { myAccess } from "@/components/layout/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { FormSheet, StatCard } from "@/components/page/booqi";
import { StatusChip } from "@/components/page/kit";
import { toast } from "sonner";
import type { Service } from "@/services/serviceService";
import { quickSaleService, type QuickSaleItem as QuickSaleItemAPI } from "@/services/quickSaleService";
import { membershipService, type Membership } from "@/services/membershipService";
import { packageService, type ServicePackage } from "@/services/packageService";
import { useFeatureFlags } from "@/services/platformService";
import { appointmentService, type Appointment } from "@/services/appointmentService";
import { businessService } from "@/services/businessService";
import { promoService } from "@/services/promoService";
import { productService, type Product } from "@/services/productService";
import { clientService, type ClientWithStats } from "@/services/clientService";
import { categoryService, type Category } from "@/services/categoryService";
import { websocketService } from "@/services/websocketService";
import { saleService, type CreateSaleRequest, type Sale } from "@/services/saleService";
import { paymentConfirmationService, type PaymentConfirmationRequest } from "@/services/paymentConfirmationService";
import { t as tr, tOpt, fmtDate as formatLocaleDate, getLocale, formatMinutes } from "@/i18n";

// Open and not yet paid, on any day. The settle list adds "today"; "Take payment" from the
// calendar can be for any day.
/** Today's date (yyyy-MM-dd) on the salon's own clock; the market's (Asia/Baku) when none is set — never the browser's. */
const todayIn = (timeZone?: string | null): string => salonToday(timeZone);
/** A local Date on that calendar day (noon, so formatting it back never slips a day). */
const dayDate = (ymd: string, addDays = 0): Date => {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + addDays);
  return d;
};

const isUnsettled = (apt: Appointment): boolean => {
  // payment_status had no default and nothing set it on create, so every ordinary
  // booking came back null and this list was permanently empty (fixed in V77, but a
  // null is still the honest "nobody has said this is paid" and belongs here).
  // PENDING_DEPOSIT is money owed too. PARTIALLY_REFUNDED was in the old condition
  // and is not a value chk_payment_status allows, so it could never have matched.
  const unpaid =
    apt.paymentStatus == null ||
    apt.paymentStatus === 'PENDING' ||
    apt.paymentStatus === 'PENDING_DEPOSIT';
  return apt.status !== 'CANCELLED' && apt.status !== 'NO_SHOW' && unpaid;
};

// Helper function to filter and sort unsettled appointments
const filterAndSortUnsettledAppointments = (appointments: Appointment[], today: string): Appointment[] => {
  return appointments
    // The date string itself: new Date("2026-11-16") is UTC midnight, which is the 15th west of UTC.
    .filter(apt => String(apt.appointmentDate).slice(0, 10) === today && isUnsettled(apt))
    .sort((a, b) => {
      // Compare start times (HH:mm format)
      const timeA = a.startTime.split(':').map(Number);
      const timeB = b.startTime.split(':').map(Number);
      const minutesA = timeA[0] * 60 + timeA[1];
      const minutesB = timeB[0] * 60 + timeB[1];
      return minutesA - minutesB;
    });
};

/** One visit = the services booked together (same visitId), or a booking on its own. */
interface VisitRow {
  key: string;
  members: Appointment[];
}
const groupIntoVisits = (appointments: Appointment[]): VisitRow[] => {
  const rows: VisitRow[] = [];
  for (const apt of appointments) {
    const row = apt.visitId ? rows.find((r) => r.members[0].visitId === apt.visitId) : undefined;
    if (row) row.members.push(apt);
    else rows.push({ key: apt.visitId ? `visit-${apt.visitId}` : `appt-${apt.id}`, members: [apt] });
  }
  return rows;
};

/** The ticket line for one booking. */
const bookingLine = (a: Appointment, serviceName?: string): BasketItem => ({
  id: `appointment-${a.id}`,
  appointmentId: a.id,
  name: a.serviceName || serviceName || "Service",
  price: String(a.price ?? 0),
  type: "service",
  serviceId: a.serviceId,
  duration: `${a.startTime?.slice(0, 5)} - ${a.endTime?.slice(0, 5)}`,
});

// Sidebar category definitions (module-level constant — not the categories state inside the component)
const SALE_CATEGORIES = [
  { id: "quick-sale", get name() { return tr("sales.tabQuickSale"); }, active: true },
  { id: "to-be-settled", get name() { return tr("sales.tabToBeSettled"); } },
  { id: "services", get name() { return tr("sales.tabServices"); } },
  { id: "extras", get name() { return tr("sales.tabExtras"); } },
];

// Transaction interface for display
interface Transaction {
  id: string;
  time: string;
  date: string;
  description: string;
  status: string;
  amount: string;
  paymentMethod: string;
  splitCashAmount?: number;
  splitCardAmount?: number;
  billNumber?: string;
  billId?: string;
  clientName?: string;
  address?: string;
  items: Array<{
    name: string;
    duration?: string;
    quantity: number;
    price: string;
  }>;
  appointmentDate?: string;
  staffName?: string;
  tax: {
    rate: string;
    netWorth: string;
    taxAmount: string;
    grossValue: string;
  };
  addition: string;
  discount: string;
  tip: string;
  total: string;
  paidDate: string;
  sale: Sale; // Keep reference to original sale
  /** The sale's date and time, for sorting newest first. */
  isoDate?: string;
}

// Quick sale item type for display
interface QuickSaleItem {
  id: string;
  name: string;
  duration: string;
  price: string;
  color: string;
  type: 'service' | 'combo';
  serviceId?: Id;
}

/** A line in the basket: a service, combo, product, membership, gift card or booking. */
interface BasketItem {
  id: string;
  basketId?: string;
  name: string;
  price: string;
  duration?: string;
  type?: string;
  serviceId?: Id;
  productId?: Id;
  membershipId?: Id;
  /** Set when the line IS a prepaid package being sold; the sale gives the client its sessions. */
  packageId?: Id;
  giftCardAmount?: number;
  appointmentId?: string;
}

/**
 * What the till should charge for a service, offers applied.
 *
 * The backend re-prices every line on confirmation, so a till showing the list price while
 * an offer runs disagrees with its own total — the salon finds out at the moment it takes
 * the money, which is the worst moment.
 */
function servicePriceLabel(
  service: { price?: number | null; priceType?: string | null; id: Id },
  offers: Map<Id, { price: number; wasPrice?: number }>
): string {
  const offer = offers.get(service.id);
  const payable = offer ? offer.price : service.price;
  if (payable == null) return tr("sales.priceOnRequest");
  const shown = `${payable.toFixed(2)} ${currencySymbol()}`;
  if (offer?.wasPrice != null) return tr("sales.was", { shown, value: offer.wasPrice.toFixed(2) });
  return service.priceType === 'FROM' ? tr("sales.from", { shown }) : shown;
}

/** Tax of a sale's items; null when no tax applies. A service's own rate wins over the salon's. */
function receiptTax(
  sale: { total: number; items: { serviceId?: Id; serviceName?: string; unitPrice: number; quantity: number }[] },
  salonRate: number,
  services: Service[],
) {
  const lines = sale.items.map((it) => {
    const svc = services.find((x) => (it.serviceId ? x.id === it.serviceId : x.name === it.serviceName));
    return { gross: it.unitPrice * it.quantity, rate: svc?.taxRate != null ? Number(svc.taxRate) : salonRate };
  });
  const sum = lines.reduce((n, l) => n + l.gross, 0);
  if (!sum || lines.every((l) => l.rate <= 0)) return null;
  // The sale total already has any discount in it, so each line takes its share of it.
  let net = 0;
  for (const l of lines) net += ((l.gross / sum) * sale.total) / (1 + l.rate / 100);
  const rates = [...new Set(lines.map((l) => l.rate))];
  return {
    rate: rates.length === 1 ? `${rates[0]}%` : "Mixed",
    net,
    tax: sale.total - net,
  };
}

/** Identical lines (same name and price) collapse into one "2 × 12.50" row. Display only. */
function groupReceiptLines<P extends string | number>(lines: { name: string; price: P }[]): { name: string; price: P; qty: number }[] {
  const out: { name: string; price: P; qty: number }[] = [];
  for (const l of lines) {
    const hit = out.find((o) => o.name === l.name && o.price === l.price);
    if (hit) hit.qty += 1;
    else out.push({ ...l, qty: 1 });
  }
  return out;
}

function saleStatusChip(status: string) {
  if (status === "PAID") return <StatusChip status="active" label={tr("common.paid")} />;
  if (status === "CANCELLED") return <StatusChip status="ended" label={tr("sales.voided")} />;
  if (status === "REFUNDED") return <StatusChip status="failed" label={tr("sales.refunded")} />;
  return <StatusChip status="draft" label={status.charAt(0) + status.slice(1).toLowerCase()} />;
}

export default function SalesPage() {
  useBrandFont();
  const navigate = useNavigate();
  const businessId = useBusinessId();
  const { services, loading: servicesLoading } = useServices(businessId);
  const { addons, loading: addonsLoading } = useAddons(businessId);
  // The salon's tax rate, receipt footer and brand colour (Business > Branding / Booking rules).
  const [salonInfo, setSalonInfo] = useState<{ taxRate: number; receiptFooter: string; brandColor: string }>(
    { taxRate: 0, receiptFooter: "", brandColor: "" }
  );
  // null until the salon is loaded: "today" is the salon's day, so nothing date-based runs before.
  const [salonTz, setSalonTz] = useState<string | null>(null);
  // Warm the payment step once the till has painted, so checkout opens without a wait.
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const warm = () => void loadPaymentMethodPage().catch(() => undefined);
    const id = idle ? idle(warm) : window.setTimeout(warm, 2000);
    return () => {
      if (!idle) window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    if (!businessId) return;
    businessService
      .getBusiness(businessId)
      .then((b) => {
        setSalonTz(b.timezone || "");
        setSalonInfo({
          taxRate: Number(b.taxRate ?? 0) || 0,
          receiptFooter: b.receiptFooter ?? "",
          brandColor: /^#[0-9a-fA-F]{6}$/.test(b.brandColor ?? "") ? (b.brandColor as string) : "",
        });
      })
      .catch(() => setSalonTz(""));
  }, [businessId]);
  const { staff } = useStaff(businessId);
  // The catalogue carries the list price; this carries what the offer makes it today.
  const offers = useServiceOffers(businessId);
  const [activeTab, setActiveTab] = useState("NEW SALES");
  const [activeCategory, setActiveCategory] = useState("quick-sale");
  
  // Sidebar categories - defined inside component to ensure accessibility
  const passFlags = useFeatureFlags();
  const sidebarCategories = [
    { id: "quick-sale", get name() { return tr("sales.tabQuickSale"); }, active: true },
    { id: "to-be-settled", get name() { return tr("sales.tabToBeSettled"); } },
    { id: "services", get name() { return tr("sales.tabServices"); } },
    { id: "extras", get name() { return tr("sales.tabExtras"); } },
    ...(passFlags.memberships === true ? [{ id: "memberships", get name() { return tr("passes.tabMemberships"); } }] : []),
    ...(passFlags.packages === true ? [{ id: "packages", get name() { return tr("passes.tabPackages"); } }] : []),
    { id: "gift-cards", get name() { return tr("sales.tabGiftCards"); } },
    // Retail from Inventory. It was commented out, so a product could be stocked but
    // never sold, while Inventory promised that a sale takes it off the shelf.
    { id: "products", get name() { return tr("sales.tabProducts"); } },
    // Disabled sections from own amount to timepass
    // { id: "own-amount", name: "OWN AMOUNT" },
    // { id: "packages", name: "PACKAGES" },
    // { id: "time-passes", name: "TIME PASSES" },
  ];
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientWithStats | null>(null);
  const [periodFilter, setPeriodFilter] = useState("Days");
  const [searchQuery, setSearchQuery] = useState("");
  // #118: "how much went through on card today" and "what did Anna take" are the two
  // questions asked of this list, and neither could be answered without reading every row.
  const [methodFilter, setMethodFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [rangeFrom, setRangeFrom] = useState(() => format(new Date(Date.now() - 30 * 86400000), "yyyy-MM-dd"));
  const [rangeTo, setRangeTo] = useState(() => format(salonNow(), "yyyy-MM-dd"));
  const [voiding, setVoiding] = useState(false);
  const [txReload, setTxReload] = useState(0);
  // FG-W6-08: a refund is for the owner or a manager; the server checks it again.
  const [refundSale, setRefundSale] = useState<Sale | null>(null);
  const access = myAccess();
  const canRefund = access.isOwner || access.roleName.toLowerCase() === "manager";
  const [staffFilter, setStaffFilter] = useState("All");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  // UI2-HUBB-029: the list rows carry no refund info; the sale detail does.
  const [refundInfo, setRefundInfo] = useState<Pick<Sale, "refundedAmount" | "refundStatus" | "payments"> | null>(null);
  const selectedSaleId = selectedTransaction?.sale?.id;
  useEffect(() => {
    setRefundInfo(null);
    if (selectedSaleId == null) return;
    let live = true;
    saleService
      .getSaleById(selectedSaleId)
      .then((d) => live && setRefundInfo({ refundedAmount: d.refundedAmount, refundStatus: d.refundStatus, payments: d.payments }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [selectedSaleId]);
  const partlyRefunded = refundInfo?.refundStatus === "PARTIALLY_REFUNDED";
  const refundedLabel = refundInfo?.refundedAmount ? tr("sales.refundedAmount", { value: `${Number(refundInfo.refundedAmount).toFixed(2)} ${currencySymbol()}` }) : null;
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedQuickSaleItems, setSelectedQuickSaleItems] = useState<string[]>([]);
  const [quickSaleItems, setQuickSaleItems] = useState<QuickSaleItem[]>([]);
  // Sellable at the till, not just bookable: a membership and a gift card are things the
  // salon takes money for over the counter, which the basket had no way to represent.
  const [sellableMemberships, setSellableMemberships] = useState<Membership[]>([]);
  const [sellablePackages, setSellablePackages] = useState<ServicePackage[]>([]);
  const [giftCardAmount, setGiftCardAmount] = useState("100");
  const [loadingQuickSale, setLoadingQuickSale] = useState(false);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [appointmentsError, setAppointmentsError] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  // False until today's bookings are first known: the till lays out once, so nothing jumps (CLS).
  const [appointmentsSettled, setAppointmentsSettled] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  // Arriving from the calendar's "Take payment": open on the settle list with this
  // booking already picked, instead of making the cashier find it again.
  const location = useLocation();
  const incomingState = location.state as { appointmentId?: string; appointmentIds?: string[] } | null;
  const incomingAppointmentId = incomingState?.appointmentId ?? incomingState?.appointmentIds?.[0];
  // A whole visit from the calendar: every active service goes on the one ticket.
  const incomingAppointmentIds = incomingState?.appointmentIds?.length
    ? incomingState.appointmentIds
    : incomingAppointmentId
      ? [incomingAppointmentId]
      : [];
  const incomingKey = incomingAppointmentIds.join(",");
  const [selectedAppointmentStaffId, setSelectedAppointmentStaffId] = useState<Id | null>(null);
  // The promo code the selected booking was made with, priced by the server.
  const [bookedPromo, setBookedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState("");
  const [addonSearchQuery, setAddonSearchQuery] = useState("");

  // Client picker for quick sale
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [searchQueryClient, setSearchQueryClient] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketNote, setTicketNote] = useState("");
  // The sale just taken, for the success screen (receipt, change to give, "New sale").
  const [lastSale, setLastSale] = useState<{
    saleId: Id;
    total: number;
    change: number;
    method: string;
    client: string | null;
    lines: { name: string; price: number }[];
    /** Non-cash tenders (bonus points, gift card, balance), so the receipt says how it was paid. */
    tenders: { label: string; amount: number }[];
    /** What the checkout took off / added on top, so the receipt adds up to its total. */
    discount: number;
    tip: number;
    at: Date;
  } | null>(null);

  useEffect(() => {
    const loadClients = async () => {
      if (!businessId) return;
      try {
        setLoadingClients(true);
        const data = await clientService.getClientsWithAppointments(businessId);
        setClients(data);
      } catch {
        setClients([]);
      } finally {
        setLoadingClients(false);
      }
    };
    loadClients();
  }, [businessId]);

  /**
   * #118: the transactions actually shown, after every filter.
   *
   * Derived once rather than inline, because the totals under the list have to count the
   * same rows the list shows — two copies of this expression is how a summary ends up
   * describing a different set of sales from the one on screen.
   */
  const visibleTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((t) => {
      if (q && !(
        t.clientName?.toLowerCase().includes(q) ||
        t.staffName?.toLowerCase().includes(q) ||
        t.id?.toString().includes(q)
      )) return false;
      if (methodFilter !== "All" && t.paymentMethod !== methodFilter) return false;
      if (staffFilter !== "All" && (t.staffName ?? "") !== staffFilter) return false;
      return true;
    });
  }, [transactions, searchQuery, methodFilter, staffFilter]);

  /** Only what this salon has actually taken money through — not a fixed list of methods
      that offers "Gift card" to a salon that has never sold one. */
  const methodOptions = useMemo(
    () => ["All", ...Array.from(new Set(transactions.map((t) => t.paymentMethod).filter(Boolean)))],
    [transactions]
  );
  const staffOptions = useMemo(
    () => ["All", ...Array.from(new Set(transactions.map((t) => t.staffName).filter(Boolean)))],
    [transactions]
  );

  const filteredClients = clients
    .filter((c) => {
      const q = searchQueryClient.toLowerCase();
      if (!q) return true;
      const name = `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase();
      return name.includes(q) || (c.email || "").toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q);
    })
    .slice(0, 50);

  const getClientDisplayName = (c: ClientWithStats) => {
    return `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.email || c.phone || tr("sales.unknown");
  };

  // Load quick sale items from API on mount
  useEffect(() => {
    const loadQuickSaleItems = async () => {
      if (!businessId || servicesLoading) return;
      
      try {
        setLoadingQuickSale(true);
        const items = await quickSaleService.getQuickSaleItems(businessId);
        // Convert API items to display format
        const displayItems = items.map(item => {
          const service = services.find(s => s.id === item.serviceId);
          const converted = {
            id: item.serviceId.toString(),
            name: item.serviceName || service?.name || 'Unknown',
            duration: item.durationMinutes 
              ? formatMinutes(item.durationMinutes)
              : 'N/A',
            price: item.price 
              ? `${item.price.toFixed(2)} ${currencySymbol()}`
              : item.priceType === 'FROM' 
                ? `From ${item.price?.toFixed(2) || '0.00'} ${currencySymbol()}`
                : tr("sales.priceOnRequest"),
            color: item.color || 'gray',
            type: (item.serviceType === 'COMBO' ? 'combo' : 'service') as 'service' | 'combo',
            serviceId: item.serviceId,
          };
          return converted;
        });
        setQuickSaleItems(displayItems);
      } catch (error) {
        // Silently handle error - user hasn't configured quick sale items yet
        // If no items found, that's okay - user hasn't configured yet
        setQuickSaleItems([]);
      } finally {
        setLoadingQuickSale(false);
      }
    };

    loadQuickSaleItems();
    membershipService
      .list(businessId, true)
      .then(setSellableMemberships)
      .catch(() => setSellableMemberships([]));
    packageService
      .list(businessId)
      .then((rows) => setSellablePackages(rows.filter((p) => p.active)))
      .catch(() => setSellablePackages([]));
  }, [businessId, services, servicesLoading]);


  // Fresh each time the shelf is opened, so the stock shown follows the last sale.
  useEffect(() => {
    if (!businessId || activeCategory !== "products") return;
    productService.list(businessId).then(setProducts).catch(() => setProducts([]));
  }, [businessId, activeCategory]);

  // Every booking on the ticket: a visit puts all its services on one sale.
  const ticketApptIds = Array.from(new Set(basket.map((b) => b.appointmentId).filter((x): x is string => !!x)));
  const ticketAppts = todayAppointments.filter((a) => ticketApptIds.includes(a.id));
  const ticketApptKey = ticketApptIds.join(",");

  // Price the booking's promo code once it is in the basket.
  useEffect(() => {
    const appt = ticketAppts.find((a) => !!a.promoCode);
    const code = appt?.promoCode;
    if (!businessId || !code) {
      setBookedPromo(null);
      return;
    }
    let alive = true;
    promoService
      .validate(businessId, code, ticketAppts.reduce((sum, a) => sum + Number(a.price ?? 0), 0))
      .then((r) => alive && setBookedPromo({ code: r.code, discount: Number(r.discount) }))
      // A code that no longer validates is the server's to refuse at payment; do not
      // pretend it applies here.
      .catch(() => alive && setBookedPromo(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, ticketApptKey, todayAppointments]);

  // Load today's appointments when "to-be-settled" category is active
  useEffect(() => {
    const loadTodayAppointments = async () => {
      // Loaded always: the bookings to check out lead the till, whatever section is open.
      if (!businessId || salonTz === null) return;
      
      try {
        setLoadingAppointments(true);
        setAppointmentsError(false);
        const todayStr = todayIn(salonTz);
        const today = dayDate(todayStr);
        const appointments = await appointmentService.getAppointmentsByBusiness(businessId, today);
        
        // Enrich appointments with service names if missing
        const enrichedAppointments = appointments.map(apt => {
          if (!apt.serviceName && apt.serviceId) {
            const service = services.find(s => s.id === apt.serviceId);
            if (service) {
              return { ...apt, serviceName: service.name };
            }
          }
          return apt;
        });
        
        const unsettledAppointments = filterAndSortUnsettledAppointments(enrichedAppointments, todayStr);
        setTodayAppointments(unsettledAppointments);

        // Came here from the calendar to settle one specific booking: put it in the
        // basket now, so "Take payment" lands on a ready checkout rather than a list.
        if (incomingAppointmentIds.length > 0) {
          const targets: Appointment[] = [];
          for (const wanted of incomingAppointmentIds) {
            let target = unsettledAppointments.find((a) => a.id === wanted);
            // The list above is today's only. A booking from another day (paying ahead, or
            // settling yesterday's) used to open an empty basket with no word why.
            if (!target) {
              const fetched = await appointmentService.getAppointmentById(wanted).catch(() => null);
              const unsettled = fetched && isUnsettled(fetched) ? fetched : null;
              if (unsettled) {
                const service = services.find((s) => s.id === unsettled.serviceId);
                target = service && !unsettled.serviceName ? { ...unsettled, serviceName: service.name } : unsettled;
                const extra = target;
                setTodayAppointments((prev) => (prev.some((a) => a.id === extra.id) ? prev : [extra, ...prev]));
              } else {
                toast.error(fetched ? tr("sales.thisBookingIsAlreadySettled") : tr("sales.couldNotLoadThatBooking"));
              }
            }
            if (target) targets.push(target);
          }
          if (targets.length > 0) {
            const first = targets[0];
            setBasket((prev) => [
              ...prev,
              ...targets.filter((t) => !prev.some((b) => b.appointmentId === t.id)).map((t) => bookingLine(t)),
            ]);
            setSelectedAppointmentId(first.id);
            setSelectedAppointmentStaffId(first.staffId || null);
            // Straight to the till. "Take payment" means take payment — landing on the
            // settle list and making the cashier find the booking again is the step this
            // was meant to remove.
            setShowPaymentMethod(true);
            const match = clients.find(
              (c) =>
                // Walk-ins come back as clientId 0 — that is "no record", not client 0.
                (!!first.clientId && c.id === first.clientId) ||
                (first.clientEmail && c.email?.toLowerCase() === first.clientEmail.toLowerCase())
            );
            if (match) setSelectedClient(match);
          }
        }
      } catch (error) {
        // A failed load must not read as "everything is settled" — that is the one thing
        // this page must never be wrong about.
        console.error('Failed to load today\'s appointments:', error);
        setAppointmentsError(true);
        setTodayAppointments([]);
      } finally {
        setLoadingAppointments(false);
        setAppointmentsSettled(true);
      }
    };

    loadTodayAppointments();
    // clients: a booking opened from the calendar is matched to its client here — if the
    // client list arrived after the bookings, nobody was preselected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, salonTz, activeCategory, services, clients, incomingKey]);

  // WebSocket subscription for real-time appointment updates (the to-check-out list is
  // always on screen now, so it listens whenever the till is open).
  useEffect(() => {
    if (!businessId) return;

    // Connect to WebSocket if not already connected
    if (!websocketService.isConnected()) {
      websocketService.connect().catch((error) => {
        console.error('Failed to connect WebSocket:', error);
      });
    }

    // Subscribe to appointment updates
    const unsubscribe = websocketService.subscribeToAppointments(
      businessId,
      (appointment: Appointment) => {
        // Check if appointment is for today and matches criteria
        const today = todayIn(salonTz);
        const aptDate = format(new Date(appointment.appointmentDate), 'yyyy-MM-dd');
        
        if (aptDate === today) {
          setTodayAppointments((prevAppointments) => {
            // Enrich appointment with service name if missing
            let enrichedAppointment = appointment;
            if (!appointment.serviceName && appointment.serviceId) {
              const service = services.find(s => s.id === appointment.serviceId);
              if (service) {
                enrichedAppointment = { ...appointment, serviceName: service.name };
              }
            }
            
            // Check if appointment matches the unsettled criteria
            // Same rule as filterAndSortUnsettledAppointments above — the two drifting
            // apart is how a live-updated row survives a reload that then drops it.
            const stillOpen = isUnsettled(enrichedAppointment);

            // Find if appointment already exists in the list
            const existingIndex = prevAppointments.findIndex(apt => apt.id === enrichedAppointment.id);

            if (stillOpen) {
              // If it matches criteria, add or update it
              if (existingIndex >= 0) {
                // Update existing appointment
                const updated = [...prevAppointments];
                updated[existingIndex] = enrichedAppointment;
                return filterAndSortUnsettledAppointments(updated, today);
              } else {
                // Add new appointment
                return filterAndSortUnsettledAppointments([...prevAppointments, enrichedAppointment], today);
              }
            } else {
              // If it no longer matches criteria, remove it
              if (existingIndex >= 0) {
                return prevAppointments.filter(apt => apt.id !== enrichedAppointment.id);
              }
            }

            return prevAppointments;
          });
        }
      }
    );

    // Cleanup subscription when category changes or component unmounts
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
    // services: live bookings are enriched from it; subscribed before it loaded, every
    // update was read against an empty list.
  }, [businessId, salonTz, activeCategory, services]);

  // Load categories when services tab is active
  useEffect(() => {
    const loadCategories = async () => {
      if (!businessId || activeCategory !== "services") return;
      
      try {
        setLoadingCategories(true);
        const cats = await categoryService.getCategoriesByBusiness(businessId);
        setCategories(cats);
      } catch (error) {
        console.error('Failed to load categories:', error);
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, [businessId, activeCategory]);

  // Load transactions when TRANSACTIONS tab is active
  useEffect(() => {
    const loadTransactions = async () => {
      if (!businessId || activeTab !== "TRANSACTIONS" || salonTz === null) return;
      
      try {
        setLoadingTransactions(true);
        
        // Calculate date range based on period filter
        let startDate: Date;
        const salonDay = todayIn(salonTz);
        const endDate: Date = dayDate(salonDay);
        
        if (periodFilter === "Today") {
          startDate = dayDate(salonDay);
        } else if (periodFilter === "Days") {
          // Last 7 days
          startDate = dayDate(salonDay, -7);
        } else if (periodFilter === "Months") {
          // Last 30 days
          startDate = dayDate(salonDay, -30);
        } else {
          // Custom: the dates picked in the header.
          startDate = new Date(`${rangeFrom}T00:00:00`);
        }
        const rangeEnd = periodFilter === "Another period" ? new Date(`${rangeTo}T23:59:59`) : endDate;
        
        const sales = await saleService.getSalesByDateRange(businessId, startDate, rangeEnd);
        
        // Convert sales to transactions
        const convertedTransactions: Transaction[] = sales.map((sale) => {
          const saleDate = new Date(sale.saleDate);
          const saleTime = sale.saleTime || '00:00';
          const [hours, minutes] = saleTime.split(':');
          const timeStr = `${hours}:${minutes}`;
          
          // Format date
          const dateStr = format(saleDate, 'd MMM, yyyy');
          
          // Format payment method - for split payments, show cash and card amounts
          let paymentMethodDisplay: string;
          if (sale.paymentMethod === 'SPLIT' && sale.splitCashAmount && sale.splitCardAmount) {
            paymentMethodDisplay = `${tr("common.cash")}: ${sale.splitCashAmount.toFixed(2)} ${currencySymbol()}, ${tr("common.card")}: ${sale.splitCardAmount.toFixed(2)} ${currencySymbol()}`;
          } else {
            const paymentMethodMap: Record<string, string> = {
              get 'CASH'() { return tr("common.cash"); },
              get 'CARD_TERMINAL'() { return tr("common.card"); },
              get 'CHECK'() { return tr("sales.check"); },
              get 'SPLIT'() { return tr("paymentMethod.splitPayment"); },
              get 'MEMBERSHIP'() { return tr("paymentMethod.membership"); },
              get 'GIFT_CARD'() { return tr("paymentMethod.giftCard"); },
              get 'PACKAGE'() { return tr("paymentMethod.package"); },
            };
            paymentMethodDisplay = paymentMethodMap[sale.paymentMethod] || sale.paymentMethod;
          }
          
          return {
            id: sale.id.toString(),
            time: timeStr,
            date: dateStr,
            description: sale.notes || '',
            status: sale.status === 'COMPLETED' ? 'PAID' : sale.status,
            amount: `${sale.total.toFixed(2)} ${currencySymbol()}`,
            paymentMethod: paymentMethodDisplay,
            splitCashAmount: sale.splitCashAmount,
            splitCardAmount: sale.splitCardAmount,
            billNumber: sale.billNumber,
            billId: sale.billId,
            clientName: sale.clientName || tr("sales.walkInClient"),
            address: sale.clientEmail || '',
            items: sale.items.map(item => ({
              name: item.serviceName,
              duration: item.duration,
              quantity: item.quantity,
              price: `${(item.unitPrice * item.quantity).toFixed(2)} ${currencySymbol()}`,
            })),
            staffName: sale.staffName,
            // The tax breakdown is worked out when the receipt is shown (taxFor), from the
            // salon's rate and each service's own override.
            tax: { rate: "", netWorth: "", taxAmount: "", grossValue: "" },
            addition: `${sale.subtotal.toFixed(2)} ${currencySymbol()}`,
            discount: sale.discountAmount > 0 
              ? `${sale.discountAmount.toFixed(2)} ${currencySymbol()}` 
              : sale.discountPercent > 0 
                ? `${sale.discountPercent.toFixed(0)}%`
                : `0.00 ${currencySymbol()}`,
            tip: sale.tipAmount > 0 
              ? `${sale.tipAmount.toFixed(2)} ${currencySymbol()}` 
              : sale.tipPercent > 0 
                ? `${sale.tipPercent.toFixed(0)}%`
                : `0.00 ${currencySymbol()}`,
            total: `${sale.total.toFixed(2)} ${currencySymbol()}`,
            paidDate: format(new Date(`${sale.saleDate}T${saleTime}`), 'dd/MM/yyyy, HH:mm'),
            isoDate: new Date(`${sale.saleDate}T${saleTime}`).toISOString(),
            sale: sale,
          };
        });

        // Sort by date and time (newest first) using ISO string for cross-browser reliability
        convertedTransactions.sort((a, b) => {
          return new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime();
        });
        
        setTransactions(convertedTransactions);
      } catch (error) {
        console.error('Failed to load transactions:', error);
        setTransactions([]);
      } finally {
        setLoadingTransactions(false);
      }
    };

    loadTransactions();
  }, [businessId, salonTz, activeTab, periodFilter, rangeFrom, rangeTo, txReload]);

  // Group services by category and filter by search
  const groupedServices = useMemo(() => {
    if (!services.length) return {};
    
    // Filter services by search query
    const filtered = services.filter(service => {
      if (!serviceSearchQuery) return true;
      const query = serviceSearchQuery.toLowerCase();
      return (
        service.name.toLowerCase().includes(query) ||
        service.categoryName?.toLowerCase().includes(query) ||
        (service.serviceType === 'COMBO' && 'combo'.includes(query))
      );
    });

    // Group by category
    const grouped: Record<string, Service[]> = {};
    const uncategorized: Service[] = [];

    filtered.forEach(service => {
      if (service.categoryName) {
        if (!grouped[service.categoryName]) {
          grouped[service.categoryName] = [];
        }
        grouped[service.categoryName].push(service);
      } else {
        uncategorized.push(service);
      }
    });

    // Add uncategorized if any
    if (uncategorized.length > 0) {
      grouped['Uncategorized'] = uncategorized;
    }

    return grouped;
  }, [services, serviceSearchQuery]);

  // Get available services and combos for quick sale
  const availableItems = useMemo(() => {
    return services
      .filter(s => s.isActive && s.isVisible)
      .map(service => ({
        id: service.id.toString(),
        name: service.name,
        duration: service.durationMinutes 
          ? formatMinutes(service.durationMinutes)
          : 'N/A',
        price: servicePriceLabel(service, offers),
        color: service.color || 'gray',
        type: (service.serviceType === 'COMBO' ? 'combo' : 'service') as 'service' | 'combo',
        serviceId: service.id,
      }));
    // offers: the tile price includes a running offer; without it the price stayed undiscounted
    // when the offers loaded after the services.
  }, [services, offers]);

  // Initialize selected items when opening edit dialog
  useEffect(() => {
    if (showEditDialog) {
      setSelectedQuickSaleItems(quickSaleItems.map(item => item.id));
    }
  }, [showEditDialog, quickSaleItems]);

  // Save quick sale configuration
  const saveQuickSaleConfig = async () => {
    try {
      const serviceIds = [...selectedQuickSaleItems];
      const savedItems = await quickSaleService.updateQuickSaleItems(businessId, serviceIds);
      
      // Convert API items to display format
      const displayItems = savedItems.map(item => {
        const service = services.find(s => s.id === item.serviceId);
        return {
          id: item.serviceId.toString(),
          name: item.serviceName || service?.name || 'Unknown',
          duration: item.durationMinutes 
            ? formatMinutes(item.durationMinutes)
            : 'N/A',
          price: item.price 
            ? `${item.price.toFixed(2)} ${currencySymbol()}`
            : item.priceType === 'FROM' 
              ? `From ${item.price?.toFixed(2) || '0.00'} ${currencySymbol()}`
              : tr("sales.priceOnRequest"),
          color: item.color || 'gray',
          type: (item.serviceType === 'COMBO' ? 'combo' : 'service') as 'service' | 'combo',
          serviceId: item.serviceId,
        };
      });
      
      setQuickSaleItems(displayItems);
      setShowEditDialog(false);
      setIsEditMode(false);
      toast.success(tr("sales.quickSaleItemsUpdatedSuccessfully"));
    } catch (error) {
      toast.error(tr("sales.failedToSaveQuickSale"));
    }
  };

  // Get items to display (use saved quick sale items or fallback to first 6 available)
  const displayItems = useMemo(() => {
    if (quickSaleItems.length > 0) {
      return quickSaleItems;
    }
    // Fallback: show first 6 available items
    return availableItems.slice(0, 6);
  }, [quickSaleItems, availableItems]);

  const addToBasket = (item: QuickSaleItem) => {
    setBasket([...basket, { ...item, basketId: Date.now().toString() }]);
  };

  // Not every line gets a basketId (products, gift cards and a booking brought from the
  // calendar are added with their own id), so one key is used everywhere: removing one of
  // those used to remove all of them, and their checkout coverage was never found.
  const lineKey = (item: { basketId?: string; id?: string }) => item.basketId ?? item.id;
  const removeFromBasket = (basketId: string) => {
    setBasket(basket.filter((item) => lineKey(item) !== basketId));
  };

  const clearBasket = () => {
    setBasket([]);
    setSelectedClient(null);
  };

  const calculateTotal = () => {
    return basket.reduce((sum, item) => {
      const raw = parseFloat(String(item.price ?? "0").replace(/[^0-9.,]/g, "").replace(",", "."));
      const itemPrice = isNaN(raw) ? 0 : raw;
      return sum + itemPrice;
    }, 0);
  };

  const getColorClass = (color: string) => {
    // If color is a hex code, return empty string (we'll use inline style)
    if (color && color.startsWith('#')) {
      return "";
    }
    const colors: Record<string, string> = {
      pink: "border-l-pink-500",
      blue: "border-l-blue-500",
      green: "border-l-green-500",
    };
    return colors[color] || "border-l-gray-500";
  };

  /** Void a paid sale: the server marks it cancelled and reconciles a linked booking's payment. */
  const voidSale = async (t: Transaction) => {
    if (!confirm(tr("sales.voidSaleItStaysIn", { id: t.id, amount: t.amount }))) return;
    setVoiding(true);
    try {
      await saleService.cancelSale(t.id);
      toast.success(tr("sales.saleVoided", { id: t.id }));
      setSelectedTransaction(null);
      setTxReload((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("sales.couldNotVoidTheSale"));
    } finally {
      setVoiding(false);
    }
  };

  /** A visit from today's list onto the ticket: every service, with its client and staff. */
  const checkoutVisit = (members: Appointment[]) => {
    const first = members[0];
    setBasket((prev) => [
      ...prev,
      ...members
        .filter((m) => !prev.some((b) => b.appointmentId === m.id))
        .map((m) => bookingLine(m, services.find((sv) => sv.id === m.serviceId)?.name)),
    ]);
    // The client record, not their name: everything at the till that matters — points,
    // memberships, history — is keyed by id. Walk-ins come back as clientId 0, which is
    // "no record", not client 0.
    setSelectedClient(
      clients.find(
        (c) =>
          (!!first.clientId && c.id === first.clientId) ||
          (first.clientEmail && c.email?.toLowerCase() === first.clientEmail.toLowerCase())
      ) ?? null
    );
    setSelectedAppointmentId(first.id);
    setSelectedAppointmentStaffId(first.staffId || null);
  };

  /** Same item added twice shows as one line with a quantity; each unit stays its own sale line. */
  const ticketLines = (() => {
    const groups: { key: string; items: BasketItem[] }[] = [];
    for (const item of basket) {
      const key = item.appointmentId
        ? `appt-${item.appointmentId}`
        : [item.type, item.serviceId, item.productId, item.membershipId, item.packageId, item.giftCardAmount, item.name, item.price].join("|");
      const g = groups.find((x) => x.key === key);
      if (g) g.items.push(item);
      else groups.push({ key, items: [item] });
    }
    return groups;
  })();
  const priceOf = (item: BasketItem) => {
    const raw = parseFloat(String(item.price ?? "0").replace(/[^0-9.,]/g, "").replace(",", "."));
    return isNaN(raw) ? 0 : raw;
  };
  const ticketStaffId = selectedAppointmentStaffId ?? (staff && staff.length > 0 ? staff[0].id : null);
  const depositOnTicket = (() => {
    return ticketAppts.reduce((sum, a) => sum + (a.depositPaid ? Number(a.depositAmount ?? 0) : 0), 0);
  })();
  const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

  const ticketBody = () => (
    <>
      <div className="flex items-center justify-between px-5 pb-2 pr-14 pt-5 md:pr-5">
        <p className="text-lg font-extrabold tracking-[-0.02em]">{tr("sales.ticket")}</p>
        {basket.length > 0 && (
          <button type="button" onClick={clearBasket} className="text-sm font-semibold text-[rgb(var(--reg-muted))] hover:text-rose-700">
            {tr("sales.clear")}
          </button>
        )}
      </div>

      {/* Client */}
      <div className="px-5 pb-3">
        <button
          type="button"
          onClick={() => setShowClientPicker(true)}
          className="flex w-full items-center gap-3 rounded-2xl bg-[rgb(var(--reg-canvas))] p-3 text-left ring-1 ring-[rgb(var(--reg-line))] transition hover:ring-[rgb(var(--reg-brand)/0.4)]"
        >
          {selectedClient ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--reg-brand-soft))] text-sm font-bold text-[rgb(var(--reg-brand-strong))]">
              {initialsOf(getClientDisplayName(selectedClient))}
            </span>
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[rgb(var(--reg-muted))] ring-1 ring-[rgb(var(--reg-line))]"><User size={18} /></span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{selectedClient ? getClientDisplayName(selectedClient) : tr("common.walkIn")}</span>
            <span className="block truncate text-xs text-[rgb(var(--reg-muted))]">{selectedClient ? selectedClient.phone || selectedClient.email || tr("common.client") : tr("sales.addAClientForPoints")}</span>
          </span>
          {selectedClient ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={tr("sales.removeClient")}
              onClick={(e) => { e.stopPropagation(); setSelectedClient(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setSelectedClient(null); } }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[rgb(var(--reg-muted))] hover:bg-white"
            >
              <X size={15} />
            </span>
          ) : (
            <Plus size={18} className="text-[rgb(var(--reg-muted))]" />
          )}
        </button>
      </div>

      {/* Lines */}
      <div className="min-h-[120px] flex-1 overflow-y-auto border-t border-[rgb(var(--reg-line)/0.7)] px-5 py-3">
        {basket.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center">
            <p className="font-bold">{tr("sales.nothingOnTheTicketYet")}</p>
            <p className="mt-1 text-sm text-[rgb(var(--reg-muted))]">{tr("sales.tapAServiceAnExtra")}</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {ticketLines.map(({ key, items }) => {
              const first = items[0];
              const qty = items.length;
              const unit = priceOf(first);
              const canRepeat = !first.appointmentId;
              return (
                <li key={key} className="flex items-center gap-3 rounded-xl py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{first.name}</p>
                    <p className="text-xs text-[rgb(var(--reg-muted))]">
                      {qty > 1 ? `${qty} × ${unit.toFixed(2)}` : first.duration && first.duration !== "N/A" ? first.duration : first.type === "product" ? tr("sales.product") : first.type === "gift-card" ? tr("paymentMethod.giftCard") : tr("common.service")}
                    </p>
                  </div>
                  <div className="flex items-center rounded-full ring-1 ring-[rgb(var(--reg-line))]">
                    <button
                      type="button"
                      aria-label={qty > 1 ? tr("sales.oneFewer", { name: first.name }) : tr("sales.remove", { name: first.name })}
                      onClick={() => removeFromBasket(lineKey(items[items.length - 1])!)}
                      className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgb(var(--reg-canvas))]"
                    >
                      {qty > 1 ? <Minus size={14} /> : <Trash2 size={14} />}
                    </button>
                    <span className="w-6 text-center text-sm font-bold tabular-nums">{qty}</span>
                    <button
                      type="button"
                      aria-label={tr("sales.oneMore", { name: first.name })}
                      disabled={!canRepeat}
                      onClick={() => setBasket((b) => [...b, { ...first, id: first.id.startsWith("product-") || first.id.startsWith("membership-") || first.id.startsWith("package-") || first.id.startsWith("gift-card-") ? `${first.id}-${Date.now()}` : first.id, basketId: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }])}
                      className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgb(var(--reg-canvas))] disabled:opacity-30"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="w-[72px] text-right text-[15px] font-bold tabular-nums">{(unit * qty).toFixed(2)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Who did it, and a note */}
      {basket.length > 0 && (
        <div className="space-y-3 border-t border-[rgb(var(--reg-line)/0.7)] px-5 py-3">
          {staff.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">{tr("sales.doneBy")}</p>
              <div role="radiogroup" aria-label={tr("sales.doneBy")} className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
                {staff.map((s) => {
                  const on = ticketStaffId === s.id;
                  return (
                    <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => setSelectedAppointmentStaffId(s.id)} className={cn("inline-flex h-9 shrink-0 items-center gap-2 rounded-full pl-1 pr-3 text-sm font-semibold ring-1 ring-inset", on ? "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))] ring-[rgb(var(--reg-brand))]" : "ring-[rgb(var(--reg-line))]")}>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[10px] font-bold ring-1 ring-[rgb(var(--reg-line))]">{initialsOf(s.name)}</span>
                      {s.name.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <input
            aria-label={tr("sales.noteOnThisSale")}
            className="h-10 w-full rounded-[12px] border border-[rgb(var(--reg-line))] bg-white px-3 text-sm"
            placeholder={tr("common.noteOptional")}
            value={ticketNote}
            onChange={(e) => setTicketNote(e.target.value)}
          />
        </div>
      )}

      {/* Totals + charge */}
      <div className="border-t border-[rgb(var(--reg-line)/0.8)] bg-white px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between text-[rgb(var(--reg-muted))]"><dt>{tr("sales.subtotal")}</dt><dd className="tabular-nums">{calculateTotal().toFixed(2)} {currencySymbol()}</dd></div>
          {depositOnTicket > 0 && <div className="flex justify-between text-[rgb(var(--reg-success))]"><dt>{tr("sales.depositAlreadyPaid")}</dt><dd className="tabular-nums">−{depositOnTicket.toFixed(2)}</dd></div>}
          {bookedPromo && <div className="flex justify-between text-[rgb(var(--reg-muted))]"><dt>{tr("sales.promo", { code: bookedPromo.code })}</dt><dd>{tr("sales.appliedAtPayment")}</dd></div>}
          {salonInfo.taxRate > 0 && <div className="flex justify-between text-[rgb(var(--reg-muted))]"><dt>{tr("sales.tax", { taxRate: salonInfo.taxRate })}</dt><dd>{tr("sales.included")}</dd></div>}
        </dl>
        <p className="mt-1 text-xs text-[rgb(var(--reg-muted))]">{tr("sales.discountAndTipOnThe")}</p>
        <button
          type="button"
          disabled={basket.length === 0}
          onClick={() => { setTicketOpen(false); setShowPaymentMethod(true); }}
          className="mt-3 flex h-[52px] w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] text-base font-bold text-white shadow-[0_10px_24px_-8px_rgb(var(--reg-brand-strong)/0.6)] transition hover:brightness-110 disabled:opacity-50"
        >
          {tr("sales.charge", { value: Math.max(0, calculateTotal() - depositOnTicket).toFixed(2), value2: currencySymbol() })}
        </button>
      </div>
    </>
  );

  // Paid: what to hand back, the receipt, and the way to the next client.
  if (lastSale) {
    const methodName: Record<string, string> = { get cash() { return tr("common.cash"); }, get "card-terminal"() { return tr("common.card"); }, get split() { return tr("sales.cashPlusCard"); }, get "gift-card"() { return tr("paymentMethod.giftCard"); }, get package() { return tr("paymentMethod.package"); }, get membership() { return tr("paymentMethod.membership"); } };
    return (
      <AppLayout>
        <div className="flex min-h-full items-start justify-center bg-[rgb(var(--reg-canvas))] px-4 py-8 text-[rgb(var(--reg-ink))] md:items-center" style={{ fontFamily: BRAND_FONT }}>
          <div className="w-full max-w-md text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-mesh-1)),rgb(var(--reg-mesh-2))_55%,rgb(var(--reg-mesh-3)))] animate-in zoom-in-75 duration-500 motion-reduce:animate-none">
              <Check className="h-8 w-8" aria-hidden />
            </span>
            <h1 className="mt-5 text-[28px] font-extrabold tracking-[-0.03em]">{tr("sales.paid", { value: lastSale.total.toFixed(2), value2: currencySymbol() })}</h1>
            <p className="mt-1 text-[rgb(var(--reg-muted))]">{lastSale.tenders.length > 1 ? tr("paymentMethod.splitPayment") : (methodName[lastSale.method] ?? lastSale.method)}{lastSale.client ? ` · ${lastSale.client}` : tr("sales.walkIn")}</p>
            {lastSale.change > 0 && (
              <div className="mx-auto mt-5 inline-flex items-baseline gap-3 rounded-2xl bg-[rgb(var(--reg-canvas))] px-5 py-3 text-[rgb(var(--reg-ink))] ring-1 ring-inset ring-[rgb(var(--reg-line))]">
                <span className="text-sm font-semibold">{tr("sales.changeToGive")}</span>
                <span className="text-2xl font-extrabold tabular-nums">{lastSale.change.toFixed(2)} {currencySymbol()}</span>
              </div>
            )}
            <div id="till-receipt" className="mx-auto mt-6 max-w-[320px] overflow-hidden rounded-xl bg-white text-left font-mono text-[12px] leading-relaxed shadow-[0_8px_20px_-14px_rgb(var(--reg-ink)/0.4)] ring-1 ring-[rgb(var(--reg-line)/0.8)]">
              <div className="h-1.5" style={{ backgroundColor: salonInfo.brandColor || "rgb(var(--reg-brand))" }} aria-hidden />
              <div className="px-5 py-4">
                <p className="text-center text-[13px] font-bold">{(() => { try { return JSON.parse(localStorage.getItem("currentBusiness") || "{}").name || ""; } catch { return ""; } })()}</p>
                <p className="text-center text-[rgb(var(--reg-muted))]">{formatLocaleDate(lastSale.at, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · #{lastSale.saleId}</p>
                <div className="my-2 border-t border-dashed border-[rgb(var(--reg-line))]" />
                {groupReceiptLines(lastSale.lines).map((l, i) => (
                  <p key={i} className="flex justify-between gap-3"><span className="truncate">{l.name}</span><span className="tabular-nums">{l.qty > 1 ? `${l.qty} × ${Number(l.price).toFixed(2)}` : Number(l.price).toFixed(2)}</span></p>
                ))}
                {lastSale.discount > 0 && <p className="flex justify-between"><span>{tr("common.discount")}</span><span className="tabular-nums">−{lastSale.discount.toFixed(2)}</span></p>}
                {lastSale.tip > 0 && <p className="flex justify-between"><span>{tr("sales.tip")}</span><span className="tabular-nums">+{lastSale.tip.toFixed(2)}</span></p>}
                <div className="my-2 border-t border-dashed border-[rgb(var(--reg-line))]" />
                <p className="flex justify-between font-bold"><span>{tr("common.total")}</span><span className="tabular-nums">{lastSale.total.toFixed(2)} {currencySymbol()}</span></p>
                {lastSale.tenders.map((tn, i) => (
                  <p key={i} className="flex justify-between text-[rgb(var(--reg-muted))]"><span>{tn.label}</span><span className="tabular-nums">{tn.amount.toFixed(2)}</span></p>
                ))}
                {salonInfo.receiptFooter.trim() && <p className="mt-3 whitespace-pre-wrap break-words text-center text-[rgb(var(--reg-muted))]">{salonInfo.receiptFooter}</p>}
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <button type="button" onClick={() => window.print()} className="h-[52px] flex-1 rounded-full border border-[rgb(var(--reg-line))] bg-white text-base font-semibold hover:bg-[rgb(var(--reg-canvas))]">
                {tr("sales.printReceipt")}
              </button>
              <button type="button" autoFocus onClick={() => setLastSale(null)} className="h-[52px] flex-[1.4] rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] text-base font-bold text-white shadow-[0_10px_24px_-8px_rgb(var(--reg-brand-strong)/0.6)] hover:brightness-110">
                {tr("sales.newSale")}
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // If payment method page is shown, render it instead
  if (showPaymentMethod) {
    const orderItems = basket.map(item => {
      const raw = parseFloat(String(item.price ?? "0").replace(/[^0-9.,]/g, "").replace(",", "."));
      return {
        id: lineKey(item),
        name: item.name,
        quantity: 1,
        price: isNaN(raw) ? 0 : raw,
        duration: item.duration,
        // POS v3: the quote prices and covers lines by service / product.
        serviceId: item.serviceId,
        productId: item.productId,
      };
    });

    return (
      <Suspense fallback={null}>
        <PaymentMethodPage
          orderItems={orderItems}
          subtotal={calculateTotal()}
          // #117: what the customer already paid up front on this booking. The backend has
          // always subtracted it; the screen did not, so the cashier asked for the full
          // price and the customer paid the deposit twice.
          depositPaid={(() => {
            return ticketAppts.reduce((sum, a) => sum + (a.depositPaid ? Number(a.depositAmount ?? 0) : 0), 0);
          })()}
          bookedPromo={bookedPromo}
          pointsCredit={(() => {
            return ticketAppts.reduce((sum, a) => sum + Number((a as { pointsDiscount?: number }).pointsDiscount ?? 0), 0);
          })()}
          prepaidOnline={(() => {
            return ticketAppts.reduce((sum, a) => sum + Number((a as { prepaidAmount?: number }).prepaidAmount ?? 0), 0);
          })()}
          // The client object, not its name: every benefit at the till — membership,
          // package, points, the stamp card — is keyed by client id, and this was passing
          // the whole record in as a name string.
          selectedClient={
            selectedClient
              ? { id: String(selectedClient.id), name: getClientDisplayName(selectedClient) }
              : null
          }
          selectedStaff={staff?.find(s => s.id === selectedAppointmentStaffId) ?? (staff && staff.length > 0 ? staff[0] : null)}
          // #15: a walk-in sale defaults to the first staff member (harmless with one
          // staff member, silently wrong with several) — staffList + onStaffChange make
          // that default visible and correctable via the checkout screen's "CHANGE"
          // control instead of being locked in with no way to fix it.
          appointmentIds={ticketApptIds.map(String)}
          staffList={staff ?? []}
          onStaffChange={(member) => setSelectedAppointmentStaffId(member.id)}
          onConfirm={async (paymentData) => {
            try {
              // Map payment method from PaymentMethodPage format to backend format
              const paymentMethodMap: Record<string, 'CASH' | 'CARD_TERMINAL' | 'CHECK' | 'SPLIT' | 'MEMBERSHIP' | 'GIFT_CARD' | 'PACKAGE'> = {
                'cash': 'CASH',
                'card-terminal': 'CARD_TERMINAL',
                'check': 'CHECK',
                'split': 'SPLIT',
                'membership': 'MEMBERSHIP',
                'gift-card': 'GIFT_CARD',
                'package': 'PACKAGE',
              };

              // Convert basket items to sale items
              const saleItems = basket.map(item => {
                const rawPrice = parseFloat(String(item.price ?? "0").replace(/[^0-9.,]/g, "").replace(",", "."));
                const price = isNaN(rawPrice) ? 0 : rawPrice;
                return {
                  serviceId: item.serviceId,
                  serviceName: item.name,
                  serviceType:
                    item.type === 'combo'
                      ? 'COMBO'
                      : item.type === 'membership'
                        ? 'MEMBERSHIP'
                        : item.type === 'package'
                        ? 'PACKAGE'
                        : item.type === 'gift-card'
                          ? 'GIFT_CARD'
                          : item.type === 'product'
                            ? 'PRODUCT'
                            : 'SERVICE',
                  // A product line is priced and taken off the shelf by the server.
                  productId: item.productId,
                  quantity: 1,
                  unitPrice: price,
                  duration: item.duration,
                  // Which benefit covers this line, when one does. Set per line so a basket
                  // can mix a service that is free on the membership with one that is paid.
                  // Keyed the way the checkout screen keys it (orderItems use basketId). Looking it
                  // up by item.id found nothing, so a line marked "Free (earned)", a membership or
                  // a package went to the server as a normal paid line: the client was charged
                  // and the reward stayed unspent.
                  coveredBy: paymentData.coverage?.[lineKey(item)],
                  membershipId: item.membershipId,
                  packageId: item.packageId,
                  giftCardAmount: item.giftCardAmount,
                  // Which booking this line is, so the receipt and the commission follow it.
                  appointmentId: item.appointmentId,
                };
              });

              // Calculate subtotal
              const subtotal = calculateTotal();

              // Get selected staff ID — prefer the appointment's staff, fall back to first in list
              const staffId = selectedAppointmentStaffId ?? (staff && staff.length > 0 ? staff[0].id : undefined);

              // Create payment confirmation request
              const confirmationRequest: PaymentConfirmationRequest = {
                businessId: businessId!,
                staffId: staffId,
                clientId: selectedClient ? selectedClient.id : undefined,
                clientName: selectedClient ? getClientDisplayName(selectedClient) : undefined,
                items: saleItems,
                // #31: these were hardcoded to zero, so the recorded sale was always at
                // full price even when the screen showed a discount and the customer paid
                // the discounted total. Backend #34 had to land first — with the discount
                // finally arriving, commissions would otherwise have been paid on gross.
                discountAmount: paymentData.discountAmount,
                discountPercent: paymentData.discountPercent,
                tipAmount: paymentData.tip,
                tipPercent: paymentData.tipPercent,
                paymentMethod: paymentMethodMap[paymentData.paymentMethod] || 'CASH',
                // The tenders, when the checkout screen collected more than one.
                payments: paymentData.payments,
                leaveBalance: paymentData.leaveBalance ? true : undefined,
                paymentAmount: paymentData.amount,
                giftCardCode: paymentData.giftCardCode,
                splitCashAmount: paymentData.splitCashAmount,
                splitCardAmount: paymentData.splitCardAmount,
                // One visit, one sale: every booking on the ticket settles with it.
                appointmentIds: ticketApptIds.length > 0 ? ticketApptIds : undefined,
                appointmentId: ticketApptIds.length > 0 ? undefined : selectedAppointmentId || undefined,
                promoCode: bookedPromo?.code,
                notes: ticketNote.trim() || undefined,
                quoteBillDue: paymentData.quoteBillDue,
              };

              // Confirm payment (creates sale, calculates commissions, updates appointment)
              const response = await paymentConfirmationService.confirmPayment(confirmationRequest);

              // POS v3: the previous debt the client paid with this visit goes on their balance.
              if (paymentData.debtSettle && selectedClient) {
                try {
                  await clientBalanceService.settle(selectedClient.id, {
                    amount: paymentData.debtSettle.amount,
                    method: paymentData.debtSettle.method,
                  });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : String(e));
                }
              }

              // Success
              toast.success(tr("sales.paymentProcessedSuccessfully"));
              const tipValue = Math.round((Number(paymentData.tip) > 0 ? Number(paymentData.tip) : (subtotal * Number(paymentData.tipPercent || 0)) / 100) * 100) / 100;
              setLastSale({
                saleId: response.saleId,
                total: Number(response.totalAmount ?? paymentData.amount),
                change: paymentData.paymentMethod === "cash" && !((paymentData.payments ?? []).length > 0 && (paymentData.payments ?? []).every((p) => p.method === "GIFT_CARD")) ? Math.max(0, paymentData.change) : 0,
                // Paid only with a gift card: say so, not the till default ("cash").
                method: (paymentData.payments ?? []).length > 0 && (paymentData.payments ?? []).every((p) => p.method === "GIFT_CARD") ? "gift-card" : paymentData.paymentMethod,
                client: selectedClient ? getClientDisplayName(selectedClient) : null,
                lines: basket.map((item) => {
                  const raw = parseFloat(String(item.price ?? "0").replace(/[^0-9.,]/g, "").replace(",", "."));
                  return { name: item.name, price: isNaN(raw) ? 0 : raw };
                }),
                // Discount = whatever makes lines + tip add up to the charged total (covers promo codes too).
                discount: Math.max(0, Math.round((subtotal + tipValue - Number(response.totalAmount ?? paymentData.amount)) * 100) / 100),
                tip: tipValue,
                tenders: (() => {
                  const nonCash = (paymentData.payments ?? [])
                    .filter((p) => p.method === "POINTS" || p.method === "GIFT_CARD" || p.method === "WALLET")
                    .map((p) => ({
                      label: p.method === "POINTS" ? tr("pos.bonusPoints", { points: p.points ?? 0 }) : p.method === "GIFT_CARD" ? tr("pos.giftCard", { code: p.giftCardCode ?? "" }) : tr("pos.wallet"),
                      amount: Number(p.amount) || 0,
                    }));
                  // UI2-HUBB-036: the rest of the bill, paid in cash/card, so the split adds up to the total.
                  const rest = Math.round((Number(response.totalAmount ?? paymentData.amount) - nonCash.reduce((a, x) => a + x.amount, 0)) * 100) / 100;
                  if (nonCash.length > 0 && rest > 0.004) {
                    nonCash.push({ label: paymentData.paymentMethod === "card-terminal" ? tr("common.card") : tr("common.cash"), amount: rest });
                  }
                  return nonCash;
                })(),
                at: new Date(),
              });
              // The shelf just changed; show what is left, not what was there before the sale.
              if (businessId) productService.list(businessId).then(setProducts).catch(() => {});
              setShowPaymentMethod(false);
              setBasket([]);
              setSelectedClient(null);
              setSelectedAppointmentId(null);
              setSelectedAppointmentStaffId(null);
              setTicketNote("");
            } catch (error) {
              console.error('Failed to process payment:', error);
              toast.error((error instanceof Error && error.message) || tr("sales.failedToProcessPaymentPlease"));
            }
          }}
          onCancel={() => setShowPaymentMethod(false)}
          onDiscard={() => {
            setShowPaymentMethod(false);
            clearBasket();
            setSelectedAppointmentId(null);
            setSelectedAppointmentStaffId(null);
            setTicketNote("");
          }}
        />
      </Suspense>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-full w-full flex-col bg-[rgb(var(--reg-canvas))] text-[rgb(var(--reg-ink))]" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', fontFamily: BRAND_FONT }}>
        {/* Header: the page name and its two modes. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[rgb(var(--reg-line)/0.8)] bg-[rgb(var(--reg-canvas)/0.92)] px-4 py-4 backdrop-blur-xl md:px-8">
          <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em] md:text-[32px]">{tr("common.till")}</h1>
          <div role="tablist" aria-label={tr("common.till")} className="flex rounded-full bg-[rgb(var(--reg-ink)/0.05)] p-1">
          <button
            role="tab"
            aria-selected={activeTab === "NEW SALES"}
            onClick={() => setActiveTab("NEW SALES")}
            className={`h-9 rounded-full px-4 text-sm font-semibold transition-colors ${
              activeTab === "NEW SALES"
                ? "bg-white shadow-[0_1px_2px_rgb(var(--reg-ink)/0.06),0_4px_12px_-6px_rgb(var(--reg-ink)/0.15)]"
                : "text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]"
            }`}
          >
            {tr("sales.newSale")}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "TRANSACTIONS"}
            onClick={() => setActiveTab("TRANSACTIONS")}
            className={`h-9 rounded-full px-4 text-sm font-semibold transition-colors ${
              activeTab === "TRANSACTIONS"
                ? "bg-white shadow-[0_1px_2px_rgb(var(--reg-ink)/0.06),0_4px_12px_-6px_rgb(var(--reg-ink)/0.15)]"
                : "text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]"
            }`}
          >
            {tr("sales.transactions")}
          </button>
          </div>
          {/* Invoices section disabled */}
          {/* <button
            onClick={() => setActiveTab("INVOICES")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "INVOICES"
                ? "text-foreground border-b-2 border-foreground"
                : "text-muted-foreground hover:text-muted-foreground"
            }`}
          >
            INVOICES
          </button> */}
        </div>

        {/* Main Content Area */}
        {activeTab === "NEW SALES" ? (
          <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
            {/* ── catalogue ── */}
            <div className="min-w-0 flex-1 space-y-5 px-4 pb-40 pt-4 md:overflow-y-auto md:px-6 md:pb-6 md:pt-5">
              {/* Today's bookings still to be paid — the most common sale, so it leads. */}
              {appointmentsSettled && (loadingAppointments || appointmentsError || todayAppointments.length > 0) && (
                <section aria-label={tr("sales.todaySAppointmentsToCheck")}>
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h2 className="text-base font-extrabold">{tr("sales.toCheckOutToday")}</h2>
                    <span className="text-xs text-[rgb(var(--reg-muted))]">{format(new Date(), "EEEE d MMMM")}</span>
                  </div>
                  {loadingAppointments ? (
                    <div className="h-20 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" />
                  ) : appointmentsError ? (
                    // A failed load must not read as "everything is settled".
                    <p className="rounded-[20px] bg-rose-50 p-4 text-sm text-rose-900 ring-1 ring-inset ring-rose-200">
                      {tr("sales.couldNotLoadTodayS")}
                    </p>
                  ) : (
                    <ul className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin] md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-3">
                      {groupIntoVisits(todayAppointments).map(({ key, members }) => {
                        const appointment = members[0];
                        const staffMember = staff.find((s) => s.id === appointment.staffId);
                        const nameOf = (m: Appointment) => m.serviceName || services.find((sv) => sv.id === m.serviceId)?.name || tr("common.service");
                        const paid = members.reduce((sum, m) => sum + (m.depositPaid ? Math.min(Number(m.depositAmount ?? 0), m.price ?? 0) : 0), 0);
                        const total = members.reduce((sum, m) => sum + Number(m.price ?? 0), 0);
                        const hasPrice = members.some((m) => m.price != null);
                        const inTicket = members.every((m) => ticketApptIds.includes(m.id));
                        return (
                          <li key={key} className="w-[260px] shrink-0 md:w-auto">
                            <div className={cn("flex h-full flex-col rounded-[18px] bg-white p-3.5 ring-1 ring-[rgb(var(--reg-line)/0.8)]", inTicket && "ring-2 ring-[rgb(var(--reg-brand))]")}>
                              <div className="flex items-start gap-3">
                                <span className="rounded-xl bg-[rgb(var(--reg-canvas))] px-2.5 py-1.5 text-sm font-extrabold tabular-nums">{appointment.startTime?.slice(0, 5)}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[15px] font-bold">{appointment.clientName || tr("sales.walkInClient")}</p>
                                  <p className="truncate text-sm text-[rgb(var(--reg-muted))]">
                                    {members.map(nameOf).join(" + ")}
                                    {members.length > 1
                                      ? ` · ${tr("sales.visitServices", { count: members.length })}`
                                      : staffMember?.name || appointment.staffName ? ` · ${staffMember?.name || appointment.staffName}` : ""}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-3 flex items-center justify-between gap-2">
                                <span className="min-w-0 text-sm font-extrabold tabular-nums">
                                  {hasPrice ? `${(total - paid).toFixed(2)} ${currencySymbol()}` : "—"}
                                  {/* #117: a deposit already taken, on the row the cashier reads first. */}
                                  {paid > 0 && <span className="block text-[11px] font-semibold text-[rgb(var(--reg-success))]">{tr("sales.depositPaid", { value: paid.toFixed(2) })}</span>}
                                </span>
                                <button
                                  type="button"
                                  disabled={inTicket}
                                  onClick={() => checkoutVisit(members)}
                                  className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full bg-[rgb(var(--reg-ink))] px-3.5 text-sm font-semibold text-white transition hover:bg-[rgb(var(--reg-ink)/0.85)] disabled:bg-[rgb(var(--reg-brand-soft))] disabled:text-[rgb(var(--reg-brand-strong))]"
                                >
                                  {inTicket ? tr("sales.onTheTicket") : tr("sales.checkOut")}
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}

              {!appointmentsSettled ? (
                <div className="space-y-3" aria-busy>
                  <div className="h-12 animate-pulse rounded-full bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" />
                  <div className="h-10 w-3/4 animate-pulse rounded-full bg-[rgb(var(--reg-ink)/0.05)]" />
                  <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => <li key={i} className="h-[107px] animate-pulse rounded-[18px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" />)}
                  </ul>
                </div>
              ) : (
              <section aria-label={tr("sales.catalogue")} className="space-y-3">
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))]" aria-hidden />
                  <input
                    aria-label={tr("sales.searchTheCatalogue")}
                    className="h-11 w-full rounded-[14px] border border-[rgb(var(--reg-line))] bg-white pl-10 pr-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.45)]"
                    placeholder={tr("sales.searchServicesExtrasProducts")}
                    value={serviceSearchQuery}
                    onChange={(e) => { setServiceSearchQuery(e.target.value); setAddonSearchQuery(e.target.value); }}
                  />
                </div>
                <div role="tablist" aria-label={tr("sales.catalogueSections")} className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
                  {sidebarCategories.filter((c) => c.id !== "to-be-settled").map((category) => {
                    const on = activeCategory === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => setActiveCategory(category.id)}
                        className={cn("inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-semibold capitalize", on ? "bg-[rgb(var(--reg-ink))] text-white" : "bg-white text-[rgb(var(--reg-ink)/0.75)] ring-1 ring-inset ring-[rgb(var(--reg-line))]")}
                      >
                        {category.name.toLocaleLowerCase(getLocale())}
                      </button>
                    );
                  })}
                  {activeCategory === "quick-sale" && (
                    <button type="button" onClick={() => setShowEditDialog(true)} className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-[rgb(var(--reg-brand-strong))] hover:bg-[rgb(var(--reg-brand-soft))]">
                      <Edit2 size={14} />{" "}{tr("sales.editQuickSale")}
                    </button>
                  )}
                </div>

                {(() => {
                  const q = serviceSearchQuery.trim().toLowerCase();
                  const tile = (key: string, p: { name: string; meta?: string; price: string; color?: string; badge?: string; disabled?: boolean; onAdd: () => void }) => (
                    <li key={key}>
                      <button
                        type="button"
                        disabled={p.disabled}
                        onClick={p.onAdd}
                        className="group relative flex h-full w-full flex-col overflow-hidden rounded-[18px] bg-white p-3.5 text-left ring-1 ring-[rgb(var(--reg-line)/0.8)] transition hover:-translate-y-0.5 hover:ring-[rgb(var(--reg-brand)/0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.6)] active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
                      >
                        <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: p.color && p.color.startsWith("#") ? p.color : "rgb(var(--reg-brand) / 0.35)" }} aria-hidden />
                        <span className="flex items-start justify-between gap-2">
                          <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{p.name}</span>
                          {p.badge && <span className="shrink-0 rounded-full bg-[rgb(var(--reg-ink)/0.06)] px-2 py-0.5 text-[10px] font-bold uppercase">{p.badge}</span>}
                        </span>
                        {p.meta && <span className="mt-0.5 text-xs text-[rgb(var(--reg-muted))]">{p.meta}</span>}
                        <span className="mt-auto flex items-center justify-between pt-3">
                          {(() => {
                            // Offers come as "32.00 ₼ (was 40.00)": show the old price struck through.
                            const m = p.price.match(/^(.*?)\s*\(was (.*)\)$/);
                            return m ? (
                              <span className="leading-tight">
                                <span className="block text-[15px] font-extrabold tabular-nums text-[#c4294f]">{m[1]}</span>
                                <span className="block text-xs tabular-nums text-[rgb(var(--reg-muted))] line-through">{m[2]}</span>
                              </span>
                            ) : (
                              <span className="text-[15px] font-extrabold tabular-nums">{p.price}</span>
                            );
                          })()}
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))] transition group-hover:bg-[rgb(var(--reg-brand))] group-hover:text-white" aria-hidden>
                            <Plus size={15} />
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                  const grid = (children: React.ReactNode) => <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">{children}</ul>;
                  const empty = (title: string, body: string, action?: React.ReactNode) => (
                    <div className="rounded-[20px] bg-white px-5 py-10 text-center ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                      <p className="font-bold">{title}</p>
                      <p className="mt-1 text-sm text-[rgb(var(--reg-muted))]">{body}</p>
                      {action && <div className="mt-4">{action}</div>}
                    </div>
                  );
                  const loadingBox = grid([0, 1, 2, 3].map((i) => <li key={i} className="h-[107px] animate-pulse rounded-[18px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy />));

                  if (activeCategory === "quick-sale") {
                    if (servicesLoading) return loadingBox;
                    const items = displayItems.filter((i) => !q || i.name.toLowerCase().includes(q));
                    if (displayItems.length === 0)
                      return empty(tr("sales.noQuickSaleItemsYet"), tr("sales.pickTheServicesYouSell"), (
                        <button type="button" onClick={() => setShowEditDialog(true)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[rgb(var(--reg-ink))] px-4 text-sm font-semibold text-white"><Edit2 size={14} />{" "}{tr("sales.setUpQuickSale")}</button>
                      ));
                    return grid(items.map((item) => tile(item.id, { name: item.name, meta: item.duration, price: item.price, color: item.color, badge: item.type === "combo" ? tr("common.combo") : undefined, onAdd: () => addToBasket(item) })));
                  }
                  if (activeCategory === "services") {
                    if (servicesLoading || loadingCategories) return loadingBox;
                    const groups = Object.entries(groupedServices);
                    if (groups.length === 0) return empty(serviceSearchQuery ? tr("sales.noServicesFound") : tr("common.noServicesYet"), serviceSearchQuery ? tr("sales.tryADifferentSearch") : tr("sales.createServicesInTheCatalogue"));
                    return (
                      <div className="space-y-5">
                        {groups.map(([categoryName, categoryServices]) => {
                          const list = categoryServices.filter((s) => s.isActive && s.isVisible);
                          if (!list.length) return null;
                          return (
                            <div key={categoryName}>
                              <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted))]">{categoryName}</h3>
                              {grid(list.map((service) => {
                                const serviceItem: QuickSaleItem = {
                                  id: service.id.toString(),
                                  name: service.name,
                                  duration: service.durationMinutes
                                    ? formatMinutes(service.durationMinutes)
                                    : "N/A",
                                  price: servicePriceLabel(service, offers),
                                  color: service.color || "gray",
                                  type: (service.serviceType === "COMBO" ? "combo" : "service") as "service" | "combo",
                                  serviceId: service.id,
                                };
                                return tile(String(service.id), { name: service.name, meta: serviceItem.duration, price: serviceItem.price, color: service.color, badge: service.serviceType === "COMBO" ? tr("common.combo") : undefined, onAdd: () => addToBasket(serviceItem) });
                              }))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  }
                  if (activeCategory === "extras") {
                    if (addonsLoading) return loadingBox;
                    const list = addons.filter((addon) => !q || addon.name.toLowerCase().includes(q) || addon.description?.toLowerCase().includes(q));
                    if (list.length === 0) return empty(q ? tr("sales.noExtrasFound") : tr("sales.noExtrasYet"), q ? tr("sales.tryADifferentSearch") : tr("sales.addOnsYouCreateIn"));
                    return grid(list.map((addon) => {
                      const addonItem: QuickSaleItem = {
                        id: addon.id.toString(),
                        name: addon.name,
                        duration: "N/A",
                        price: addon.price
                          ? `${addon.price.toFixed(2)} ${currencySymbol()}`
                          : addon.priceType === "FROM"
                            ? `From ${addon.price?.toFixed(2) || "0.00"} ${currencySymbol()}`
                            : tr("sales.priceOnRequest"),
                        color: addon.color || "gray",
                        type: "service",
                        serviceId: addon.id,
                      };
                      return tile(`addon-${addon.id}`, { name: addon.name, meta: addon.description, price: addonItem.price, color: addon.color, badge: tr("sales.extra"), onAdd: () => addToBasket(addonItem) });
                    }));
                  }
                  if (activeCategory === "memberships") {
                    if (sellableMemberships.length === 0) return empty(tr("sales.noMembershipsForSale"), tr("sales.membershipPlansAppearHereOnce"));
                    return grid(sellableMemberships.map((plan) =>
                      tile(`m-${plan.id}`, {
                        name: plan.name,
                        meta: `every ${plan.billing_period_months === 1 ? "month" : `${plan.billing_period_months} months`}`,
                        price: `${plan.price} ${currencySymbol()}`,
                        onAdd: () =>
                          setBasket((b) => [...b, { id: `membership-${plan.id}-${Date.now()}`, name: plan.name, price: String(plan.price), type: "membership", membershipId: plan.id }]),
                      }),
                    ));
                  }
                  if (activeCategory === "packages") {
                    if (sellablePackages.length === 0) return empty(tr("passes.noPackagesForSale"), tr("passes.packagesAppearHere"));
                    return grid(sellablePackages.map((pack) =>
                      tile(`pk-${pack.id}`, {
                        name: pack.name,
                        meta: tr("passes.sessionsCount", { n: pack.sessions_total }),
                        price: `${Number(pack.price).toFixed(2)} ${currencySymbol()}`,
                        onAdd: () =>
                          setBasket((b) => [...b, { id: `package-${pack.id}-${Date.now()}`, name: pack.name, price: String(pack.price), type: "package", packageId: pack.id }]),
                      }),
                    ));
                  }
                  if (activeCategory === "products") {
                    const list = products.filter((p) => !q || p.name.toLowerCase().includes(q));
                    if (products.length === 0) return empty(tr("sales.noProductsYet"), tr("sales.addThemUnderCatalogueInventory"));
                    return grid(list.map((p) => {
                      const out = p.quantityOnHand <= 0;
                      return tile(`p-${p.id}`, {
                        name: p.name,
                        meta: out ? tr("sales.outOfStock") : tr("sales.inStock", { count: p.quantityOnHand }),
                        price: `${Number(p.price).toFixed(2)} ${currencySymbol()}`,
                        badge: p.lowStock && !out ? tr("sales.low") : undefined,
                        disabled: out,
                        onAdd: () => setBasket((b) => [...b, { id: `product-${p.id}-${Date.now()}`, name: p.name, price: String(p.price), type: "product", productId: p.id }]),
                      });
                    }));
                  }
                  if (activeCategory === "gift-cards") {
                    return (
                      <div className="max-w-md rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                        <p className="font-bold">{tr("sales.sellAGiftCard")}</p>
                        <p className="mt-0.5 text-sm text-[rgb(var(--reg-muted))]">{tr("sales.issuedToTheClientOn")}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {[50, 100, 200, 500].map((preset) => (
                            <button key={preset} type="button" onClick={() => setGiftCardAmount(String(preset))} className={cn("h-10 rounded-full px-4 text-sm font-semibold ring-1 ring-inset", giftCardAmount === String(preset) ? "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))] ring-[rgb(var(--reg-brand))]" : "ring-[rgb(var(--reg-line))]")}>
                              {preset} {currencySymbol()}
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <input aria-label={tr("sales.giftCardAmount", { value: currencySymbol() })} type="number" min={1} value={giftCardAmount} onChange={(e) => setGiftCardAmount(e.target.value)} className="h-11 w-36 rounded-[14px] border border-[rgb(var(--reg-line))] px-4 text-base" />
                          <button
                            type="button"
                            onClick={() => {
                              const amount = parseFloat(giftCardAmount) || 0;
                              if (amount <= 0) return;
                              setBasket((b) => [...b, { id: `gift-card-${Date.now()}`, name: `${tr("paymentMethod.giftCard")} ${amount} ${currencySymbol()}`, price: String(amount), type: "gift-card", giftCardAmount: amount }]);
                            }}
                            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[rgb(var(--reg-ink))] px-5 text-sm font-semibold text-white"
                          >
                            <Plus size={15} />{" "}{tr("sales.addToTicket")}
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </section>
              )}
            </div>

            {/* ── ticket: a column on desktop, a sheet behind a summary bar on a phone ── */}
            <aside className="hidden w-[400px] shrink-0 p-5 pl-0 md:flex md:flex-col">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_1px_2px_rgb(var(--reg-ink)/0.04),0_12px_32px_-16px_rgb(var(--reg-ink)/0.2)] ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                {ticketBody()}
              </div>
            </aside>
            <div className="fixed inset-x-3 bottom-[calc(88px+env(safe-area-inset-bottom))] z-20 md:hidden">
              <button
                type="button"
                onClick={() => setTicketOpen(true)}
                className="flex w-full items-center gap-3 rounded-full bg-[rgb(var(--reg-ink))] py-2 pl-4 pr-2 text-left text-white shadow-[0_12px_28px_-10px_rgb(var(--reg-ink)/0.6)]"
              >
                <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white/15 px-2 text-sm font-bold tabular-nums">{basket.length}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{selectedClient ? getClientDisplayName(selectedClient) : basket.length ? tr("sales.viewTicket") : tr("sales.ticketIsEmpty")}</span>
                <span className="rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] px-4 py-2 text-sm font-bold tabular-nums">
                  {calculateTotal().toFixed(2)} {currencySymbol()}
                </span>
              </button>
            </div>
            <Sheet open={ticketOpen} onOpenChange={setTicketOpen}>
              <SheetContent side="bottom" className="flex h-[92dvh] flex-col rounded-t-[24px] border-0 bg-white p-0 md:hidden" style={{ fontFamily: BRAND_FONT }}>
                <SheetTitle className="sr-only">{tr("sales.ticket")}</SheetTitle>
                {ticketBody()}
              </SheetContent>
            </Sheet>
                <Dialog open={showClientPicker} onOpenChange={setShowClientPicker}>
                  <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{tr("sales.selectClient")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <input
                          type="text"
                          placeholder={tr("sales.searchByNamePhoneOr")}
                          value={searchQueryClient}
                          onChange={(e) => setSearchQueryClient(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                          autoFocus
                        />
                      </div>
                      {/* Client list */}
                      {loadingClients ? (
                        <div className="flex items-center justify-center py-6">
                          <p className="text-sm text-muted-foreground">{tr("sales.loadingClients")}</p>
                        </div>
                      ) : filteredClients.length === 0 ? (
                        <div className="text-center py-6">
                          <p className="text-sm text-muted-foreground">
                            {searchQueryClient ? tr("sales.noClientsMatchYourSearch") : tr("sales.noClientsYetCreateOne")}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1 max-h-80 overflow-y-auto">
                          {filteredClients.map((client) => (
                            <button
                              key={client.id}
                              type="button"
                              onClick={() => {
                                setSelectedClient(client);
                                setShowClientPicker(false);
                              }}
                              className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                                selectedClient?.id === client.id
                                  ? "border-accent bg-accent/5"
                                  : "border-border hover:border-border hover:bg-muted"
                              }`}
                            >
                              {/* Avatar placeholder */}
                              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <User className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {getClientDisplayName(client)}
                                </p>
                                <div className="flex gap-3 mt-0.5">
                                  {client.email && <span className="text-xs text-muted-foreground truncate">{client.email}</span>}
                                  {client.phone && <span className="text-xs text-muted-foreground truncate">{client.phone}</span>}
                                </div>
                              </div>
                              {selectedClient?.id === client.id && (
                                <div className="shrink-0 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                                  <Check className="h-3 w-3 text-white" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
          </div>
        ) : activeTab === "TRANSACTIONS" ? (
          <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-28 pt-4 md:px-8 md:pb-8 md:pt-5">
            {/* Range, search, filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label={tr("common.period")} className="inline-flex rounded-full bg-[rgb(var(--reg-ink)/0.05)] p-1">
                {[
                  ["Today", tr("common.today")],
                  ["Days", tr("sales.period7")],
                  ["Months", tr("sales.period30")],
                  ["Another period", tr("sales.periodCustom")],
                ].map(([v, label]) => (
                  <button key={v} type="button" role="tab" aria-selected={periodFilter === v} onClick={() => setPeriodFilter(v)} className={cn("h-9 rounded-full px-3.5 text-sm font-semibold", periodFilter === v ? "bg-white shadow-[0_1px_2px_rgb(var(--reg-ink)/0.08)]" : "text-[rgb(var(--reg-muted))]")}>
                    {label}
                  </button>
                ))}
              </div>
              {periodFilter === "Another period" && (
                <div className="flex items-center gap-1.5">
                  <input aria-label={tr("common.fromDate")} type="date" value={rangeFrom} max={rangeTo} onChange={(e) => setRangeFrom(e.target.value)} className="h-10 rounded-[12px] border border-[rgb(var(--reg-line))] bg-white px-3 text-sm" />
                  <span className="text-[rgb(var(--reg-muted))]">–</span>
                  <input aria-label={tr("sales.to")} type="date" value={rangeTo} min={rangeFrom} onChange={(e) => setRangeTo(e.target.value)} className="h-10 rounded-[12px] border border-[rgb(var(--reg-line))] bg-white px-3 text-sm" />
                </div>
              )}
              <div className="relative min-w-[200px] flex-1">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))]" aria-hidden />
                <input aria-label={tr("sales.searchTransactions")} placeholder={tr("sales.clientStaffOrSale")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-10 w-full rounded-[12px] border border-[rgb(var(--reg-line))] bg-white pl-10 pr-3 text-sm" />
              </div>
              {[
                { label: tr("sales.method"), value: methodFilter, set: setMethodFilter, options: methodOptions },
                { label: tr("common.staff"), value: staffFilter, set: setStaffFilter, options: staffOptions },
                { label: tr("sales.status"), value: statusFilter, set: setStatusFilter, options: ["All", "PAID", "CANCELLED", "REFUNDED"] }, // i18n-ignore: filter values, labels go through tOpt
              ].map((f) => (
                <select key={f.label} aria-label={f.label} value={f.value} onChange={(e) => f.set(e.target.value)} className="h-10 rounded-[12px] border border-[rgb(var(--reg-line))] bg-white px-3 text-sm font-semibold">
                  {f.options.map((o) => (
                    <option key={o} value={o}>{o === "All" ? tr("sales.filterAll", { label: f.label }) : tOpt("payStatus", o.charAt(0) + o.slice(1).toLowerCase())}</option>
                  ))}
                </select>
              ))}
            </div>

            {(() => {
              const shown = visibleTransactions.filter((t) => statusFilter === "All" || t.status === statusFilter);
              const paid = shown.filter((t) => t.status === "PAID");
              const revenue = paid.reduce((n, t) => n + Number(t.sale.total || 0), 0);
              const undone = shown.filter((t) => t.status === "CANCELLED" || t.status === "REFUNDED").length;
              const chip = (status: string) =>
                status === "PAID" ? <StatusChip status="active" label={tr("common.paid")} /> : status === "CANCELLED" ? <StatusChip status="ended" label={tr("sales.voided")} /> : status === "REFUNDED" ? <StatusChip status="failed" label={tr("sales.refunded")} /> : <StatusChip status="draft" label={status.charAt(0) + status.slice(1).toLowerCase()} />;
              const methodChip = (m: string) => (
                <span className="inline-flex max-w-[160px] truncate rounded-full bg-[rgb(var(--reg-ink)/0.05)] px-2.5 py-1 text-xs font-semibold">{m}</span>
              );
              const itemsSummary = (t: Transaction) => (t.items.length ? t.items.map((i) => (i.quantity > 1 ? `${i.quantity}× ${i.name}` : i.name)).join(", ") : t.description || "—");
              return (
                <>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard icon={Receipt} label={tr("common.sales")} value={paid.length} hint={tr("sales.inRange", { count: shown.length })} tone="violet" />
                    <StatCard icon={CreditCard} label={tr("common.revenue")} value={`${revenue.toFixed(2)} ${currencySymbol()}`} hint={tr("sales.paidSales")} tone="emerald" />
                    <StatCard icon={User} label={tr("sales.averageTicket")} value={paid.length ? `${(revenue / paid.length).toFixed(2)} ${currencySymbol()}` : "—"} tone="sky" />
                    <StatCard icon={XIcon} label={tr("sales.voidedRefunded")} value={undone} tone={undone ? "rose" : "slate"} />
                  </div>

                  {loadingTransactions ? (
                    <div className="h-64 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy />
                  ) : shown.length === 0 ? (
                    <div className="rounded-[20px] bg-white px-6 py-14 text-center ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                      <p className="text-lg font-extrabold">{tr("sales.noSalesHere")}</p>
                      <p className="mt-1 text-sm text-[rgb(var(--reg-muted))]">{transactions.length ? tr("sales.nothingMatchesTheseFilters") : tr("sales.salesYouTakeAtThe")}</p>
                      {!transactions.length && <button type="button" onClick={() => setActiveTab("NEW SALES")} className="mt-4 inline-flex h-10 items-center rounded-full bg-[rgb(var(--reg-ink))] px-5 text-sm font-semibold text-white">{tr("sales.newSale")}</button>}
                    </div>
                  ) : (
                    <>
                      <div className="hidden overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)] md:block">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[rgb(var(--reg-line)/0.8)] text-left text-xs uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">
                              {/* i18n-ignore: column ids, labels go through tOpt */ ["When", "Client", "Items", "Staff", "Method", "Total", "Status"].map((h) => (
                                <th key={h} scope="col" className={cn("px-4 py-3 font-bold", h === "Total" && "text-right")}>{tOpt("salesCols", h)}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {shown.map((t) => (
                              <tr key={t.id} onClick={() => setSelectedTransaction(t)} className="cursor-pointer border-t border-[rgb(var(--reg-line)/0.5)] transition hover:bg-[rgb(var(--reg-canvas)/0.7)]">
                                <td className="whitespace-nowrap px-4 py-3"><span className="font-semibold tabular-nums">{t.time}</span><span className="block text-xs text-[rgb(var(--reg-muted))]">{t.date}</span></td>
                                <td className="max-w-[180px] truncate px-4 py-3 font-semibold">
                                  <button type="button" className="text-left hover:underline" onClick={(e) => { e.stopPropagation(); setSelectedTransaction(t); }}>{t.clientName}</button>
                                </td>
                                <td className="max-w-[260px] truncate px-4 py-3 text-[rgb(var(--reg-ink)/0.8)]">{itemsSummary(t)}</td>
                                <td className="px-4 py-3">{t.staffName || "—"}</td>
                                <td className="px-4 py-3">{methodChip(t.paymentMethod)}</td>
                                <td className={cn("px-4 py-3 text-right font-extrabold tabular-nums", t.status !== "PAID" && "text-[rgb(var(--reg-muted))] line-through")}>{t.amount}</td>
                                <td className="px-4 py-3">{chip(t.status)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <ul className="space-y-2 md:hidden">
                        {shown.map((t) => (
                          <li key={t.id}>
                            <button type="button" onClick={() => setSelectedTransaction(t)} className="flex w-full items-start gap-3 rounded-2xl bg-white p-3.5 text-left ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                              <span className="rounded-xl bg-[rgb(var(--reg-canvas))] px-2 py-1 text-sm font-bold tabular-nums">{t.time}</span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-semibold">{t.clientName}</span>
                                <span className="block truncate text-sm text-[rgb(var(--reg-muted))]">{itemsSummary(t)}</span>
                                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">{methodChip(t.paymentMethod)}{chip(t.status)}</span>
                              </span>
                              <span className={cn("shrink-0 font-extrabold tabular-nums", t.status !== "PAID" && "text-[rgb(var(--reg-muted))] line-through")}>{t.amount}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              );
            })()}

            <FormSheet
              open={!!selectedTransaction}
              onOpenChange={(o) => !o && setSelectedTransaction(null)}
              title={selectedTransaction ? tr("sales.sale", { id: selectedTransaction.id }) : tr("sales.sale2")}
              description={selectedTransaction ? `${selectedTransaction.paidDate}${selectedTransaction.billNumber ? tr("sales.bill", { billNumber: selectedTransaction.billNumber }) : ""}` : undefined}
              footer={
                selectedTransaction ? (
                  <>
                    <Button variant="outline" className="h-[52px] flex-1 rounded-full border-[rgb(var(--reg-line))] text-base font-semibold" onClick={() => window.print()}>
                      {tr("sales.printReceipt")}
                    </Button>
                    {selectedTransaction.status === "PAID" && canRefund && (
                      <Button
                        variant="outline"
                        className="h-[52px] flex-1 rounded-full border-[rgb(var(--reg-line))] text-base font-semibold"
                        onClick={() => setRefundSale(selectedTransaction.sale)}
                      >
                        {tr("sales.saleRefund.open")}
                      </Button>
                    )}
                    {selectedTransaction.status === "PAID" && (
                      <Button
                        variant="outline"
                        disabled={voiding}
                        className="h-[52px] flex-1 rounded-full border-rose-200 text-base font-semibold text-rose-700 hover:bg-rose-50"
                        onClick={() => void voidSale(selectedTransaction)}
                      >
                        {voiding ? tr("sales.voiding") : tr("sales.voidSale")}
                      </Button>
                    )}
                  </>
                ) : undefined
              }
            >
              {selectedTransaction && (() => {
                const t = selectedTransaction;
                const tax = receiptTax(t.sale, salonInfo.taxRate, services);
                // UI2-HUBB-036: how the bill was settled, from the sale's own payments[].
                const payBreakdown = (refundInfo?.payments ?? t.sale.payments ?? [])
                  .filter((p) => Number(p.amount) > 0)
                  .map((p) => ({
                    cashLike: p.method !== "POINTS" && p.method !== "GIFT_CARD" && p.method !== "WALLET",
                    amount: Number(p.amount),
                    label: p.method === "POINTS" ? (p.reference ? tr("pos.bonusPoints", { points: String(p.reference).replace(/\D/g, "") || p.reference }) : tr("pos.bonusLine")) : p.method === "GIFT_CARD" ? tr("pos.giftCard", { code: p.reference ?? "" }) : p.method === "WALLET" ? tr("pos.wallet") : p.method.startsWith("CARD") ? tr("common.card") : tr("common.cash"),
                  }));
                return (
                  <>
                    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]"><User size={18} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{t.clientName}</p>
                        <p className="truncate text-sm text-[rgb(var(--reg-muted))]">{[t.staffName ? tr("sales.doneByValue", { value: t.staffName }) : null, t.address || null].filter(Boolean).join(" · ") || "—"}</p>
                      </div>
                      {partlyRefunded ? <StatusChip status="failed" label={tr("sales.partiallyRefunded")} /> : saleStatusChip(t.status)}
                    </div>
                    {partlyRefunded && refundedLabel && <p className="-mt-2 px-1 text-sm font-semibold text-rose-700">{tr("sales.partiallyRefunded")} · {refundedLabel}</p>}

                    <section className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted))]">{tr("sales.items")}</h3>
                      <ul className="space-y-1.5 text-sm">
                        {groupReceiptLines(t.items.flatMap((it) => Array.from({ length: Math.max(1, it.quantity) }, () => ({ name: it.name, price: (parseFloat(it.price) / Math.max(1, it.quantity)).toFixed(2) })))).map((l, i) => (
                          <li key={i} className="flex justify-between gap-3"><span className="min-w-0 truncate">{l.name}</span><span className="shrink-0 tabular-nums">{l.qty > 1 ? `${l.qty} × ${l.price}` : l.price} {currencySymbol()}</span></li>
                        ))}
                      </ul>
                      <dl className="mt-3 space-y-1 border-t border-[rgb(var(--reg-line)/0.6)] pt-3 text-sm">
                        <div className="flex justify-between text-[rgb(var(--reg-muted))]"><dt>{tr("sales.subtotal")}</dt><dd className="tabular-nums">{t.addition}</dd></div>
                        <div className="flex justify-between text-[rgb(var(--reg-muted))]"><dt>{tr("common.discount")}</dt><dd className="tabular-nums">{t.discount}</dd></div>
                        <div className="flex justify-between text-[rgb(var(--reg-muted))]"><dt>{tr("sales.tip")}</dt><dd className="tabular-nums">{t.tip}</dd></div>
                        {tax && <div className="flex justify-between text-[rgb(var(--reg-muted))]"><dt>{tr("sales.taxIncl", { rate: tax.rate })}</dt><dd className="tabular-nums">{tax.tax.toFixed(2)}</dd></div>}
                        <div className="flex justify-between pt-1 text-base font-extrabold"><dt>{tr("common.total")}</dt><dd className="tabular-nums">{t.total}</dd></div>
                      </dl>
                    </section>

                    <section className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                      <h3 className="mb-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted))]">{tr("sales.payment")}</h3>
                      {payBreakdown.length > 1 ? (
                        <ul className="space-y-1 text-sm">
                          {payBreakdown.map((p, i) => (
                            <li key={i} className="flex justify-between"><span>{p.label}</span><span className="tabular-nums">{p.amount.toFixed(2)} {currencySymbol()}</span></li>
                          ))}
                        </ul>
                      ) : t.splitCashAmount && t.splitCardAmount ? (
                        <ul className="space-y-1 text-sm">
                          <li className="flex justify-between"><span>{tr("common.cash")}</span><span className="tabular-nums">{t.splitCashAmount.toFixed(2)} {currencySymbol()}</span></li>
                          <li className="flex justify-between"><span>{tr("common.card")}</span><span className="tabular-nums">{t.splitCardAmount.toFixed(2)} {currencySymbol()}</span></li>
                        </ul>
                      ) : (
                        <p className="flex justify-between text-sm"><span>{t.paymentMethod}</span><span className="tabular-nums">{t.amount}</span></p>
                      )}
                      {Number(t.sale.changeAmount) > 0 && <p className="mt-1 flex justify-between text-sm text-[rgb(var(--reg-muted))]"><span>{tr("sales.changeGiven")}</span><span className="tabular-nums">{Number(t.sale.changeAmount).toFixed(2)}</span></p>}
                    </section>

                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted))]">{tr("sales.receipt")}</p>
                      <div className="mx-auto max-w-[320px] overflow-hidden rounded-xl bg-white font-mono text-[12px] leading-relaxed shadow-[0_8px_20px_-14px_rgb(var(--reg-ink)/0.4)] ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                        <div className="h-1.5" style={{ backgroundColor: salonInfo.brandColor || "rgb(var(--reg-brand))" }} aria-hidden />
                        <div className="px-5 py-4">
                          <p className="text-center text-[rgb(var(--reg-muted))]">{t.paidDate} · #{t.id}</p>
                          <div className="my-2 border-t border-dashed border-[rgb(var(--reg-line))]" />
                          {groupReceiptLines(t.items.map((it) => ({ name: it.name, price: it.price }))).map((l, i) => <p key={i} className="flex justify-between gap-3"><span className="truncate">{l.name}</span><span>{l.qty > 1 ? `${l.qty} × ${l.price}` : l.price}</span></p>)}
                          <div className="my-2 border-t border-dashed border-[rgb(var(--reg-line))]" />
                          <p className="flex justify-between font-bold"><span>{tr("common.total")}</span><span>{t.total}</span></p>
                          {/* UI2-HUBB-036: bonus points / gift card / balance that paid part of the bill. */}
                          {(refundInfo?.payments ?? []).filter((p) => ["POINTS", "GIFT_CARD", "WALLET"].includes(p.method) && Number(p.amount) > 0).map((p, i) => (
                            <p key={`tn${i}`} className="flex justify-between text-[rgb(var(--reg-muted))]"><span>{p.method === "POINTS" ? (p.reference ? tr("pos.bonusPoints", { points: String(p.reference).replace(/\D/g, "") || p.reference }) : tr("pos.bonusLine")) : p.method === "GIFT_CARD" ? tr("pos.giftCard", { code: p.reference ?? "" }) : tr("pos.wallet")}</span><span>{Number(p.amount).toFixed(2)}</span></p>
                          ))}
                          {payBreakdown.length > 1 && payBreakdown.filter((p) => p.cashLike).map((p, i) => (
                            <p key={`cl${i}`} className="flex justify-between text-[rgb(var(--reg-muted))]"><span>{p.label}</span><span>{p.amount.toFixed(2)}</span></p>
                          ))}
                          {t.status === "REFUNDED" && <p className="flex justify-between text-rose-700"><span>{tr("sales.refunded")}</span><span>−{t.total}</span></p>}
                          {partlyRefunded && refundInfo?.refundedAmount ? <p className="flex justify-between text-rose-700"><span>{tr("sales.partiallyRefunded")}</span><span>−{Number(refundInfo.refundedAmount).toFixed(2)}</span></p> : null}
                          {salonInfo.receiptFooter.trim() && <p className="mt-3 whitespace-pre-wrap break-words text-center text-[rgb(var(--reg-muted))]">{salonInfo.receiptFooter}</p>}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </FormSheet>
          </div>
        ) : null}
        {refundSale && (
          <SaleRefundDialog
            open
            onOpenChange={(o) => { if (!o) setRefundSale(null); }}
            sale={refundSale}
            onRefunded={() => {
              setRefundSale(null);
              setSelectedTransaction(null);
              setTxReload((n) => n + 1);
            }}
          />
        )}

        {/* Edit Quick Sale Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{tr("sales.editQuickSaleItems")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                {tr("sales.selectServicesAndCombosTo")}
              </p>
              
              {servicesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">{tr("sales.loadingServices")}</p>
                </div>
              ) : availableItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-foreground font-medium mb-2">{tr("sales.noServicesAvailable")}</p>
                  <p className="text-sm text-muted-foreground">
                    {tr("sales.createServicesAndCombosFirst")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {availableItems.map((item) => (
                    <div
                      key={item.id}
                      className={`
                        flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors
                        ${selectedQuickSaleItems.includes(item.id)
                          ? 'border-foreground bg-muted'
                          : 'border-border hover:border-border'
                        }
                      `}
                      onClick={() => {
                        setSelectedQuickSaleItems(prev => 
                          prev.includes(item.id)
                            ? prev.filter(id => id !== item.id)
                            : [...prev, item.id]
                        );
                      }}
                    >
                      <Checkbox
                        checked={selectedQuickSaleItems.includes(item.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedQuickSaleItems(prev => [...prev, item.id]);
                          } else {
                            setSelectedQuickSaleItems(prev => prev.filter(id => id !== item.id));
                          }
                        }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-foreground">{item.name}</h4>
                          {item.type === 'combo' && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                              {tr("sales.combo")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <p className="text-sm text-muted-foreground">{item.duration}</p>
                          <p className="text-sm font-medium text-foreground">{item.price}</p>
                        </div>
                      </div>
                      <div 
                        className={`w-4 h-4 rounded border-l-4 ${getColorClass(item.color)}`}
                        style={{ borderLeftColor: item.color !== 'gray' ? undefined : '#6b7280' }}
                      />
                </div>
              ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setSelectedQuickSaleItems(quickSaleItems.map(item => item.id));
                  }}
                >
                  {tr("common.cancel")}
                </Button>
                <Button
                  onClick={saveQuickSaleConfig}
                  disabled={selectedQuickSaleItems.length === 0}
                  className="bg-foreground hover:bg-foreground/90"
                >
                  <Save size={16} className="mr-2" />
                  {tr("sales.saveChanges")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
