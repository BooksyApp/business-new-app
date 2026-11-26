import type { Id } from "@/types/id";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { RoleSelect } from "@/components/staff/RoleSelect";
import { roleService } from "@/services/roleService";
import { myAccess } from "@/components/layout/navigation";
import { currencySymbol } from "@/lib/currency";
import StaffPage from "./StaffPage";
import { BzScope, Btn, Card, CheckRow, Drawer, Field, FormGrid, FormSection, Note, Skeleton } from "@/components/bz";
import { X, Check, Send } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { StaffAvatarPicker } from "@/components/media/StaffAvatarPicker";
import { useStaff } from "@/hooks/useStaff";
import { useServices } from "@/hooks/useServices";
import { staffService } from "@/services/staffService";
import { serviceService } from "@/services/serviceService";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useNavigation } from "@/utils/navigationUtils";
import { WorkingHoursEditor } from "@/components/staff/WorkingHoursEditor";
import { StaffPortfolioSection } from "@/components/staff/StaffPortfolioSection";
import { ChairRentCard } from "@/components/staff/ChairRentCard";
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
    <BzScope>
      <StaffPage />
      <Drawer
        title={formData.name || t("editStaff.editTeamMember")}
        sub={t("editStaff.profileServicesAndWorkingHours")}
        onClose={close}
        closeIcon={<X className="ic" />}
        footer={
          <>
            <Btn kind="ol" onClick={close}>{t("common.cancel")}</Btn>
            <Btn kind="v" onClick={handleSave} disabled={!formData.name.trim() || updating || loading}>
              {updating ? t("common.saving") : t("common.saveChanges")}
            </Btn>
          </>
        }
      >
        <div className="stk">
          {/* The camera button used to do nothing. */}
          <StaffAvatarPicker
            value={formData.avatarUrl}
            initials={getInitials(formData.name)}
            onChange={(url) => setFormData((prev) => ({ ...prev, avatarUrl: url }))}
          />

          <Field label={t("common.name")} required>
            <input id="name" value={formData.name} onChange={(e) => handleInputChange("name", e.target.value)} />
          </Field>

          <FormGrid cols={2}>
            <Field label={t("editStaff.phoneNumber")}>
              <input id="phone" type="tel" value={formData.phone} onChange={(e) => handleInputChange("phone", e.target.value)} placeholder={t("editStaff.enterPhoneNumber")} />
            </Field>
            <Field label={t("editStaff.eMail")}>
              <input id="email" type="email" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} />
            </Field>
          </FormGrid>

          {/* It was a button with no handler: nothing was ever re-sent. */}
          <div>
            <Btn
              kind="soft"
              icon={<Send className="ic" />}
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
            </Btn>
          </div>

          <FormGrid cols={2}>
            {/* Role: one of the salon's roles (Team > Roles). */}
            <RoleSelect staffId={id!} value={formData.permissionLevel} onChange={(v) => handleInputChange("permissionLevel", v)} />
            <Field label={t("common.position")}>
              <input id="position" value={formData.position} onChange={(e) => handleInputChange("position", e.target.value)} placeholder={t("editStaff.enterPosition")} />
            </Field>
          </FormGrid>

          <CheckRow
            label={t("editStaff.checkTheBoxIfThe")}
            checked={formData.showInCalendar}
            icon={<Check className="ic" />}
            onChange={(v) => handleInputChange("showInCalendar", v)}
          />
          <CheckRow
            label={t("editStaff.checkTheBoxToAllow")}
            checked={formData.availableForOnlineBooking}
            icon={<Check className="ic" />}
            onChange={(v) => handleInputChange("availableForOnlineBooking", v)}
          />

          <Field label={t("editStaff.stafferDescription")} kind="ta">
            <textarea id="description" placeholder={t("editStaff.enterDescription")} value={formData.description} onChange={(e) => handleInputChange("description", e.target.value)} />
          </Field>

          <FormSection>{t("editStaff.services")}</FormSection>
          <Field label={t("common.searchServices")}>
            <input type="text" />
          </Field>
          {servicesLoading ? (
            <Skeleton lines={[90, 70, 80]} />
          ) : (
            Object.entries(servicesByCategory).map(([category, categoryServices]) => (
              <div key={category} style={{ display: "contents" }}>
                <div className="lbl2">{category}</div>
                {categoryServices.map((service) => (
                  <CheckRow
                    key={service.id}
                    label={service.name}
                    checked={selectedServiceIds.includes(service.id)}
                    icon={<Check className="ic" />}
                    onChange={() => handleServiceToggle(service.id)}
                    right={`${service.durationMinutes ? formatMinutes(service.durationMinutes) : t("common.nA")} · ${service.price ? `${service.price.toFixed(2)} ${currencySymbol()}` : t("common.nA")}`}
                  />
                ))}
              </div>
            ))
          )}
          <div className="row sp">
            <span />
            <Btn kind="soft">{t("editStaff.editServices")}</Btn>
          </div>

          <FormSection>{t("editStaff.workingHours")}</FormSection>
          <Note kind="in">{t("editStaff.clientsCanOnlyBookThis")}</Note>
          <Card style={{ padding: "6px 18px" }}>
            <WorkingHoursEditor value={schedule} onChange={setSchedule} />
          </Card>

          {/* FG-W2-29: the specialist's "Works" gallery on the public salon page. */}
          {id && businessId && <StaffPortfolioSection businessId={businessId} staffId={id} services={services} />}

          {/* FG-W5-02: a chair renter's rent ledger. Not salon revenue; the rent is a salon expense once paid. */}
          {id && businessId && <ChairRentCard businessId={businessId} staffId={id} />}
        </div>
      </Drawer>
    </BzScope>
  );
}
