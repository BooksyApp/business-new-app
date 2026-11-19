import type { Id } from "@/types/id";
import { useState } from "react";
import { currencySymbol } from "@/lib/currency";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { EmptyState, StatCard } from "@/components/ui/stat-card";
import { Coins, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, ChevronDown, Clock, DollarSign, Star, Pencil, Trash2, Loader2, AlertCircle, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useServices } from "@/hooks/useServices";
import { useCategories } from "@/hooks/useCategories";
import { useBusinessId } from "@/hooks/useBusinessId";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { Service } from "@/services/serviceService";
import type { Category } from "@/services/categoryService";
import { t, formatMinutes } from "@/i18n";

function formatDuration(minutes?: number) {
  if (!minutes) return "";
  return formatMinutes(minutes);
}

function formatPrice(price?: number) {
  if (price == null) return t("services.priceTbd");
  return `${price.toFixed(2)} ${currencySymbol()}`;
}

export default function ServicesPage() {
  const businessId = useBusinessId();
  const { services, loading: servicesLoading, createService, updateService, deleteService } = useServices(businessId);
  const { categories, loading: categoriesLoading, createCategory, deleteCategory } = useCategories(businessId);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  // Add service dialog
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    categoryId: "",
    durationMinutes: "",
    price: "",
    description: "",
  });
  const [savingService, setSavingService] = useState(false);

  // Edit service dialog
  const [editServiceOpen, setEditServiceOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // Add category dialog
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [savingCategory, setSavingCategory] = useState(false);

  const loading = servicesLoading || categoriesLoading;

  // Filter services
  const filteredServices = services.filter(s => {
    const matchesSearch = !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategoryFilter === "all" ||
      String(s.categoryId) === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const grouped: Array<{ category: Category | null; services: Service[] }> = [];
  const uncategorized: Service[] = [];

  for (const svc of filteredServices) {
    if (!svc.categoryId) {
      uncategorized.push(svc);
    }
  }

  for (const cat of categories) {
    const catServices = filteredServices.filter(s => s.categoryId === cat.id);
    if (catServices.length > 0) {
      grouped.push({ category: cat, services: catServices });
    }
  }

  if (uncategorized.length > 0) {
    grouped.push({ category: null, services: uncategorized });
  }

  const handleAddService = async () => {
    if (!serviceForm.name.trim()) {
      toast.error(t("services.serviceNameIsRequired"));
      return;
    }
    setSavingService(true);
    try {
      await createService({
        name: serviceForm.name.trim(),
        categoryId: serviceForm.categoryId ? serviceForm.categoryId : undefined,
        durationMinutes: serviceForm.durationMinutes ? Number(serviceForm.durationMinutes) : undefined,
        price: serviceForm.price ? Number(serviceForm.price) : undefined,
        description: serviceForm.description || undefined,
      });
      setAddServiceOpen(false);
      setServiceForm({ name: "", categoryId: "", durationMinutes: "", price: "", description: "" });
    } finally {
      setSavingService(false);
    }
  };

  const handleEditService = async () => {
    if (!editingService) return;
    setSavingService(true);
    try {
      await updateService(editingService.id, {
        name: editingService.name,
        categoryId: editingService.categoryId,
        durationMinutes: editingService.durationMinutes,
        price: editingService.price,
        description: editingService.description,
      });
      setEditServiceOpen(false);
      setEditingService(null);
    } finally {
      setSavingService(false);
    }
  };

  const handleDeleteService = async (id: Id, name: string) => {
    if (!confirm(t("services.delete", { name }))) return;
    await deleteService(id);
  };

  const handleAddCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error(t("services.categoryNameIsRequired"));
      return;
    }
    setSavingCategory(true);
    try {
      await createCategory({
        name: categoryForm.name.trim(),
        description: categoryForm.description || undefined,
      });
      setAddCategoryOpen(false);
      setCategoryForm({ name: "", description: "" });
    } finally {
      setSavingCategory(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader helpSlug="xidmetler-ve-qiymetler"
        title={t("common.services")}
        subtitle={t("services.manageYourServiceOfferingsAnd")}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setAddCategoryOpen(true)}
            >
              <Tag size={16} />
              {t("services.addCategory")}
            </Button>
            <Button
              className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm hover:shadow-md transition-all"
              onClick={() => setAddServiceOpen(true)}
            >
              <Plus size={16} />
              {t("services.addService")}
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* The three numbers that describe a menu: how much of it there is, how it is
            organised, and what it costs. Reading them off a list of cards was the job
            this page used to leave to the owner. */}
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard icon={Tag} label={t("common.services")} value={services.length} tone="violet" />
          <StatCard icon={Layers} label={t("services.categories")} value={categories.length} tone="sky" />
          <StatCard
            icon={Coins}
            label={t("services.averagePrice")}
            value={
              services.length
                ? `${Math.round(
                    services.reduce((n, sv) => n + (Number(sv.price) || 0), 0) / services.length
                  )} ${currencySymbol()}`
                : "—"
            }
            tone="emerald"
          />
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("common.searchServices")}
              className="pl-10 border-border/60 focus:border-accent/50 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
            <SelectTrigger className="w-40 border-border/60 hover:border-accent/30 transition-all">
              <Filter size={16} className="mr-2" />
              <SelectValue placeholder={t("common.category")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("services.allCategories")}</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {!loading && services.length === 0 && (
          <EmptyState
            icon={Tag}
            title={t("common.noServicesYet")}
            body={t("services.aServiceIsWhatA")}
            action={
              <Button onClick={() => setAddServiceOpen(true)} className="gap-2">
                <Plus size={16} />
                {t("services.addService2")}
              </Button>
            }
          />
        )}

        {/* Services grouped by category */}
        {!loading && grouped.length > 0 && (
          <div className="space-y-6">
            {grouped.map((group, catIndex) => (
              <Card
                key={group.category?.id ?? "uncategorized"}
                className="overflow-hidden border-l-4 border-l-violet-500 bg-white transition-shadow hover:shadow-md"
                style={{ animationDelay: `${catIndex * 100}ms` }}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold">
                        {group.category?.name ?? t("services.uncategorized")}
                      </CardTitle>
                      <CardDescription className="mt-0.5">
                        {t("services.availableCount", { count: group.services.length })}
                      </CardDescription>
                    </div>
                    {group.category && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        aria-label={t("services.deleteCategory", { name: group.category!.name })}
                        onClick={() => {
                          if (confirm(t("services.deleteCategoryServicesInThis", { name: group.category!.name }))) {
                            deleteCategory(group.category!.id);
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {group.services.map((service, index) => (
                      <div
                        key={service.id}
                        className="flex items-center justify-between p-4 rounded-xl border border-border/60 hover:border-accent/30 hover:bg-gradient-to-r hover:from-muted/30 hover:to-muted/10 transition-all duration-300 cursor-pointer group card-interactive"
                        style={{ animationDelay: `${(catIndex * 100) + (index * 30)}ms` }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h4 className="font-semibold text-sm truncate">{service.name}</h4>
                            {!service.isActive && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-muted-foreground">
                                {t("services.inactive")}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                            {service.durationMinutes && (
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {formatDuration(service.durationMinutes)}
                              </span>
                            )}
                            {service.description && (
                              <span className="truncate max-w-32">{service.description}</span>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex items-center gap-2">
                          <div className="text-lg font-bold text-status-completed">
                            {formatPrice(service.price)}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              aria-label={t("services.edit", { name: service.name })}
                              onClick={e => {
                                e.stopPropagation();
                                setEditingService(service);
                                setEditServiceOpen(true);
                              }}
                            >
                              <Pencil size={13} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              aria-label={t("services.delete2", { name: service.name })}
                              onClick={e => {
                                e.stopPropagation();
                                handleDeleteService(service.id, service.name);
                              }}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Service Dialog */}
      <Dialog open={addServiceOpen} onOpenChange={setAddServiceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("services.addNewService")}</DialogTitle>
            <DialogDescription>{t("services.createANewServiceFor")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("services.serviceName")}</Label>
              <Input
                placeholder={t("services.eGHairCutSwedish")}
                value={serviceForm.name}
                onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("common.category")}</Label>
              <Select
                value={serviceForm.categoryId}
                onValueChange={v => setServiceForm(f => ({ ...f, categoryId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("services.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("services.durationMinutes")}</Label>
                <Input
                  type="number"
                  placeholder={t("services.eG")}
                  value={serviceForm.durationMinutes}
                  onChange={e => setServiceForm(f => ({ ...f, durationMinutes: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("services.price", { value: currencySymbol() })}</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={t("services.eG2")}
                  value={serviceForm.price}
                  onChange={e => setServiceForm(f => ({ ...f, price: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("common.descriptionOptional")}</Label>
              <Input
                placeholder={t("services.briefDescriptionOfTheService")}
                value={serviceForm.description}
                onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddServiceOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleAddService} disabled={savingService}>
              {savingService && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("services.addService")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Service Dialog */}
      <Dialog open={editServiceOpen} onOpenChange={setEditServiceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("services.editService")}</DialogTitle>
          </DialogHeader>
          {editingService && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t("services.serviceName")}</Label>
                <Input
                  value={editingService.name}
                  onChange={e => setEditingService(s => s ? { ...s, name: e.target.value } : s)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("common.category")}</Label>
                <Select
                  value={editingService.categoryId ? String(editingService.categoryId) : "none"}
                  onValueChange={v => setEditingService(s => s ? { ...s, categoryId: v && v !== "none" ? v : undefined } : s)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("services.selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("services.none")}</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("services.durationMinutes")}</Label>
                  <Input
                    type="number"
                    value={editingService.durationMinutes ?? ""}
                    onChange={e => setEditingService(s => s ? { ...s, durationMinutes: e.target.value ? Number(e.target.value) : undefined } : s)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("services.price", { value: currencySymbol() })}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingService.price ?? ""}
                    onChange={e => setEditingService(s => s ? { ...s, price: e.target.value ? Number(e.target.value) : undefined } : s)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("services.description")}</Label>
                <Input
                  value={editingService.description ?? ""}
                  onChange={e => setEditingService(s => s ? { ...s, description: e.target.value } : s)}
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditServiceOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleEditService} disabled={savingService}>
              {savingService && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("services.saveChanges")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("services.addCategory")}</DialogTitle>
            <DialogDescription>{t("services.groupYourServicesIntoCategories")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("services.categoryName")}</Label>
              <Input
                placeholder={t("services.eGHairServicesMassage")}
                value={categoryForm.name}
                onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("common.descriptionOptional")}</Label>
              <Input
                placeholder={t("services.briefDescription")}
                value={categoryForm.description}
                onChange={e => setCategoryForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddCategoryOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleAddCategory} disabled={savingCategory}>
              {savingCategory && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("services.addCategory")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
