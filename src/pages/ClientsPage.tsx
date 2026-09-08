import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
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
import { useEffect, useState } from "react";
import { clientService, ClientWithStats, invitationService, Invitation } from "@/services/clientService";
import { useBusinessId } from "@/hooks/useBusinessId";
import { format } from "date-fns";
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
import { appointmentService } from "@/services/appointmentService";
import { useServices } from "@/hooks/useServices";
import { useStaff } from "@/hooks/useStaff";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);


  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
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

  const loadVisits = (clientId: number) => {
    setClientVisits(null);
    if (!businessId || !clientId) return;
    clientService
      .getAppointmentsAtBusiness(businessId, clientId)
      .then(setClientVisits)
      .catch(() => setClientVisits([]));
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
    appointmentDate: format(new Date(), "yyyy-MM-dd"),
    startTime: "",
    endTime: "",
    notes: "",
  });
  const businessId = useBusinessId();


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
      const data = await clientService.getClientsWithAppointments(businessId);
      setClients(data);
    } catch (error: any) {
      console.error("Failed to load clients:", error);
      toast.error(error.message || "Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  const loadInvitations = async () => {
    try {
      const data = await invitationService.getInvitationsByBusiness(businessId);
      setInvitations(data || []);
    } catch (error: any) {
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

  return (
    <AppLayout>
      <PageHeader
        title="Clients"
        subtitle="View clients who have booked appointments with your business"
        actions={
          <Button 
            className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm hover:shadow-md transition-all"
            onClick={() => setAddClientDialogOpen(true)}
          >
            <Plus size={16} />
            Add Client
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* The four numbers a salon actually opens this page for, above the table rather
            than buried in eight columns of the same grey text. */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} label="Clients" value={clients.length} tone="violet" />
          <StatCard
            icon={UserPlus}
            label="New this month"
            value={
              clients.filter((c) => {
                if (!c.createdAt) return false;
                const d = new Date(c.createdAt);
                const now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).length
            }
            tone="emerald"
          />
          <StatCard
            icon={Star}
            label="Regulars"
            value={clients.filter((c) => (c.totalVisits ?? 0) >= 5).length}
            hint="5 visits or more"
            tone="amber"
          />
          <StatCard
            icon={CalendarCheck}
            label="Total visits"
            value={clients.reduce((n, c) => n + (c.totalVisits ?? 0), 0)}
            tone="sky"
          />
        </div>

        {/* Enhanced Search and Filter */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search clients by name, email, or phone..." 
              className="pl-10 border-border/60 focus:border-accent/50 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className={`gap-2 border-border/60 hover:border-accent/30 hover:bg-accent/5 transition-all ${showFilters ? "bg-accent/10 border-accent/40" : ""}`}
            onClick={() => {
              setShowFilters(f => !f);
              if (!showFilters) toast.info("Filters coming soon — use the search box for now");
            }}
          >
            <Filter size={16} />
            Filters
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/60 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-card to-card/95 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Total Clients
              </CardTitle>
              <User className="h-5 w-5 text-appointment-blue" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{totalClients}</div>
              {pendingClientsCount > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {pendingClientsCount} pending invitation{pendingClientsCount !== 1 ? 's' : ''}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-card to-card/95 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Success Book
              </CardTitle>
              <CheckCircle className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{totalSuccess}</div>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-card to-card/95 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Cancel Book
              </CardTitle>
              <XCircle className="h-5 w-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{totalCancelled}</div>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-card to-card/95 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Total Revenue
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-appointment-purple" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {formatCurrency(totalRevenue)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Clients Table */}
        <Card className="border-border/60 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-card to-card/95 backdrop-blur-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredClients.length === 0 ? (
              <EmptyState
                icon={Users}
                title={searchQuery ? `Nothing matches "${searchQuery}"` : "No clients yet"}
                body={
                  searchQuery
                    ? "Search runs over name, email and phone. Try part of one of those."
                    : "Anyone who books lands here automatically. You can also add someone yourself."
                }
                action={
                  searchQuery ? null : (
                    <Button className="gap-2" onClick={() => setAddClientDialogOpen(true)}>
                      <Plus size={16} />
                      Add a client
                    </Button>
                  )
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Client</th>
                      <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Contact</th>
                      <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Visits</th>
                      <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Success</th>
                      <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Cancelled</th>
                      <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Total Spent</th>
                      <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Last Visit</th>
                      <th className="text-left p-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client, index) => (
                      // #22: the row carried cursor-pointer and a hover highlight but had
                      // no onClick, so it advertised itself as clickable and did nothing —
                      // View Details was only reachable through the ⋯ menu. Open the same
                      // dialog the menu item opens.
                      <tr
                        key={client.id}
                        className="border-b border-border/40 transition-colors hover:bg-violet-50/60 cursor-pointer group"
                        style={{ animationDelay: `${index * 30}ms` }}
                        onClick={() => { setDetailClient(client); setClientDetailOpen(true); loadLoyalty(client.id); loadVisits(client.id); }}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {/* The same colour this client has on the calendar, so the two
                                screens agree about who is who. */}
                            <Avatar className="ring-2 ring-background transition-all">
                              <AvatarFallback
                                className={`font-semibold ${clientColorClasses(
                                  getFullName(client.firstName, client.lastName)
                                )}`}
                              >
                                {getInitials(client.firstName, client.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm">{getFullName(client.firstName, client.lastName)}</span>
                                {(client.totalVisits ?? 0) <= 1 && (
                                  <Badge className="bg-emerald-600 text-[10px] px-1.5 py-0.5 text-white hover:bg-emerald-600">
                                    New
                                  </Badge>
                                )}
                                {(client.totalVisits ?? 0) >= 5 && (
                                  <Badge className="bg-rose-600 text-[10px] px-1.5 py-0.5 text-white hover:bg-rose-600">
                                    Regular
                                  </Badge>
                                )}
                                {(() => {
                                  try {
                                    // Check if this is a pending client (negative ID or status is PENDING)
                                    if (client.id < 0 || client.status === "PENDING") {
                                      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px] px-1.5 py-0.5">Pending Invitation</Badge>;
                                    }
                                    const invitation = getClientInvitation(client.id);
                                    if (invitation && invitation.status === "PENDING") {
                                      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px] px-1.5 py-0.5">Pending Invitation</Badge>;
                                    }
                                    if (invitation && invitation.status === "ACCEPTED") {
                                      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5 py-0.5">Registered</Badge>;
                                    }
                                    return null;
                                  } catch (e) {
                                    return null;
                                  }
                                })()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1.5">
                            {client.email && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                                <Mail size={12} />
                                <span className="truncate max-w-[200px]">{client.email}</span>
                              </div>
                            )}
                            {client.phone && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                                <Phone size={12} />
                                <span>{client.phone}</span>
                              </div>
                            )}
                            {!client.email && !client.phone && (
                              <span className="text-xs text-muted-foreground">No contact info</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          {client.id < 0 || client.status === "PENDING" ? (
                            <span className="text-xs text-muted-foreground italic">Not registered</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{client.totalVisits}</span>
                              <span className="text-xs text-muted-foreground">visits</span>
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                            <span className="text-sm font-semibold text-green-600">
                              {(client.confirmedAppointments || 0) + (client.completedAppointments || 0)}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <XCircle className="h-3.5 w-3.5 text-red-600" />
                            <span className="text-sm font-semibold text-red-600">
                              {client.cancelledAppointments || 0}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          {client.id < 0 || client.status === "PENDING" ? (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          ) : (
                            <span className="text-sm font-bold text-status-completed">
                              {formatCurrency(client.totalSpent)}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {client.id < 0 || client.status === "PENDING" ? (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {formatDate(client.lastVisitDate)}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            {client.id < 0 || client.status === "PENDING" ? (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-7 text-xs gap-1.5 hover:bg-accent/10 hover:text-accent transition-all"
                                onClick={() => {
                                  // For pending clients, we can resend invitation or view details
                                  toast.info("This client has a pending invitation. They will appear as registered once they complete registration.");
                                }}
                              >
                                <Clock className="h-3.5 w-3.5" />
                                Pending
                              </Button>
                            ) : hasAccount(client) ? null : (
                              /* Invite is for someone with no account yet. A client who
                                 books through the app already has one, so offering to
                                 invite them says the salon does not know who they are. */
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 text-xs hover:bg-accent/10 hover:text-accent"
                                onClick={(e) => {
                                  // #22: the row opens the detail dialog now.
                                  e.stopPropagation();
                                  setSelectedClient(client);
                                  setInvitationDialogOpen(true);
                                }}
                              >
                                <Send className="h-3.5 w-3.5" />
                                Invite
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="More actions"
                                  className="h-8 w-8 hover:bg-accent/10 hover:text-accent transition-all"
                                  // #22: the row opens the detail dialog now, so opening
                                  // the menu must not also open it underneath.
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              {/* #22: the row is clickable now, so the menu must not also
                                  open the detail dialog behind itself. */}
                              {/* View only. A salon does not own the client's record — it
                                  owns its own dealings with them — so editing and deleting
                                  are gone rather than pretending ("coming soon"). */}
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => { setDetailClient(client); setClientDetailOpen(true); loadLoyalty(client.id); loadVisits(client.id); }}>
                                  View details and visits
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Send Invitation Dialog */}
      <Dialog open={invitationDialogOpen} onOpenChange={setInvitationDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send Appointment Invitation</DialogTitle>
            <DialogDescription>
              Send an invitation to {selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName || ""}`.trim() : "client"} to book an appointment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Service *</Label>
              <Select
                value={invitationForm.serviceId}
                onValueChange={(value) => setInvitationForm(prev => ({ ...prev, serviceId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
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
              <Label>Staff *</Label>
              <Select
                value={invitationForm.staffId}
                onValueChange={(value) => setInvitationForm(prev => ({ ...prev, staffId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={invitationForm.appointmentDate}
                  onChange={(e) => setInvitationForm(prev => ({ ...prev, appointmentDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Time *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="time"
                    placeholder="Start"
                    value={invitationForm.startTime}
                    onChange={(e) => setInvitationForm(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                  <Input
                    type="time"
                    placeholder="End"
                    value={invitationForm.endTime}
                    onChange={(e) => setInvitationForm(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="Add notes..."
                value={invitationForm.notes}
                onChange={(e) => setInvitationForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            {/* #47: the backend has carried allow_marketing_emails / allow_sms_notifications
                since V1 and the types declared them, but no screen could ever set one — so
                every client's consent was permanently NULL and any campaign would have had
                zero opted-in recipients. */}
            <div className="space-y-3 rounded-lg border border-border/60 p-3">
              <p className="text-sm font-medium">Marketing consent</p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={newClientForm.allowMarketingEmails}
                  onCheckedChange={(checked) =>
                    setNewClientForm(prev => ({ ...prev, allowMarketingEmails: checked === true }))
                  }
                />
                Client agreed to marketing emails
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={newClientForm.allowSmsNotifications}
                  onCheckedChange={(checked) =>
                    setNewClientForm(prev => ({ ...prev, allowSmsNotifications: checked === true }))
                  }
                />
                Client agreed to SMS notifications
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setInvitationDialogOpen(false);
                  setSelectedClient(null);
                  setInvitationForm({
                    serviceId: "",
                    staffId: "",
                    appointmentDate: format(new Date(), "yyyy-MM-dd"),
                    startTime: "",
                    endTime: "",
                    notes: "",
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!invitationForm.serviceId || !invitationForm.staffId || !invitationForm.appointmentDate || !invitationForm.startTime || !invitationForm.endTime) {
                    toast.error("Please fill in all required fields");
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
                          message: `You have been invited to book an appointment on ${format(new Date(invitationForm.appointmentDate), "MMM d, yyyy")} at ${invitationForm.startTime}. Please register to confirm your appointment.`,
                          expirationDays: 30,
                        });
                        await loadInvitations(); // Refresh invitations
                      } catch (invError: any) {
                        console.error("Failed to create invitation:", invError);
                        // Don't fail the whole operation if invitation fails
                      }
                    }
                    
                    toast.success("Appointment booked and invitation sent! The client will receive a referral code to register.");
                    setInvitationDialogOpen(false);
                    setSelectedClient(null);
                    setInvitationForm({
                      serviceId: "",
                      staffId: "",
                      appointmentDate: format(new Date(), "yyyy-MM-dd"),
                      startTime: "",
                      endTime: "",
                      notes: "",
                    });
                    loadClients(); // Refresh clients list
                  } catch (error: any) {
                    toast.error(error.message || "Failed to send invitation");
                  }
                }}
                disabled={!invitationForm.serviceId || !invitationForm.staffId || !invitationForm.appointmentDate || !invitationForm.startTime || !invitationForm.endTime}
              >
                Send Invitation
              </Button>
            </div>
          </div>
          </DialogContent>
        </Dialog>

      {/* Add Client Dialog */}
      <Dialog open={addClientDialogOpen} onOpenChange={setAddClientDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>
              Add a new client to your business. You can send them an invitation after adding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  placeholder="First name"
                  value={newClientForm.firstName}
                  onChange={(e) => setNewClientForm(prev => ({ ...prev, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Last name"
                  value={newClientForm.lastName}
                  onChange={(e) => setNewClientForm(prev => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={newClientForm.email}
                onChange={(e) => setNewClientForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+44 123 456 7890"
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
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!newClientForm.firstName.trim()) {
                    toast.error("First name is required");
                    return;
                  }

                  if (!newClientForm.email && !newClientForm.phone) {
                    toast.error("Please provide either email or phone number");
                    return;
                  }

                  try {
                    // Ask if user wants to send invitation before creating client
                    const shouldInvite = window.confirm("Would you like to send an invitation to this client? They will receive a referral code to register. If invitation fails, client will not be created.");
                    
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
                      toast.success("Client added and invitation sent successfully! The invitation will show as 'Pending' until the client registers.");
                    } else {
                      toast.success("Client added successfully!");
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
                  } catch (error: any) {
                    toast.error(error.message || "Failed to add client. If invitation was requested, it may have failed.");
                  }
                }}
                disabled={!newClientForm.firstName.trim() || (!newClientForm.email && !newClientForm.phone)}
              >
                Add Client
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Detail Dialog */}
      <Dialog
        open={clientDetailOpen}
        onOpenChange={(open) => {
          setClientDetailOpen(open);
          if (!open) setLoyaltyPoints(null);
        }}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>
              {detailClient ? getFullName(detailClient.firstName, detailClient.lastName) : "Client"}
            </DialogTitle>
            <DialogDescription>
              What this client has done at your salon. Read-only — their account is theirs.
            </DialogDescription>
          </DialogHeader>
          {detailClient && (
            <div className="max-h-[65vh] space-y-4 overflow-y-auto py-1">
              <div className="flex items-center gap-3 rounded-xl border p-3">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full font-semibold ${clientColorClasses(
                    getFullName(detailClient.firstName, detailClient.lastName)
                  )}`}
                >
                  {getInitials(detailClient.firstName, detailClient.lastName)}
                </span>
                <div className="min-w-0 text-sm">
                  <p className="truncate">{detailClient.email || "No email"}</p>
                  <p className="truncate text-muted-foreground">{detailClient.phone || "No phone"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatCard icon={CalendarCheck} label="Visits" value={detailClient.totalVisits ?? 0} tone="violet" />
                <StatCard icon={Coins} label="Spent" value={formatCurrency(detailClient.totalSpent)} tone="emerald" />
                <StatCard
                  icon={XCircle}
                  label="Cancelled"
                  value={detailClient.cancelledAppointments ?? 0}
                  tone={(detailClient.cancelledAppointments ?? 0) > 0 ? "amber" : "slate"}
                />
                <StatCard
                  icon={Star}
                  label="Points"
                  value={loyaltyPoints != null ? loyaltyPoints : "—"}
                  tone="sky"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">History at your salon</p>
                  {clientVisits && clientVisits.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {clientVisits.length} booking{clientVisits.length === 1 ? "" : "s"} · first on{" "}
                      {clientVisits[clientVisits.length - 1].appointment_date}
                    </p>
                  )}
                </div>
                {clientVisits === null ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : clientVisits.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No bookings with you yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {clientVisits.map((v) => {
                      const tone =
                        v.status === "CANCELLED"
                          ? "border-l-rose-400"
                          : v.status === "NO_SHOW"
                            ? "border-l-amber-400"
                            : v.status === "PENDING"
                              ? "border-l-slate-300"
                              : "border-l-emerald-400";
                      return (
                        <div key={v.id} className={`rounded-lg border border-l-4 bg-white p-3 ${tone}`}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {v.service_name || "Service"}
                                {v.staff_name ? (
                                  <span className="font-normal text-muted-foreground"> with {v.staff_name}</span>
                                ) : null}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {v.appointment_date} · {String(v.start_time).slice(0, 5)}–
                                {String(v.end_time).slice(0, 5)}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold">
                                {v.price != null ? `${v.price} ${currencySymbol()}` : "—"}
                              </p>
                              <div className="mt-1 flex justify-end gap-1">
                                <Badge variant="outline" className="text-[10px]">
                                  {v.status}
                                </Badge>
                                {/* Whether it was actually paid for is half the history. */}
                                {v.payment_status && (
                                  <Badge
                                    className={`text-[10px] ${
                                      v.payment_status === "PAID"
                                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                                        : "bg-slate-100 text-slate-700 hover:bg-slate-100"
                                    }`}
                                  >
                                    {v.payment_status}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* What the client asked for when booking. It was recorded and
                              never shown anywhere the salon would look. */}
                          {v.notes && (
                            <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                              {v.notes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
