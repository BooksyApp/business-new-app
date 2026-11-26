import type { Id } from "@/types/id";
import { useState, useEffect } from "react";
import { currencySymbol } from "@/lib/currency";
import { BzScope, Btn, Card, CheckRow, Drawer, EmptyState, Field, FormGrid, FormSection, Note, Skeleton, Toggle } from "@/components/bz";
import StaffPage from "./StaffPage";
import { X, Check, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StaffAvatarPicker } from "@/components/media/StaffAvatarPicker";
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
    <BzScope>
      <StaffPage />
      <Drawer
        title={t("addStaff.newTeamMember")}
        sub={t("addStaff.theyGetTheirOwnCalendar")}
        onClose={close}
        closeIcon={<X className="ic" />}
        footer={
          <>
            <Btn kind="ol" onClick={close}>{t("common.cancel")}</Btn>
            <Btn kind="v" onClick={handleAddAndSendInvite} disabled={!formData.name.trim() || creating}>
              {creating ? t("common.creating") : willInvite ? t("addStaff.addAndSendInvite") : t("common.addTeamMember")}
            </Btn>
          </>
        }
      >
        <div className="stk">
          {/* The camera button used to do nothing. */}
          <StaffAvatarPicker value={formData.avatarUrl} onChange={(url) => setFormData((prev) => ({ ...prev, avatarUrl: url }))} />

          <Field label={t("common.name")} required>
            <input id="name" value={formData.name} onChange={(e) => handleInputChange("name", e.target.value)} placeholder={t("addStaff.enterName")} autoFocus />
          </Field>

          <FormGrid cols={2}>
            <Field label={t("addStaff.phoneNumber")}>
              <input id="phone" type="tel" value={formData.phone} onChange={(e) => handleInputChange("phone", e.target.value)} placeholder={t("addStaff.enterPhoneNumber")} />
            </Field>
            <Field label={t("addStaff.eMail")}>
              <input id="email" type="email" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} placeholder={t("addStaff.enterEmail")} />
            </Field>
          </FormGrid>

          <Toggle
            title={t("addStaff.inviteAndCreateBooqiAccount")}
            help={t("addStaff.weLlSendThemA")}
            checked={formData.inviteAndCreateAccount}
            onChange={(checked) => handleInputChange("inviteAndCreateAccount", checked)}
          />

          {/* Role: one of the salon's roles (Team > Roles). */}
          <RoleSelect value={formData.permissionLevel} onChange={(v) => handleInputChange("permissionLevel", v)} />

          <Field label={t("common.position")}>
            <input id="position" value={formData.position} onChange={(e) => handleInputChange("position", e.target.value)} placeholder={t("addStaff.enterPosition")} />
          </Field>

          <FormSection>{t("addStaff.services")}</FormSection>
          {servicesLoading ? (
            <Skeleton lines={[90, 70, 80]} />
          ) : !services || services.length === 0 ? (
            <EmptyState icon={<Layers className="ic" />} title={t("addStaff.noServicesAvailableCreateServices")} />
          ) : (
            services.map((service) => (
              <CheckRow
                key={service.id}
                label={service.name}
                checked={selectedServiceIds.includes(service.id)}
                icon={<Check className="ic" />}
                onChange={() => handleServiceToggle(service.id)}
                right={`${service.durationMinutes ? formatMinutes(service.durationMinutes) : t("common.nA")} · ${service.price ? `${service.price.toFixed(2)} ${currencySymbol()}` : t("common.nA")}`}
              />
            ))
          )}

          <FormSection>{t("addStaff.workingHours")}</FormSection>
          <Note kind="in">{t("addStaff.clientsCanOnlyBookThis")}</Note>
          <Card style={{ padding: "6px 18px" }}>
            <WorkingHoursEditor value={schedule} onChange={setSchedule} />
          </Card>
        </div>
      </Drawer>
    </BzScope>
  );
}
