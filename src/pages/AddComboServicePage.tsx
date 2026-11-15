import { useState, useEffect } from "react";
import { currencySymbol } from "@/lib/currency";
import { RouteSheet, SheetTabs } from "@/components/page/RouteSheet";
import { sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import ItemsCategoryPage from "./ItemsCategoryPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  X,
  Trash2,
  Loader2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useServices } from "@/hooks/useServices";
import { useCategories } from "@/hooks/useCategories";
import { toast } from "sonner";
import { serviceService } from "@/services/serviceService";
import { useNavigation } from "@/utils/navigationUtils";
import { t, formatMinutes } from "@/i18n";

const sidebarItems = [
  { id: "general", get label() { return t("addComboService.tabGeneral"); } },
  { id: "services", get label() { return t("addComboService.tabServices"); } },
  { id: "pricing", get label() { return t("addComboService.tabPricing"); } },
];

interface ComboService {
  id: string;
  serviceId: number;
  name: string;
  durationMinutes?: number;
  price?: number;
  color?: string;
  timeBetweenHours?: string;
  timeBetweenMinutes?: string;
  priceType?: string;
  priceValue?: string;
}

export default function AddComboServicePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { getPath } = useNavigation();
  const isEditMode = !!id;
  const { services, loading: servicesLoading, createService, updateService } = useServices();
  const { categories } = useCategories();
  const [activeSidebarItem, setActiveSidebarItem] = useState("general");
  const [bookingType, setBookingType] = useState("sequence");
  const [pricingType, setPricingType] = useState("custom");
  const [comboServices, setComboServices] = useState<ComboService[]>([]);
  const [formData, setFormData] = useState({
    comboName: "",
    categoryId: "none",
    description: "",
    allowOnlineBooking: true,
    comboPriceType: "FIXED",
    comboPrice: "",
    color: "#9333ea", // Default purple color for combo services
  });

  // Load combo service data if in edit mode
  useEffect(() => {
    const loadComboServiceData = async () => {
      if (isEditMode && id) {
        // Wait for services to load if not already loaded
        if (services.length === 0 && !servicesLoading) {
          // Services might still be loading, wait a bit
          return;
        }
        
        const service = services.find(s => s.id.toString() === id && s.serviceType === 'COMBO');
        if (service) {
          setFormData({
            comboName: service.name || "",
            categoryId: service.categoryId?.toString() || "none",
            description: service.description || "",
            allowOnlineBooking: true, // TODO: Load from service if available
            comboPriceType: service.priceType || "FIXED",
            comboPrice: service.price?.toString() || "",
            color: service.color || "#9333ea",
          });
          
          // Load combo service items
          try {
            console.log("Loading combo service items for combo service ID:", id);
            const comboItems = await serviceService.getComboServiceItems(parseInt(id));
            console.log("Loaded combo items:", comboItems);
            console.log("Available services:", services);
            
            const loadedServices: ComboService[] = comboItems.map((item, index) => {
              // Try to find service in the services array, or use the serviceName from the API
              const serviceData = services.find(s => s.id === item.serviceId);
              console.log(`Finding service for item ${item.serviceId}:`, serviceData);
              const timeBetweenTotal = item.timeBetweenMinutes || 0;
              const hours = Math.floor(timeBetweenTotal / 60);
              const minutes = timeBetweenTotal % 60;
              
              const comboService: ComboService = {
                id: `combo-${item.serviceId}-${index}`,
                serviceId: item.serviceId,
                name: item.serviceName || serviceData?.name || `Service ${item.serviceId}`,
                durationMinutes: serviceData?.durationMinutes,
                price: serviceData?.price,
                color: serviceData?.color || "#9333ea",
                timeBetweenHours: hours > 0 ? hours.toString() : "0",
                timeBetweenMinutes: minutes > 0 ? minutes.toString() : "0",
              };
              
              console.log(`Created combo service item:`, comboService);
              return comboService;
            });
            console.log("Setting combo services (total:", loadedServices.length, "):", loadedServices);
            if (loadedServices.length > 0) {
              setComboServices(loadedServices);
              
              // Determine pricing type: if price matches sum of service prices, it's "sum", otherwise "custom"
              const sumOfServices = loadedServices.reduce((sum, cs) => {
                return sum + (cs.price ? Number(cs.price) : 0);
              }, 0);
              const servicePrice = service.price ? Number(service.price) : 0;
              
              console.log("Determining pricing type - Service price:", servicePrice, "Sum of services:", sumOfServices);
              
              // Check if price matches sum (with small tolerance for floating point)
              // Also check if price is 0 or undefined - if so, default to custom
              if (servicePrice > 0 && sumOfServices > 0 && Math.abs(servicePrice - sumOfServices) < 0.01) {
                setPricingType("sum");
                console.log("Pricing type set to 'sum' (price matches sum of services:", servicePrice, "==", sumOfServices, ")");
              } else {
                setPricingType("custom");
                console.log("Pricing type set to 'custom' (price:", servicePrice, "sum:", sumOfServices, ")");
              }
            } else {
              console.warn("No combo services loaded, but comboItems had", comboItems.length, "items");
              // Default to custom if no services
              setPricingType("custom");
            }
          } catch (error) {
            console.error("Failed to load combo service items:", error);
            toast.error(t("addComboService.failedToLoadComboService"));
            // Default to custom on error
            setPricingType("custom");
          }
        }
      }
    };
    
    loadComboServiceData();
  }, [isEditMode, id, services, servicesLoading]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddService = (serviceId: number) => {
    const service = services.find((s) => s.id === serviceId);
    if (service && !comboServices.some((cs) => cs.serviceId === serviceId)) {
      setComboServices([
        ...comboServices,
        {
          id: Date.now().toString(),
          serviceId: service.id,
          name: service.name,
          durationMinutes: service.durationMinutes,
          price: service.price,
          color: service.color,
          priceType: service.priceType || "FIXED",
          priceValue: service.price?.toString() || "",
        },
      ]);
    }
  };

  const handleRemoveService = (id: string) => {
    setComboServices(comboServices.filter((s) => s.id !== id));
  };

  const handleUpdateServiceTime = (
    id: string,
    field: "timeBetweenHours" | "timeBetweenMinutes",
    value: string
  ) => {
    setComboServices(
      comboServices.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      )
    );
  };

  const handleRemoveTimeBetween = (id: string) => {
    setComboServices(
      comboServices.map((s) =>
        s.id === id
          ? { ...s, timeBetweenHours: undefined, timeBetweenMinutes: undefined }
          : s
      )
    );
  };

  const handleAddTimeBetween = (id: string) => {
    setComboServices(
      comboServices.map((s) =>
        s.id === id
          ? { ...s, timeBetweenHours: "0", timeBetweenMinutes: "0" }
          : s
      )
    );
  };

  const handleUpdateServicePrice = (
    id: string,
    field: "priceType" | "priceValue",
    value: string
  ) => {
    setComboServices(
      comboServices.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      )
    );
  };

  const calculateComboPrice = () => {
    if (pricingType === "sum") {
      const total = comboServices.reduce((sum, cs) => {
        const service = services.find(s => s.id === cs.serviceId);
        return sum + (service?.price ? Number(service.price) : 0);
      }, 0);
      return total.toFixed(2);
    }
    return formData.comboPrice || "0.00";
  };

  const calculateComboDuration = () => {
    if (comboServices.length === 0) return formatMinutes(0);
    
    if (bookingType === "parallel") {
      // For parallel: duration is the maximum (longest) service duration
      const maxDuration = comboServices.reduce((max, cs) => {
        const service = services.find(s => s.id === cs.serviceId);
        const serviceDuration = service?.durationMinutes || 0;
        return Math.max(max, serviceDuration);
      }, 0);

      return formatMinutes(maxDuration);
    } else {
      // For sequence: sum all service durations + time between services
      const totalMinutes = comboServices.reduce((sum, cs, index) => {
        const service = services.find(s => s.id === cs.serviceId);
        const serviceDuration = service?.durationMinutes || 0;
        
        // Add service duration
        let duration = sum + serviceDuration;
        
        // Add time between services (not for the last service)
        if (index < comboServices.length - 1 && cs.timeBetweenHours !== undefined && cs.timeBetweenMinutes !== undefined) {
          const timeBetweenHours = parseInt(cs.timeBetweenHours || "0");
          const timeBetweenMinutes = parseInt(cs.timeBetweenMinutes || "0");
          const timeBetweenTotal = timeBetweenHours * 60 + timeBetweenMinutes;
          duration += timeBetweenTotal;
        }
        
        return duration;
      }, 0);

      return formatMinutes(totalMinutes);
    }
  };

  const handleSave = async () => {
    try {
      // Validate required fields
      if (!formData.comboName.trim()) {
        toast.error(t("addComboService.pleaseEnterAComboService"));
        return;
      }
      
      if (comboServices.length === 0) {
        toast.error(t("addComboService.pleaseAddAtLeastOne"));
        return;
      }
      
      // Calculate total duration based on booking type
      let totalDuration: number;
      
      if (bookingType === "parallel") {
        // For parallel: duration is the maximum (longest) service duration
        totalDuration = comboServices.reduce((max, cs) => {
          const service = services.find(s => s.id === cs.serviceId);
          const serviceDuration = service?.durationMinutes || 0;
          return Math.max(max, serviceDuration);
        }, 0);
      } else {
        // For sequence: sum all service durations + time between services
        totalDuration = comboServices.reduce((sum, cs, index) => {
          const service = services.find(s => s.id === cs.serviceId);
          const serviceDuration = service?.durationMinutes || 0;
          
          // Add service duration
          let duration = sum + serviceDuration;
          
          // Add time between services (not for the last service)
          if (index < comboServices.length - 1 && cs.timeBetweenHours !== undefined && cs.timeBetweenMinutes !== undefined) {
            const timeBetweenHours = parseInt(cs.timeBetweenHours || "0");
            const timeBetweenMinutes = parseInt(cs.timeBetweenMinutes || "0");
            const timeBetweenTotal = timeBetweenHours * 60 + timeBetweenMinutes;
            duration += timeBetweenTotal;
          }
          
          return duration;
        }, 0);
      }
      
      // Calculate price based on pricing type
      let finalPrice: number | undefined;
      if (pricingType === "sum") {
        const calculatedPrice = comboServices.reduce((sum, cs) => {
          const service = services.find(s => s.id === cs.serviceId);
          return sum + (service?.price ? Number(service.price) : 0);
        }, 0);
        // Always set price when using sum, even if it's 0
        finalPrice = calculatedPrice >= 0 ? calculatedPrice : undefined;
      } else if (pricingType === "custom" && formData.comboPrice) {
        const parsedPrice = parseFloat(formData.comboPrice);
        finalPrice = isNaN(parsedPrice) ? undefined : parsedPrice;
      }
      
      // Prepare combo service IDs and time between services
      const comboServiceIds = comboServices.map(cs => cs.serviceId);
      const timeBetweenMinutes: number[] = [];
      
      // Calculate time between services in minutes (for sequence booking)
      if (bookingType === "sequence") {
        for (let i = 0; i < comboServices.length - 1; i++) {
          const cs = comboServices[i];
          if (cs.timeBetweenHours !== undefined && cs.timeBetweenMinutes !== undefined) {
            const hours = parseInt(cs.timeBetweenHours || "0");
            const minutes = parseInt(cs.timeBetweenMinutes || "0");
            timeBetweenMinutes.push(hours * 60 + minutes);
          } else {
            timeBetweenMinutes.push(0);
          }
        }
      }
      
      const serviceData = {
        name: formData.comboName,
        description: formData.description || undefined,
        durationMinutes: totalDuration || undefined,
        price: finalPrice !== undefined ? finalPrice : (pricingType === "sum" ? 0 : undefined),
        priceType: formData.comboPriceType as 'FIXED' | 'FROM' | 'RANGE',
        serviceType: 'COMBO' as const,
        color: formData.color || undefined,
        categoryId: formData.categoryId && formData.categoryId !== "none" ? parseInt(formData.categoryId) : undefined,
        comboServiceIds: comboServiceIds && comboServiceIds.length > 0 ? comboServiceIds : undefined,
        timeBetweenMinutes: timeBetweenMinutes && timeBetweenMinutes.length > 0 ? timeBetweenMinutes : undefined,
      };
      
      console.log("Saving combo service with data:", serviceData);
      
      if (isEditMode && id) {
        await updateService(parseInt(id), serviceData);
      } else {
        await createService(serviceData);
      }
      
      navigate(getPath("items-category"));
    } catch (error) {
      console.error("Failed to create combo service:", error);
      const e = error as { message?: string; response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || e?.message || t("addComboService.failedToCreateComboService"));
    }
  };

  const handleSaveAndAddNext = async () => {
    try {
      // Validate required fields
      if (!formData.comboName.trim()) {
        toast.error(t("addComboService.pleaseEnterAComboService"));
        return;
      }
      
      if (comboServices.length === 0) {
        toast.error(t("addComboService.pleaseAddAtLeastOne"));
        return;
      }
      
      // Calculate total duration based on booking type
      let totalDuration: number;
      
      if (bookingType === "parallel") {
        // For parallel: duration is the maximum (longest) service duration
        totalDuration = comboServices.reduce((max, cs) => {
          const service = services.find(s => s.id === cs.serviceId);
          const serviceDuration = service?.durationMinutes || 0;
          return Math.max(max, serviceDuration);
        }, 0);
      } else {
        // For sequence: sum all service durations + time between services
        totalDuration = comboServices.reduce((sum, cs, index) => {
          const service = services.find(s => s.id === cs.serviceId);
          const serviceDuration = service?.durationMinutes || 0;
          
          // Add service duration
          let duration = sum + serviceDuration;
          
          // Add time between services (not for the last service)
          if (index < comboServices.length - 1 && cs.timeBetweenHours !== undefined && cs.timeBetweenMinutes !== undefined) {
            const timeBetweenHours = parseInt(cs.timeBetweenHours || "0");
            const timeBetweenMinutes = parseInt(cs.timeBetweenMinutes || "0");
            const timeBetweenTotal = timeBetweenHours * 60 + timeBetweenMinutes;
            duration += timeBetweenTotal;
          }
          
          return duration;
        }, 0);
      }
      
      // Calculate price based on pricing type
      let finalPrice: number | undefined;
      if (pricingType === "sum") {
        const calculatedPrice = comboServices.reduce((sum, cs) => {
          const service = services.find(s => s.id === cs.serviceId);
          return sum + (service?.price ? Number(service.price) : 0);
        }, 0);
        // Always set price when using sum, even if it's 0
        finalPrice = calculatedPrice >= 0 ? calculatedPrice : undefined;
      } else if (pricingType === "custom" && formData.comboPrice) {
        const parsedPrice = parseFloat(formData.comboPrice);
        finalPrice = isNaN(parsedPrice) ? undefined : parsedPrice;
      }
      
      // Prepare combo service IDs and time between services
      const comboServiceIds = comboServices.map(cs => cs.serviceId);
      const timeBetweenMinutes: number[] = [];
      
      // Calculate time between services in minutes (for sequence booking)
      if (bookingType === "sequence") {
        for (let i = 0; i < comboServices.length - 1; i++) {
          const cs = comboServices[i];
          if (cs.timeBetweenHours !== undefined && cs.timeBetweenMinutes !== undefined) {
            const hours = parseInt(cs.timeBetweenHours || "0");
            const minutes = parseInt(cs.timeBetweenMinutes || "0");
            timeBetweenMinutes.push(hours * 60 + minutes);
          } else {
            timeBetweenMinutes.push(0);
          }
        }
      }
      
      const serviceData = {
        name: formData.comboName,
        description: formData.description || undefined,
        durationMinutes: totalDuration || undefined,
        price: finalPrice !== undefined ? finalPrice : (pricingType === "sum" ? 0 : undefined),
        priceType: formData.comboPriceType as 'FIXED' | 'FROM' | 'RANGE',
        serviceType: 'COMBO' as const,
        color: formData.color || undefined,
        categoryId: formData.categoryId && formData.categoryId !== "none" ? parseInt(formData.categoryId) : undefined,
        comboServiceIds: comboServiceIds && comboServiceIds.length > 0 ? comboServiceIds : undefined,
        timeBetweenMinutes: timeBetweenMinutes && timeBetweenMinutes.length > 0 ? timeBetweenMinutes : undefined,
      };
      
      console.log("Saving combo service with data:", serviceData);
      
      if (isEditMode && id) {
        // In edit mode, just save and go back
        await updateService(parseInt(id), serviceData);
        navigate(getPath("items-category"));
        return;
      }
      
      await createService(serviceData);
      
      // Reset form for next combo
      setFormData({
        comboName: "",
        categoryId: "none",
        description: "",
        allowOnlineBooking: true,
        comboPriceType: "FIXED",
        comboPrice: "",
        color: "#9333ea",
      });
      setComboServices([]);
      setBookingType("sequence");
      setPricingType("custom");
    } catch (error) {
      console.error("Failed to create combo service:", error);
      const e = error as { message?: string; response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || e?.message || t("addComboService.failedToCreateComboService"));
    }
  };

  const close = () => navigate(getPath("items-category"));

  return (
    <RouteSheet
      backdrop={<ItemsCategoryPage />}
      onClose={close}
      size="lg"
      title={isEditMode ? formData.comboName || t("addComboService.editCombo") : t("addComboService.newCombo")}
      description={t("addComboService.severalServicesBookedTogetherAs")}
      header={
        <SheetTabs
          label={t("addComboService.comboSections")}
          value={activeSidebarItem}
          onChange={setActiveSidebarItem}
          items={sidebarItems.map((i) => ({ id: i.id, label: i.label.charAt(0) + i.label.slice(1).toLowerCase() }))}
        />
      }
      footer={
        <>
          {!isEditMode ? (
            <Button variant="outline" className={sheetSecondary} onClick={handleSaveAndAddNext}>{t("common.saveAddNext")}</Button>
          ) : (
            <Button variant="outline" className={sheetSecondary} onClick={close}>{t("common.cancel")}</Button>
          )}
          {/* It was disabled when creating, so a new combo could only be saved through
              "save & add next"; handleSave creates as well as updates. */}
          <Button className={sheetPrimary} onClick={handleSave}>
            {isEditMode ? t("common.saveChanges") : t("addComboService.saveCombo")}
          </Button>
        </>
      }
    >
              <div className="bg-white rounded-2xl shadow-sm border border-[rgb(var(--reg-line)/0.8)] p-6">
                <h2 className="text-lg font-bold text-[rgb(var(--reg-ink))] mb-6">
                  {t("addComboService.comboServiceDetails")}
                </h2>

                {/* GENERAL Tab */}
                {activeSidebarItem === "general" && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="combo-name">{t("addComboService.comboName")}</Label>
                      <Input
                        id="combo-name"
                        placeholder={t("addComboService.comboName")}
                        value={formData.comboName}
                        onChange={(e) =>
                          handleInputChange("comboName", e.target.value)
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="service-category">{t("addComboService.serviceCategory")}</Label>
                      <Select
                        value={formData.categoryId}
                        onValueChange={(value) =>
                          handleInputChange("categoryId", value)
                        }
                      >
                        <SelectTrigger id="service-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("common.notCategorized")}</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Combo Service Color */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[rgb(var(--reg-ink)/0.85)]">{t("addComboService.comboServiceColor")}</Label>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <input
                            type="color"
                            value={formData.color}
                            onChange={(e) => handleInputChange("color", e.target.value)}
                            className="w-16 h-10 rounded border border-[rgb(var(--reg-line))] cursor-pointer"
                            title={t("addComboService.selectColor")}
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
                          title={t("addComboService.colorPreview")}
                        />
                      </div>
                      <p className="text-xs text-[rgb(var(--reg-muted))]">
                        {t("addComboService.thisColorWillBeUsed")}
                      </p>
                    </div>

                    {/* Text Editor Toolbar */}
                    <div className="flex items-center gap-2 p-2 border border-[rgb(var(--reg-line)/0.8)] rounded-2xl">
                      <button className="p-2 hover:bg-[rgb(var(--reg-ink)/0.05)] rounded">
                        <Bold size={16} className="text-[rgb(var(--reg-muted))]" />
                      </button>
                      <button className="p-2 hover:bg-[rgb(var(--reg-ink)/0.05)] rounded">
                        <Italic size={16} className="text-[rgb(var(--reg-muted))]" />
                      </button>
                      <button className="p-2 hover:bg-[rgb(var(--reg-ink)/0.05)] rounded">
                        <Strikethrough size={16} className="text-[rgb(var(--reg-muted))]" />
                      </button>
                      <div className="w-px h-6 bg-gray-200" />
                      <button className="p-2 hover:bg-[rgb(var(--reg-ink)/0.05)] rounded">
                        <List size={16} className="text-[rgb(var(--reg-muted))]" />
                      </button>
                      <button className="p-2 hover:bg-[rgb(var(--reg-ink)/0.05)] rounded">
                        <ListOrdered size={16} className="text-[rgb(var(--reg-muted))]" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="service-description">
                        {t("addComboService.serviceDescription")}
                      </Label>
                      <Textarea
                        id="service-description"
                        placeholder={t("addComboService.enterServiceDescription")}
                        value={formData.description}
                        onChange={(e) =>
                          handleInputChange("description", e.target.value)
                        }
                        className="min-h-[120px]"
                      />
                    </div>

                    {/* Add Photos */}
                    <div className="space-y-2">
                      <Label>{t("addComboService.addPhotos")}</Label>
                      <div className="border-2 border-dashed border-[rgb(var(--reg-line))] rounded-2xl p-8 flex flex-col items-center justify-center hover:border-gray-400 transition-colors cursor-pointer">
                        <ImageIcon size={32} className="text-[rgb(var(--reg-muted)/0.8)] mb-2" />
                        <span className="text-sm text-[rgb(var(--reg-muted))]">{t("addComboService.addPhotos2")}</span>
                      </div>
                    </div>

                    {/* Allow clients to book online */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="allow-online-booking">
                          {t("addComboService.allowClientsToBookOnline")}
                        </Label>
                        <HelpCircle size={16} className="text-[rgb(var(--reg-muted)/0.8)]" />
                      </div>
                      <Switch
                        id="allow-online-booking"
                        checked={formData.allowOnlineBooking}
                        onCheckedChange={(checked) =>
                          handleInputChange("allowOnlineBooking", checked)
                        }
                      />
                    </div>
                  </div>
                )}

                {/* SERVICES Tab */}
                {activeSidebarItem === "services" && (
                  <div className="space-y-6">
                    {/* Booking Type */}
                    <div className="space-y-4">
                      <h3 className="text-base font-bold text-[rgb(var(--reg-ink))]">
                        {t("addComboService.bookingType")}
                      </h3>
                      <RadioGroup
                        value={bookingType}
                        onValueChange={setBookingType}
                      >
                        <div className="space-y-3">
                          <div
                            className={`flex items-start gap-4 p-4 border-2 rounded-2xl cursor-pointer ${
                              bookingType === "sequence"
                                ? "border-gray-900"
                                : "border-[rgb(var(--reg-line)/0.8)]"
                            }`}
                            onClick={() => setBookingType("sequence")}
                          >
                            <RadioGroupItem
                              value="sequence"
                              id="sequence"
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <Label
                                htmlFor="sequence"
                                className="font-medium cursor-pointer"
                              >
                                {t("addComboService.sequence")}
                              </Label>
                              <p className="text-sm text-[rgb(var(--reg-muted))] mt-1">
                                {t("addComboService.servicesArePerformedOneAfter")}
                              </p>
                            </div>
                          </div>
                          <div
                            className={`flex items-start gap-4 p-4 border-2 rounded-2xl cursor-pointer ${
                              bookingType === "parallel"
                                ? "border-gray-900"
                                : "border-[rgb(var(--reg-line)/0.8)]"
                            }`}
                            onClick={() => setBookingType("parallel")}
                          >
                            <RadioGroupItem
                              value="parallel"
                              id="parallel"
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <Label
                                htmlFor="parallel"
                                className="font-medium cursor-pointer"
                              >
                                {t("addComboService.parallel")}
                              </Label>
                              <p className="text-sm text-[rgb(var(--reg-muted))] mt-1">
                                {t("addComboService.servicesArePerformedAtThe")}
                              </p>
                            </div>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Combo Section */}
                    <div className="space-y-4">
                      <h3 className="text-base font-bold text-[rgb(var(--reg-ink))]">
                        {t("common.combo")}
                      </h3>
                      {comboServices.length === 0 && isEditMode && (
                        <div className="text-sm text-[rgb(var(--reg-muted))] italic">
                          {t("addComboService.noServicesAddedToThis")}
                        </div>
                      )}
                      <div className="space-y-3">
                        {comboServices.map((service, index) => (
                          <div key={service.id} className="space-y-3">
                            <div className="flex items-center gap-4 p-4 bg-[rgb(var(--reg-canvas))] rounded-2xl">
                              <div 
                                className={`w-1 h-12 rounded-full ${service.color?.startsWith("bg-") ? service.color : "bg-gray-400"}`}
                                style={service.color?.startsWith("#") ? { backgroundColor: service.color } : {}}
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
                              <button
                                onClick={() => handleRemoveService(service.id)}
                                className="text-[rgb(var(--reg-muted)/0.8)] hover:text-[rgb(var(--reg-muted))]"
                              >
                                <X size={18} />
                              </button>
                            </div>

                            {/* Time between services (only for sequence, and not for last service) */}
                            {bookingType === "sequence" &&
                              index < comboServices.length - 1 && (
                                <div className="ml-5 pl-4 border-l-2 border-[rgb(var(--reg-line)/0.8)]">
                                  {service.timeBetweenHours !== undefined ? (
                                    <div className="flex items-center gap-3 p-3 bg-[rgb(var(--reg-canvas))] rounded-2xl">
                                      <div className="flex items-center gap-2">
                                        <Select
                                          value={service.timeBetweenHours}
                                          onValueChange={(value) =>
                                            handleUpdateServiceTime(
                                              service.id,
                                              "timeBetweenHours",
                                              value
                                            )
                                          }
                                        >
                                          <SelectTrigger className="w-24">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(
                                              (h) => (
                                                <SelectItem key={h} value={h.toString()}>
                                                  {t("addComboService.h", { h })}
                                                </SelectItem>
                                              )
                                            )}
                                          </SelectContent>
                                        </Select>
                                        <Select
                                          value={service.timeBetweenMinutes}
                                          onValueChange={(value) =>
                                            handleUpdateServiceTime(
                                              service.id,
                                              "timeBetweenMinutes",
                                              value
                                            )
                                          }
                                        >
                                          <SelectTrigger className="w-24">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {[0, 15, 30, 45].map((m) => (
                                              <SelectItem key={m} value={m.toString()}>
                                                {t("addComboService.min", { m })}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <span className="text-sm text-[rgb(var(--reg-muted))]">
                                        {t("addComboService.timeBetweenServices")}
                                      </span>
                                      <button
                                        onClick={() =>
                                          handleRemoveTimeBetween(service.id)
                                        }
                                        className="ml-auto text-[rgb(var(--reg-muted)/0.8)] hover:text-[rgb(var(--reg-muted))]"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        handleAddTimeBetween(service.id)
                                      }
                                      className="text-sm text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))] flex items-center gap-2"
                                    >
                                      <Plus size={16} />
                                      {t("addComboService.addTimeBetweenServices")}
                                    </button>
                                  )}
                                </div>
                              )}
                          </div>
                        ))}
                      </div>

                      {servicesLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-[rgb(var(--reg-muted)/0.8)]" />
                        </div>
                      ) : (
                        <Select onValueChange={(value) => handleAddService(parseInt(value))}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t("addComboService.selectAServiceToAdd")} />
                          </SelectTrigger>
                          <SelectContent>
                            {services
                              .filter((s) => !comboServices.some((cs) => cs.serviceId === s.id))
                              .map((service) => (
                                <SelectItem key={service.id} value={service.id.toString()}>
                                  {service.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                )}

                {/* PRICING Tab */}
                {activeSidebarItem === "pricing" && (
                  <div className="space-y-6">
                    {/* Pricing Type */}
                    <div className="space-y-4">
                      <RadioGroup
                        value={pricingType}
                        onValueChange={setPricingType}
                      >
                        <div className="space-y-3">
                          <div
                            className={`flex items-start gap-4 p-4 border-2 rounded-2xl cursor-pointer ${
                              pricingType === "sum"
                                ? "border-gray-900"
                                : "border-[rgb(var(--reg-line)/0.8)]"
                            }`}
                            onClick={() => setPricingType("sum")}
                          >
                            <RadioGroupItem
                              value="sum"
                              id="service-pricing"
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <Label
                                htmlFor="service-pricing"
                                className="font-medium cursor-pointer"
                              >
                                {t("addComboService.servicePricing")}
                              </Label>
                              <p className="text-sm text-[rgb(var(--reg-muted))] mt-1">
                                {t("addComboService.thePriceForTheCombo")}
                              </p>
                            </div>
                          </div>
                          <div
                            className={`flex items-start gap-4 p-4 border-2 rounded-2xl cursor-pointer ${
                              pricingType === "custom"
                                ? "border-gray-900"
                                : "border-[rgb(var(--reg-line)/0.8)]"
                            }`}
                            onClick={() => setPricingType("custom")}
                          >
                            <RadioGroupItem
                              value="custom"
                              id="custom-pricing"
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <Label
                                htmlFor="custom-pricing"
                                className="font-medium cursor-pointer"
                              >
                                {t("addComboService.customPricing")}
                              </Label>
                              <p className="text-sm text-[rgb(var(--reg-muted))] mt-1">
                                {t("addComboService.setACustomPriceFor")}
                              </p>
                            </div>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Combo Price (for Custom Pricing) */}
                    {pricingType === "custom" && (
                      <div className="space-y-4 p-4 bg-[rgb(var(--reg-canvas))] rounded-2xl">
                        <div className="space-y-2">
                          <Label>{t("common.priceType")}</Label>
                          <Select
                            value={formData.comboPriceType}
                            onValueChange={(value) =>
                              handleInputChange("comboPriceType", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="FIXED">{t("common.fixed")}</SelectItem>
                              <SelectItem value="FROM">{t("common.from2")}</SelectItem>
                              <SelectItem value="RANGE">{t("addComboService.range")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{t("common.price")}</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[rgb(var(--reg-muted))]">{currencySymbol()}</span>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={formData.comboPrice}
                              onChange={(e) =>
                                handleInputChange("comboPrice", e.target.value)
                              }
                            />
                          </div>
                          {!formData.comboPrice && (
                            <p className="text-sm text-red-500">
                              {t("addComboService.thisFieldIsRequired")}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Individual Services Pricing */}
                    <div className="space-y-4">
                      <h3 className="text-base font-bold text-[rgb(var(--reg-ink))]">
                        {t("addComboService.servicesInCombo")}
                      </h3>
                      {comboServices.map((service) => (
                        <div
                          key={service.id}
                          className="p-4 bg-[rgb(var(--reg-canvas))] rounded-2xl space-y-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-1 h-8 ${service.color} rounded-full`} />
                            <h4 className="font-medium text-[rgb(var(--reg-ink))]">
                              {service.name}
                            </h4>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>{t("common.priceType")}</Label>
                              <Select
                                value={service.priceType}
                                onValueChange={(value) =>
                                  handleUpdateServicePrice(
                                    service.id,
                                    "priceType",
                                    value
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="FIXED">{t("common.fixed")}</SelectItem>
                              <SelectItem value="FROM">{t("common.from2")}</SelectItem>
                              <SelectItem value="RANGE">{t("addComboService.range")}</SelectItem>
                            </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>{t("common.price")}</Label>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-[rgb(var(--reg-muted))]">{currencySymbol()}</span>
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  value={service.priceValue}
                                  onChange={(e) =>
                                    handleUpdateServicePrice(
                                      service.id,
                                      "priceValue",
                                      e.target.value
                                    )
                                  }
                                />
                              </div>
                              {!service.priceValue && (
                                <p className="text-sm text-red-500">
                                  {t("addComboService.thisFieldIsRequired")}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Summary */}
                    <div className="flex items-center justify-between pt-4 border-t border-[rgb(var(--reg-line)/0.8)]">
                      <p className="text-sm text-[rgb(var(--reg-muted))]">
                        {pricingType === "custom"
                          ? t("addComboService.anyChangesToThePrice")
                          : t("addComboService.theComboPriceIsCalculated")}
                      </p>
                      <div className="text-right">
                        <div>
                          <p className="text-sm text-[rgb(var(--reg-muted))] mb-1">{t("addComboService.comboPrice")}</p>
                          <p className="text-2xl font-bold text-[rgb(var(--reg-ink))]">
                            {calculateComboPrice()} {currencySymbol()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-[rgb(var(--reg-muted))] mb-1">{t("addComboService.comboDuration")}</p>
                          <p className="text-2xl font-bold text-[rgb(var(--reg-ink))]">
                            {calculateComboDuration()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
    </RouteSheet>
  );
}



