import type { Id } from "@/types/id";
import { useState, useEffect } from "react";
import { currencySymbol } from "@/lib/currency";
import { RouteSheet } from "@/components/page/RouteSheet";
import { sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import StaffPage from "./StaffPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  UserPlus,
  ChevronRight,
  Send,
  Layers,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StaffAvatarPicker } from "@/components/media/StaffAvatarPicker";
import { Switch } from "@/components/ui/switch";
import { useStaff } from "@/hooks/useStaff";
import { useServices } from "@/hooks/useServices";
import { serviceService } from "@/services/serviceService";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import { useNavigation } from "@/utils/navigationUtils";
import { RoleSelect } from "@/components/staff/RoleSelect";
import { roleService } from "@/services/roleService";
import { myAccess } from "@/components/layout/navigation";
import { toast } from "sonner";
import { WorkingHoursEditor } from "@/components/staff/WorkingHoursEditor";
import {
  DEFAULT_WEEK,
  WEEK_DAYS,
  scheduleToPayload,
  type WeekSchedule,
} from "@/components/staff/workingHours";
import { t, formatMinutes } from "@/i18n";

export default function AddStaffPage() {
  const navigate = useNavigate();
  const { getPath } = useNavigation();
  const businessId = useBusinessId();
  const { createStaff, loading: creating } = useStaff();
  const { services, loading: servicesLoading } = useServices();
  const { businessHours } = useBusinessHours(businessId);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Id[]>([]);
  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT_WEEK);
  const [scheduleSeededFromBusinessHours, setScheduleSeededFromBusinessHours] = useState(false);

  // A brand-new staff member's default schedule should match when the salon itself is
  // open, not a hardcoded Mon–Fri 09:00–17:00 guess (DEFAULT_WEEK, kept as the
  // fallback for a business with no hours configured yet). Seeds once, when business
  // hours first load — guarded so it never overwrites hours the owner already edited.
  useEffect(() => {
    if (scheduleSeededFromBusinessHours || businessHours.length === 0) return;
    const seeded = WEEK_DAYS.reduce((acc, d) => {
      const biz = businessHours.find(h => h.dayOfWeek === d.key);
      acc[d.key] = {
        enabled: biz?.enabled ?? DEFAULT_WEEK[d.key].enabled,
        start: biz?.startTime || DEFAULT_WEEK[d.key].start,
        end: biz?.endTime || DEFAULT_WEEK[d.key].end,
      };
      return acc;
    }, {} as WeekSchedule);
    setSchedule(seeded);
    setScheduleSeededFromBusinessHours(true);
  }, [businessHours, scheduleSeededFromBusinessHours]);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    inviteAndCreateAccount: true,
    permissionLevel: "",
    position: "",
    avatarUrl: "",
  });

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

  // #55: an invitation needs somewhere to send it. The switch alone is not enough, so
  // the label and the confirmation both follow what will actually happen.
  const willInvite = formData.inviteAndCreateAccount && !!formData.email.trim();

  const handleAddAndSendInvite = async () => {
    // Email format validation
    const emailRegex = /^[^@]+@[^@]+\.[^@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      toast.error(t("addStaff.invalidEmailAddressFormat"));
      return;
    }
    // Name length check
    if (formData.name && formData.name.length > 255) {
      toast.error(t("addStaff.nameIsTooLongMax"));
      return;
    }

    try {
      const created = await createStaff({
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        position: formData.position || undefined,
        inviteAndCreateAccount: formData.inviteAndCreateAccount,
        avatarUrl: formData.avatarUrl || undefined,
        schedule: scheduleToPayload(schedule),
      });
      // Persist the staff↔service assignments (owned by service-catalog).
      if (created?.id && selectedServiceIds.length > 0) {
        await serviceService.setStaffServiceIds(businessId, created.id, selectedServiceIds);
      }
      // #13/#293: role has its own endpoint — createStaff's DTO has no field for it.
      if (created?.id && formData.permissionLevel && myAccess().isOwner) {
        await roleService.assign(created.id, formData.permissionLevel);
      }
      // #55: the button used to promise an invite and then say nothing at all. Report
      // what was actually requested. Whether the invitation is *emailed* is a separate
      // layer (backend #496: notifications are disabled by default and the sending
      // domain has no SPF/DKIM/DMARC), so do not claim delivery here.
      if (willInvite) {
        toast.success(t("addStaff.staffMemberAddedAndInvited", { value: formData.email.trim() }));
      } else if (formData.inviteAndCreateAccount) {
        toast.success(t("addStaff.staffMemberAddedNoInvitation"));
      } else {
        toast.success(t("addStaff.staffMemberAdded"));
      }
      navigate(getPath("staff"));
    } catch (error) {
      console.error("Failed to create staff:", error);
      toast.error((error instanceof Error && error.message) || t("addStaff.failedToCreateStaffMember"));
    }
  };

  const close = () => navigate(getPath("staff"));

  return (
    <RouteSheet
      backdrop={<StaffPage />}
      onClose={close}
      size="lg"
      title={t("addStaff.newTeamMember")}
      description={t("addStaff.theyGetTheirOwnCalendar")}
      footer={
        <>
          <Button variant="outline" className={sheetSecondary} onClick={close}>{t("common.cancel")}</Button>
          <Button className={sheetPrimary} onClick={handleAddAndSendInvite} disabled={!formData.name.trim() || creating}>
            {creating ? t("common.creating") : willInvite ? t("addStaff.addAndSendInvite") : t("common.addTeamMember")}
          </Button>
        </>
      }
    >
            <div className="grid gap-6">
              {/* Left Panel - Staff Member Details */}
              <div className="space-y-6">
                <div className="rounded-[20px] bg-white p-5 ring-1 shadow-[var(--shadow-sm)] ring-[rgb(var(--reg-line)/0.6)] space-y-6">
                  {/* Profile Picture */}
                  {/* The camera button used to do nothing. */}
                  <StaffAvatarPicker
                    value={formData.avatarUrl}
                    onChange={(url) => setFormData((prev) => ({ ...prev, avatarUrl: url }))}
                  />

                  {/* Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("common.name")}</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder={t("addStaff.enterName")}
                      autoFocus
                    />
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("addStaff.phoneNumber")}</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder={t("addStaff.enterPhoneNumber")}
                    />
                  </div>

                  {/* E-mail */}
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("addStaff.eMail")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder={t("addStaff.enterEmail")}
                    />
                  </div>

                  {/* Invite and create booqi account? */}
                  <div className="space-y-3 p-4 bg-[rgb(var(--reg-canvas))] rounded-2xl">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="invite-account" className="text-sm font-medium">
                        {t("addStaff.inviteAndCreateBooqiAccount")}
                      </Label>
                      <Switch
                        id="invite-account"
                        checked={formData.inviteAndCreateAccount}
                        onCheckedChange={(checked) =>
                          handleInputChange("inviteAndCreateAccount", checked)
                        }
                      />
                    </div>
                    <p className="text-xs text-[rgb(var(--reg-muted))]">
                      {t("addStaff.weLlSendThemA")}
                    </p>
                  </div>

                  {/* Role — one of the salon's roles (Team → Roles). */}
                  <RoleSelect
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
                      placeholder={t("addStaff.enterPosition")}
                    />
                  </div>

                </div>
              </div>

              {/* Right Panel - Services Management */}
              <div className="space-y-6">
                <div className="rounded-[20px] bg-white p-5 ring-1 shadow-[var(--shadow-sm)] ring-[rgb(var(--reg-line)/0.6)] space-y-6 min-h-[600px] flex flex-col">
                  {/* Services Tab */}
                  <div className="border-b border-[rgb(var(--reg-line)/0.8)]">
                    <button className="px-4 py-3 text-sm font-medium border-b-2 border-gray-900 text-[rgb(var(--reg-ink))]">
                      {t("addStaff.services")}
                    </button>
                  </div>

                  {/* Services List */}
                  {servicesLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[rgb(var(--reg-muted)/0.8)] mb-4" />
                      <p className="text-sm text-[rgb(var(--reg-muted))]">{t("addStaff.loadingServices")}</p>
                    </div>
                  ) : !services || services.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                      <div className="mb-4">
                        <Layers size={64} className="text-gray-300 mx-auto" />
                      </div>
                      <p className="text-sm text-[rgb(var(--reg-muted))] mb-6 max-w-xs">
                        {t("addStaff.noServicesAvailableCreateServices")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {services.map((service) => {
                        const isSelected = selectedServiceIds.includes(service.id);
                        return (
                          <div
                            key={service.id}
                            className="flex items-center gap-3 p-3 bg-[rgb(var(--reg-canvas))] rounded-2xl hover:bg-[rgb(var(--reg-ink)/0.05)] transition-colors"
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                handleServiceToggle(service.id);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className="h-5 w-5"
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
                  )}
                </div>
              </div>
            </div>

            {/* Working Hours */}
            <div className="mt-6 rounded-[20px] bg-white p-5 ring-1 shadow-[var(--shadow-sm)] ring-[rgb(var(--reg-line)/0.6)]">
              <h3 className="text-sm font-semibold text-[rgb(var(--reg-ink))] mb-1">{t("addStaff.workingHours")}</h3>
              <p className="text-xs text-[rgb(var(--reg-muted))] mb-4">
                {t("addStaff.clientsCanOnlyBookThis")}
              </p>
              <WorkingHoursEditor value={schedule} onChange={setSchedule} />
            </div>
    </RouteSheet>
  );
}



