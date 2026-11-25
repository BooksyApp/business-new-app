import { idTone } from "@/lib/idTone";
import { positionLabel } from "@/lib/positionLabel";
import type { Id } from "@/types/id";
import { useState, useMemo, useEffect, useCallback } from "react";
import { salonNow } from "@/lib/salonClock";
import { useSalonTimeZone } from "@/hooks/useSalonTimeZone";
import { resourceTypeService, type ResourceType } from "@/services/resourceTypeService";
import { timeOffService } from "@/services/timeOffService";
import { currencySymbol } from "@/lib/currency";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus, Calendar, Copy, HelpCircle, Clock, Pencil, CheckCircle2, XCircle, X, UserPlus, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNavigation } from "@/utils/navigationUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parse } from "date-fns";
import { format } from "@/i18n/dateFns";
import { useStaff } from "@/hooks/useStaff";
import { invitationService, type Invitation } from "@/services/clientService";
import { useServices } from "@/hooks/useServices";
import { serviceService } from "@/services/serviceService";
import { useTimeOff } from "@/hooks/useTimeOff";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import { useCommissions, useCommissionRules } from "@/hooks/useCommissions";
import { usePayments } from "@/hooks/usePayments";
import { CommissionCategory, CommissionStatus, CommissionType, type CommissionRule } from "@/services/commissionService";
import type { Staff } from "@/services/staffService";
import { PaymentMethod } from "@/services/paymentService";
import { Dialog } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ShiftsWeek } from "@/components/team/ShiftsWeek";
import { StatCard } from "@/components/page/booqi";
import { ActionMenu, FilterChips } from "@/components/page/kit";
import { money } from "@/components/page/kitStyles";
import { Coins, Percent, TrendingUp, Layers as LayersIcon } from "lucide-react";
import { BooqiScope, EmptyState, FormSheet, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn, sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { Field, RowAction, StatusChip } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
import { cn } from "@/lib/utils";
import { roleService, type BusinessRole } from "@/services/roleService";
import { staffService } from "@/services/staffService";
import { t as tr, fmtDate as formatLocaleDate, formatMinutes } from "@/i18n";

import { roleName, roleDescription } from "@/lib/roleLabel";
import { hasPermission, myAccess } from "@/components/layout/navigation";
// Helper function to format duration
const formatDuration = (minutes?: number): string => {
  if (!minutes) return tr("common.nA");
  return formatMinutes(minutes);
};

// Helper function to format price
const formatPrice = (price?: number): string => {
  if (price === undefined || price === null) return "N/A";
  return `${price.toFixed(2)} ${currencySymbol()}`;
};

// Helper function to get initials
const getInitials = (name: string): string => {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
};

// Helper function to get color class
const getColorClass = (color?: string): string => {
  if (!color) return "bg-gray-400";
  if (color.startsWith("#")) return "";
  if (color.startsWith("bg-")) return color;
  return "bg-gray-400";
};

// #13: a staff member's real per-day hours live in workingHoursStart/workingHoursEnd
// (keys like "MONDAY", values "HH:mm[:ss]") — the only fields the backend actually
// sends. `workingHoursDetail`, read here previously, doesn't exist on any real API
// response, so every read of it was always undefined and every staff member always
// showed as if unconfigured (or, in the Working Hours tab specifically, as a fake
// 10:00–19:00-every-day default that a Save then wrote back as if it were real).
const DAY_KEY_TO_BACKEND: Record<string, string> = {
  sunday: "SUNDAY", monday: "MONDAY", tuesday: "TUESDAY", wednesday: "WEDNESDAY",
  thursday: "THURSDAY", friday: "FRIDAY", saturday: "SATURDAY",
};

function getStaffDayHours(
  staff: { workingHoursStart?: Record<string, string>; workingHoursEnd?: Record<string, string> } | undefined,
  dayKeyLowercase: string
): { start: string | null; end: string | null; isClosed: boolean } {
  const backendKey = DAY_KEY_TO_BACKEND[dayKeyLowercase];
  const start = staff?.workingHoursStart?.[backendKey];
  const end = staff?.workingHoursEnd?.[backendKey];
  if (start && end) {
    return { start: start.slice(0, 5), end: end.slice(0, 5), isClosed: false };
  }
  return { start: null, end: null, isClosed: true };
}

export default function StaffPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("staff-members");
  const [selectedStaffId, setSelectedStaffId] = useState<Id | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [servicesSearchQuery, setServicesSearchQuery] = useState("");
  const [selectedServicesForStaff, setSelectedServicesForStaff] = useState<Id[]>([]);
  const [workingHoursForm, setWorkingHoursForm] = useState<Record<string, { start: string; end: string; isClosed: boolean }>>({});
  const [selectedDate, setSelectedDate] = useState(() => salonNow()); // The salon's today (LR-09)
  const [selectedStaffer, setSelectedStaffer] = useState("All");

  // Fetch data from API
  const businessId = useBusinessId();
  useSalonTimeZone(businessId);
  const { getPath } = useNavigation();
  const { staff: apiStaff, loading: staffLoading, updateStaff, setStaffRole, refresh: refreshStaff } = useStaff(businessId);

  // #55: an owner had no way to see who had been invited and had not signed up yet —
  // the add-staff screen promised an invite and the list said nothing afterwards.
  // Invitations carry no staffId, only recipientEmail, so they match on that.
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  // #43: resource types — shared equipment a booking consumes.
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [resourceForm, setResourceForm] = useState({ name: "", quantity: "1" });
  const [resourceBusy, setResourceBusy] = useState(false);

  const loadResourceTypes = useCallback(() => {
    if (!businessId) return;
    resourceTypeService
      .list(businessId)
      .then((data) => setResourceTypes(data || []))
      .catch(() => setResourceTypes([]));
  }, [businessId]);

  useEffect(() => { loadResourceTypes(); }, [loadResourceTypes]);

  const addResourceType = async () => {
    const name = resourceForm.name.trim();
    const quantity = Number(resourceForm.quantity);
    if (!name || !Number.isFinite(quantity) || quantity < 1) {
      toast.error(tr("staff.nameAndAQuantityOf"));
      return;
    }
    setResourceBusy(true);
    try {
      await resourceTypeService.create(businessId, name, quantity);
      setResourceForm({ name: "", quantity: "1" });
      loadResourceTypes();
      toast.success(tr("staff.resourceAdded"));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : tr("staff.couldNotAddTheResource"));
    } finally {
      setResourceBusy(false);
    }
  };

  const removeResourceType = async (id: Id) => {
    setResourceBusy(true);
    try {
      // Backend deactivates rather than deleting, so existing bookings keep resolving.
      await resourceTypeService.deactivate(businessId, id);
      loadResourceTypes();
      toast.success(tr("staff.resourceDeactivated"));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : tr("staff.couldNotRemoveTheResource"));
    } finally {
      setResourceBusy(false);
    }
  };


  // #48: PUT /api/time-off/{id}/approve and timeOffService.approveTimeOff have existed
  // all along with no caller. Backend create() also approved everything unconditionally,
  // so nothing was ever pending — that half is fixed on the backend; this is the screen
  // that lets a manager actually act on a pending request.
  const [approvingTimeOffId, setApprovingTimeOffId] = useState<Id | null>(null);

  const approveTimeOffRequest = async (timeOffId: Id) => {
    setApprovingTimeOffId(timeOffId);
    try {
      await timeOffService.approveTimeOff(timeOffId, businessId);
      toast.success(tr("staff.timeOffApproved"));
      // The pending list reads timeOffs; without this the approved request stayed listed.
      await Promise.all([refreshStaff(), fetchTimeOffs()]);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : tr("staff.couldNotApproveTheTime"));
    } finally {
      setApprovingTimeOffId(null);
    }
  };

  /** A shift row overrides the staff member's default weekly hours for that date. */
  useEffect(() => {
    if (!businessId) return;
    // Invitations are a MARKETING-permission endpoint on the server; avoid a 403 for other roles.
    if (!hasPermission(myAccess(), "MARKETING")) return;
    invitationService
      .getInvitationsByBusiness(businessId)
      .then((data) => setInvitations(data || []))
      // A failed invitations fetch must not take the staff list down with it.
      .catch(() => setInvitations([]));
  }, [businessId]);

  const pendingInviteFor = (email?: string | null) => {
    const e = (email || "").trim().toLowerCase();
    if (!e) return undefined;
    return invitations.find(
      (inv) => inv.status === "PENDING" && (inv.recipientEmail || "").trim().toLowerCase() === e
    );
  };
  const { services: apiServices, loading: servicesLoading, updateService, refresh: refreshServices } = useServices(businessId);
  const { timeOffs, createTimeOff, loading: timeOffsLoading, fetchTimeOffs } = useTimeOff(businessId);
  const { businessHours, getDefaultHours, getHoursForDay } = useBusinessHours(businessId);
  
  // Commission and Payment hooks
  const selectedStaffIdForCommissions = selectedStaffer !== "All" ? selectedStaffer : undefined;
  const {
    commissions,
    pendingCommissions,
    totalPending,
    loading: commissionsLoading,
    refresh: refreshCommissions,
  } = useCommissions({ staffId: selectedStaffIdForCommissions });
  const {
    rules: commissionRules,
    loading: rulesLoading,
    error: rulesError,
    createRule: createCommissionRule,
    updateRule: updateCommissionRule,
    deleteRule: deleteCommissionRule,
    deleteAllRules: deleteAllCommissionRules,
    getRulesByCategory,
    refresh: refreshCommissionRules
  } = useCommissionRules();
  const { 
    payments, 
    loading: paymentsLoading,
    createPayment 
  } = usePayments({ staffId: selectedStaffIdForCommissions });
  
  // Get default business hours
  const defaultHours = getDefaultHours();
  const businessStartHour = defaultHours ? parseInt(defaultHours.startTime.split(':')[0]) : 10;
  const businessEndHour = defaultHours ? parseInt(defaultHours.endTime.split(':')[0]) : 19;
  
  const [isAddTimeOffOpen, setIsAddTimeOffOpen] = useState(false);
  const [isCommissionRuleDialogOpen, setIsCommissionRuleDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [editingCommissionRule, setEditingCommissionRule] = useState<CommissionRule | null>(null);
  const [commissionRuleForm, setCommissionRuleForm] = useState({
    category: CommissionCategory.DEFAULT,
    type: CommissionType.PERCENTAGE,
    value: 0,
    description: "",
    staffId: undefined as Id | undefined,
    serviceId: undefined as Id | undefined,
    scope: "category" as "category" | "service", // New field to determine if rule is for category or specific service
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    method: PaymentMethod.CASH,
    paymentDate: new Date().toISOString().split('T')[0],
    referenceNumber: "",
    notes: "",
  });
  const [timeOffForm, setTimeOffForm] = useState({
    staffId: "",
    startDate: format(selectedDate, "yyyy-MM-dd"),
    endDate: format(selectedDate, "yyyy-MM-dd"),
    startTime: "",
    endTime: "",
    isFullDay: true,
    isRecurring: false,
    recurrencePattern: "",
    recurrenceEndDate: "",
    reason: "",
    isApproved: false,
  });
  

  // Set default selected staff when data loads
  useEffect(() => {
    if (apiStaff && apiStaff.length > 0 && selectedStaffId === null) {
      setSelectedStaffId(apiStaff[0].id);
    }
  }, [apiStaff, selectedStaffId]);

  const selectedStaff = apiStaff?.find((s) => s.id === selectedStaffId);

  // Initialize selected services when staff is selected
  useEffect(() => {
    if (selectedStaff && apiServices) {
      // Get services currently linked to this staff member
      const linkedServiceIds = apiServices
        .filter(service => service.staffIds?.includes(selectedStaff.id))
        .map(service => service.id);
      setSelectedServicesForStaff(linkedServiceIds);
    } else {
      setSelectedServicesForStaff([]);
    }
  }, [selectedStaff, apiServices]);

  // Initialize working hours form when staff is selected. #13: read the real
  // workingHoursStart/workingHoursEnd (see getStaffDayHours) — a day with no entry
  // there genuinely has no saved hours, so it starts as Closed. Its editable
  // placeholder start/end (shown once the owner toggles that day open) comes from the
  // salon's own hours for that day, not a hardcoded guess — a new/unconfigured staff
  // member's schedule should default to matching when the business itself is open.
  useEffect(() => {
    if (selectedStaff) {
      const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      const hours: Record<string, { start: string; end: string; isClosed: boolean }> = {};
      days.forEach(day => {
        const dayHours = getStaffDayHours(selectedStaff, day);
        const bizHours = getHoursForDay(DAY_KEY_TO_BACKEND[day]);
        hours[day] = {
          start: dayHours.start || bizHours?.startTime || "09:00",
          end: dayHours.end || bizHours?.endTime || "17:00",
          isClosed: dayHours.isClosed,
        };
      });
      setWorkingHoursForm(hours);
    } else {
      setWorkingHoursForm({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- getHoursForDay is derived from businessHours, which is listed
  }, [selectedStaff, businessHours]);

  // Filter all services by search query (for services tab)
  const filteredAllServices = useMemo(() => {
    if (!apiServices) return [];
    if (!servicesSearchQuery.trim()) return apiServices;
    const query = servicesSearchQuery.toLowerCase();
    return apiServices.filter((service) =>
      service.name.toLowerCase().includes(query) ||
      service.description?.toLowerCase().includes(query)
    );
  }, [apiServices, servicesSearchQuery]);

  // Group services by category
  const servicesByCategory = useMemo(() => {
    return filteredAllServices.reduce((acc, service) => {
      const category = service.categoryName || tr("common.notCategorized");
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(service);
      return acc;
    }, {} as Record<string, typeof apiServices>);
  }, [filteredAllServices]);

  const filteredStaff = useMemo(() => {
    if (!apiStaff) return [];
    return apiStaff.filter((staff) =>
      staff.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [apiStaff, searchQuery]);

  const loading = staffLoading || servicesLoading;

  // ── resources: cards + a sheet to create one or link services to it ──
  const [resourceSheet, setResourceSheet] = useState<ResourceType | null | false>(false);
  const [resourceLinks, setResourceLinks] = useState<Id[]>([]);
  const activeResources = resourceTypes.filter((r) => r.isActive !== false);
  const openResource = (r: ResourceType | null) => {
    setResourceLinks([]);
    if (!r) setResourceForm({ name: "", quantity: "1" });
    setResourceSheet(r);
  };
  const saveResource = async () => {
    if (resourceSheet === false) return;
    if (resourceSheet === null) {
      if (!resourceForm.name.trim()) return toast.error(tr("staff.giveTheResourceAName"));
      await addResourceType();
      setResourceSheet(false);
      return;
    }
    // The service API sets a resource but cannot clear one, so this only adds links.
    setResourceBusy(true);
    try {
      await Promise.all(resourceLinks.map((id) => serviceService.updateService(id, businessId, { resourceTypeId: resourceSheet.id })));
      if (resourceLinks.length) toast.success(tr("staff.servicesNowNeed", { count: resourceLinks.length, name: resourceSheet.name }));
      await refreshServices();
      setResourceSheet(false);
    } catch (error) {
      toast.error((error instanceof Error && error.message) || tr("staff.couldNotLinkTheServices"));
    } finally {
      setResourceBusy(false);
    }
  };

  // ── commissions: this month's numbers ──
  const monthKey = format(new Date(), "yyyy-MM");
  // Same rule as the pay run (FG-W1-06): a cancelled commission is not earned.
  const monthEarned = commissions.filter((c) => c.status !== CommissionStatus.CANCELLED && (c.commissionDate || "").startsWith(monthKey)).reduce((n, c) => n + (c.commissionAmount ?? 0), 0);
  const monthPaid = payments.filter((p) => (p.paymentDate || "").startsWith(monthKey)).reduce((n, p) => n + (p.amount ?? 0), 0);

  // ── the member sheet: Profile / Services / Hours / Access ──
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberTab, setMemberTab] = useState<"profile" | "services" | "hours" | "permissions">("profile");
  const [roles, setRoles] = useState<BusinessRole[]>([]);
  const [pickedRoleId, setPickedRoleId] = useState<Id | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", position: "", phone: "", email: "" });
  const [profileBusy, setProfileBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);

  // Roles are owner-only on the server; anyone else simply gets no Access choices.
  const loadRoles = useCallback(() => {
    if (!businessId) return;
    roleService.list(businessId).then(setRoles).catch(() => setRoles([]));
  }, [businessId]);
  useEffect(() => { loadRoles(); }, [loadRoles]);

  const roleOf = (staffId: Id) => roles.find((r) => r.memberIds?.includes(staffId));

  const openMember = (id: Id, tab: "profile" | "services" | "hours" | "permissions") => {
    const s = apiStaff.find((x) => x.id === id);
    setSelectedStaffId(id);
    setMemberTab(tab);
    setServicesSearchQuery("");
    if (s) setProfileForm({ name: s.name || "", position: s.position || "", phone: s.phone || "", email: s.email || "" });
    setPickedRoleId(roleOf(id)?.id ?? null);
    setMemberOpen(true);
  };

  const saveProfile = async () => {
    if (!selectedStaff || !profileForm.name.trim()) return;
    setProfileBusy(true);
    try {
      await updateStaff(selectedStaff.id, {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim() || undefined,
        email: profileForm.email.trim() || undefined,
        position: profileForm.position.trim() || undefined,
      }, { silent: true });
      await refreshStaff();
      toast.success(tr("hooks.staffMemberUpdatedSuccessfully"));
    } catch (error) {
      toast.error((error instanceof Error && error.message) || tr("staff.couldNotSaveTheProfile"));
    } finally {
      setProfileBusy(false);
    }
  };

  const saveRole = async () => {
    if (!selectedStaff || !pickedRoleId) return;
    setRoleBusy(true);
    try {
      await roleService.assign(selectedStaff.id, pickedRoleId);
      toast.success((() => { const pr = roles.find((r) => r.id === pickedRoleId); return pr ? tr("staff.isNow", { name: selectedStaff.name, value: roleName(pr) }) : tr("staff.roleUpdated", { name: selectedStaff.name }); })());
      loadRoles();
      await refreshStaff();
    } catch (error) {
      toast.error((error instanceof Error && error.message) || tr("staff.couldNotChangeTheRole"));
    } finally {
      setRoleBusy(false);
    }
  };

  /** Email (or re-email) the link that lets this person set up their own sign-in. */
  const sendInvite = async () => {
    if (!selectedStaff) return;
    setInviteBusy(true);
    try {
      const r = await staffService.sendInvite(selectedStaff.id);
      toast.success(r.sent ? tr("staff.signInLinkSentTo", { email: r.email }) : tr("staff.linkCreatedForEmailIs", { email: r.email }));
    } catch (error) {
      toast.error((error instanceof Error && error.message) || tr("staff.couldNotSendTheLink"));
    } finally {
      setInviteBusy(false);
    }
  };


  // Toggle service selection for staff
  const handleToggleService = (serviceId: Id) => {
    setSelectedServicesForStaff(prev => {
      if (prev.includes(serviceId)) {
        return prev.filter(id => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  };

  // Save service-staff relationships
  const handleSaveServices = async () => {
    if (!selectedStaff || !apiServices) return;

    try {
      // Update each service to include/exclude the selected staff member
      const updatePromises = apiServices.map(async (service) => {
        const shouldInclude = selectedServicesForStaff.includes(service.id);
        const currentStaffIds = service.staffIds || [];
        const alreadyIncluded = currentStaffIds.includes(selectedStaff.id);

        // Only update if the relationship needs to change
        if (shouldInclude !== alreadyIncluded) {
          const newStaffIds = shouldInclude
            ? [...currentStaffIds, selectedStaff.id]
            : currentStaffIds.filter(id => id !== selectedStaff.id);

          await updateService(service.id, {
            name: service.name,
            description: service.description,
            price: service.price,
            durationMinutes: service.durationMinutes,
            categoryId: service.categoryId,
            color: service.color,
            staffIds: newStaffIds,
          });
        }
      });

      await Promise.all(updatePromises);
      await refreshServices();
      toast.success(tr("staff.servicesUpdatedSuccessfully"));
    } catch (error) {
      toast.error((error instanceof Error && error.message) || tr("staff.failedToSaveServices"));
    }
  };

  // Save working hours
  // #13: the field the backend actually accepts is `schedule` (uppercase day keys,
  // [start, end] tuples, closed days simply omitted) — not `workingHours`, which isn't
  // a field on the update DTO at all. Sending the wrong field name silently dropped
  // it, and the backend's (now-fixed) unconditional delete-then-replace of working
  // hours turned "no schedule was sent" into "delete them all".
  //
  // Takes the hours form as a parameter (rather than always reading the
  // workingHoursForm state) so a caller that just computed a new form value — #16:
  // "Copy Schedule" below — can persist it immediately instead of leaving an edit that
  // *looks* saved (a success toast) sitting unsaved in local state until a separate
  // click on this same tab's own Save button.
  const saveWorkingHoursSchedule = async (
    hoursForm: Record<string, { start: string; end: string; isClosed: boolean }>,
    successMessage = tr("staff.workingHoursUpdatedSuccessfully")
  ) => {
    if (!selectedStaff) return;

    try {
      const schedule: Record<string, string[]> = {};
      Object.entries(hoursForm).forEach(([day, dayHours]) => {
        if (!dayHours.isClosed && dayHours.start && dayHours.end) {
          schedule[DAY_KEY_TO_BACKEND[day]] = [dayHours.start, dayHours.end];
        }
      });
      await updateStaff(selectedStaff.id, { schedule }, { silent: true });
      // The refreshed staff object re-runs the hours effect; clearing the selection to
      // force it (as before) briefly fell back to the first member.
      await refreshStaff();
      toast.success(successMessage);
    } catch (error) {
      toast.error((error instanceof Error && error.message) || tr("staff.failedToSaveWorkingHours"));
    }
  };

  const handleSaveWorkingHours = () => saveWorkingHoursSchedule(workingHoursForm);

  // Quick actions for working hours
  const handleCopyToAllDays = (sourceDay: string) => {
    const sourceHours = workingHoursForm[sourceDay];
    if (!sourceHours) return;

    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const updated = { ...workingHoursForm };
    days.forEach(day => {
      updated[day] = { ...sourceHours };
    });
    setWorkingHoursForm(updated);
    toast.success(tr("staff.copiedHoursToAllDays", { sourceDay }));
  };

  const handleSetWeekdays = () => {
    const mondayBiz = getHoursForDay("MONDAY");
    const mondayHours = workingHoursForm.monday
      || { start: mondayBiz?.startTime || "09:00", end: mondayBiz?.endTime || "17:00", isClosed: false };
    const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday"];
    const updated = { ...workingHoursForm };
    weekdays.forEach(day => {
      updated[day] = { ...mondayHours };
    });
    setWorkingHoursForm(updated);
    toast.success(tr("staff.setSameHoursForAll"));
  };

  const handleSetWeekends = () => {
    const saturdayBiz = getHoursForDay("SATURDAY");
    const saturdayHours = workingHoursForm.saturday
      || { start: saturdayBiz?.startTime || "09:00", end: saturdayBiz?.endTime || "17:00", isClosed: false };
    const weekends = ["saturday", "sunday"];
    const updated = { ...workingHoursForm };
    weekends.forEach(day => {
      updated[day] = { ...saturdayHours };
    });
    setWorkingHoursForm(updated);
    toast.success(tr("staff.setSameHoursForWeekends"));
  };





  // Parse time string to total minutes for comparison
  const parseTimeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  };

  // Check if a new time off conflicts with existing time offs
  const hasTimeOffConflict = (
    staffId: string | number,
    startDate: string,
    endDate: string,
    startTime: string,
    endTime: string,
    isFullDay: boolean
  ): boolean => {
    if (!timeOffs || timeOffs.length === 0) return false;
    
    const staffIdStr = staffId.toString();
    const newStartDate = parse(startDate, "yyyy-MM-dd", new Date());
    const newEndDate = parse(endDate, "yyyy-MM-dd", new Date());
    
    // For full day time offs, use business hours for conflict detection
    const newStart = parseTimeToMinutes(isFullDay 
      ? `${businessStartHour.toString().padStart(2, "0")}:00` 
      : startTime);
    const newEnd = parseTimeToMinutes(isFullDay 
      ? `${businessEndHour.toString().padStart(2, "0")}:00` 
      : endTime);
    
    return timeOffs.some((existing) => {
      // Must be same staff member
      if (existing.staffId.toString() !== staffIdStr) return false;
      
      // Check if date ranges overlap
      const existingStartDate = parse(existing.startDate, "yyyy-MM-dd", new Date());
      const existingEndDate = parse(existing.endDate, "yyyy-MM-dd", new Date());
      
      // Date ranges must overlap
      if (newEndDate < existingStartDate || newStartDate > existingEndDate) {
        return false;
      }
      
      // If dates overlap, check time overlap
      const existingStart = parseTimeToMinutes(existing.isFullDay 
        ? `${businessStartHour.toString().padStart(2, "0")}:00` 
        : (existing.startTime || "00:00"));
      const existingEnd = parseTimeToMinutes(existing.isFullDay 
        ? `${businessEndHour.toString().padStart(2, "0")}:00` 
        : (existing.endTime || "23:59"));
      
      // Check for time overlap
      return (newStart < existingEnd && newEnd > existingStart);
    });
  };


  return (
    <AppLayout>
      <BooqiScope>
      <div className="flex flex-col">
        <PageHeader helpSlug="komanda-elave-etmek"
          title={tr("common.team")}
          subtitle={tr("staff.whoWorksHereWhatThey")}
          actions={
            <Button className={primaryBtn} onClick={() => navigate(getPath("add-staff"))}>
              <UserPlus size={16} />{" "}{tr("common.addTeamMember")}
            </Button>
          }
        />
        <div className="px-4 pt-5 md:px-8">
          <div role="tablist" aria-label={tr("staff.teamSections")} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-[rgb(var(--reg-ink)/0.05)] p-1 [scrollbar-width:none]">
            {[
              { key: "staff-members", label: tr("staff.members") },
              { key: "shifts", label: tr("staff.shifts") },
              // #43: resource types — shared equipment a booking consumes.
              { key: "resources", label: tr("staff.resources") },
              { key: "commissions", label: tr("staff.commissions") },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors",
                  activeTab === t.key
                    ? "bg-white text-[rgb(var(--reg-ink))] shadow-[0_1px_2px_rgb(var(--reg-ink)/0.06),0_4px_12px_-6px_rgb(var(--reg-ink)/0.15)]"
                    : "text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {/* Shifts View */}
        {activeTab === "resources" && (
          <div className={pageBody}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="max-w-xl text-sm text-[rgb(var(--reg-muted))]">
                {tr("staff.theEquipmentBookingsShareChairs")}
              </p>
              <Button className={primaryBtn} onClick={() => openResource(null)}><Plus size={16} />{" "}{tr("staff.newResource")}</Button>
            </div>
            {activeResources.length === 0 ? (
              <EmptyState
                icon={LayersIcon}
                title={tr("staff.noResourcesYet")}
                body={tr("staff.addTheRoomsAndEquipment")}
                action={<Button className={primaryBtn} onClick={() => openResource(null)}><Plus size={16} />{" "}{tr("staff.newResource")}</Button>}
              />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {activeResources.map((r) => {
                  const linked = apiServices.filter((s) => (s as { resourceTypeId?: Id | null }).resourceTypeId === r.id);
                  return (
                    <li key={r.id} className="flex flex-col rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand))]"><LayersIcon size={20} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[16px] font-bold">{r.name}</p>
                          <p className="text-sm text-[rgb(var(--reg-muted))]">{tr("staff.capacityAtATime", { quantity: r.quantity })}</p>
                        </div>
                        <ActionMenu
                          label={tr("common.moreFor", { name: r.name })}
                          actions={[
                            { label: tr("staff.linkServices"), icon: Pencil, onSelect: () => openResource(r) },
                            { label: tr("common.remove"), icon: X, danger: true, disabled: resourceBusy, onSelect: () => { if (confirm(tr("staff.removeExistingBookingsKeepIt", { name: r.name }))) void removeResourceType(r.id); } },
                          ]}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {linked.length === 0 ? (
                          <span className="text-xs text-[rgb(var(--reg-muted))]">{tr("staff.noServicesUseItYet")}</span>
                        ) : (
                          linked.map((s) => (
                            <span key={s.id} className="rounded-full bg-[rgb(var(--reg-ink)/0.05)] px-2.5 py-1 text-xs font-semibold">{s.name}</span>
                          ))
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <FormSheet
          open={resourceSheet !== false}
          onOpenChange={(o) => !o && setResourceSheet(false)}
          title={resourceSheet ? resourceSheet.name : tr("staff.newResource")}
          description={resourceSheet ? tr("staff.capacityPickTheServicesThat", { quantity: resourceSheet.quantity }) : tr("staff.aRoomOrAPiece")}
          footer={
            <>
              <Button variant="outline" className={sheetSecondary} onClick={() => setResourceSheet(false)}>{tr("common.cancel")}</Button>
              <Button className={sheetPrimary} disabled={resourceBusy} onClick={() => void saveResource()}>
                {resourceBusy ? tr("common.saving") : resourceSheet ? tr("common.save") : tr("staff.createResource")}
              </Button>
            </>
          }
        >
          {!resourceSheet && (
            <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
              <Field label={tr("common.name")} htmlFor="rs-name">
                <input id="rs-name" className={fieldCls} value={resourceForm.name} placeholder={tr("staff.washbasin")} onChange={(e) => setResourceForm((f) => ({ ...f, name: e.target.value }))} />
              </Field>
              <Field label={tr("staff.capacity")} htmlFor="rs-qty">
                <input id="rs-qty" type="number" min={1} className={fieldCls} value={resourceForm.quantity} onChange={(e) => setResourceForm((f) => ({ ...f, quantity: e.target.value }))} />
              </Field>
            </div>
          )}
          <Field label={tr("staff.servicesThatNeedIt")} hint={resourceSheet ? tr("staff.linkingTakesEffectForNew") : tr("staff.youCanLinkServicesAfter")}>
            {resourceSheet ? (
              <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto">
                {apiServices.map((s) => {
                  const current = (s as { resourceTypeId?: Id | null }).resourceTypeId;
                  const already = current === resourceSheet.id;
                  return (
                    <li key={s.id}>
                      <label className={cn("flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 ring-1 ring-[rgb(var(--reg-line)/0.8)]", already && "opacity-70")}>
                        <Checkbox checked={already || resourceLinks.includes(s.id)} disabled={already} onCheckedChange={() => setResourceLinks((l) => (l.includes(s.id) ? l.filter((x) => x !== s.id) : [...l, s.id]))} />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.name}</span>
                        {current && !already && <span className="text-[11px] text-[rgb(var(--reg-muted))]">{tr("staff.usesAnother")}</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </Field>
        </FormSheet>

        {activeTab === "shifts" && (
          <div className={pageBody}>
            <ShiftsWeek
              businessId={businessId}
              timeOffs={timeOffs}
              approvingId={approvingTimeOffId}
              onApprove={approveTimeOffRequest}
              onAddTimeOff={() => setIsAddTimeOffOpen(true)}
            />
          </div>
        )}

        {/* Edit Business Hours Dialog */}


        {/* Commissions View */}
        {activeTab === "commissions" && (
          <div className={pageBody}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FilterChips<string>
                label={tr("common.teamMember")}
                value={selectedStaffer}
                onChange={setSelectedStaffer}
                options={[{ value: "All", label: tr("staff.everyone") }, ...apiStaff.map((s) => ({ value: String(s.id), label: s.name }))]}
              />
              <div className="flex gap-2">
                {selectedStaffer !== "All" && pendingCommissions.length > 0 && (
                  <Button className={primaryBtn} onClick={() => setIsPaymentDialogOpen(true)}><Coins size={16} />{" "}{tr("staff.payOut", { value: money(totalPending, currencySymbol()) })}</Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard icon={TrendingUp} label={tr("staff.earnedThisMonth")} value={money(Math.round(monthEarned * 100) / 100, currencySymbol())} hint={selectedStaffer === "All" ? tr("staff.wholeTeam") : apiStaff.find((s) => String(s.id) === selectedStaffer)?.name} tone="violet" />
              <StatCard icon={Clock} label={tr("staff.waitingToBePaid")} value={money(Math.round(totalPending * 100) / 100, currencySymbol())} hint={tr("staff.pendingItemsCount", { n: pendingCommissions.length })} tone="amber" />
              <StatCard icon={Coins} label={tr("staff.paidOutThisMonth")} value={money(Math.round(monthPaid * 100) / 100, currencySymbol())} tone="emerald" />
              <StatCard icon={Percent} label={tr("staff.rules")} value={commissionRules.length} hint={rulesError ? tr("staff.couldNotLoad") : tr("staff.defaultAndPerPerson")} tone="sky" />
            </div>

            <section className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 md:px-5">
                <h2 className="text-base font-extrabold">{tr("staff.commissionRates")}</h2>
                {commissionRules.length > 0 && (
                  <button
                    type="button"
                    className="text-sm font-semibold text-rose-700 hover:underline"
                    onClick={async () => {
                      if (window.confirm(tr("staff.deleteAllCommissionRulesThis"))) {
                        try {
                          await deleteAllCommissionRules();
                          toast.success(tr("staff.allCommissionRulesDeleted"));
                        } catch {
                          toast.error(tr("staff.failedToDeleteCommissionRules"));
                        }
                      }
                    }}
                  >
                    {tr("staff.deleteAllRules")}
                  </button>
                )}
              </div>
              {rulesLoading ? (
                <div className="m-4 h-40 animate-pulse rounded-2xl bg-[rgb(var(--reg-canvas))]" />
              ) : (
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">
                      <th scope="col" className="px-4 py-2 font-bold md:px-5">{tr("staff.sold")}</th>
                      <th scope="col" className="px-2 py-2 font-bold">{tr("staff.everyone")}</th>
                      {selectedStaffIdForCommissions && <th scope="col" className="px-2 py-2 font-bold">{apiStaff.find((s) => s.id === selectedStaffIdForCommissions)?.name.split(" ")[0]}</th>}
                      <th scope="col" className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {COMMISSION_ROWS.map((item) => {
                      const categoryRules = commissionRules.filter((r) => r.category === item.category);
                      const defaultRule = categoryRules.find((r) => !r.staffId && !r.serviceId);
                      const memberRule = selectedStaffIdForCommissions ? categoryRules.find((r) => r.staffId === selectedStaffIdForCommissions && !r.serviceId) : undefined;
                      const others = categoryRules.filter((r) => r.staffId && !r.serviceId).length;
                      const ruleToEdit = selectedStaffIdForCommissions ? memberRule : defaultRule;
                      return (
                        <tr key={item.category} className="border-t border-[rgb(var(--reg-line)/0.6)]">
                          <th scope="row" className="px-4 py-3 text-left font-semibold md:px-5">
                            {item.name}
                            {!selectedStaffIdForCommissions && others > 0 && <span className="block text-xs font-normal text-[rgb(var(--reg-muted))]">{tr("staff.personalRates", { count: others })}</span>}
                          </th>
                          <td className="px-2 py-3 tabular-nums">{rateText(defaultRule)}</td>
                          {selectedStaffIdForCommissions && <td className="px-2 py-3 font-semibold tabular-nums">{memberRule ? rateText(memberRule) : <span className="font-normal text-[rgb(var(--reg-muted))]">{tr("staff.usesDefault")}</span>}</td>}
                          <td className="pr-3">
                            <button
                              type="button"
                              aria-label={tr("staff.editRate", { name: item.name })}
                              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[rgb(var(--reg-ink)/0.06)]"
                              onClick={() => {
                                setEditingCommissionRule(ruleToEdit || null);
                                setCommissionRuleForm({
                                  category: item.category,
                                  type: ruleToEdit?.type || CommissionType.PERCENTAGE,
                                  value: ruleToEdit?.value || 0,
                                  description: ruleToEdit?.description || "",
                                  staffId: selectedStaffIdForCommissions || ruleToEdit?.staffId || undefined,
                                  serviceId: ruleToEdit?.serviceId || undefined,
                                  scope: ruleToEdit?.serviceId ? "service" : "category",
                                });
                                setIsCommissionRuleDialogOpen(true);
                              }}
                            >
                              <Pencil size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {commissionRules
                      .filter((r) => r.serviceId && (!selectedStaffIdForCommissions || !r.staffId || r.staffId === selectedStaffIdForCommissions))
                      .map((r) => (
                        <tr key={r.id} className="border-t border-[rgb(var(--reg-line)/0.6)] bg-[rgb(var(--reg-canvas)/0.5)]">
                          <th scope="row" className="px-4 py-2.5 text-left font-normal md:px-5">
                            <span className="font-semibold">{apiServices.find((s) => s.id === r.serviceId)?.name ?? tr("staff.aService")}</span>
                            <span className="block text-xs text-[rgb(var(--reg-muted))]">{r.staffId ? apiStaff.find((s) => s.id === r.staffId)?.name : tr("staff.everyone")}{" "}{tr("staff.thisServiceOnly")}</span>
                          </th>
                          <td className="px-2 py-2.5 tabular-nums" colSpan={selectedStaffIdForCommissions ? 2 : 1}>{rateText(r)}</td>
                          <td className="pr-3">
                            <ActionMenu
                              label={tr("staff.moreForThisRule")}
                              actions={[
                                {
                                  label: tr("common.edit"),
                                  icon: Pencil,
                                  onSelect: () => {
                                    setEditingCommissionRule(r);
                                    setCommissionRuleForm({ category: r.category, type: r.type, value: r.value, description: r.description || "", staffId: r.staffId || undefined, serviceId: r.serviceId, scope: "service" });
                                    setIsCommissionRuleDialogOpen(true);
                                  },
                                },
                                { label: tr("common.delete"), icon: X, danger: true, onSelect: () => { if (r.id && confirm(tr("staff.deleteThisRule"))) void deleteCommissionRule(r.id).then(() => toast.success(tr("staff.ruleDeleted"))).catch(() => toast.error(tr("staff.couldNotDeleteTheRule"))); } },
                              ]}
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
              <p className="px-4 pb-4 pt-2 text-xs text-[rgb(var(--reg-muted))] md:px-5">{tr("staff.aPersonalRateBeatsThe")}</p>
            </section>

            {selectedStaffer !== "All" && (
              <section className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                <h2 className="px-4 pt-4 text-base font-extrabold md:px-5">{tr("staff.waitingToBePaid")}</h2>
                {commissionsLoading ? (
                  <div className="m-4 h-20 animate-pulse rounded-2xl bg-[rgb(var(--reg-canvas))]" />
                ) : pendingCommissions.length === 0 ? (
                  <p className="px-4 pb-5 pt-2 text-sm text-[rgb(var(--reg-muted))] md:px-5">{tr("staff.nothingOwedRightNow")}</p>
                ) : (
                  <ul className="mt-2">
                    {pendingCommissions.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 border-t border-[rgb(var(--reg-line)/0.6)] px-4 py-3 md:px-5">
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold capitalize">{c.category.replace("_", " ").toLowerCase()}</span>
                          <span className="block text-xs text-[rgb(var(--reg-muted))]">{tr("staff.sale", { value: money(c.saleAmount, currencySymbol()), value2: formatLocaleDate(new Date(c.commissionDate), { day: "numeric", month: "short" }) })}</span>
                        </span>
                        <span className="text-sm font-extrabold tabular-nums text-[rgb(var(--reg-ink))]">{money(c.commissionAmount, currencySymbol())}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}

        {/* Staff Members View */}
        {activeTab === "staff-members" && (
          <div className={pageBody}>
            {apiStaff.length > 3 && (
              <div className="relative max-w-md">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))]" aria-hidden />
                <input aria-label={tr("staff.searchTeam")} className={cn(fieldCls, "h-11 pl-10")} placeholder={tr("staff.searchTeam")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            )}
            {loading ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy>
                {[0, 1, 2].map((i) => <div key={i} className="h-44 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" />)}
              </div>
            ) : apiStaff.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title={tr("staff.justYouSoFar")}
                body={tr("staff.addThePeopleWhoDo")}
                action={<Button className={primaryBtn} onClick={() => navigate(getPath("add-staff"))}><UserPlus size={16} />{" "}{tr("common.addTeamMember")}</Button>}
              />
            ) : filteredStaff.length === 0 ? (
              <p className="rounded-[20px] bg-white px-5 py-10 text-center text-sm text-[rgb(var(--reg-muted))] ring-1 ring-[rgb(var(--reg-line)/0.8)]">{tr("staff.nobodyMatches", { searchQuery })}</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredStaff.map((staff) => {
                  const invite = pendingInviteFor(staff.email);
                  const role = roleOf(staff.id);
                  const serviceCount = apiServices.filter((s) => s.staffIds?.includes(staff.id)).length;
                  return (
                    <li key={staff.id}>
                      <button
                        type="button"
                        onClick={() => openMember(staff.id, "profile")}
                        className="flex h-full w-full flex-col rounded-[20px] bg-white p-4 text-left ring-1 ring-[rgb(var(--reg-line)/0.8)] transition hover:-translate-y-0.5 hover:ring-[rgb(var(--reg-brand)/0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.6)]"
                      >
                        <span className="flex items-start gap-3">
                          <MemberAvatar name={staff.name} id={staff.id} url={staff.avatarUrl} size="h-14 w-14 text-lg" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[16px] font-bold">{staff.name}</span>
                            <span className="block truncate text-sm text-[rgb(var(--reg-muted))]">{positionLabel(staff.position) || tr("staff.noPositionSet")}</span>
                            <span className="mt-1.5 flex flex-wrap gap-1.5">
                              {role && (
                                <span className="rounded-full bg-[rgb(var(--reg-brand-soft))] px-2 py-0.5 text-[11px] font-bold text-[rgb(var(--reg-brand-strong))]">{roleName(role)}</span>
                              )}
                              {/* #55: pending means the invitation exists and the person has
                                  not registered yet — not that the email was delivered. */}
                              {invite && <StatusChip status="draft" label={tr("staff.invited")} className="px-2 py-0.5 text-[11px]" />}
                            </span>
                          </span>
                        </span>
                        <span className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-2 text-sm">
                          <span className="rounded-xl bg-[rgb(var(--reg-canvas))] px-3 py-2">
                            <span className="block text-[11px] font-semibold text-[rgb(var(--reg-muted))]">{tr("common.services")}</span>
                            <span className="block font-bold tabular-nums">{serviceCount}</span>
                          </span>
                          <span className="rounded-xl bg-[rgb(var(--reg-canvas))] px-3 py-2">
                            <span className="block text-[11px] font-semibold text-[rgb(var(--reg-muted))]">{tr("staff.works")}</span>
                            <span className="block truncate font-bold">{hoursSummary(staff).split(" · ")[0]}</span>
                            <span className="block truncate text-xs text-[rgb(var(--reg-muted))]">{hoursSummary(staff).split(" · ")[1] ?? ""}</span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <FormSheet
          open={memberOpen && !!selectedStaff}
          onOpenChange={setMemberOpen}
          title={selectedStaff?.name ?? tr("common.teamMember")}
          description={selectedStaff ? [positionLabel(selectedStaff.position), (() => { const ro = roleOf(selectedStaff.id); return ro ? roleName(ro) : undefined; })()].filter(Boolean).join(" · ") || undefined : undefined}
          footer={
            memberTab === "profile" ? (
              <>
                <Button variant="outline" className={sheetSecondary} onClick={() => setMemberOpen(false)}>{tr("common.close")}</Button>
                <Button className={sheetPrimary} disabled={profileBusy || !profileForm.name.trim()} onClick={() => void saveProfile()}>
                  {profileBusy ? tr("common.saving") : tr("staff.saveProfile")}
                </Button>
              </>
            ) : memberTab === "permissions" ? (
              <>
                <Button variant="outline" className={sheetSecondary} onClick={() => setMemberOpen(false)}>{tr("common.close")}</Button>
                <Button className={sheetPrimary} disabled={roleBusy || !pickedRoleId || pickedRoleId === roleOf(selectedStaff?.id ?? "")?.id} onClick={() => void saveRole()}>
                  {roleBusy ? tr("common.saving") : tr("staff.saveRole")}
                </Button>
              </>
            ) : undefined
          }
        >
          {selectedStaff && (
            <>
              <div role="tablist" aria-label={tr("staff.memberSections")} className="grid grid-cols-4 gap-1 rounded-full bg-[rgb(var(--reg-ink)/0.05)] p-1">
                {([
                  ["profile", tr("staff.tabProfile")],
                  ["services", tr("staff.tabServices")],
                  ["hours", tr("staff.tabHours")],
                  ["permissions", tr("staff.tabAccess")],
                ] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={memberTab === k}
                    onClick={() => setMemberTab(k)}
                    className={cn(
                      "h-9 rounded-full text-sm font-semibold transition-colors",
                      memberTab === k ? "bg-white text-[rgb(var(--reg-ink))] shadow-[0_1px_2px_rgb(var(--reg-ink)/0.08)]" : "text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {memberTab === "profile" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                    <MemberAvatar name={selectedStaff.name} id={selectedStaff.id} url={selectedStaff.avatarUrl} size="h-16 w-16 text-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-extrabold">{selectedStaff.name}</p>
                      <p className="text-sm text-[rgb(var(--reg-muted))]">{hoursSummary(selectedStaff)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <RowAction icon={Calendar} tone="ink" onClick={() => navigate(getPath("calendar"))}>{tr("common.calendar")}</RowAction>
                        {selectedStaff.email && (
                          <RowAction icon={Send} disabled={inviteBusy} onClick={() => void sendInvite()}>
                            {pendingInviteFor(selectedStaff.email) ? tr("staff.resendSignInLink") : tr("staff.sendSignInLink")}
                          </RowAction>
                        )}
                      </div>
                    </div>
                  </div>
                  <Field label={tr("common.name")} htmlFor="m-name">
                    <input id="m-name" className={fieldCls} value={profileForm.name} onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))} />
                  </Field>
                  <Field label={tr("common.position")} htmlFor="m-position" hint={tr("staff.clientsSeeItWhenThey")}>
                    <input id="m-position" className={fieldCls} value={profileForm.position} placeholder={tr("staff.stylist")} onChange={(e) => setProfileForm((f) => ({ ...f, position: e.target.value }))} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={tr("common.phone")} htmlFor="m-phone">
                      <input id="m-phone" type="tel" className={fieldCls} value={profileForm.phone} onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))} />
                    </Field>
                    <Field label={tr("common.email")} htmlFor="m-email">
                      <input id="m-email" type="email" className={fieldCls} value={profileForm.email} onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))} />
                    </Field>
                  </div>
                </div>
              )}

                {memberTab === "services" && (
                  <div className="space-y-6">
                    {/* Search Services */}
                    <div className="relative max-w-md">
                      <Search
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                        size={18}
                      />
                      <Input
                        type="text"
                        placeholder={tr("common.searchServices")}
                        className="pl-10"
                        value={servicesSearchQuery}
                        onChange={(e) => setServicesSearchQuery(e.target.value)}
                      />
                    </div>

                    {/* Services by Category */}
                    {Object.keys(servicesByCategory).length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p className="text-sm">
                          {selectedStaff 
                            ? servicesSearchQuery 
                              ? tr("staff.noServicesFoundMatchingYour")
                              : tr("staff.noServicesAssignedToThis")
                            : tr("staff.selectAStaffMemberTo")}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {Object.entries(servicesByCategory).map(
                          ([category, services]) => (
                            <div key={category} className="space-y-3">
                              <h3 className="text-sm font-semibold text-gray-700 uppercase">
                                {category}
                              </h3>
                              <div className="space-y-2">
                                {services.map((service) => {
                                const colorClass = getColorClass(service.color);
                                const colorStyle = service.color?.startsWith("#") ? { backgroundColor: service.color } : {};
                                const isSelected = selectedServicesForStaff.includes(service.id);
                                
                                return (
                                  <div
                                    key={service.id}
                                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => handleToggleService(service.id)}
                                      className="mr-2"
                                    />
                                    <div
                                      className={`w-1 h-12 rounded-full ${colorClass}`}
                                      style={colorStyle}
                                    />
                                    <div className="flex-1">
                                      <h4 className="font-medium text-gray-900">
                                        {service.name}
                                      </h4>
                                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                                        <span>{formatDuration(service.durationMinutes)}</span>
                                        <span className="font-semibold text-gray-900">
                                          {formatPrice(service.price)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )
                      )}
                      </div>
                    )}

                    {/* Save Services Button */}
                    {selectedStaff && (
                      <div className="pt-4">
                        <Button 
                          className={cn(sheetPrimary, "w-full")}
                          onClick={handleSaveServices}
                          disabled={servicesLoading}
                        >
                          {tr("staff.saveServices")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}


                {memberTab === "hours" && (
                  <div className="space-y-6">
                    {!selectedStaff ? (
                      <div className="text-center py-12 text-gray-500">
                        <Clock size={48} className="mx-auto mb-4 text-gray-300" />
                        <p className="text-sm font-medium">{tr("staff.selectAStaffMemberTo2")}</p>
                      </div>
                    ) : (
                      <>
                        {/* Quick Actions */}
                        <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                              <Clock size={16} className="text-[rgb(var(--reg-brand))]" />
                              {tr("staff.quickActions")}
                            </h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleSetWeekdays}
                              className="text-xs"
                            >
                              <Copy size={14} className="mr-1" />
                              {tr("staff.copyMondayToWeekdays")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleSetWeekends}
                              className="text-xs"
                            >
                              <Copy size={14} className="mr-1" />
                              {tr("staff.copySaturdayToWeekends")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyToAllDays("monday")}
                              className="text-xs"
                            >
                              <Copy size={14} className="mr-1" />
                              {tr("staff.copyMondayToAllDays")}
                            </Button>
                          </div>
                        </div>

                        {/* Weekdays Section */}
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                            {tr("staff.weekdays")}
                          </h3>
                          <div className="space-y-2">
                            {[
                              { key: "monday", label: tr("common.monday"), get short() { return tr("common.dayMon"); } },
                              { key: "tuesday", label: tr("common.tuesday"), get short() { return tr("common.dayTue"); } },
                              { key: "wednesday", label: tr("common.wednesday"), get short() { return tr("common.dayWed"); } },
                              { key: "thursday", label: tr("common.thursday"), get short() { return tr("common.dayThu"); } },
                              { key: "friday", label: tr("common.friday"), get short() { return tr("common.dayFri"); } },
                            ].map((day) => {
                              const dayHours = workingHoursForm[day.key] || { start: "10:00", end: "19:00", isClosed: false };
                              
                              return (
                                <div
                                  key={day.key}
                                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-white p-3 ring-1 ring-[rgb(var(--reg-line)/0.8)]"
                                >
                                  <div className="w-20 flex-shrink-0">
                                    <div className="flex items-center gap-2">
                                      {dayHours.isClosed ? (
                                        <XCircle size={16} className="text-red-500" />
                                      ) : (
                                        <CheckCircle2 size={16} className="text-[rgb(var(--reg-success))]" />
                                      )}
                                      <Label className="text-sm font-medium text-gray-900">
                                        {day.short}
                                      </Label>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2 flex-shrink-0">
                                    <Checkbox
                                      id={`${day.key}-closed`}
                                      checked={dayHours.isClosed}
                                      onCheckedChange={(checked) => {
                                        setWorkingHoursForm(prev => ({
                                          ...prev,
                                          [day.key]: {
                                            ...prev[day.key],
                                            isClosed: checked === true,
                                          },
                                        }));
                                      }}
                                    />
                                    <Label
                                      htmlFor={`${day.key}-closed`}
                                      className="text-xs text-gray-600 cursor-pointer"
                                    >
                                      {tr("common.closed")}
                                    </Label>
                                  </div>
                                  {!dayHours.isClosed && (
                                    <div className="flex min-w-[230px] flex-1 items-center gap-2">
                                      <div className="flex flex-1 items-center gap-2">
                                        <Clock size={14} className="text-gray-400" />
                                        <Input
                                          type="time"
                                          value={dayHours.start}
                                          onChange={(e) => {
                                            setWorkingHoursForm(prev => ({
                                              ...prev,
                                              [day.key]: {
                                                ...prev[day.key],
                                                start: e.target.value,
                                              },
                                            }));
                                          }}
                                          className="h-8 text-sm"
                                        />
                                        <span className="text-gray-400">-</span>
                                        <Input
                                          type="time"
                                          value={dayHours.end}
                                          onChange={(e) => {
                                            setWorkingHoursForm(prev => ({
                                              ...prev,
                                              [day.key]: {
                                                ...prev[day.key],
                                                end: e.target.value,
                                              },
                                            }));
                                          }}
                                          className="h-8 text-sm"
                                        />
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCopyToAllDays(day.key)}
                                        className="h-8 px-2 text-xs"
                                        title={tr("staff.copyHoursToAllDays", { label: day.label })}
                                      >
                                        <Copy size={12} />
                                      </Button>
                                    </div>
                                  )}
                                  {dayHours.isClosed && (
                                    <div className="flex-1 flex items-center justify-between">
                                      <span className="text-sm text-gray-500 italic">
                                        {tr("staff.closedAllDay")}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCopyToAllDays(day.key)}
                                        className="h-8 px-2 text-xs"
                                        title={tr("staff.copyHoursToAllDays", { label: day.label })}
                                      >
                                        <Copy size={12} />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Weekends Section */}
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                            {tr("staff.weekends")}
                          </h3>
                          <div className="space-y-2">
                            {[
                              { key: "saturday", label: tr("common.saturday"), get short() { return tr("common.daySat"); } },
                              { key: "sunday", label: tr("common.sunday"), get short() { return tr("common.daySun"); } },
                            ].map((day) => {
                              const dayHours = workingHoursForm[day.key] || { start: "10:00", end: "19:00", isClosed: false };
                              
                              return (
                                <div
                                  key={day.key}
                                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-white p-3 ring-1 ring-[rgb(var(--reg-line)/0.8)]"
                                >
                                  <div className="w-20 flex-shrink-0">
                                    <div className="flex items-center gap-2">
                                      {dayHours.isClosed ? (
                                        <XCircle size={16} className="text-red-500" />
                                      ) : (
                                        <CheckCircle2 size={16} className="text-[rgb(var(--reg-success))]" />
                                      )}
                                      <Label className="text-sm font-medium text-gray-900">
                                        {day.short}
                                      </Label>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2 flex-shrink-0">
                                    <Checkbox
                                      id={`${day.key}-closed`}
                                      checked={dayHours.isClosed}
                                      onCheckedChange={(checked) => {
                                        setWorkingHoursForm(prev => ({
                                          ...prev,
                                          [day.key]: {
                                            ...prev[day.key],
                                            isClosed: checked === true,
                                          },
                                        }));
                                      }}
                                    />
                                    <Label
                                      htmlFor={`${day.key}-closed`}
                                      className="text-xs text-gray-600 cursor-pointer"
                                    >
                                      {tr("common.closed")}
                                    </Label>
                                  </div>
                                  {!dayHours.isClosed && (
                                    <div className="flex min-w-[230px] flex-1 items-center gap-2">
                                      <div className="flex flex-1 items-center gap-2">
                                        <Clock size={14} className="text-gray-400" />
                                        <Input
                                          type="time"
                                          value={dayHours.start}
                                          onChange={(e) => {
                                            setWorkingHoursForm(prev => ({
                                              ...prev,
                                              [day.key]: {
                                                ...prev[day.key],
                                                start: e.target.value,
                                              },
                                            }));
                                          }}
                                          className="h-8 text-sm"
                                        />
                                        <span className="text-gray-400">-</span>
                                        <Input
                                          type="time"
                                          value={dayHours.end}
                                          onChange={(e) => {
                                            setWorkingHoursForm(prev => ({
                                              ...prev,
                                              [day.key]: {
                                                ...prev[day.key],
                                                end: e.target.value,
                                              },
                                            }));
                                          }}
                                          className="h-8 text-sm"
                                        />
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCopyToAllDays(day.key)}
                                        className="h-8 px-2 text-xs"
                                        title={tr("staff.copyHoursToAllDays", { label: day.label })}
                                      >
                                        <Copy size={12} />
                                      </Button>
                                    </div>
                                  )}
                                  {dayHours.isClosed && (
                                    <div className="flex-1 flex items-center justify-between">
                                      <span className="text-sm text-gray-500 italic">
                                        {tr("staff.closedAllDay")}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCopyToAllDays(day.key)}
                                        className="h-8 px-2 text-xs"
                                        title={tr("staff.copyHoursToAllDays", { label: day.label })}
                                      >
                                        <Copy size={12} />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Save Button */}
                        <div className="pt-4 border-t border-gray-200">
                          <Button
                            className={cn(sheetPrimary, "w-full")}
                            onClick={handleSaveWorkingHours}
                            disabled={staffLoading}
                            size="lg"
                          >
                            <Clock size={16} className="mr-2" />
                            {tr("staff.saveWorkingHours")}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

              {memberTab === "permissions" && (
                <div className="space-y-3">
                  <p className="text-sm text-[rgb(var(--reg-muted))]">
                    {tr("staff.everyoneSeesTheirOwnCalendar")}{" "}
                    <button type="button" className="font-semibold text-[rgb(var(--reg-brand-strong))] hover:underline" onClick={() => navigate(getPath("roles"))}>{tr("staff.editRoles")}</button>
                  </p>
                  <div role="radiogroup" aria-label={tr("common.role")} className="space-y-2">
                    {roles.filter((r) => !r.isOwner).map((r) => {
                      const on = pickedRoleId === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setPickedRoleId(r.id)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-2xl p-4 text-left ring-1 ring-inset transition",
                            on ? "bg-[rgb(var(--reg-brand-soft))] ring-[rgb(var(--reg-brand))]" : "bg-white ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-brand)/0.4)]",
                          )}
                        >
                          <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-2", on ? "ring-[rgb(var(--reg-brand))]" : "ring-[rgb(var(--reg-line))]")}>
                            {on && <span className="h-2.5 w-2.5 rounded-full bg-[rgb(var(--reg-brand))]" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-bold">{roleName(r)}</span>
                            <span className="block text-xs text-[rgb(var(--reg-muted))]">
                              {roleDescription(r) || (r.permissions.length ? `${r.permissions.length} permissions` : tr("staff.ownCalendarOnly"))}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </FormSheet>
      </div>

      {/* Add Time Off Sheet */}
      <Sheet open={isAddTimeOffOpen} onOpenChange={(open) => {
        setIsAddTimeOffOpen(open);
        if (!open) {
          // Reset form when closed
          setTimeOffForm({
            staffId: "",
            startDate: format(selectedDate, "yyyy-MM-dd"),
            endDate: format(selectedDate, "yyyy-MM-dd"),
            startTime: "",
            endTime: "",
            isFullDay: true,
            isRecurring: false,
            recurrencePattern: "",
            recurrenceEndDate: "",
            reason: "",
            isApproved: false,
          });
        }
      }}>
        <SheetContent side="right" className="w-full sm:w-[500px] !max-w-none p-0 flex flex-col h-screen max-h-screen">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
            <SheetTitle className="text-base font-semibold text-gray-900">{tr("staff.addTimeOff")}</SheetTitle>
          </div>

          {/* Form Content */}
          <div className="flex-1 p-4 space-y-4 overflow-y-auto min-h-0">
            {/* Staff Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">{tr("staff.selectStaff")}</Label>
              <Select
                value={timeOffForm.staffId}
                onValueChange={(value) => setTimeOffForm(prev => ({ ...prev, staffId: value }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={tr("common.selectStaffMember")} />
                </SelectTrigger>
                <SelectContent>
                  {apiStaff?.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Full Day / Hours Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">{tr("common.duration")}</Label>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="full-day"
                    checked={timeOffForm.isFullDay}
                    onCheckedChange={(checked) => {
                      setTimeOffForm(prev => ({ ...prev, isFullDay: checked === true }));
                      if (checked) {
                        setTimeOffForm(prev => ({ ...prev, startTime: "", endTime: "" }));
                      }
                    }}
                  />
                  <Label htmlFor="full-day" className="text-sm font-normal cursor-pointer">
                    {tr("staff.fullDay")}
                  </Label>
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700">{tr("staff.startDate")}</Label>
                <Input
                  type="date"
                  value={timeOffForm.startDate}
                  onChange={(e) => setTimeOffForm(prev => ({ ...prev, startDate: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700">{tr("staff.endDate")}</Label>
                <Input
                  type="date"
                  value={timeOffForm.endDate}
                  onChange={(e) => setTimeOffForm(prev => ({ ...prev, endDate: e.target.value }))}
                  className="h-9 text-sm"
                  min={timeOffForm.startDate}
                />
              </div>
            </div>

            {/* Time Range (if not full day) */}
            {!timeOffForm.isFullDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">{tr("staff.startTime2")}</Label>
                  <Input
                    type="time"
                    value={timeOffForm.startTime}
                    onChange={(e) => setTimeOffForm(prev => ({ ...prev, startTime: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">{tr("staff.endTime2")}</Label>
                  <Input
                    type="time"
                    value={timeOffForm.endTime}
                    onChange={(e) => setTimeOffForm(prev => ({ ...prev, endTime: e.target.value }))}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Recurring */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recurring"
                  checked={timeOffForm.isRecurring}
                  onCheckedChange={(checked) => setTimeOffForm(prev => ({ ...prev, isRecurring: checked === true }))}
                />
                <Label htmlFor="recurring" className="text-sm font-normal cursor-pointer">
                  {tr("staff.repeat")}
                </Label>
              </div>
              {timeOffForm.isRecurring && (
                <div className="space-y-2 pl-6">
                  <Select
                    value={timeOffForm.recurrencePattern}
                    onValueChange={(value) => setTimeOffForm(prev => ({ ...prev, recurrencePattern: value }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder={tr("staff.selectPattern")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">{tr("common.daily")}</SelectItem>
                      <SelectItem value="WEEKLY">{tr("staff.weekly")}</SelectItem>
                      <SelectItem value="MONTHLY">{tr("staff.monthly")}</SelectItem>
                      <SelectItem value="YEARLY">{tr("staff.yearly")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700">{tr("staff.repeatUntil")}</Label>
                    <Input
                      type="date"
                      value={timeOffForm.recurrenceEndDate}
                      onChange={(e) => setTimeOffForm(prev => ({ ...prev, recurrenceEndDate: e.target.value }))}
                      className="h-9 text-sm"
                      min={timeOffForm.endDate}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">{tr("staff.reason")}</Label>
              <Textarea
                value={timeOffForm.reason}
                onChange={(e) => setTimeOffForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder={tr("staff.enterReasonForTimeOff")}
                className="text-sm min-h-[80px]"
              />
            </div>

            {/* Approval */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="approved"
                  checked={timeOffForm.isApproved}
                  onCheckedChange={(checked) => setTimeOffForm(prev => ({ ...prev, isApproved: checked === true }))}
                />
                <Label htmlFor="approved" className="text-sm font-normal cursor-pointer">
                  {tr("staff.approved")}
                </Label>
                <HelpCircle className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500">
                  {timeOffForm.isApproved 
                    ? tr("staff.noManagerApprovalNeeded") 
                    : tr("staff.requiresManagerApproval")}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-4 py-3 border-t border-gray-200 flex gap-2 shrink-0">
            <Button
              variant="outline"
              className="flex-1 h-9 text-sm"
              onClick={() => setIsAddTimeOffOpen(false)}
            >
              {tr("staff.cancel")}
            </Button>
            <Button
              className="flex-1 h-9 text-sm bg-gray-900 hover:bg-gray-800 text-white"
              disabled={!timeOffForm.staffId || !timeOffForm.startDate || !timeOffForm.endDate || !timeOffForm.reason}
              onClick={async () => {
                if (!timeOffForm.staffId || !timeOffForm.startDate || !timeOffForm.endDate || !timeOffForm.reason) {
                  toast.error(tr("common.pleaseFillInAllRequired"));
                  return;
                }

                // Check for conflicts with other time offs (NOT ALLOWED)
                const startTime = timeOffForm.isFullDay 
                  ? `${businessStartHour.toString().padStart(2, "0")}:00` 
                  : (timeOffForm.startTime || "00:00");
                const endTime = timeOffForm.isFullDay 
                  ? `${businessEndHour.toString().padStart(2, "0")}:00` 
                  : (timeOffForm.endTime || "23:59");
                
                const hasConflict = hasTimeOffConflict(
                  timeOffForm.staffId,
                  timeOffForm.startDate,
                  timeOffForm.endDate,
                  startTime,
                  endTime,
                  timeOffForm.isFullDay
                );
                
                if (hasConflict) {
                  toast.error(tr("staff.thisTimeOffConflictsWith"));
                  return;
                }

                try {
                  await createTimeOff({
                    businessId: businessId,
                    staffId: timeOffForm.staffId,
                    startDate: timeOffForm.startDate,
                    endDate: timeOffForm.endDate,
                    startTime: timeOffForm.isFullDay ? null : timeOffForm.startTime || null,
                    endTime: timeOffForm.isFullDay ? null : timeOffForm.endTime || null,
                    isFullDay: timeOffForm.isFullDay,
                    isRecurring: timeOffForm.isRecurring,
                    recurrencePattern: timeOffForm.isRecurring ? timeOffForm.recurrencePattern : null,
                    recurrenceEndDate: timeOffForm.isRecurring ? timeOffForm.recurrenceEndDate : null,
                    reason: timeOffForm.reason,
                    isApproved: timeOffForm.isApproved,
                  });
                  
                  toast.success(tr("staff.timeOffCreatedSuccessfully"));
                  setIsAddTimeOffOpen(false);
                  setTimeOffForm({
                    staffId: "",
                    startDate: format(selectedDate, "yyyy-MM-dd"),
                    endDate: format(selectedDate, "yyyy-MM-dd"),
                    startTime: "",
                    endTime: "",
                    isFullDay: true,
                    isRecurring: false,
                    recurrencePattern: "",
                    recurrenceEndDate: "",
                    reason: "",
                    isApproved: false,
                  });
                } catch (error) {
                  toast.error((error instanceof Error && error.message) || tr("staff.failedToCreateTimeOff"));
                }
              }}
            >
              {tr("staff.save")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Commission Rule Dialog */}
      <FormSheet title={editingCommissionRule ? tr("staff.editCommissionRate") : tr("staff.newCommissionRate")} description={tr("staff.whatATeamMemberEarns")} open={isCommissionRuleDialogOpen} onOpenChange={(open) => {
        setIsCommissionRuleDialogOpen(open);
        if (!open) {
          // Reset form when dialog closes
          setEditingCommissionRule(null);
          setCommissionRuleForm({
            category: CommissionCategory.DEFAULT,
            type: CommissionType.PERCENTAGE,
            value: 0,
            description: "",
            staffId: selectedStaffIdForCommissions, // Preserve the selected staff from dropdown
            serviceId: undefined,
            scope: "category",
          });
        }
      }}>
        
          <div className="space-y-4 py-4">
            {/* Scope selection - Category or Service */}
            {commissionRuleForm.category === CommissionCategory.SERVICES && (
              <div className="space-y-2">
                <Label>{tr("staff.ruleScope")}</Label>
                <Select
                  value={commissionRuleForm.scope}
                  onValueChange={(value) => setCommissionRuleForm(prev => ({ 
                    ...prev, 
                    scope: value as "category" | "service",
                    serviceId: value === "category" ? undefined : prev.serviceId,
                    // Preserve other values
                    value: prev.value,
                    type: prev.type,
                    description: prev.description,
                    staffId: prev.staffId,
                    category: prev.category,
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="category">{tr("staff.allServicesInCategory")}</SelectItem>
                    <SelectItem value="service">{tr("staff.specificService")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {commissionRuleForm.scope === "category" 
                    ? tr("staff.thisRuleWillApplyTo")
                    : tr("staff.thisRuleWillApplyTo2")}
                </p>
              </div>
            )}

            {/* Service selection - only if scope is "service" */}
            {commissionRuleForm.scope === "service" && commissionRuleForm.category === CommissionCategory.SERVICES && (
              <div className="space-y-2">
                <Label>{tr("common.service")}</Label>
                <Select
                  value={commissionRuleForm.serviceId ? commissionRuleForm.serviceId.toString() : ""}
                  onValueChange={(value) => setCommissionRuleForm(prev => ({ 
                    ...prev, 
                    serviceId: value ? value : undefined,
                    // Preserve other values
                    value: prev.value,
                    type: prev.type,
                    description: prev.description,
                    staffId: prev.staffId,
                    category: prev.category,
                    scope: prev.scope,
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tr("staff.selectAService")} />
                  </SelectTrigger>
                  <SelectContent>
                    {apiServices?.filter(s => s.isActive).map((service) => (
                      <SelectItem key={service.id} value={service.id.toString()}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Staff selection */}
            <div className="space-y-2">
              <Label>{tr("staff.applyToStaff")}</Label>
              <Select
                value={commissionRuleForm.staffId ? commissionRuleForm.staffId.toString() : "all"}
                onValueChange={(value) => {
                  const newStaffId = value === "all" ? undefined : value;
                  setCommissionRuleForm(prev => ({ 
                    ...prev, 
                    staffId: newStaffId,
                    // Preserve all other values
                    value: prev.value,
                    type: prev.type,
                    description: prev.description,
                    category: prev.category,
                    serviceId: prev.serviceId,
                    scope: prev.scope,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr("staff.allStaffDefault")}</SelectItem>
                  {apiStaff?.filter(s => s.isActive).map((staff) => (
                    <SelectItem key={staff.id} value={staff.id.toString()}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {commissionRuleForm.staffId 
                  ? tr("staff.thisRuleWillOnlyApply")
                  : tr("staff.thisRuleWillApplyTo3")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{tr("staff.commissionType")}</Label>
              <Select
                value={commissionRuleForm.type}
                onValueChange={(value) => setCommissionRuleForm(prev => ({ 
                  ...prev, 
                  type: value as CommissionType,
                  // Preserve other values
                  value: prev.value,
                  description: prev.description,
                  staffId: prev.staffId,
                  serviceId: prev.serviceId,
                  category: prev.category,
                  scope: prev.scope,
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CommissionType.PERCENTAGE}>{tr("common.percentage")}</SelectItem>
                  <SelectItem value={CommissionType.FIXED_AMOUNT}>{tr("staff.fixedAmount")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {commissionRuleForm.type === CommissionType.PERCENTAGE ? tr("staff.percentage") : tr("staff.fixedAmount2", { value: currencySymbol() })}
              </Label>
              <Input
                type="number"
                step={commissionRuleForm.type === CommissionType.PERCENTAGE ? "0.1" : "0.01"}
                min="0"
                value={commissionRuleForm.value || ""}
                onChange={(e) => {
                  const numValue = parseFloat(e.target.value);
                  setCommissionRuleForm(prev => ({ ...prev, value: isNaN(numValue) ? 0 : numValue }));
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>{tr("staff.descriptionOptional")}</Label>
              <Textarea
                value={commissionRuleForm.description}
                onChange={(e) => setCommissionRuleForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder={tr("staff.addADescriptionForThis")}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className={sheetSecondary}
                onClick={() => setIsCommissionRuleDialogOpen(false)}
              >
                {tr("common.cancel")}
              </Button>
              <Button
                className={sheetPrimary}
                onClick={async () => {
                  try {
                    // Validation
                    if (commissionRuleForm.scope === "service" && !commissionRuleForm.serviceId) {
                      toast.error(tr("staff.pleaseSelectAService"));
                      return;
                    }
                    
                    // Prepare rule data (remove scope as it's not part of the API)
                    const ruleData: Omit<CommissionRule, "id"> = {
                      category: commissionRuleForm.category,
                      type: commissionRuleForm.type,
                      value: commissionRuleForm.value,
                      description: commissionRuleForm.description || "",
                      serviceId: commissionRuleForm.scope === "service" ? commissionRuleForm.serviceId : undefined,
                      businessId,
                    };
                    
                    // Only include staffId if it's set (for staff-specific rules)
                    // If undefined, it means "all staff" and should be null or omitted
                    if (commissionRuleForm.staffId !== undefined) {
                      ruleData.staffId = commissionRuleForm.staffId;
                    } else {
                      ruleData.staffId = null; // Explicitly set to null for "all staff"
                    }
                    
                    if (commissionRuleForm.type === CommissionType.PERCENTAGE && commissionRuleForm.value > 100) {
                      toast.error(tr("staff.failedToSaveCommissionRule"));
                      return;
                    }

                    if (editingCommissionRule) {
                      if (!(await updateCommissionRule(editingCommissionRule.id!, ruleData))) {
                        toast.error(tr("staff.failedToSaveCommissionRule"));
                        return;
                      }
                      toast.success(tr("staff.commissionRuleUpdatedSuccessfully"));
                    } else {
                      if (!(await createCommissionRule(ruleData))) {
                        toast.error(tr("staff.failedToSaveCommissionRule"));
                        return;
                      }
                      toast.success(commissionRuleForm.staffId 
                        ? tr("staff.staffSpecificCommissionRuleCreated") 
                        : tr("staff.commissionRuleCreatedSuccessfully"));
                    }
                    // Refresh the rules list to show the new/updated rule
                    await refreshCommissionRules();
                    setIsCommissionRuleDialogOpen(false);
                    // Form will be reset by onOpenChange handler
                  } catch (error) {
                    toast.error(tr("staff.failedToSaveCommissionRule"));
                  }
                }}
              >
                {editingCommissionRule ? tr("staff.update") : tr("staff.create")}
              </Button>
            </div>
          </div>
        </FormSheet>

      {/* Payment Dialog */}
      <FormSheet title={tr("staff.payOutCommission")} description={tr("staff.recordAPayoutToThis")} open={isPaymentDialogOpen} onOpenChange={(open) => {
        setIsPaymentDialogOpen(open);
        if (open) {
          // Initialize form with total pending when dialog opens
          setPaymentForm({
            amount: totalPending,
            method: PaymentMethod.CASH,
            paymentDate: new Date().toISOString().split('T')[0],
            referenceNumber: "",
            notes: "",
          });
        } else {
          // Reset form when dialog closes
          setPaymentForm({
            amount: 0,
            method: PaymentMethod.CASH,
            paymentDate: new Date().toISOString().split('T')[0],
            referenceNumber: "",
            notes: "",
          });
        }
      }}>
        
          <div className="space-y-4 py-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">{tr("staff.totalPendingCommissions")}</p>
              <p className="text-2xl font-bold text-gray-900">{totalPending.toFixed(2)} {currencySymbol()}</p>
              <p className="text-xs text-gray-500 mt-1">{tr("staff.commissionCount", { count: pendingCommissions.length })}</p>
            </div>

            <div className="space-y-2">
              <Label>{tr("staff.paymentAmount")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={paymentForm.amount || totalPending}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label>{tr("staff.paymentMethod")}</Label>
              <Select 
                value={paymentForm.method} 
                onValueChange={(value) => setPaymentForm(prev => ({ ...prev, method: value as PaymentMethod }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PaymentMethod.CASH}>{tr("common.cash")}</SelectItem>
                  <SelectItem value={PaymentMethod.CHECK}>{tr("staff.check")}</SelectItem>
                  <SelectItem value={PaymentMethod.BANK_TRANSFER}>{tr("staff.bankTransfer")}</SelectItem>
                  <SelectItem value={PaymentMethod.PAYPAL}>{tr("staff.paypal")}</SelectItem>
                  <SelectItem value={PaymentMethod.VENMO}>{tr("staff.venmo")}</SelectItem>
                  <SelectItem value={PaymentMethod.OTHER}>{tr("staff.other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{tr("staff.paymentDate")}</Label>
              <Input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>{tr("staff.referenceNumberOptional")}</Label>
              <Input
                type="text"
                placeholder={tr("staff.checkNumberTransactionIdEtc")}
                value={paymentForm.referenceNumber}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, referenceNumber: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>{tr("staff.notesOptional")}</Label>
              <Textarea
                placeholder={tr("staff.addAnyNotesAboutThis")}
                rows={3}
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className={sheetSecondary}
                onClick={() => setIsPaymentDialogOpen(false)}
              >
                {tr("common.cancel")}
              </Button>
              <Button
                className={sheetPrimary}
                onClick={async () => {
                  try {
                    await createPayment({
                      businessId,
                      staffId: selectedStaffIdForCommissions!,
                      amount: paymentForm.amount || totalPending,
                      method: paymentForm.method,
                      paymentDate: paymentForm.paymentDate,
                      commissionIds: pendingCommissions.map(c => c.id),
                      referenceNumber: paymentForm.referenceNumber || undefined,
                      notes: paymentForm.notes || undefined,
                    });
                    // The commissions this payment settled are now PAID server-side —
                    // without this, the Pending Commissions panel kept showing the old
                    // (now stale) pending total/list until the staffer was re-selected.
                    await refreshCommissions();
                    toast.success(tr("staff.paymentCreatedSuccessfully"));
                    setIsPaymentDialogOpen(false);
                    // Reset form
                    setPaymentForm({
                      amount: 0,
                      method: PaymentMethod.CASH,
                      paymentDate: new Date().toISOString().split('T')[0],
                      referenceNumber: "",
                      notes: "",
                    });
                  } catch (error) {
                    toast.error(tr("staff.failedToCreatePayment"));
                  }
                }}
              >
                {tr("staff.createPayment")}
              </Button>
            </div>
          </div>
        </FormSheet>

      {/* Edit Staff Sheet - Same layout as Add Staff Page */}
      </BooqiScope>
    </AppLayout>
  );
}

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const dayShort = () => [tr("common.dayMon"), tr("common.dayTue"), tr("common.dayWed"), tr("common.dayThu"), tr("common.dayFri"), tr("common.daySat"), tr("common.daySun")];

/** "Mon–Sat · 10:00–19:00", "Mon, Wed · times vary", "No hours set". */
function hoursSummary(staff: Staff): string {
  const open = DAY_ORDER.map((d, i) => ({ i, h: getStaffDayHours(staff, d) })).filter((x) => !x.h.isClosed);
  if (open.length === 0) return tr("staff.noHoursSet");
  const contiguous = open.every((x, n) => n === 0 || x.i === open[n - 1].i + 1);
  const DAY_SHORT = dayShort();
  const days = contiguous && open.length > 2 ? `${DAY_SHORT[open[0].i]}–${DAY_SHORT[open[open.length - 1].i]}` : open.map((x) => DAY_SHORT[x.i]).join(", ");
  return `${days} · ${commonRange(open.map((x) => `${x.h.start}–${x.h.end}`))}`;
}

/** The most common day's hours, marked when other days differ. */
function commonRange(ranges: string[]): string {
  const n = new Map<string, number>();
  ranges.forEach((r) => n.set(r, (n.get(r) ?? 0) + 1));
  const [top] = [...n.entries()].sort((a, b) => b[1] - a[1]);
  return n.size === 1 ? top[0] : tr("staff.mostlyRange", { range: top[0] });
}

const AVATAR_TONES = [
  "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]",
  "bg-rose-50 text-rose-800",
  "bg-amber-50 text-amber-900",
  "bg-[rgb(var(--reg-ink)/0.06)] text-[rgb(var(--reg-ink)/0.75)]",
  "bg-sky-50 text-sky-800",
];

function MemberAvatar({ name, id, url, size }: { name: string; id: Id; url?: string; size: string }) {
  return url ? (
    <img src={url} alt="" className={cn("shrink-0 rounded-full object-cover", size)} />
  ) : (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full font-bold", AVATAR_TONES[idTone(id, AVATAR_TONES.length)], size)}>
      {getInitials(name)}
    </span>
  );
}

const COMMISSION_ROWS = [
  { get name() { return tr("staff.rowServices"); }, category: CommissionCategory.SERVICES },
  { get name() { return tr("staff.rowProducts"); }, category: CommissionCategory.PRODUCTS },
  { get name() { return tr("staff.rowGiftCards"); }, category: CommissionCategory.GIFT_CARDS },
  { get name() { return tr("staff.rowMemberships"); }, category: CommissionCategory.MEMBERSHIPS },
  { get name() { return tr("staff.rowPackages"); }, category: CommissionCategory.PACKAGES },
];

function rateText(rule?: CommissionRule) {
  if (!rule) return tr("staff.notSet");
  return rule.type === CommissionType.PERCENTAGE ? `${rule.value}%` : money(rule.value, currencySymbol());
}
