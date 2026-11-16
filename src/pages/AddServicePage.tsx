import type { Id } from "@/types/id";
import { useState, useEffect } from "react";
import { currencySymbol } from "@/lib/currency";
import { RouteSheet, SheetTabs } from "@/components/page/RouteSheet";
import { ClientPreview } from "@/components/page/kit";
import { sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import ItemsCategoryPage from "./ItemsCategoryPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  HelpCircle,
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Image as ImageIcon,
  Plus,
  Loader2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useServices } from "@/hooks/useServices";
import { useCategories } from "@/hooks/useCategories";
import { useStaff } from "@/hooks/useStaff";
import { useNavigation } from "@/utils/navigationUtils";
import { toast } from "sonner";
import { t as tr, formatMinutes } from "@/i18n";

const sidebarItems = [
  { id: "general", get label() { return tr("addService.tabGeneral"); }, active: true },
  { id: "staff", get label() { return tr("addService.tabStaff"); } },
  { id: "settings", get label() { return tr("addService.tabSettings"); } },
  { id: "for-client", get label() { return tr("addService.forClient"); } },
];

// Scheduling fields in the SETTINGS tab are split into hours + minutes selects;
// the backend stores a single total-minutes value per field.
const toMinutes = (h: string, m: string) => (parseInt(h) || 0) * 60 + (parseInt(m) || 0);
const splitMinutes = (total?: number) => {
  const t = Math.max(0, total ?? 0);
  return { hours: Math.floor(t / 60).toString(), minutes: (t % 60).toString() };
};

export default function AddServicePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { getPath, businessId } = useNavigation();
  const isEditMode = !!id;
  const { services, createService, updateService, loading: creating } = useServices();
  const { categories, loading: categoriesLoading } = useCategories();
  const { staff, loading: staffLoading } = useStaff();
  
  // Verify businessId is available
  useEffect(() => {
    if (!businessId) {
      toast.error(tr("addService.businessIdIsMissingPlease"));
      console.error("Business ID is missing:", businessId);
    }
  }, [businessId]);
  const [activeSidebarItem, setActiveSidebarItem] = useState("general");
  const [selectedStaff, setSelectedStaff] = useState<Id[]>([]);
  const [settingsData, setSettingsData] = useState({
    allowSelfBooking: true,
    mobileService: false,
    virtualAppointments: false,
    bookingIntervalHours: "0",
    bookingIntervalMinutes: "15",
    paddingTimeRule: "-",
    paddingTimeMinutes: "Not set",
    paddingTimeBeforeHours: "0",
    paddingTimeBeforeMinutes: "0",
    paddingTimeAfterHours: "0",
    paddingTimeAfterMinutes: "0",
    processingTimeDuringHours: "0",
    processingTimeDuringMinutes: "0",
    processingTimeAfterHours: "0",
    processingTimeAfterMinutes: "0",
    parallelClients: "Not allowed",
    // "default" = the business tax rate (Business > Tax); a number overrides it for this service.
    taxRate: "default",
  });
  const [clientData, setClientData] = useState({
    messageToClient: "",
    questions: [] as { text: string; required: boolean }[],
  });
  const [formData, setFormData] = useState({
    serviceName: "",
    serviceType: "standard",
    durationHours: "0",
    durationMinutes: "30",
    priceType: "FIXED",
    price: "",
    categoryId: "none",
    description: "",
    color: "#3b82f6", // Default blue color
  });

  // Ensure arrays are never undefined - defensive programming
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeStaff = Array.isArray(staff) ? staff : [];
  
  // Ensure createService and updateService are functions
  const safeCreateService = typeof createService === 'function' ? createService : async () => {
    console.error('createService is not available');
    throw new Error(tr("addService.serviceCreationIsNotAvailable"));
  };
  const safeUpdateService = typeof updateService === 'function' ? updateService : async () => {
    console.error('updateService is not available');
    throw new Error(tr("addService.serviceUpdateIsNotAvailable"));
  };

  // Load service data if in edit mode
  useEffect(() => {
    if (isEditMode && id && services.length > 0) {
      const service = services.find(s => s.id.toString() === id);
      if (service) {
        const hours = Math.floor((service.durationMinutes || 0) / 60);
        const minutes = (service.durationMinutes || 0) % 60;
        setFormData({
          serviceName: service.name || "",
          // Re-populate the Service Type dropdown on edit. Legacy/empty values
          // (e.g. the old hardcoded "SERVICE") fall back to "standard" so the
          // Select always shows a valid option instead of a blank.
          serviceType: ["standard", "package", "course"].includes(service.serviceType || "")
            ? (service.serviceType as string)
            : "standard",
          durationHours: hours.toString(),
          durationMinutes: minutes.toString(),
          priceType: service.priceType || "FIXED",
          price: service.price?.toString() || "",
          categoryId: service.categoryId?.toString() || "none",
          description: service.description || "",
          color: service.color || "#3b82f6",
        });
        // Load staff IDs linked to this service
        if (service.staffIds && service.staffIds.length > 0) {
          setSelectedStaff(service.staffIds);
        } else {
          setSelectedStaff([]);
        }
        // Re-populate the SETTINGS toggles from the stored flags
        const bi = splitMinutes(service.bookingInterval);
        const pb = splitMinutes(service.paddingBefore);
        const pa = splitMinutes(service.paddingAfter);
        const pd = splitMinutes(service.processingDuring);
        const paf = splitMinutes(service.processingAfter);
        setSettingsData((prev) => ({
          ...prev,
          allowSelfBooking: service.isVisible ?? true,
          mobileService: service.mobileService ?? false,
          virtualAppointments: service.virtualAppointment ?? false,
          bookingIntervalHours: bi.hours,
          bookingIntervalMinutes: bi.minutes,
          paddingTimeBeforeHours: pb.hours,
          paddingTimeBeforeMinutes: pb.minutes,
          paddingTimeAfterHours: pa.hours,
          paddingTimeAfterMinutes: pa.minutes,
          processingTimeDuringHours: pd.hours,
          processingTimeDuringMinutes: pd.minutes,
          processingTimeAfterHours: paf.hours,
          processingTimeAfterMinutes: paf.minutes,
          parallelClients: parallelLabel(service.parallelClients),
          taxRate: service.taxRate != null ? String(service.taxRate) : "default",
        }));
        setClientData({
          messageToClient: service.messageToClient ?? "",
          questions: (service.questions ?? []).map((q) => ({ text: q.text, required: !!q.required })),
        });
      }
    }
  }, [isEditMode, id, services]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Build the scheduling-engine fields (all total minutes) from the SETTINGS tab.
  // The "Padding Time" Rule selector is honoured too: Fixed => that many minutes,
  // Percentage => % of duration, applied as after-padding when the granular
  // before/after fields are left at 0 (the explicit fields win when set).
  const buildScheduling = () => {
    const durMin = (parseInt(formData.durationHours) || 0) * 60 + (parseInt(formData.durationMinutes) || 0);
    const granularAfter = toMinutes(settingsData.paddingTimeAfterHours, settingsData.paddingTimeAfterMinutes);
    const ruleVal = settingsData.paddingTimeMinutes !== "Not set" ? parseInt(settingsData.paddingTimeMinutes) || 0 : 0;
    let ruleAfter = 0;
    if (settingsData.paddingTimeRule === "fixed") ruleAfter = ruleVal;
    else if (settingsData.paddingTimeRule === "percentage") ruleAfter = Math.round((durMin * ruleVal) / 100);
    return {
      bookingInterval: toMinutes(settingsData.bookingIntervalHours, settingsData.bookingIntervalMinutes),
      paddingBefore: toMinutes(settingsData.paddingTimeBeforeHours, settingsData.paddingTimeBeforeMinutes),
      paddingAfter: granularAfter > 0 ? granularAfter : ruleAfter,
      processingDuring: toMinutes(settingsData.processingTimeDuringHours, settingsData.processingTimeDuringMinutes),
      processingAfter: toMinutes(settingsData.processingTimeAfterHours, settingsData.processingTimeAfterMinutes),
    };
  };

  // Stored as "clients one staff member can take at once": 1 = one at a time, 0 = no limit.
  const parallelLabel = (n?: number | null) =>
    n == null || n === 1 ? "Not allowed" : n === 0 ? "Unlimited" : String(n - 1);
  const parallelValue = (label: string) =>
    label === "Not allowed" ? 1 : label === "Unlimited" ? 0 : parseInt(label) + 1;

  /** What the client sees: the questions, the note after booking, and how many may overlap. */
  const buildClientSettings = () => ({
    questions: clientData.questions
      .filter((q) => q.text.trim())
      .map((q) => ({ text: q.text.trim(), required: q.required })),
    messageToClient: clientData.messageToClient.trim(),
    parallelClients: parallelValue(settingsData.parallelClients),
    taxRate: settingsData.taxRate === "default" ? null : parseFloat(settingsData.taxRate),
  });

  const handleSave = async () => {
    try {
      // Validate required fields
      if (!formData.serviceName.trim()) {
        toast.error(tr("addService.serviceNameIsRequired"));
        return;
      }

      const durationMinutes = parseInt(formData.durationHours) * 60 + parseInt(formData.durationMinutes);
      const serviceData = {
        name: formData.serviceName,
        description: formData.description || undefined,
        durationMinutes: durationMinutes || undefined,
        price: formData.price ? parseFloat(formData.price) : undefined,
        priceType: formData.priceType as 'FIXED' | 'FROM' | 'RANGE',
        serviceType: formData.serviceType || 'standard',
        color: formData.color || undefined,
        categoryId: formData.categoryId && formData.categoryId !== "none" ? formData.categoryId : undefined,
        staffIds: selectedStaff, // Always send staffIds array (even if empty) so backend can update relationships
        isVisible: settingsData.allowSelfBooking, // "Allow self-booking" gates visibility in the customer app
        mobileService: settingsData.mobileService,
        virtualAppointment: settingsData.virtualAppointments,
        // Scheduling engine (Phase 2): booking interval, padding, processing time.
        ...buildScheduling(),
        ...buildClientSettings(),
      };

      if (isEditMode && id) {
        await safeUpdateService(id, serviceData); // useServices shows the toast
      } else {
        await safeCreateService(serviceData); // useServices shows the toast
      }
      navigate(getPath("items-category"));
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} service:`, error);
      const e = error as { message?: string; response?: { data?: { message?: string } } };
      const errorMessage = e?.response?.data?.message || e?.message || (isEditMode ? tr("addService.failedToUpdate") : tr("addService.failedToCreate"));
      toast.error(errorMessage);
    }
  };

  const handleSaveAndAddNext = async () => {
    if (isEditMode) {
      // In edit mode, just save and go back
      await handleSave();
      return;
    }
    try {
      // Validate required fields
      if (!formData.serviceName.trim()) {
        toast.error(tr("addService.serviceNameIsRequired"));
        return;
      }

      const durationMinutes = parseInt(formData.durationHours) * 60 + parseInt(formData.durationMinutes);
      await safeCreateService({
        name: formData.serviceName,
        description: formData.description || undefined,
        durationMinutes: durationMinutes || undefined,
        price: formData.price ? parseFloat(formData.price) : undefined,
        priceType: formData.priceType as 'FIXED' | 'FROM' | 'RANGE',
        serviceType: formData.serviceType || 'standard',
        color: formData.color || undefined,
        categoryId: formData.categoryId && formData.categoryId !== "none" ? formData.categoryId : undefined,
        staffIds: selectedStaff, // Always send staffIds array (even if empty) so backend can update relationships
        isVisible: settingsData.allowSelfBooking,
        mobileService: settingsData.mobileService,
        virtualAppointment: settingsData.virtualAppointments,
        ...buildScheduling(),
        ...buildClientSettings(),
      });
      // useServices shows the "created" toast.
      // Reset form for next service
      setFormData({
        serviceName: "",
        serviceType: "standard",
        durationHours: "0",
        durationMinutes: "30",
        priceType: "FIXED",
        price: "",
        categoryId: "none",
        description: "",
        color: "#3b82f6",
      });
      setSelectedStaff([]);
      setClientData({ messageToClient: "", questions: [] });
    } catch (error) {
      console.error("Failed to create service:", error);
      const e = error as { message?: string; response?: { data?: { message?: string } } };
      const errorMessage = e?.response?.data?.message || e?.message || tr("addService.failedToCreateService");
      toast.error(errorMessage);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && safeStaff.length > 0) {
      setSelectedStaff(safeStaff.map(s => s.id));
    } else {
      setSelectedStaff([]);
    }
  };

  const handleStaffToggle = (staffId: Id) => {
    setSelectedStaff((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId]
    );
  };

  const isAllSelected = safeStaff.length > 0 && selectedStaff.length === safeStaff.length;

  const durationMin = (parseInt(formData.durationHours) || 0) * 60 + (parseInt(formData.durationMinutes) || 0);
  const close = () => navigate(getPath("items-category"));

  return (
    <RouteSheet
      backdrop={<ItemsCategoryPage />}
      onClose={close}
      size="lg"
      title={isEditMode ? formData.serviceName || tr("addService.editService") : tr("addService.newService")}
      description={isEditMode ? tr("addService.changesShowOnBooqiAs") : tr("addService.clientsCanBookItOnline")}
      header={
        <SheetTabs
          label={tr("addService.serviceSections")}
          value={activeSidebarItem}
          onChange={setActiveSidebarItem}
          items={sidebarItems.map((i) => ({ id: i.id, label: i.label.charAt(0) + i.label.slice(1).toLowerCase() }))}
        />
      }
      footer={
        <>
          {!isEditMode ? (
            <Button variant="outline" className={sheetSecondary} onClick={handleSaveAndAddNext} disabled={!formData.serviceName.trim() || creating}>
              {tr("common.saveAddNext")}
            </Button>
          ) : (
            <Button variant="outline" className={sheetSecondary} onClick={close}>{tr("common.cancel")}</Button>
          )}
          <Button className={sheetPrimary} onClick={handleSave} disabled={!formData.serviceName.trim() || creating}>
            {creating ? (isEditMode ? tr("addService.updating") : tr("common.saving")) : isEditMode ? tr("common.saveChanges") : tr("addService.saveService")}
          </Button>
        </>
      }
    >
            {activeSidebarItem === "general" && (
              <ClientPreview where={tr("addService.yourMenuOnBooqi")}>
                <div className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-inset ring-[rgb(var(--reg-line))]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold">{formData.serviceName.trim() || tr("addService.serviceName")}</span>
                    <span className="mt-0.5 block line-clamp-2 text-sm text-[rgb(var(--reg-muted))]">
                      {[durationMin ? formatMinutes(durationMin) : null, formData.description.trim() || null].filter(Boolean).join(" · ") || "\u00a0"}
                    </span>
                    <span className="mt-1 block text-sm font-bold tabular-nums">
                      {formData.priceType === "FROM" ? tr("common.from") : ""}{formData.price || "0"} {currencySymbol()}
                    </span>
                  </span>
                  <span className="inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-semibold ring-1 ring-inset ring-[rgb(var(--reg-line))]">{tr("common.book")}</span>
                </div>
              </ClientPreview>
            )}
            {activeSidebarItem === "general" ? (
              <div className="space-y-8">
              {/* Main details (required) section */}
              <div className="space-y-6">
                <h2 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted))]">
                  {tr("addService.mainDetailsRequired")}
                </h2>

                {/* Service Name */}
                <div className="space-y-2">
                  <Label htmlFor="serviceName" className="text-sm font-medium text-[rgb(var(--reg-ink)/0.85)]">
                    {tr("addService.serviceName2")}
                  </Label>
                  <Input
                    id="serviceName"
                    value={formData.serviceName}
                    onChange={(e) => handleInputChange("serviceName", e.target.value)}
                    placeholder={tr("addService.enterServiceName")}
                    className="h-12 w-full rounded-[14px] border-[rgb(var(--reg-line))] bg-white text-base"
                  />
                </div>

                {/* Service Type */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="serviceType" className="text-sm font-medium text-[rgb(var(--reg-ink)/0.85)]">
                      {tr("addService.serviceType")}
                    </Label>
                    <HelpCircle size={16} className="text-[rgb(var(--reg-muted)/0.8)] cursor-help" />
                  </div>
                  <Select
                    value={formData.serviceType}
                    onValueChange={(value) => handleInputChange("serviceType", value)}
                  >
                    <SelectTrigger id="serviceType" className="w-full">
                      <SelectValue placeholder={tr("addService.selectServiceType")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">{tr("addService.standard")}</SelectItem>
                      <SelectItem value="package">{tr("addService.package")}</SelectItem>
                      <SelectItem value="course">{tr("addService.course")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[rgb(var(--reg-ink)/0.85)]">{tr("common.duration")}</Label>
                  <div className="flex items-center gap-3">
                    <Select
                      value={formData.durationHours}
                      onValueChange={(value) => handleInputChange("durationHours", value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {tr("addService.h", { i })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-[rgb(var(--reg-muted))]">{tr("addService.hourS")}</span>
                    <Select
                      value={formData.durationMinutes}
                      onValueChange={(value) => handleInputChange("durationMinutes", value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 15, 30, 45].map((min) => (
                          <SelectItem key={min} value={min.toString()}>
                            {tr("addService.min", { min })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-[rgb(var(--reg-muted))]">{tr("addService.minutes")}</span>
                  </div>
                </div>

                {/* Price type and Price */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[rgb(var(--reg-ink)/0.85)]">{tr("common.priceType")}</Label>
                  <div className="flex items-center gap-3">
                    <Select
                      value={formData.priceType}
                      onValueChange={(value) => handleInputChange("priceType", value)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIXED">{tr("common.fixed")}</SelectItem>
                        <SelectItem value="FROM">{tr("common.from2")}</SelectItem>
                        <SelectItem value="RANGE">{tr("addService.range")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-[rgb(var(--reg-muted))]">{currencySymbol()}</span>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => handleInputChange("price", e.target.value)}
                      placeholder={tr("common.price")}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Additional details section */}
              <div className="space-y-6 pt-6 border-t border-[rgb(var(--reg-line)/0.8)]">
                <h2 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted))]">{tr("addService.additionalDetails")}</h2>

                {/* Service Category */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[rgb(var(--reg-ink)/0.85)]">{tr("addService.serviceCategory")}</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => handleInputChange("categoryId", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tr("common.notCategorized")}</SelectItem>
                      {safeCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Service Color */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-[rgb(var(--reg-ink)/0.85)]">{tr("addService.serviceColor")}</Label>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="color"
                        value={formData.color}
                        onChange={(e) => handleInputChange("color", e.target.value)}
                        className="w-16 h-10 rounded border border-[rgb(var(--reg-line))] cursor-pointer"
                        title={tr("addService.selectColor")}
                      />
                    </div>
                    <Input
                      type="text"
                      value={formData.color}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Validate hex color format
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(value) || value === "") {
                          handleInputChange("color", value);
                        }
                      }}
                      placeholder="#000000"
                      className="flex-1 font-mono text-sm"
                      maxLength={7}
                    />
                    <div
                      className="w-10 h-10 rounded border border-[rgb(var(--reg-line))] flex-shrink-0"
                      style={{ backgroundColor: formData.color }}
                      title={tr("addService.colorPreview")}
                    />
                  </div>
                  <p className="text-xs text-[rgb(var(--reg-muted))]">
                    {tr("addService.thisColorWillBeUsed")}
                  </p>
                </div>

                {/* Text Editor Toolbar */}
                <div className="flex items-center gap-2 p-2 border border-[rgb(var(--reg-line)/0.8)] rounded-2xl bg-[rgb(var(--reg-canvas))]">
                  <button className="p-2 hover:bg-gray-200 rounded">
                    <Bold size={16} className="text-[rgb(var(--reg-muted))]" />
                  </button>
                  <button className="p-2 hover:bg-gray-200 rounded">
                    <Italic size={16} className="text-[rgb(var(--reg-muted))]" />
                  </button>
                  <button className="p-2 hover:bg-gray-200 rounded">
                    <Strikethrough size={16} className="text-[rgb(var(--reg-muted))]" />
                  </button>
                  <div className="w-px h-6 bg-gray-300" />
                  <button className="p-2 hover:bg-gray-200 rounded">
                    <List size={16} className="text-[rgb(var(--reg-muted))]" />
                  </button>
                  <button className="p-2 hover:bg-gray-200 rounded">
                    <ListOrdered size={16} className="text-[rgb(var(--reg-muted))]" />
                  </button>
                </div>

                {/* Service Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium text-[rgb(var(--reg-ink)/0.85)]">
                    {tr("addService.serviceDescription")}
                  </Label>
                  <div className="relative">
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      placeholder={tr("addService.enterServiceDescription")}
                      rows={8}
                      className="w-full px-4 py-3 border border-[rgb(var(--reg-line))] rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
                    />
                    <button className="absolute bottom-3 right-3 p-2 text-[rgb(var(--reg-muted)/0.8)] hover:text-[rgb(var(--reg-muted))] hover:bg-[rgb(var(--reg-ink)/0.05)] rounded">
                      <ImageIcon size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            ) : activeSidebarItem === "staff" ? (
              <div className="max-w-3xl bg-white rounded-2xl shadow-sm">
                <div className="p-6">
                  {/* Select All */}
                  <div className="flex items-center gap-3 py-4 border-b border-[rgb(var(--reg-line)/0.8)]">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      className="h-5 w-5 border-gray-400 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900"
                    />
                    <Label className="text-sm font-medium text-[rgb(var(--reg-ink))] cursor-pointer">
                      {tr("addService.selectAll", { count: selectedStaff.length })}
                    </Label>
                  </div>

                  {/* Staff List */}
                  <div className="divide-y divide-gray-200">
                    {staffLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-[rgb(var(--reg-muted)/0.8)]" />
                      </div>
                    ) : safeStaff.length > 0 ? (
                      safeStaff.map((staffMember) => {
                        const isSelected = selectedStaff.includes(staffMember.id);
                        const initials = staffMember.initials || (staffMember.name || "").split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
                        return (
                          <div
                            key={staffMember.id}
                            className="flex items-center gap-3 py-4"
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleStaffToggle(staffMember.id)}
                              className="h-5 w-5 border-gray-400 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900"
                            />
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-medium text-[rgb(var(--reg-ink)/0.85)]">
                                {initials}
                              </span>
                            </div>
                            <Label className="text-sm font-medium text-[rgb(var(--reg-ink))] cursor-pointer flex-1">
                              {staffMember.name}
                            </Label>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-8 text-center text-[rgb(var(--reg-muted))] text-sm">
                        {tr("addService.noStaffMembersAvailable")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : activeSidebarItem === "settings" ? (
              <div className="max-w-3xl bg-white rounded-2xl shadow-sm">
                <div className="p-6 space-y-6">
                  {/* Allow self-booking */}
                  <div className="flex items-center justify-between py-3 border-b border-[rgb(var(--reg-line)/0.8)]">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium text-[rgb(var(--reg-ink))] cursor-pointer">
                        {tr("addService.allowSelfBooking")}
                      </Label>
                      <HelpCircle size={16} className="text-[rgb(var(--reg-muted)/0.8)] cursor-help" />
                    </div>
                    <Switch
                      checked={settingsData.allowSelfBooking}
                      onCheckedChange={(checked) =>
                        setSettingsData((prev) => ({ ...prev, allowSelfBooking: checked }))
                      }
                     
                    />
                  </div>

                  {/* Mobile Service */}
                  <div className="flex items-center justify-between py-3 border-b border-[rgb(var(--reg-line)/0.8)]">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium text-[rgb(var(--reg-ink))] cursor-pointer">
                        {tr("addService.mobileService")}
                      </Label>
                      <HelpCircle size={16} className="text-[rgb(var(--reg-muted)/0.8)] cursor-help" />
                    </div>
                    <Switch
                      checked={settingsData.mobileService}
                      onCheckedChange={(checked) =>
                        setSettingsData((prev) => ({ ...prev, mobileService: checked }))
                      }
                    />
                  </div>

                  {/* Virtual Appointments */}
                  <div className="flex items-center justify-between py-3 border-b border-[rgb(var(--reg-line)/0.8)]">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium text-[rgb(var(--reg-ink))] cursor-pointer">
                        {tr("addService.virtualAppointments")}
                      </Label>
                      <HelpCircle size={16} className="text-[rgb(var(--reg-muted)/0.8)] cursor-help" />
                    </div>
                    <Switch
                      checked={settingsData.virtualAppointments}
                      onCheckedChange={(checked) =>
                        setSettingsData((prev) => ({ ...prev, virtualAppointments: checked }))
                      }
                    />
                  </div>

                  {/* Booking Intervals */}
                  <div className="py-3 border-b border-[rgb(var(--reg-line)/0.8)]">
                    <div className="flex items-center gap-2 mb-3">
                      <Label className="text-sm font-medium text-[rgb(var(--reg-ink))]">
                        {tr("addService.bookingIntervals")}
                      </Label>
                      <HelpCircle size={16} className="text-[rgb(var(--reg-muted)/0.8)] cursor-help" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Select
                        value={settingsData.bookingIntervalHours}
                        onValueChange={(value) =>
                          setSettingsData((prev) => ({ ...prev, bookingIntervalHours: value }))
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-[rgb(var(--reg-muted))]">{tr("addService.hour")}</span>
                      <Select
                        value={settingsData.bookingIntervalMinutes}
                        onValueChange={(value) =>
                          setSettingsData((prev) => ({ ...prev, bookingIntervalMinutes: value }))
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 15, 30, 45].map((min) => (
                            <SelectItem key={min} value={min.toString()}>
                              {tr("addService.min", { min })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-[rgb(var(--reg-muted))]">{tr("addService.minutes")}</span>
                    </div>
                  </div>

                  {/* Padding Time */}
                  <div className="py-3 border-b border-[rgb(var(--reg-line)/0.8)]">
                    <div className="flex items-center gap-2 mb-3">
                      <Label className="text-sm font-medium text-[rgb(var(--reg-ink))]">{tr("addService.paddingTime")}</Label>
                      <HelpCircle size={16} className="text-[rgb(var(--reg-muted)/0.8)] cursor-help" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Select
                          value={settingsData.paddingTimeRule}
                          onValueChange={(value) =>
                            setSettingsData((prev) => ({ ...prev, paddingTimeRule: value }))
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="-">-</SelectItem>
                            <SelectItem value="fixed">{tr("common.fixed")}</SelectItem>
                            <SelectItem value="percentage">{tr("common.percentage")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-[rgb(var(--reg-muted))]">{tr("addService.rule")}</span>
                        <Select
                          value={settingsData.paddingTimeMinutes}
                          onValueChange={(value) =>
                            setSettingsData((prev) => ({ ...prev, paddingTimeMinutes: value }))
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Not set">{tr("addService.notSet")}</SelectItem>
                            <SelectItem value="5">{tr("addService.min2")}</SelectItem>
                            <SelectItem value="10">{tr("addService.min3")}</SelectItem>
                            <SelectItem value="15">{tr("addService.min4")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-[rgb(var(--reg-muted))]">{tr("addService.minutes")}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Select
                          value={settingsData.paddingTimeBeforeHours}
                          onValueChange={(value) =>
                            setSettingsData((prev) => ({ ...prev, paddingTimeBeforeHours: value }))
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-[rgb(var(--reg-muted))]">{tr("addService.hour")}</span>
                        <Select
                          value={settingsData.paddingTimeBeforeMinutes}
                          onValueChange={(value) =>
                            setSettingsData((prev) => ({ ...prev, paddingTimeBeforeMinutes: value }))
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 15, 30, 45].map((min) => (
                              <SelectItem key={min} value={min.toString()}>
                                {tr("addService.min", { min })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-[rgb(var(--reg-muted))]">{tr("addService.minutes")}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-[rgb(var(--reg-muted))] w-20">{tr("addService.after")}</span>
                        <Select
                          value={settingsData.paddingTimeAfterHours}
                          onValueChange={(value) =>
                            setSettingsData((prev) => ({ ...prev, paddingTimeAfterHours: value }))
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-[rgb(var(--reg-muted))]">{tr("addService.hour")}</span>
                        <Select
                          value={settingsData.paddingTimeAfterMinutes}
                          onValueChange={(value) =>
                            setSettingsData((prev) => ({ ...prev, paddingTimeAfterMinutes: value }))
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 15, 30, 45].map((min) => (
                              <SelectItem key={min} value={min.toString()}>
                                {tr("addService.min", { min })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-[rgb(var(--reg-muted))]">{tr("addService.minutes")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Processing time during the service */}
                  <div className="py-3 border-b border-[rgb(var(--reg-line)/0.8)]">
                    <div className="flex items-center gap-2 mb-3">
                      <Label className="text-sm font-medium text-[rgb(var(--reg-ink))]">
                        {tr("addService.processingTimeDuringTheService")}
                      </Label>
                      <HelpCircle size={16} className="text-[rgb(var(--reg-muted)/0.8)] cursor-help" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Select
                        value={settingsData.processingTimeDuringHours}
                        onValueChange={(value) =>
                          setSettingsData((prev) => ({ ...prev, processingTimeDuringHours: value }))
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-[rgb(var(--reg-muted))]">{tr("addService.hour")}</span>
                      <Select
                        value={settingsData.processingTimeDuringMinutes}
                        onValueChange={(value) =>
                          setSettingsData((prev) => ({ ...prev, processingTimeDuringMinutes: value }))
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 15, 30, 45].map((min) => (
                            <SelectItem key={min} value={min.toString()}>
                              {tr("addService.min", { min })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-[rgb(var(--reg-muted))]">{tr("addService.minutes")}</span>
                    </div>
                  </div>

                  {/* Processing time after the service */}
                  <div className="py-3 border-b border-[rgb(var(--reg-line)/0.8)]">
                    <div className="flex items-center gap-2 mb-3">
                      <Label className="text-sm font-medium text-[rgb(var(--reg-ink))]">
                        {tr("addService.processingTimeAfterTheService")}
                      </Label>
                      <HelpCircle size={16} className="text-[rgb(var(--reg-muted)/0.8)] cursor-help" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Select
                        value={settingsData.processingTimeAfterHours}
                        onValueChange={(value) =>
                          setSettingsData((prev) => ({ ...prev, processingTimeAfterHours: value }))
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-[rgb(var(--reg-muted))]">{tr("addService.hour")}</span>
                      <Select
                        value={settingsData.processingTimeAfterMinutes}
                        onValueChange={(value) =>
                          setSettingsData((prev) => ({ ...prev, processingTimeAfterMinutes: value }))
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 15, 30, 45].map((min) => (
                            <SelectItem key={min} value={min.toString()}>
                              {tr("addService.min", { min })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-[rgb(var(--reg-muted))]">{tr("addService.minutes")}</span>
                    </div>
                  </div>

                  {/* Parallel Clients */}
                  <div className="py-3 border-b border-[rgb(var(--reg-line)/0.8)]">
                    <div className="flex items-center gap-2 mb-3">
                      <Label className="text-sm font-medium text-[rgb(var(--reg-ink))]">{tr("addService.parallelClients")}</Label>
                      <HelpCircle size={16} className="text-[rgb(var(--reg-muted)/0.8)] cursor-help" />
                    </div>
                    <Select
                      value={settingsData.parallelClients}
                      onValueChange={(value) =>
                        setSettingsData((prev) => ({ ...prev, parallelClients: value }))
                      }
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Not allowed">{tr("addService.notAllowed")}</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="Unlimited">{tr("addService.unlimited")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tax Rate */}
                  <div className="py-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Label className="text-sm font-medium text-[rgb(var(--reg-ink))]">{tr("addService.taxRate")}</Label>
                      <HelpCircle size={16} className="text-[rgb(var(--reg-muted)/0.8)] cursor-help" />
                    </div>
                    <Select
                      value={settingsData.taxRate}
                      onValueChange={(value) =>
                        setSettingsData((prev) => ({ ...prev, taxRate: value }))
                      }
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">{tr("addService.businessDefault")}</SelectItem>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="5">5%</SelectItem>
                        <SelectItem value="8">8%</SelectItem>
                        <SelectItem value="18">18%</SelectItem>
                        <SelectItem value="23">23%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ) : activeSidebarItem === "for-client" ? (
              <div className="max-w-3xl bg-white rounded-2xl shadow-sm">
                <div className="p-6 space-y-8">
                  {/* Message to Client */}
                  <div className="space-y-3">
                    <h2 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted))]">{tr("addService.messageToClient")}</h2>
                    <div className="space-y-2">
                      <textarea
                        value={clientData.messageToClient}
                        onChange={(e) =>
                          setClientData((prev) => ({ ...prev, messageToClient: e.target.value }))
                        }
                        placeholder={tr("addService.eGPleaseDoNot")}
                        rows={6}
                        className="w-full px-4 py-3 border border-[rgb(var(--reg-line))] rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-400 resize-y"
                      />
                      <p className="text-sm text-[rgb(var(--reg-muted))]">
                        {tr("addService.shownToTheClientOnce")}
                      </p>
                    </div>
                  </div>

                  {/* Questions to Client */}
                  <div className="space-y-3">
                    <h2 className="text-xs font-extrabold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted))]">{tr("addService.questionsToClient")}</h2>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setClientData((prev) => ({
                          ...prev,
                          questions: [...prev.questions, { text: "", required: false }],
                        }));
                      }}
                      className="flex items-center gap-2 border-[rgb(var(--reg-line))] hover:bg-[rgb(var(--reg-canvas))]"
                    >
                      <Plus size={16} />
                      {tr("addService.addQuestion")}
                    </Button>
                    {clientData.questions.length > 0 && (
                      <div className="space-y-3 mt-4">
                        {clientData.questions.map((question, index) => (
                          <div key={index} className="flex items-center gap-3">
                            <Input
                              value={question.text}
                              onChange={(e) => {
                                const newQuestions = [...clientData.questions];
                                newQuestions[index] = { ...question, text: e.target.value };
                                setClientData((prev) => ({ ...prev, questions: newQuestions }));
                              }}
                              placeholder={tr("addService.enterYourQuestion")}
                              className="flex-1"
                            />
                            <label className="flex shrink-0 items-center gap-1.5 text-sm text-[rgb(var(--reg-muted))]">
                              <input
                                type="checkbox"
                                checked={question.required}
                                onChange={(e) => {
                                  const newQuestions = [...clientData.questions];
                                  newQuestions[index] = { ...question, required: e.target.checked };
                                  setClientData((prev) => ({ ...prev, questions: newQuestions }));
                                }}
                              />
                              {tr("addService.required")}
                            </label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newQuestions = clientData.questions.filter(
                                  (_, i) => i !== index
                                );
                                setClientData((prev) => ({ ...prev, questions: newQuestions }));
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              {tr("common.remove")}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-[rgb(var(--reg-muted))]">
                  {sidebarItems.find((item) => item.id === activeSidebarItem)?.label}{" "}{tr("addService.sectionComingSoon")}
                </p>
              </div>
            )}
    </RouteSheet>
  );
}

