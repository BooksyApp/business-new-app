import type { Id } from "@/types/id";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { RoleSelect } from "@/components/staff/RoleSelect";
import { roleService } from "@/services/roleService";
import { myAccess } from "@/components/layout/navigation";
import { currencySymbol } from "@/lib/currency";
import { RouteSheet } from "@/components/page/RouteSheet";
import { sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import StaffPage from "./StaffPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  Search,
  HelpCircle,
  UserPlus,
  ChevronRight,
  User,
  Loader2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { StaffAvatarPicker } from "@/components/media/StaffAvatarPicker";
import { useStaff } from "@/hooks/useStaff";
import { useServices } from "@/hooks/useServices";
import { staffService } from "@/services/staffService";
import { serviceService } from "@/services/serviceService";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useNavigation } from "@/utils/navigationUtils";
import { WorkingHoursEditor } from "@/components/staff/WorkingHoursEditor";
import {
  DEFAULT_WEEK,
  scheduleToPayload,
  weekFromWorkingHours,
  type WeekSchedule,
} from "@/components/staff/workingHours";
import { t, formatMinutes } from "@/i18n";

export default function EditStaffPage() {
  const navigate = useNavigate();
  const { getPath } = useNavigation();
  const { id } = useParams<{ id: string }>();
  const [inviting, setInviting] = useState(false);
  const businessId = useBusinessId();
  const { updateStaff, loading: updating } = useStaff(businessId);
  const { services, loading: servicesLoading } = useServices(businessId);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Id[]>([]);
  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT_WEEK);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    permissionLevel: "",
    position: "",
    showInCalendar: true,
    availableForOnlineBooking: true,
    description: "",
    avatarUrl: "",
  });

  // Load staff data
  useEffect(() => {
    const loadStaff = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const staff = await staffService.getStaffById(id!, businessId);
        setFormData({
          name: staff.name,
          phone: staff.phone || "",
          email: staff.email || "",
          permissionLevel: "",
          position: staff.position || "",
          // Read from isActive: canBookAppointments does not exist on Staff, so both were
          // always false — and Save sends showInCalendar as isActive, so every edit
          // switched the team member off (gone from the calendar, booking and sign-in).
          showInCalendar: staff.isActive !== false,
          availableForOnlineBooking: staff.isActive !== false,
          description: "",
          avatarUrl: staff.avatarUrl ?? "",
        });
        // Load the staff's saved hours. If they have none yet (new/unconfigured
        // staff), start from a sensible enabled Mon–Fri week instead of all-off,
        // so the owner just adjusts and saves — an all-off form saves 0 hours,
        // which silently makes the staff unbookable.
        const loaded = weekFromWorkingHours(staff.workingHoursStart, staff.workingHoursEnd);
        const hasAnyHours = Object.values(loaded).some((d) => d.enabled);
        setSchedule(hasAnyHours ? loaded : DEFAULT_WEEK);
        // Which services this staff can perform lives in service-catalog, not on the
        // staff record — load it from the assignments endpoint.
        try {
          const svcIds = await serviceService.getStaffServiceIds(businessId, id!);
          setSelectedServiceIds(svcIds || []);
        } catch (e) {
          console.error("Failed to load staff service assignments:", e);
          setSelectedServiceIds([]);
        }
      } catch (error) {
        console.error("Failed to load staff:", error);
      } finally {
        setLoading(false);
      }
    };
    loadStaff();
  }, [id, businessId]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleServiceToggle = (serviceId: Id) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      await updateStaff(id!, {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        position: formData.position || undefined,
        isActive: formData.showInCalendar,
        avatarUrl: formData.avatarUrl,
        schedule: scheduleToPayload(schedule),
      });
      // Persist the staff↔service assignments (owned by service-catalog).
      await serviceService.setStaffServiceIds(businessId, id!, selectedServiceIds);
      if (formData.permissionLevel && myAccess().isOwner) {
        const roles = await roleService.list(businessId);
        const current = roles.find((r) => r.memberIds.includes(id!));
        if (String(current?.id ?? "") !== formData.permissionLevel) {
          await roleService.assign(id!, formData.permissionLevel);
        }
      }
      navigate(getPath("staff"));
    } catch (error) {
      console.error("Failed to update staff:", error);
    }
  };

  // Group services by category
  const servicesByCategory = services.reduce((acc, service) => {
    const category = service.categoryName || t("common.notCategorized");
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, typeof services>);

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const close = () => navigate(getPath("staff"));

  return (
    <RouteSheet
      backdrop={<StaffPage />}
      onClose={close}
      size="lg"
      title={formData.name || t("editStaff.editTeamMember")}
      description={t("editStaff.profileServicesAndWorkingHours")}
      footer={
        <>
          <Button variant="outline" className={sheetSecondary} onClick={close}>{t("common.cancel")}</Button>
          <Button className={sheetPrimary} onClick={handleSave} disabled={!formData.name.trim() || updating || loading}>
            {updating ? t("common.saving") : t("common.saveChanges")}
          </Button>
        </>
      }
    >
            <div className="grid gap-6">
              {/* Left Panel - Staff Member Details */}
              <div className="space-y-6">
                <div className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)] space-y-6">
                  {/* Profile Picture */}
                  {/* The camera button used to do nothing. */}
                  <StaffAvatarPicker
                    value={formData.avatarUrl}
                    initials={getInitials(formData.name)}
                    onChange={(url) => setFormData((prev) => ({ ...prev, avatarUrl: url }))}
                  />

                  {/* Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("common.name")}</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                    />
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("editStaff.phoneNumber")}</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder={t("editStaff.enterPhoneNumber")}
                    />
                  </div>

                  {/* E-mail */}
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("editStaff.eMail")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                    />
                  </div>

                  {/* Invite Again */}
                  <div className="flex items-center gap-2">
                    {/* It was a button with no handler: nothing was ever re-sent. */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      type="button"
                      disabled={inviting || !formData.email}
                      onClick={async () => {
                        setInviting(true);
                        try {
                          const r = await staffService.sendInvite(id!);
                          toast.success(t("editStaff.invitationSentTo", { email: r.email }));
                        } catch (err) {
                          toast.error((err instanceof Error && err.message) || t("editStaff.couldNotSendTheInvitation"));
                        } finally {
                          setInviting(false);
                        }
                      }}
                    >
                      {inviting ? t("editStaff.sending") : t("editStaff.inviteAgain")}
                    </Button>
                    <HelpCircle size={16} className="text-[rgb(var(--reg-muted)/0.8)]" />
                  </div>

                  {/* Role — one of the salon's roles (Team → Roles). It always showed "Owner"
                      and was never saved. */}
                  <RoleSelect
                    staffId={id!}
                    value={formData.permissionLevel}
                    onChange={(v) => handleInputChange("permissionLevel", v)}
                  />

                  {/* Position */}
                  <div className="space-y-2">
                    <Label htmlFor="position">{t("common.position")}</Label>
                    <Input
                      id="position"
                      value={formData.position}
                      onChange={(e) => handleInputChange("position", e.target.value)}
                      placeholder={t("editStaff.enterPosition")}
                    />
                  </div>

                  {/* Show Staff Member in Calendar */}
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="show-in-calendar"
                      checked={formData.showInCalendar}
                      onCheckedChange={(checked) =>
                        handleInputChange("showInCalendar", checked as boolean)
                      }
                      className="mt-1"
                    />
                    <Label
                      htmlFor="show-in-calendar"
                      className="text-sm text-[rgb(var(--reg-ink)/0.85)] cursor-pointer"
                    >
                      {t("editStaff.checkTheBoxIfThe")}
                    </Label>
                  </div>

                  {/* Available for Online Booking */}
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="online-booking"
                      checked={formData.availableForOnlineBooking}
                      onCheckedChange={(checked) =>
                        handleInputChange(
                          "availableForOnlineBooking",
                          checked as boolean
                        )
                      }
                      className="mt-1"
                    />
                    <Label
                      htmlFor="online-booking"
                      className="text-sm text-[rgb(var(--reg-ink)/0.85)] cursor-pointer"
                    >
                      {t("editStaff.checkTheBoxToAllow")}
                    </Label>
                  </div>

                  {/* Staffer description */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="description">{t("editStaff.stafferDescription")}</Label>
                      <HelpCircle size={16} className="text-[rgb(var(--reg-muted)/0.8)]" />
                    </div>
                    <Textarea
                      id="description"
                      placeholder={t("editStaff.enterDescription")}
                      value={formData.description}
                      onChange={(e) =>
                        handleInputChange("description", e.target.value)
                      }
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
              </div>

              {/* Right Panel - Services Management */}
              <div className="space-y-6">
                <div className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)] space-y-6">
                  {/* Services Tab */}
                  <div className="border-b border-[rgb(var(--reg-line)/0.8)]">
                    <button className="px-4 py-3 text-sm font-medium border-b-2 border-gray-900 text-[rgb(var(--reg-ink))]">
                      {t("editStaff.services")}
                    </button>
                  </div>

                  {/* Search Services */}
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[rgb(var(--reg-muted)/0.8)]"
                      size={18}
                    />
                    <Input
                      type="text"
                      placeholder={t("common.searchServices")}
                      className="pl-10"
                    />
                  </div>

                  {/* Services by Category */}
                  {servicesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-[rgb(var(--reg-muted)/0.8)]" />
                    </div>
                  ) : (
                    <div className="space-y-6 max-h-[500px] overflow-y-auto">
                      {Object.entries(servicesByCategory).map(
                        ([category, categoryServices]) => (
                          <div key={category} className="space-y-3">
                            <h3 className="text-sm font-semibold text-[rgb(var(--reg-ink)/0.85)] uppercase">
                              {category}
                            </h3>
                            <div className="space-y-2">
                              {categoryServices.map((service) => {
                                const isSelected = selectedServiceIds.includes(service.id);
                                const colorClass = service.color?.startsWith("#") ? "" : (service.color?.startsWith("bg-") ? service.color : "bg-gray-400");
                                const colorStyle = service.color?.startsWith("#") ? { backgroundColor: service.color } : {};
                                
                                return (
                                  <div
                                    key={service.id}
                                    className="flex items-center gap-4 p-4 bg-[rgb(var(--reg-canvas))] rounded-2xl hover:bg-[rgb(var(--reg-ink)/0.05)] transition-colors cursor-pointer"
                                    onClick={() => handleServiceToggle(service.id)}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => handleServiceToggle(service.id)}
                                      className="h-5 w-5"
                                    />
                                    <div
                                      className={`w-1 h-12 rounded-full ${colorClass}`}
                                      style={colorStyle}
                                    />
                                    <div className="flex-1">
                                      <h4 className="font-medium text-[rgb(var(--reg-ink))]">
                                        {service.name}
                                      </h4>
                                      <div className="flex items-center gap-4 text-sm text-[rgb(var(--reg-muted))] mt-1">
                                        <span>
                                          {service.durationMinutes
                                            ? formatMinutes(service.durationMinutes)
                                            : t("common.nA")}
                                        </span>
                                        <span className="font-semibold text-[rgb(var(--reg-ink))]">
                                          {service.price ? `${service.price.toFixed(2)} ${currencySymbol()}` : t("common.nA")}
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

                  {/* Edit Services Button */}
                  <div className="pt-4 border-t border-[rgb(var(--reg-line)/0.8)]">
                    <Button variant="outline" className="w-full">
                      {t("editStaff.editServices")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Working Hours */}
            <div className="mt-6 rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
              <h3 className="text-sm font-semibold text-[rgb(var(--reg-ink))] mb-1">{t("editStaff.workingHours")}</h3>
              <p className="text-xs text-[rgb(var(--reg-muted))] mb-4">
                {t("editStaff.clientsCanOnlyBookThis")}
              </p>
              <WorkingHoursEditor value={schedule} onChange={setSchedule} />
            </div>
    </RouteSheet>
  );
}



