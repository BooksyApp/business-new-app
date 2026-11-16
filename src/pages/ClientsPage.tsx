import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { salonToday } from "@/lib/salonClock";
import { useSalonTimeZone } from "@/hooks/useSalonTimeZone";
import { clientColorClasses } from "@/lib/appointmentVisuals";
import { currencySymbol } from "@/lib/currency";
import type { ClientAppointmentRow } from "@/services/clientService";
import { EmptyState, StatCard } from "@/components/ui/stat-card";
import { CalendarCheck, Coins, Star, UserPlus, Users } from "lucide-react";
import { loyaltyService } from "@/services/growthService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, MoreHorizontal, Phone, Mail, TrendingUp, User, Loader2, Send, Clock, CheckCircle, XCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { primaryBtn } from "@/components/page/booqiStyles";
import { appointmentStatusStyle } from "@/lib/appointmentStatus";
import { BRAND_FONT, useBrandFont } from "@/components/auth/useBrandFont";
import "@/components/auth/auth-tokens.css";
import { appointmentService } from "@/services/appointmentService";
import { clientService, ClientWithStats, invitationService, Invitation } from "@/services/clientService";
import { useBusinessId } from "@/hooks/useBusinessId";
import { format } from "@/i18n/dateFns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tillBenefitsService, type ClientBenefits } from "@/services/tillBenefitsService";
import { salonDayService, type ClientRecord, type NoteKind } from "@/services/salonDayService";
import { useServices } from "@/hooks/useServices";
import { useStaff } from "@/hooks/useStaff";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t as tr } from "@/i18n";

/** A client's next booking, as the list row carries it. */
type NextVisit = { appointmentDate: string; startTime: string; serviceName?: string | null; staffName?: string | null };

/** What the list shows about a client — read from the server's aggregates over ALL bookings. */
type ClientInsight = {
  bookingCount: number;
  liveBookingCount: number;
  next: NextVisit | null;
  lastPastDate: string | null;
  since: string | null;
  favouriteService: string | null;
  favouriteMaster: string | null;
  noShows: number;
  cancels: number;
  avgTicket: number | null;
  visitsDone: number;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);


  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [segment, setSegment] = useState<"all" | "new" | "regulars" | "cancelled" | "invited">("all");
  const [sort, setSort] = useState<{ key: "name" | "last" | "visits" | "spent"; dir: "asc" | "desc" }>({ key: "last", dir: "desc" });
  // Rows drawn at once. A salon with thousands of clients drew every one of them twice
  // (table + phone cards) on each render; the rest come in pages of the same size.
  const PAGE_ROWS = 100;
  const [rowLimit, setRowLimit] = useState(PAGE_ROWS);
  useEffect(() => setRowLimit(PAGE_ROWS), [searchQuery, segment, sort]);
  const navigate = useNavigate();
  const [density, setDensity] = useState<"compact" | "detailed">(() => {
    try {
      return localStorage.getItem("booqi.clients.density") === "compact" ? "compact" : "detailed";
    } catch {
      return "detailed";
    }
  });
  const [profileTab, setProfileTab] = useState<"overview" | "bookings" | "notes" | "marketing">("overview");
  const [benefits, setBenefits] = useState<ClientBenefits | null>(null);
  const [record, setRecord] = useState<ClientRecord | null>(null);
  const [noteForm, setNoteForm] = useState<{ kind: NoteKind; body: string }>({ kind: "NOTE", body: "" });
  const [noteBusy, setNoteBusy] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const [invitationDialogOpen, setInvitationDialogOpen] = useState(false);
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientWithStats | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [clientDetailOpen, setClientDetailOpen] = useState(false);
  const [detailClient, setDetailClient] = useState<ClientWithStats | null>(null);
  // This salon's bookings with them, and nothing from anywhere else.
  const [clientVisits, setClientVisits] = useState<ClientAppointmentRow[] | null>(null);
  // #28: LoyaltyController has served points per client all along with no caller, so a
  // salon could not see a client's balance — the loyalty scheme was invisible to the
  // people running it. Points are per (business, client), so this belongs on the client
  // rather than on the Marketing page with the other growth features.
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null);

  /**
   * Do they already have a booqi account?
   *
   * An accepted invitation is proof, and so is any visit at all: someone who has been
   * here is a client, not a lead to chase.
   */
  const hasAccount = (client: ClientWithStats) => {
    if (client.id < 0 || client.status === "PENDING") return false;
    try {
      const invitation = getClientInvitation(client.id);
      if (invitation?.status === "ACCEPTED") return true;
      if (invitation?.status === "PENDING") return false;
    } catch {
      // No invitation record is not an answer either way; fall through to their visits.
    }
    return (client.totalVisits ?? 0) > 0 || client.status === "ACTIVE";
  };

  const loadVisits = (client: ClientWithStats) => {
    setClientVisits(null);
    // Walk-in clients have no record (id 0): their history comes by the list's client key.
    const request = !businessId
      ? null
      : client.id > 0
        ? clientService.getAppointmentsAtBusiness(businessId, client.id)
        : client.clientKey
          ? clientService.getVisitsByKey(businessId, client.clientKey)
          : null;
    if (!request) {
      setClientVisits([]);
      return;
    }
    request.then(setClientVisits).catch(() => setClientVisits([]));
  };

  const loadLoyalty = (clientId: number) => {
    setLoyaltyPoints(null);
    if (!businessId || !clientId) return;
    loyaltyService
      .account(businessId, clientId)
      .then((a) => {
        const raw = a?.pointsBalance ?? a?.points_balance;
        setLoyaltyPoints(typeof raw === "number" ? raw : 0);
      })
      // No account yet is the normal case for a new client, not an error worth a toast.
      .catch(() => setLoyaltyPoints(0));
  };
  const [newClientForm, setNewClientForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    // #47: consent starts unset, not false. "Not asked" and "declined" are different
    // facts, and only an explicit answer may be recorded as consent.
    allowMarketingEmails: false,
    allowSmsNotifications: false,
  });
  const [invitationForm, setInvitationForm] = useState({
    serviceId: "",
    staffId: "",
    appointmentDate: salonToday(),
    startTime: "",
    endTime: "",
    notes: "",
  });
  const businessId = useBusinessId();
  useSalonTimeZone(businessId);
  useBrandFont();


  /**
   * Somebody who booked elsewhere, or rang to say they no longer want it, used to stay on
   * the list forever — and kept being emailed on every cancellation.
   */
  useEffect(() => {
    if (!businessId) return;
  }, [businessId]);
  const { services } = useServices(businessId);
  const { staff } = useStaff(businessId);

  useEffect(() => {
    loadClients();
    loadInvitations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const loadClients = async () => {
    try {
      setLoading(true);
      // Insights (next booking, favourite service and master, visits, spend) come with each
      // row, aggregated on the server over all of the client's bookings at this salon.
      const data = await clientService.getClientsWithAppointments(businessId);
      // A walk-in booked without a name: show the phone / e-mail, else "Unnamed client".
      setClients(
        data.map((c) =>
          c.firstName?.trim() || c.lastName?.trim()
            ? c
            : { ...c, firstName: c.phone || c.email || tr("clients.unnamedClient"), lastName: null },
        ),
      );
    } catch (error) {
      console.error("Failed to load clients:", error);
      toast.error((error instanceof Error && error.message) || tr("clients.failedToLoadClients"));
    } finally {
      setLoading(false);
    }
  };

  const loadInvitations = async () => {
    try {
      const data = await invitationService.getInvitationsByBusiness(businessId);
      setInvitations(data || []);
    } catch (error) {
      console.error("Failed to load invitations:", error);
      // Don't break the page if invitations fail to load
      setInvitations([]);
    }
  };

  const getClientInvitation = (clientId?: number) => {
    if (!clientId) return null;
    return invitations.find(inv => inv.clientId === clientId);
  };

  // Convert pending invitations to client-like structure
  const getPendingClientsFromInvitations = (): ClientWithStats[] => {
    return invitations
      .filter(inv => inv.status === "PENDING")
      .map(inv => {
        // Parse recipient name (may be null for incomplete invitations)
        const nameParts = (inv.recipientName || "").trim().split(" ").filter(Boolean);
        const firstName = nameParts[0] || "Pending";
        const lastName = nameParts.slice(1).join(" ") || null;

        return {
          id: inv.clientId || inv.id * -1, // Use negative ID for non-registered clients
          businessId: inv.businessId,
          firstName,
          lastName,
          email: inv.recipientEmail || null,
          phone: inv.recipientPhone || null,
          birthday: null,
          gender: null,
          address: null,
          city: null,
          state: null,
          zipCode: null,
          country: null,
          notes: null,
          avatarUrl: null,
          preferredLanguage: null,
          preferredContactMethod: null,
          status: "PENDING",
          allowMarketingEmails: null,
          allowSmsNotifications: null,
          createdAt: inv.createdAt,
          updatedAt: null,
          totalVisits: 0,
          totalSpent: null,
          lastVisitDate: null,
          pendingAppointments: 0,
          confirmedAppointments: 0,
          completedAppointments: 0,
          cancelledAppointments: 0,
        } as ClientWithStats;
      })
      .filter(pendingClient => {
        // Only include pending clients that are not already in the clients list
        // (i.e., they don't have a registered clientId that matches an existing client)
        return !clients.some(client => 
          pendingClient.id > 0 && client.id === pendingClient.id
        );
      });
  };

  // Combine registered clients with pending clients
  const allClientsWithPending = [
    ...clients,
    ...getPendingClientsFromInvitations()
  ];

  // Filter clients based on search query
  const filteredClients = allClientsWithPending.filter((client) => {
    const query = searchQuery.toLowerCase();
    const fullName = `${client.firstName} ${client.lastName || ""}`.toLowerCase();
    const email = (client.email || "").toLowerCase();
    const phone = (client.phone || "").toLowerCase();
    return fullName.includes(query) || email.includes(query) || phone.includes(query);
  });

  // Calculate stats
  const totalClients = allClientsWithPending.length;
  const totalRevenue = allClientsWithPending.reduce((sum, client) => {
    return sum + (client.totalSpent ? Number(client.totalSpent) : 0);
  }, 0);
  const totalSuccess = allClientsWithPending.reduce((sum, client) => {
    return sum + (client.confirmedAppointments || 0) + (client.completedAppointments || 0);
  }, 0);
  const totalCancelled = allClientsWithPending.reduce((sum, client) => {
    return sum + (client.cancelledAppointments || 0);
  }, 0);
  
  // Count pending clients (invited but not registered)
  const pendingClientsCount = getPendingClientsFromInvitations().length;

  // Format currency
  const formatCurrency = (amount: number | string | null) => {
    const n = typeof amount === "number" ? amount : Number(amount);
    if (amount === null || amount === undefined || Number.isNaN(n)) return `0.00 ${currencySymbol()}`;
    return `${n.toFixed(2)} ${currencySymbol()}`;
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "dd MMM yyyy");
    } catch {
      return dateString;
    }
  };

  // Get client initials
  const getInitials = (firstName: string, lastName: string | null) => {
    const first = firstName?.[0]?.toUpperCase() || "";
    const last = lastName?.[0]?.toUpperCase() || "";
    return `${first}${last}` || "?";
  };

  // Get client full name
  const getFullName = (firstName: string, lastName: string | null) => {
    return `${firstName}${lastName ? ` ${lastName}` : ""}`;
  };

  // Segments the data actually supports (no "blocked" flag exists on a client yet).
  const isPending = (c: ClientWithStats) => c.id < 0 || c.status === "PENDING";
  const SEGMENTS: { key: typeof segment; label: string; test: (c: ClientWithStats) => boolean }[] = [
    { key: "all", label: tr("common.all"), test: () => true },
    { key: "new", label: tr("clients.new"), test: (c) => !isPending(c) && (c.totalVisits ?? 0) <= 1 },
    { key: "regulars", label: tr("clients.regulars"), test: (c) => (c.totalVisits ?? 0) >= 5 },
    { key: "cancelled", label: tr("clients.cancelledBefore"), test: (c) => (c.cancelledAppointments ?? 0) > 0 },
    { key: "invited", label: tr("clients.invited"), test: isPending },
  ];
  const segmentCount = (key: typeof segment) => allClientsWithPending.filter(SEGMENTS.find((s) => s.key === key)!.test).length;
  const shownSegments = SEGMENTS.filter((s) => s.key === "all" || segmentCount(s.key) > 0 || segment === s.key);
  const visibleClients = filteredClients
    .filter(SEGMENTS.find((s) => s.key === segment)!.test)
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "name") return dir * getFullName(a.firstName, a.lastName).localeCompare(getFullName(b.firstName, b.lastName));
      if (sort.key === "visits") return dir * ((a.totalVisits ?? 0) - (b.totalVisits ?? 0));
      if (sort.key === "spent") return dir * (Number(a.totalSpent ?? 0) - Number(b.totalSpent ?? 0));
      const ta = a.lastVisitDate ? new Date(a.lastVisitDate).getTime() : 0;
      const tb = b.lastVisitDate ? new Date(b.lastVisitDate).getTime() : 0;
      return dir * (ta - tb);
    });
  const toggleSort = (key: typeof sort.key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }));
  const openClient = (client: ClientWithStats) => {
    setDetailClient(client);
    setClientDetailOpen(true);
    loadLoyalty(client.id);
    loadVisits(client);
    setProfileTab("overview");
    loadProfileExtras(client.id);
  };
  // Walk-in clients (built from bookings, no client record) all come back with id 0, so the
  // id alone repeats; fall back to their contact + position.
  const rowKey = (client: ClientWithStats, index: number) =>
    client.id ? `c${client.id}` : `walk-in-${client.email ?? client.phone ?? ""}-${index}`;

  /* ── Insights: aggregated on the server over ALL of the client's bookings here ── */
  const insightCache = useMemo(() => new WeakMap<ClientWithStats, ClientInsight>(), []);
  const insightsFor = (client: ClientWithStats): ClientInsight => {
    const visitsDone = Math.max(client.totalVisits ?? 0, client.pastVisits ?? 0);
    const spent = Number(client.totalSpent ?? 0);
    const avgPrice = client.avgPrice == null ? null : Number(client.avgPrice);
    return {
      bookingCount: client.bookingCount ?? 0,
      liveBookingCount: client.liveBookingCount ?? 0,
      next: client.nextVisitDate && client.nextVisitTime
        ? { appointmentDate: client.nextVisitDate, startTime: client.nextVisitTime, serviceName: client.nextServiceName, staffName: client.nextStaffName }
        : null,
      lastPastDate: client.lastBookingDate ?? null,
      since: client.createdAt || client.firstBookingDate || null,
      favouriteService: client.favouriteService ?? null,
      favouriteMaster: client.favouriteMaster ?? null,
      noShows: client.noShowAppointments ?? 0,
      cancels: client.cancelledAppointments ?? 0,
      avgTicket: spent > 0 && visitsDone > 0 ? spent / visitsDone : avgPrice,
      visitsDone,
    };
  };
  const insightOf = (c: ClientWithStats): ClientInsight => {
    let v = insightCache.get(c);
    if (!v) {
      v = insightsFor(c);
      insightCache.set(c, v);
    }
    return v;
  };
  const shortDate = (d: string | null | undefined) => {
    if (!d) return null;
    try {
      return format(new Date(d.length <= 10 ? `${d}T00:00` : d.replace(" ", "T")), "d MMM yyyy");
    } catch {
      return d;
    }
  };
  const nextLabel = (a: NextVisit | null) =>
    a ? `${format(new Date(`${a.appointmentDate}T00:00`), "EEE d MMM")} · ${String(a.startTime).slice(0, 5)}` : null;
  /** Where they come from, from what the data can tell (no booking-source field exists). */
  const tagsOf = (c: ClientWithStats) => {
    const t: { label: string; cls: string }[] = [];
    if (isPending(c)) t.push({ label: tr("clients.invited"), cls: "bg-amber-100 text-amber-900" });
    else if (!c.id) t.push({ label: tr("common.walkIn"), cls: "bg-[rgb(var(--reg-ink)/0.06)] text-[rgb(var(--reg-ink)/0.75)]" });
    else {
      let accepted = false;
      try {
        accepted = getClientInvitation(c.id)?.status === "ACCEPTED";
      } catch {
        accepted = false;
      }
      if (accepted) t.push({ label: "booqi account", cls: "bg-sky-100 text-sky-900" });
      else if (insightOf(c).bookingCount === 0 && (c.totalVisits ?? 0) === 0) t.push({ label: tr("clients.addedByYou"), cls: "bg-[rgb(var(--reg-ink)/0.06)] text-[rgb(var(--reg-ink)/0.75)]" });
    }
    return t;
  };

  // Summary, from the loaded data only.
  const booked = allClientsWithPending.filter((c) => !isPending(c));
  const withVisit = booked.filter((c) => insightOf(c).visitsDone >= 1 || insightOf(c).bookingCount > 0);
  const returning = booked.filter((c) => insightOf(c).visitsDone >= 2 || insightOf(c).liveBookingCount >= 2);
  const spenders = booked.filter((c) => Number(c.totalSpent ?? 0) > 0);
  const avgSpend = spenders.length ? spenders.reduce((s, c) => s + Number(c.totalSpent ?? 0), 0) / spenders.length : null;
  const newThisMonth = booked.filter((c) => {
    const since = insightOf(c).since;
    if (!since) return false;
    const d = new Date(since.length <= 10 ? `${since}T00:00` : since.replace(" ", "T"));
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  const setDensityPersist = (d: "compact" | "detailed") => {
    setDensity(d);
    try {
      localStorage.setItem("booqi.clients.density", d);
    } catch {
      /* per-browser convenience only */
    }
  };

  const loadProfileExtras = (clientId: number) => {
    setBenefits(null);
    setRecord(null);
    if (!businessId || !clientId) return;
    tillBenefitsService.get(businessId, clientId).then(setBenefits).catch(() => setBenefits(null));
    salonDayService.getClientRecord(businessId, clientId).then(setRecord).catch(() => setRecord({ notes: [], photos: [], visits: [] }));
  };

  const addNote = async () => {
    if (!detailClient?.id || !noteForm.body.trim()) return;
    setNoteBusy(true);
    try {
      await salonDayService.addClientNote(businessId, detailClient.id, { kind: noteForm.kind, body: noteForm.body.trim() });
      setNoteForm({ kind: noteForm.kind, body: "" });
      toast.success(tr("clients.noteAdded"));
      loadProfileExtras(detailClient.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("clients.couldNotAddTheNote"));
    } finally {
      setNoteBusy(false);
    }
  };

  const bookForClient = (c: ClientWithStats) => {
    const q = new URLSearchParams({ new: "1", clientName: getFullName(c.firstName, c.lastName) });
    if (c.id > 0) q.set("clientId", String(c.id));
    if (c.phone) q.set("clientPhone", c.phone);
    if (c.email) q.set("clientEmail", c.email);
    navigate(`/${businessId}/calendar?${q.toString()}`);
  };

  const statusChip = (client: ClientWithStats) => {
    if (isPending(client)) return { label: tr("clients.invited"), cls: "bg-amber-100 text-amber-900" };
    const inv = (() => {
      try {
        return getClientInvitation(client.id);
      } catch {
        return null;
      }
    })();
    if (inv?.status === "PENDING") return { label: tr("clients.invited"), cls: "bg-amber-100 text-amber-900" };
    if ((client.totalVisits ?? 0) >= 5) return { label: tr("clients.regular"), cls: "bg-[rgb(var(--reg-brand)/0.12)] text-[rgb(var(--reg-brand-strong))]" };
    if ((client.totalVisits ?? 0) <= 1) return { label: tr("clients.new"), cls: "bg-emerald-100 text-emerald-900" };
    return null;
  };

  const SortHead = ({ k, label, className }: { k: typeof sort.key; label: string; className?: string }) => (
    <th scope="col" aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-4 py-3 text-left", className)}>
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]">
        {label}
        {sort.key === k ? (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-40" />}
      </button>
    </th>
  );

  const Avatar2 = ({ client, size = "h-10 w-10" }: { client: ClientWithStats; size?: string }) => (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-[rgb(var(--reg-brand-soft))] text-xs font-bold text-[rgb(var(--reg-brand-strong))]", size)}>
      {getInitials(client.firstName, client.lastName)}
    </span>
  );

  return (
    <AppLayout>
      <div className="min-h-full bg-[rgb(var(--reg-canvas))] text-[rgb(var(--reg-ink))]" style={{ fontFamily: BRAND_FONT }}>
        {/* Header: title + count, search, the one primary action. */}
        <div className="sticky top-0 z-20 border-b border-[rgb(var(--reg-line)/0.8)] bg-[rgb(var(--reg-canvas)/0.92)] px-4 pb-3 pt-4 backdrop-blur-xl md:px-8 md:pt-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em] md:text-[32px]">
              {tr("common.clients")}{" "}<span className="text-[rgb(var(--reg-muted))]">{loading ? "" : allClientsWithPending.length}</span>
            </h1>
            <div className="order-last flex h-11 w-full items-center gap-2 rounded-full bg-white px-4 ring-1 ring-[rgb(var(--reg-line))] focus-within:ring-2 focus-within:ring-[rgb(var(--reg-brand)/0.5)] md:order-none md:ml-auto md:w-80">
              <Search size={16} strokeWidth={1.75} className="text-[rgb(var(--reg-muted))]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr("clients.searchNamePhoneOrEmail")}
                aria-label={tr("clients.searchClients")}
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[rgb(var(--reg-muted))] md:text-sm"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} aria-label={tr("clients.clearSearch")} className="text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]">
                  <XCircle size={16} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAddClientDialogOpen(true)}
              className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgb(var(--reg-brand-strong)/0.7)] transition hover:brightness-110 md:ml-0"
            >
              <Plus size={16} strokeWidth={2.25} />
              {tr("clients.addClient")}
            </button>
          </div>
          {/* Segments as chips — only those with someone in them. */}
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:px-0" role="tablist" aria-label={tr("clients.clientSegments")}>
            {shownSegments.map((s) => {
              const on = segment === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setSegment(s.key)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1 transition",
                    on ? "bg-[rgb(var(--reg-ink))] text-white ring-[rgb(var(--reg-ink))]" : "bg-white text-[rgb(var(--reg-ink)/0.8)] ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-brand)/0.4)]",
                  )}
                >
                  {s.label}
                  <span className={cn("text-xs", on ? "text-white/70" : "text-[rgb(var(--reg-muted))]")}>{segmentCount(s.key)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-5 md:px-8 md:py-6">
          {!loading && allClientsWithPending.length > 0 && (
            <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
              {[
                { label: tr("common.clients"), value: String(allClientsWithPending.length), hint: tr("clients.haveBooked", { count: withVisit.length }) },
                { label: tr("clients.newThisMonth"), value: String(newThisMonth), hint: tr("clients.firstSeenThisMonth") },
                { label: tr("clients.returning"), value: withVisit.length ? `${Math.round((returning.length / withVisit.length) * 100)}%` : "—", hint: tr("clients.booked2Plus") },
                { label: tr("clients.avgSpend"), value: avgSpend != null ? formatCurrency(avgSpend) : "—", hint: tr("clients.perPayingClient") },
              ].map((t) => (
                <div key={t.label} className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                  <p className="text-sm font-semibold text-[rgb(var(--reg-muted))]">{t.label}</p>
                  <p className="mt-1.5 text-[26px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{t.value}</p>
                  <p className="mt-1 text-xs text-[rgb(var(--reg-muted))]">{t.hint}</p>
                </div>
              ))}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-7 w-7 animate-spin text-[rgb(var(--reg-brand))]" />
            </div>
          ) : allClientsWithPending.length === 0 ? (
            <div className="mx-auto max-w-sm py-16 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-mesh-1)),rgb(var(--reg-mesh-2))_55%,rgb(var(--reg-mesh-3)))]">
                <Users className="h-7 w-7" strokeWidth={1.75} />
              </span>
              <h2 className="mt-5 text-2xl font-extrabold tracking-[-0.02em]">{tr("clients.noClientsYet")}</h2>
              <p className="mt-2 text-[rgb(var(--reg-muted))]">{tr("clients.anyoneWhoBooksLandsHere")}</p>
              <button type="button" onClick={() => setAddClientDialogOpen(true)} className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] px-6 font-semibold text-white">
                <Plus size={18} />{" "}{tr("clients.addClient")}
              </button>
            </div>
          ) : visibleClients.length === 0 ? (
            <div className="mx-auto max-w-sm py-16 text-center">
              <Search className="mx-auto h-8 w-8 text-[rgb(var(--reg-muted))]" strokeWidth={1.5} />
              <h2 className="mt-4 text-xl font-extrabold tracking-[-0.02em]">{searchQuery ? tr("clients.nothingMatches", { searchQuery }) : tr("clients.nobodyHereYet")}</h2>
              <p className="mt-2 text-[rgb(var(--reg-muted))]">{tr("clients.searchRunsOverNameEmail", { value: segment !== "all" ? tr("clients.orShowEveryone") : "" })}</p>
              {(searchQuery || segment !== "all") && (
                <button type="button" onClick={() => { setSearchQuery(""); setSegment("all"); }} className="mt-5 inline-flex h-11 items-center rounded-full bg-white px-5 font-semibold ring-1 ring-[rgb(var(--reg-line))]">
                  {tr("clients.clearSearchAndFilters")}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop: a table on a white card — compact, or detailed with every fact we have. */}
              <div className="mb-3 hidden items-center justify-end gap-2 md:flex">
                <span className="text-sm text-[rgb(var(--reg-muted))]">{tr("clients.view")}</span>
                <div role="tablist" aria-label={tr("clients.tableDensity")} className="flex rounded-full bg-[rgb(var(--reg-ink)/0.05)] p-1">
                  {(["compact", "detailed"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      role="tab"
                      aria-selected={density === d}
                      onClick={() => setDensityPersist(d)}
                      className={cn(
                        "h-8 rounded-full px-3.5 text-sm font-semibold capitalize",
                        density === d ? "bg-white shadow-[0_1px_2px_rgb(var(--reg-ink)/0.06)]" : "text-[rgb(var(--reg-muted))]",
                      )}
                    >
                      {d === "compact" ? tr("clients.densityCompact") : tr("clients.densityDetailed")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="hidden overflow-hidden rounded-[20px] bg-white shadow-[0_1px_2px_rgb(var(--reg-ink)/0.04),0_12px_32px_-16px_rgb(var(--reg-ink)/0.12)] ring-1 ring-[rgb(var(--reg-line)/0.8)] md:block">
                {/* relative: the sr-only header text is absolutely positioned; without a
                    positioned ancestor here it escaped the scroll box and widened the page. */}
                <div className="relative overflow-x-auto">
                <table className={cn("w-full", density === "detailed" ? "min-w-[1080px]" : "min-w-[720px]")}>
                  <thead className="border-b border-[rgb(var(--reg-line)/0.8)] bg-white">
                    <tr>
                      <SortHead k="name" label={tr("common.client")} />
                      {density === "detailed" && <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">{tr("clients.clientSince")}</th>}
                      <SortHead k="last" label={tr("clients.lastVisit")} />
                      <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">{tr("clients.next")}</th>
                      {density === "detailed" && (
                        <>
                          <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">{tr("clients.favourite")}</th>
                          <th scope="col" className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]" title={tr("clients.noShowsCancellations")}><span className="whitespace-nowrap">{tr("clients.noShowCancel")}</span></th>
                          <th scope="col" className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">{tr("clients.avgTicket")}</th>
                        </>
                      )}
                      <SortHead k="visits" label={tr("clients.visits")} className="text-right" />
                      <SortHead k="spent" label={tr("clients.spent")} className="text-right" />
                      <th scope="col" className="w-12 px-2"><span className="sr-only">{tr("clients.actions")}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleClients.slice(0, rowLimit).map((client, index) => {
                      const chip = statusChip(client);
                      const pending = isPending(client);
                      const ins = insightOf(client);
                      return (
                        <tr
                          key={rowKey(client, index)}
                          onClick={() => openClient(client)}
                          className="group cursor-pointer border-b border-[rgb(var(--reg-line)/0.6)] transition-colors last:border-0 hover:bg-[rgb(var(--reg-brand-soft)/0.6)]"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar2 client={client} />
                              <div className="min-w-0">
                                <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
                                  {getFullName(client.firstName, client.lastName)}
                                  {chip && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", chip.cls)}>{chip.label}</span>}
                                </p>
                                <p className="flex items-center gap-1.5 truncate text-sm text-[rgb(var(--reg-muted))]">
                                  {client.phone || client.email || tr("clients.noContactInfo")}
                                  {density === "detailed" && tagsOf(client).map((t) => (
                                    <span key={t.label} className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", t.cls)}>{t.label}</span>
                                  ))}
                                </p>
                              </div>
                            </div>
                          </td>
                          {density === "detailed" && <td className="whitespace-nowrap px-4 py-3 text-sm text-[rgb(var(--reg-ink)/0.8)]">{shortDate(ins.since) ?? "—"}</td>}
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-[rgb(var(--reg-ink)/0.8)]">{pending ? "—" : shortDate(client.lastVisitDate) ?? (ins.lastPastDate ? shortDate(ins.lastPastDate) : tr("clients.notYet"))}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
                            {ins.next ? <span className="font-semibold text-[rgb(var(--reg-brand-strong))]">{nextLabel(ins.next)}</span> : <span className="text-[rgb(var(--reg-muted))]">—</span>}
                          </td>
                          {density === "detailed" && (
                            <>
                              <td className="max-w-[200px] px-4 py-3 text-sm">
                                <p className="truncate">{ins.favouriteService ?? "—"}</p>
                                {ins.favouriteMaster && <p className="truncate text-xs text-[rgb(var(--reg-muted))]">{tr("clients.with", { favouriteMaster: ins.favouriteMaster })}</p>}
                              </td>
                              <td className={cn("whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums", ins.noShows + ins.cancels > 0 ? "font-semibold text-rose-700" : "text-[rgb(var(--reg-muted))]")}>
                                {ins.noShows} / {ins.cancels}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums">{ins.avgTicket != null ? formatCurrency(ins.avgTicket) : "—"}</td>
                            </>
                          )}
                          <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">{pending ? "—" : ins.visitsDone}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums">{pending ? "—" : formatCurrency(client.totalSpent)}</td>
                          <td className="px-2 py-3 text-right">
                            {!pending && !hasAccount(client) && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSelectedClient(client); setInvitationDialogOpen(true); }}
                                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-[rgb(var(--reg-brand-strong))] opacity-0 transition hover:bg-white group-hover:opacity-100 focus-visible:opacity-100"
                              >
                                <Send size={14} />{" "}{tr("clients.invite")}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>

              {/* Phone: cards with the three facts that matter at a glance. */}
              <ul className="space-y-2 md:hidden">
                {visibleClients.slice(0, rowLimit).map((client, index) => {
                  const chip = statusChip(client);
                  const pending = isPending(client);
                  const ins = insightOf(client);
                  return (
                    <li key={rowKey(client, index)}>
                      <button
                        type="button"
                        onClick={() => openClient(client)}
                        className="flex w-full items-start gap-3 rounded-2xl bg-white p-3.5 text-left ring-1 ring-[rgb(var(--reg-line)/0.8)] transition active:scale-[0.99]"
                      >
                        <Avatar2 client={client} size="h-11 w-11" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[15px] font-semibold">{getFullName(client.firstName, client.lastName)}</span>
                            {chip && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", chip.cls)}>{chip.label}</span>}
                          </span>
                          {ins.next ? (
                            <span className="block truncate text-sm font-semibold text-[rgb(var(--reg-brand-strong))]">{tr("clients.next2", { value: nextLabel(ins.next) })}</span>
                          ) : (
                            <span className="block truncate text-sm text-[rgb(var(--reg-muted))]">{pending ? client.phone || client.email || tr("clients.invited") : client.phone || client.email || tr("clients.noContactInfo")}</span>
                          )}
                          {!pending && (
                            <span className="mt-0.5 block truncate text-xs text-[rgb(var(--reg-muted))]">
                              {tr("clients.visitCount", { count: ins.visitsDone })}
                              {ins.favouriteService ? ` · ${ins.favouriteService}` : ""}
                            </span>
                          )}
                        </span>
                        {!pending && <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(client.totalSpent)}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {visibleClients.length > rowLimit && (
                <div className="flex justify-center pt-3">
                  <Button variant="outline" onClick={() => setRowLimit((n) => n + PAGE_ROWS)}>
                    {tr("clients.showMore", { count: Math.min(PAGE_ROWS, visibleClients.length - rowLimit) })}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Send Invitation Dialog */}
      <Dialog open={invitationDialogOpen} onOpenChange={setInvitationDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{tr("clients.sendAppointmentInvitation")}</DialogTitle>
            <DialogDescription>
              {tr("clients.sendAnInvitationToTo", { value: selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName || ""}`.trim() : tr("clients.client") })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{tr("clients.service")}</Label>
              <Select
                value={invitationForm.serviceId}
                onValueChange={(value) => setInvitationForm(prev => ({ ...prev, serviceId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tr("clients.selectAService")} />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id.toString()}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{tr("clients.staff")}</Label>
              <Select
                value={invitationForm.staffId}
                onValueChange={(value) => setInvitationForm(prev => ({ ...prev, staffId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tr("common.selectStaffMember")} />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tr("clients.date")}</Label>
                <Input
                  type="date"
                  value={invitationForm.appointmentDate}
                  onChange={(e) => setInvitationForm(prev => ({ ...prev, appointmentDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{tr("clients.time")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="time"
                    placeholder={tr("clients.start")}
                    value={invitationForm.startTime}
                    onChange={(e) => setInvitationForm(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                  <Input
                    type="time"
                    placeholder={tr("clients.end")}
                    value={invitationForm.endTime}
                    onChange={(e) => setInvitationForm(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{tr("clients.notesOptional")}</Label>
              <Input
                placeholder={tr("clients.addNotes")}
                value={invitationForm.notes}
                onChange={(e) => setInvitationForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            {/* #47: the backend has carried allow_marketing_emails / allow_sms_notifications
                since V1 and the types declared them, but no screen could ever set one — so
                every client's consent was permanently NULL and any campaign would have had
                zero opted-in recipients. */}
            <div className="space-y-3 rounded-lg border border-border/60 p-3">
              <p className="text-sm font-medium">{tr("clients.marketingConsent")}</p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={newClientForm.allowMarketingEmails}
                  onCheckedChange={(checked) =>
                    setNewClientForm(prev => ({ ...prev, allowMarketingEmails: checked === true }))
                  }
                />
                {tr("clients.clientAgreedToMarketingEmails")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={newClientForm.allowSmsNotifications}
                  onCheckedChange={(checked) =>
                    setNewClientForm(prev => ({ ...prev, allowSmsNotifications: checked === true }))
                  }
                />
                {tr("clients.clientAgreedToSmsNotifications")}
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                className="h-12 rounded-full border-[rgb(var(--reg-line))] bg-white px-6 text-base font-semibold"
                onClick={() => {
                  setInvitationDialogOpen(false);
                  setSelectedClient(null);
                  setInvitationForm({
                    serviceId: "",
                    staffId: "",
                    appointmentDate: salonToday(),
                    startTime: "",
                    endTime: "",
                    notes: "",
                  });
                }}
              >
                {tr("common.cancel")}
              </Button>
              <Button
                onClick={async () => {
                  if (!invitationForm.serviceId || !invitationForm.staffId || !invitationForm.appointmentDate || !invitationForm.startTime || !invitationForm.endTime) {
                    toast.error(tr("common.pleaseFillInAllRequired"));
                    return;
                  }

                  try {
                    const selectedService = services.find(s => s.id.toString() === invitationForm.serviceId);
                    const appointment = await appointmentService.createAppointment({
                      businessId,
                      staffId: parseInt(invitationForm.staffId),
                      serviceId: parseInt(invitationForm.serviceId),
                      clientId: selectedClient?.id,
                      clientName: selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName || ""}`.trim() : undefined,
                      clientEmail: selectedClient?.email || undefined,
                      clientPhone: selectedClient?.phone || undefined,
                      appointmentDate: invitationForm.appointmentDate,
                      startTime: invitationForm.startTime,
                      endTime: invitationForm.endTime,
                      price: selectedService?.price,
                      notes: invitationForm.notes || undefined,
                    });
                    
                    // Automatically send invitation when booking appointment
                    if (selectedClient && (selectedClient.email || selectedClient.phone)) {
                      try {
                        await invitationService.createInvitation(businessId, {
                          clientId: selectedClient.id,
                          recipientName: `${selectedClient.firstName} ${selectedClient.lastName || ""}`.trim(),
                          recipientEmail: selectedClient.email || undefined,
                          recipientPhone: selectedClient.phone || undefined,
                          type: "APPOINTMENT_INVITATION",
                          appointmentId: appointment.id,
                          message: tr("clients.youHaveBeenInvitedTo", { value: format(new Date(invitationForm.appointmentDate), "MMM d, yyyy"), startTime: invitationForm.startTime }),
                          expirationDays: 30,
                        });
                        await loadInvitations(); // Refresh invitations
                      } catch (invError) {
                        console.error("Failed to create invitation:", invError);
                        // Don't fail the whole operation if invitation fails
                      }
                    }
                    
                    toast.success(tr("clients.appointmentBookedAndInvitationSent"));
                    setInvitationDialogOpen(false);
                    setSelectedClient(null);
                    setInvitationForm({
                      serviceId: "",
                      staffId: "",
                      appointmentDate: salonToday(),
                      startTime: "",
                      endTime: "",
                      notes: "",
                    });
                    loadClients(); // Refresh clients list
                  } catch (error) {
                    toast.error((error instanceof Error && error.message) || tr("clients.failedToSendInvitation"));
                  }
                }}
                disabled={!invitationForm.serviceId || !invitationForm.staffId || !invitationForm.appointmentDate || !invitationForm.startTime || !invitationForm.endTime}
              >
                {tr("clients.sendInvitation")}
              </Button>
            </div>
          </div>
          </DialogContent>
        </Dialog>

      {/* Add Client Dialog */}
      <Dialog open={addClientDialogOpen} onOpenChange={setAddClientDialogOpen}>
        <DialogContent className="rounded-[24px] border-0 bg-[rgb(var(--reg-canvas))] p-6 text-[rgb(var(--reg-ink))] sm:max-w-[480px]" style={{ fontFamily: BRAND_FONT }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold tracking-[-0.02em]">{tr("clients.addClient")}</DialogTitle>
            <DialogDescription>
              {tr("clients.addANewClientTo")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">{tr("clients.firstName")}</Label>
                <Input
                  className="h-12 rounded-[14px] border-[rgb(var(--reg-line))] bg-white text-base"
                  id="firstName"
                  placeholder={tr("clients.firstName2")}
                  value={newClientForm.firstName}
                  onChange={(e) => setNewClientForm(prev => ({ ...prev, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{tr("clients.lastName")}</Label>
                <Input
                  className="h-12 rounded-[14px] border-[rgb(var(--reg-line))] bg-white text-base"
                  id="lastName"
                  placeholder={tr("clients.lastName2")}
                  value={newClientForm.lastName}
                  onChange={(e) => setNewClientForm(prev => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{tr("common.email")}</Label>
              <Input
                className="h-12 rounded-[14px] border-[rgb(var(--reg-line))] bg-white text-base"
                id="email"
                type="email"
                placeholder={tr("clients.emailExampleCom")}
                value={newClientForm.email}
                onChange={(e) => setNewClientForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{tr("common.phone")}</Label>
              <Input
                className="h-12 rounded-[14px] border-[rgb(var(--reg-line))] bg-white text-base"
                id="phone"
                type="tel"
                placeholder="+994 50 123 45 67"
                value={newClientForm.phone}
                onChange={(e) => setNewClientForm(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setAddClientDialogOpen(false);
                  setNewClientForm({
                    firstName: "",
                    lastName: "",
                    email: "",
                    phone: "",
                    allowMarketingEmails: false,
                    allowSmsNotifications: false,
                  });
                }}
              >
                {tr("common.cancel")}
              </Button>
              <Button
                onClick={async () => {
                  if (!newClientForm.firstName.trim()) {
                    toast.error(tr("clients.firstNameIsRequired"));
                    return;
                  }

                  if (!newClientForm.email && !newClientForm.phone) {
                    toast.error(tr("clients.pleaseProvideEitherEmailOr"));
                    return;
                  }

                  try {
                    // Ask if user wants to send invitation before creating client
                    const shouldInvite = window.confirm(tr("clients.wouldYouLikeToSend"));
                    
                    const newClient = await clientService.createClient(businessId, {
                      firstName: newClientForm.firstName,
                      lastName: newClientForm.lastName || undefined,
                      email: newClientForm.email || undefined,
                      phone: newClientForm.phone || undefined,
                      sendInvitation: shouldInvite, // Pass invitation flag - backend will handle it transactionally
                      // #47: real values instead of the hardcoded nulls.
                      allowMarketingEmails: newClientForm.allowMarketingEmails,
                      allowSmsNotifications: newClientForm.allowSmsNotifications,
                    });
                    
                    if (shouldInvite) {
                      toast.success(tr("clients.clientAddedAndInvitationSent"));
                    } else {
                      toast.success(tr("clients.clientAddedSuccessfully"));
                    }
                    
                    setAddClientDialogOpen(false);
                    setNewClientForm({
                      firstName: "",
                      lastName: "",
                      email: "",
                      phone: "",
                      allowMarketingEmails: false,
                      allowSmsNotifications: false,
                    });
                    
                    // Reload clients list and invitations
                    loadClients();
                    if (shouldInvite) {
                      await loadInvitations();
                    }
                  } catch (error) {
                    toast.error((error instanceof Error && error.message) || tr("clients.failedToAddClientIf"));
                  }
                }}
                disabled={!newClientForm.firstName.trim() || (!newClientForm.email && !newClientForm.phone)}
                className="h-12 rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] px-6 text-base font-semibold text-white hover:brightness-110"
              >
                {tr("clients.addClient")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client card — a right-hand sheet (full screen on a phone) with four tabs. */}
      <Sheet
        open={clientDetailOpen}
        onOpenChange={(open) => {
          setClientDetailOpen(open);
          if (!open) setLoyaltyPoints(null);
        }}
      >
        <SheetContent
          side="right"
          style={{ fontFamily: BRAND_FONT }}
          className="!max-w-full flex h-[100dvh] max-h-[100dvh] w-full flex-col gap-0 border-0 bg-[rgb(var(--reg-canvas))] p-0 text-[rgb(var(--reg-ink))] sm:w-[520px] sm:border-l sm:border-[rgb(var(--reg-line))]"
        >
          {detailClient && (() => {
            const c = detailClient;
            const pending = isPending(c);
            const chip = statusChip(c);
            const ins = insightOf(c);
            const inv = (() => {
              try {
                return getClientInvitation(c.id);
              } catch {
                return null;
              }
            })();
            const now = new Date();
            // Visits from the server: by record id, or by the list's client key for walk-ins.
            const rows: ClientAppointmentRow[] = clientVisits ?? [];
            const isUpcoming = (v: ClientAppointmentRow) =>
              new Date(`${v.appointment_date}T${String(v.start_time).slice(0, 5)}`) >= now && v.status !== "CANCELLED";
            const upcoming = rows.filter(isUpcoming).sort((a, b) => (a.appointment_date + a.start_time).localeCompare(b.appointment_date + b.start_time));
            const past = rows.filter((v) => !isUpcoming(v)).sort((a, b) => (b.appointment_date + b.start_time).localeCompare(a.appointment_date + a.start_time));
            const label = "text-[12px] font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]";
            const box = "rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]";
            const visitRow = (v: ClientAppointmentRow) => {
              const st = appointmentStatusStyle(v.status, "PENDING");
              return (
                <li key={`${v.id}-${v.appointment_date}-${v.start_time}`} className="relative overflow-hidden rounded-2xl bg-white p-3.5 pl-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                  <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", st.accent)} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold">
                        {v.service_name || tr("common.service")}
                        {v.staff_name ? <span className="font-normal text-[rgb(var(--reg-muted))]"> · {v.staff_name}</span> : null}
                      </p>
                      <p className="mt-0.5 text-sm text-[rgb(var(--reg-muted))]">
                        {shortDate(v.appointment_date)} · {String(v.start_time).slice(0, 5)}–{String(v.end_time).slice(0, 5)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">{v.price != null ? `${v.price} ${currencySymbol()}` : "—"}</p>
                      <div className="mt-1 flex justify-end gap-1">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", st.chip)}>{st.label}</span>
                        {v.payment_status && (
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", v.payment_status === "PAID" ? "bg-emerald-100 text-emerald-900" : "bg-[rgb(var(--reg-ink)/0.06)] text-[rgb(var(--reg-ink)/0.7)]")}>
                            {v.payment_status === "PAID" ? tr("common.paid") : v.payment_status.charAt(0) + v.payment_status.slice(1).toLowerCase().replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {v.notes && <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm text-amber-900">{v.notes}</p>}
                </li>
              );
            };
            const consent = (v: boolean | null | undefined) =>
              v == null ? <span className="text-[rgb(var(--reg-muted))]">{tr("clients.notAsked")}</span> : v ? <span className="font-semibold text-emerald-700">{tr("clients.yes")}</span> : <span className="font-semibold text-rose-700">{tr("clients.no")}</span>;
            const NOTE_KINDS: { v: NoteKind; l: string }[] = [
              { v: "NOTE", l: "Note" },
              { v: "FORMULA", l: "Formula" },
              { v: "ALLERGY", l: "Allergy" },
              { v: "PREFERENCE", l: "Preference" },
            ];
            return (
              <>
                <div className="shrink-0 px-5 pb-3 pr-14 pt-6 md:px-6">
                  <div className="flex items-center gap-4">
                    <Avatar2 client={c} size="h-16 w-16 text-lg" />
                    <div className="min-w-0">
                      <SheetTitle className="truncate text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-[rgb(var(--reg-ink))]">
                        {getFullName(c.firstName, c.lastName)}
                      </SheetTitle>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {chip && <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", chip.cls)}>{chip.label}</span>}
                        {tagsOf(c).map((t) => <span key={t.label} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", t.cls)}>{t.label}</span>)}
                      </div>
                    </div>
                  </div>
                  <div role="tablist" aria-label={tr("clients.clientCard")} className="mt-4 flex gap-1 overflow-x-auto rounded-full bg-[rgb(var(--reg-ink)/0.05)] p-1 [scrollbar-width:none]">
                    {([["overview", tr("clients.tabOverview")], ["bookings", rows.length ? tr("clients.tabBookingsCount", { count: rows.length }) : tr("clients.tabBookings")], ["notes", tr("clients.tabNotes")], ["marketing", tr("clients.tabMarketing")]] as const).map(([k, l]) => (
                      <button
                        key={k}
                        type="button"
                        role="tab"
                        aria-selected={profileTab === k}
                        onClick={() => setProfileTab(k)}
                        className={cn(
                          "h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold transition-colors",
                          profileTab === k ? "bg-white shadow-[0_1px_2px_rgb(var(--reg-ink)/0.06),0_4px_12px_-6px_rgb(var(--reg-ink)/0.15)]" : "text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]",
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-6 pt-2 md:px-6">
                  {profileTab === "overview" && (
                    <>
                      <section className={cn(box, "space-y-2 text-sm")}>
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="flex items-center gap-2 font-semibold hover:text-[rgb(var(--reg-brand-strong))]">
                            <Phone size={15} className="text-[rgb(var(--reg-muted))]" /> {c.phone}
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="flex items-center gap-2 font-semibold hover:text-[rgb(var(--reg-brand-strong))]">
                            <Mail size={15} className="text-[rgb(var(--reg-muted))]" /> <span className="truncate">{c.email}</span>
                          </a>
                        )}
                        {!c.phone && !c.email && <p className="text-[rgb(var(--reg-muted))]">{tr("clients.noContactInfo")}</p>}
                        <p className="flex items-center gap-2 text-[rgb(var(--reg-muted))]">
                          <Clock size={15} />{" "}{tr("clients.clientSince2", { value: shortDate(ins.since) ?? "—" })}
                        </p>
                      </section>

                      {ins.next && (
                        <section className="rounded-2xl bg-[rgb(var(--reg-brand-soft))] p-4 ring-1 ring-[rgb(var(--reg-brand)/0.2)]">
                          <p className={label}>{tr("clients.nextBooking")}</p>
                          <p className="mt-1 text-[15px] font-bold">{nextLabel(ins.next)}</p>
                          <p className="text-sm text-[rgb(var(--reg-ink)/0.75)]">
                            {ins.next.serviceName || tr("common.service")}
                            {ins.next.staffName ? tr("clients.with2", { staffName: ins.next.staffName }) : ""}
                          </p>
                        </section>
                      )}

                      {!pending && (
                        <div className="grid grid-cols-2 gap-2.5">
                          {[
                            { l: tr("clients.visitsLabel"), v: ins.visitsDone },
                            { l: tr("clients.spentLabel"), v: formatCurrency(c.totalSpent) },
                            { l: tr("clients.avgTicket"), v: ins.avgTicket != null ? formatCurrency(ins.avgTicket) : "—" },
                            { l: tr("clients.noShowsCancels"), v: `${ins.noShows} / ${ins.cancels}` },
                          ].map((t) => (
                            <div key={t.l} className={box}>
                              <p className="text-xs font-semibold text-[rgb(var(--reg-muted))]">{t.l}</p>
                              <p className="mt-1 text-xl font-extrabold tabular-nums tracking-[-0.02em]">{t.v}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {(ins.favouriteService || ins.favouriteMaster) && (
                        <section className={cn(box, "grid grid-cols-2 gap-3 text-sm")}>
                          <div>
                            <p className={label}>{tr("clients.favouriteService")}</p>
                            <p className="mt-1 font-semibold">{ins.favouriteService ?? "—"}</p>
                          </div>
                          <div>
                            <p className={label}>{tr("clients.usuallyWith")}</p>
                            <p className="mt-1 font-semibold">{ins.favouriteMaster ?? "—"}</p>
                          </div>
                        </section>
                      )}

                      {c.id > 0 && (
                        <section className="space-y-2">
                          <p className={label}>{tr("clients.loyaltyBenefits")}</p>
                          {benefits === null ? (
                            <p className="text-sm text-[rgb(var(--reg-muted))]">{loyaltyPoints != null ? `${loyaltyPoints} points` : tr("common.loading2")}</p>
                          ) : (
                            <div className={cn(box, "space-y-3 text-sm")}>
                              {benefits.visitsForReward > 0 && (
                                <div>
                                  <div className="flex justify-between">
                                    <span className="font-semibold">{tr("clients.stampCard")}</span>
                                    <span className="tabular-nums text-[rgb(var(--reg-muted))]">
                                      {benefits.visits % benefits.visitsForReward}/{benefits.visitsForReward}
                                    </span>
                                  </div>
                                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[rgb(var(--reg-ink)/0.06)]">
                                    <div
                                      className="h-full rounded-full bg-[linear-gradient(90deg,rgb(var(--reg-brand)),rgb(var(--reg-mesh-2)))]"
                                      style={{ width: `${((benefits.visits % benefits.visitsForReward) / benefits.visitsForReward) * 100}%` }}
                                    />
                                  </div>
                                  {benefits.rewardsAvailable > 0 && (
                                    <p className="mt-1.5 font-semibold text-emerald-700">{tr("clients.freeServicesToUse", { count: benefits.rewardsAvailable })}</p>
                                  )}
                                </div>
                              )}
                              <p className="flex justify-between"><span>{tr("clients.points")}</span><span className="font-semibold tabular-nums">{benefits.points}</span></p>
                              {benefits.memberships.map((m) => (
                                <p key={m.id} className="flex justify-between gap-3">
                                  <span className="truncate">{m.name}</span>
                                  <span className="shrink-0 text-[rgb(var(--reg-muted))]">{tr("clients.leftOff", { sessions_remaining: m.sessions_remaining, discount_percent: m.discount_percent })}</span>
                                </p>
                              ))}
                              {benefits.packages.map((p) => (
                                <p key={p.id} className="flex justify-between gap-3">
                                  <span className="truncate">{p.name}</span>
                                  <span className="shrink-0 text-[rgb(var(--reg-muted))]">{tr("clients.sessionsLeft", { sessions_remaining: p.sessions_remaining })}</span>
                                </p>
                              ))}
                              {benefits.giftCards.map((g) => (
                                <p key={g.code} className="flex justify-between gap-3">
                                  <span>{tr("clients.giftCard", { code: g.code })}</span>
                                  <span className="shrink-0 font-semibold">{formatCurrency(g.balance)}</span>
                                </p>
                              ))}
                              {!benefits.visitsForReward && !benefits.memberships.length && !benefits.packages.length && !benefits.giftCards.length && benefits.points === 0 && (
                                <p className="text-[rgb(var(--reg-muted))]">{tr("clients.noPointsCardsOrGift")}</p>
                              )}
                            </div>
                          )}
                        </section>
                      )}

                      {c.notes && (
                        <section>
                          <p className={cn(label, "mb-2")}>{tr("clients.profileNote")}</p>
                          <p className={cn(box, "text-sm")}>{c.notes}</p>
                        </section>
                      )}
                    </>
                  )}

                  {profileTab === "bookings" && (
                    pending ? (
                      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">{tr("clients.invitedTheyAppearAsA")}</p>
                    ) : c.id > 0 && clientVisits === null ? (
                      <p className="text-sm text-[rgb(var(--reg-muted))]">{tr("clients.loadingBookings")}</p>
                    ) : rows.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-[rgb(var(--reg-line))] p-4 text-sm text-[rgb(var(--reg-muted))]">{tr("clients.noBookingsWithYouYet")}</p>
                    ) : (
                      <>
                        {upcoming.length > 0 && (
                          <section>
                            <p className={cn(label, "mb-2")}>{tr("clients.upcoming", { count: upcoming.length })}</p>
                            <ul className="space-y-2">{upcoming.map(visitRow)}</ul>
                          </section>
                        )}
                        {past.length > 0 && (
                          <section>
                            <p className={cn(label, "mb-2")}>{tr("clients.history", { count: past.length })}</p>
                            <ul className="space-y-2">{past.map(visitRow)}</ul>
                          </section>
                        )}
                      </>
                    )
                  )}

                  {profileTab === "notes" && (
                    !c.id ? (
                      <p className="rounded-2xl border border-dashed border-[rgb(var(--reg-line))] p-4 text-sm text-[rgb(var(--reg-muted))]">
                        {tr("clients.walkInClientsHaveNo")}
                      </p>
                    ) : (
                      <>
                        <section className={cn(box, "space-y-3")}>
                          <p className={label}>{tr("clients.addToTheRecord")}</p>
                          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tr("clients.noteType")}>
                            {NOTE_KINDS.map((k) => (
                              <button
                                key={k.v}
                                type="button"
                                role="radio"
                                aria-checked={noteForm.kind === k.v}
                                onClick={() => setNoteForm((f) => ({ ...f, kind: k.v }))}
                                className={cn(
                                  "h-8 rounded-full px-3 text-sm font-semibold ring-1",
                                  noteForm.kind === k.v ? "bg-[rgb(var(--reg-ink))] text-white ring-[rgb(var(--reg-ink))]" : "bg-white ring-[rgb(var(--reg-line))]",
                                )}
                              >
                                {k.l}
                              </button>
                            ))}
                          </div>
                          <textarea
                            ref={noteRef}
                            value={noteForm.body}
                            onChange={(e) => setNoteForm((f) => ({ ...f, body: e.target.value }))}
                            rows={3}
                            aria-label={tr("clients.note")}
                            placeholder={noteForm.kind === "FORMULA" ? tr("clients.eGMin") : noteForm.kind === "ALLERGY" ? tr("clients.eGPpdPatchTest") : tr("clients.whatShouldTheTeamKnow")}
                            className="w-full rounded-[14px] border border-[rgb(var(--reg-line))] bg-white px-4 py-3 text-base outline-none focus:border-[rgb(var(--reg-brand))] focus:ring-4 focus:ring-[rgb(var(--reg-brand)/0.12)]"
                          />
                          <div className="flex justify-end">
                            <Button className={primaryBtn} disabled={noteBusy || !noteForm.body.trim()} onClick={() => void addNote()}>
                              {noteBusy ? tr("common.saving") : tr("clients.addNote")}
                            </Button>
                          </div>
                        </section>
                        {record === null ? (
                          <p className="text-sm text-[rgb(var(--reg-muted))]">{tr("clients.loadingRecord")}</p>
                        ) : (
                          <>
                            <section>
                              <p className={cn(label, "mb-2")}>{tr("clients.notes", { count: record.notes.length })}</p>
                              {record.notes.length === 0 ? (
                                <p className="text-sm text-[rgb(var(--reg-muted))]">{tr("clients.nothingOnTheRecordYet")}</p>
                              ) : (
                                <ul className="space-y-2">
                                  {record.notes.map((n) => (
                                    <li key={n.id} className={cn(box, "p-3.5")}>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", n.kind === "ALLERGY" ? "bg-rose-100 text-rose-900" : n.kind === "FORMULA" ? "bg-[rgb(var(--reg-brand)/0.12)] text-[rgb(var(--reg-brand-strong))]" : "bg-[rgb(var(--reg-ink)/0.06)] text-[rgb(var(--reg-ink)/0.75)]")}>
                                          {n.kind.charAt(0) + n.kind.slice(1).toLowerCase()}
                                        </span>
                                        <span className="text-xs text-[rgb(var(--reg-muted))]">{shortDate(n.created_at)}{n.author_name ? ` · ${n.author_name}` : ""}</span>
                                      </div>
                                      <p className="mt-1.5 whitespace-pre-wrap text-sm">{n.body}</p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </section>
                            {record.photos.length > 0 && (
                              <section>
                                <p className={cn(label, "mb-2")}>{tr("clients.photos", { count: record.photos.length })}</p>
                                <div className="grid grid-cols-3 gap-2">
                                  {record.photos.map((ph) => (
                                    <figure key={ph.id} className="overflow-hidden rounded-xl bg-white ring-1 ring-[rgb(var(--reg-line))]">
                                      <img src={ph.url} alt={ph.caption || `${ph.kind.toLowerCase()} photo`} className="aspect-square w-full object-cover" />
                                      <figcaption className="px-2 py-1 text-[11px] font-semibold">{ph.kind === "BEFORE" ? tr("clients.before") : tr("clients.after")} · {shortDate(ph.taken_on)}</figcaption>
                                    </figure>
                                  ))}
                                </div>
                              </section>
                            )}
                          </>
                        )}
                      </>
                    )
                  )}

                  {profileTab === "marketing" && (
                    <section className={cn(box, "divide-y divide-[rgb(var(--reg-line)/0.6)] p-0 text-sm")}>
                      {[
                        [tr("clients.marketingEmails"), consent(c.allowMarketingEmails)],
                        ["SMS", consent(c.allowSmsNotifications)],
                        [tr("clients.prefers"), c.preferredContactMethod ? <span className="font-semibold">{c.preferredContactMethod}</span> : <span className="text-[rgb(var(--reg-muted))]">—</span>],
                        [tr("clients.language"), c.preferredLanguage ? <span className="font-semibold">{c.preferredLanguage}</span> : <span className="text-[rgb(var(--reg-muted))]">—</span>],
                        [tr("clients.booqiAccount"), pending ? <span className="font-semibold text-amber-800">{tr("clients.invited")}</span> : hasAccount(c) ? <span className="font-semibold text-emerald-700">{tr("clients.yes")}</span> : <span className="text-[rgb(var(--reg-muted))]">{tr("clients.no")}</span>],
                        [tr("clients.invitation"), inv ? <span className="font-semibold">{inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}</span> : <span className="text-[rgb(var(--reg-muted))]">{tr("clients.notSent")}</span>],
                      ].map(([k, v]) => (
                        <div key={k as string} className="flex items-center justify-between gap-3 px-4 py-3">
                          <span className="text-[rgb(var(--reg-muted))]">{k}</span>
                          {v}
                        </div>
                      ))}
                    </section>
                  )}
                </div>

                <div className="flex shrink-0 gap-2 border-t border-[rgb(var(--reg-line)/0.8)] bg-white/90 px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:px-6">
                  {c.id > 0 && (
                    <button
                      type="button"
                      onClick={() => { setProfileTab("notes"); setTimeout(() => noteRef.current?.focus(), 50); }}
                      className="inline-flex h-[52px] flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-3 font-semibold ring-1 ring-[rgb(var(--reg-line))] hover:bg-[rgb(var(--reg-canvas))]"
                    >
                      <Plus size={16} />{" "}{tr("clients.note")}
                    </button>
                  )}
                  {!pending && !hasAccount(c) && (
                    <button
                      type="button"
                      onClick={() => { setSelectedClient(c); setInvitationDialogOpen(true); }}
                      className="inline-flex h-[52px] flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-3 font-semibold ring-1 ring-[rgb(var(--reg-line))] hover:bg-[rgb(var(--reg-canvas))]"
                    >
                      <Send size={16} />{" "}{tr("clients.invite")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => bookForClient(c)}
                    className="inline-flex h-[52px] flex-[1.6] items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-brand))_0%,rgb(var(--reg-brand-strong))_100%)] font-semibold text-white shadow-[0_10px_24px_-8px_rgb(var(--reg-brand-strong)/0.6)] hover:brightness-110"
                  >
                    <Plus size={18} />{" "}{tr("common.newBooking")}
                  </button>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
