import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, FolderPlus, Layers, MapPin, Package, Pencil, Plus, Scissors, Search, Sparkles, Trash2, Video } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, EmptyState, FormSheet, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn, secondaryBtn, sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { ActionMenu, Field } from "@/components/page/kit";
import { fieldCls, money } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCategories } from "@/hooks/useCategories";
import { useServices } from "@/hooks/useServices";
import { useStaff } from "@/hooks/useStaff";
import { currencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/utils/navigationUtils";
import { serviceService, type Service } from "@/services/serviceService";
import type { Category } from "@/services/categoryService";
import { t, formatMinutes } from "@/i18n";

const formatDuration = (minutes?: number): string => {
  if (!minutes) return "—";
  return formatMinutes(minutes);
};

const priceText = (s: Service) => {
  if (s.price == null) return "—";
  const p = money(s.price, currencySymbol());
  return s.priceType === "FROM" ? t("itemsCategory.from", { p }) : p;
};

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

const AVATAR_TONES = ["bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]", "bg-rose-50 text-rose-800", "bg-amber-50 text-amber-900", "bg-[rgb(var(--reg-ink)/0.06)] text-[rgb(var(--reg-ink)/0.75)]", "bg-sky-50 text-sky-800"];

type Sel = "all" | "uncategorized" | number;

/**
 * The service menu: categories on the left (chips on a phone), services on the right with
 * the facts an owner scans for — length, price, who does it, and whether clients can book
 * it online. Editing a service is its own page; categories are edited here.
 */
export default function ItemsCategoryPage() {
  const navigate = useNavigate();
  const { getPath } = useNavigation();
  const [selected, setSelected] = useState<Sel>("all");
  const [query, setQuery] = useState("");

  const { categories, loading: categoriesLoading, createCategory, updateCategory, deleteCategory } = useCategories();
  const { services, loading: servicesLoading, refresh } = useServices();
  const { staff } = useStaff();

  // Online-bookable flips land here first, so the switch moves under the thumb.
  const [visibleOverride, setVisibleOverride] = useState<Record<number, boolean>>({});
  const [catSheet, setCatSheet] = useState<{ mode: "new" } | { mode: "edit"; cat: Category } | null>(null);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catBusy, setCatBusy] = useState(false);

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const countIn = (id: Sel) =>
    id === "all" ? services.length : id === "uncategorized" ? services.filter((s) => !s.categoryId).length : services.filter((s) => s.categoryId === id).length;

  const isVisible = (s: Service) => visibleOverride[s.id] ?? s.isVisible !== false;
  const hiddenCount = services.filter((s) => !isVisible(s)).length;

  const filtered = services.filter((s) => {
    if (selected === "uncategorized" && s.categoryId) return false;
    if (typeof selected === "number" && s.categoryId !== selected) return false;
    return s.name.toLowerCase().includes(query.trim().toLowerCase());
  });

  // Grouped by category when showing everything, in the categories' own order.
  const groups = useMemo(() => {
    if (selected !== "all") return [{ key: String(selected), title: null as string | null, items: filtered }];
    const out: { key: string; title: string | null; items: Service[] }[] = categories
      .map((c) => ({ key: String(c.id), title: c.name, items: filtered.filter((s) => s.categoryId === c.id) }))
      .filter((g) => g.items.length);
    const loose = filtered.filter((s) => !s.categoryId || !categories.some((c) => c.id === s.categoryId));
    if (loose.length) out.push({ key: "none", title: t("itemsCategory.notCategorised"), items: loose });
    return out;
  }, [selected, filtered, categories]);

  const toggleOnline = async (s: Service, on: boolean) => {
    setVisibleOverride((m) => ({ ...m, [s.id]: on }));
    try {
      await serviceService.updateService(s.id, s.businessId, { isVisible: on });
      toast.success(on ? t("itemsCategory.canBeBookedOnline", { name: s.name }) : t("itemsCategory.isHiddenFromOnlineBooking", { name: s.name }));
      void refresh();
    } catch (e) {
      setVisibleOverride((m) => ({ ...m, [s.id]: !on }));
      toast.error(e instanceof Error ? e.message : t("itemsCategory.couldNotChangeThat"));
    }
  };

  const openCat = (mode: "new" | Category) => {
    if (mode === "new") {
      setCatName("");
      setCatDesc("");
      setCatSheet({ mode: "new" });
    } else {
      setCatName(mode.name);
      setCatDesc(mode.description ?? "");
      setCatSheet({ mode: "edit", cat: mode });
    }
  };

  const saveCat = async () => {
    const name = catName.trim();
    if (!name || !catSheet) return;
    setCatBusy(true);
    try {
      if (catSheet.mode === "new") {
        const created = await createCategory({ name, description: catDesc.trim() || undefined });
        if (created?.id) setSelected(created.id);
      } else {
        await updateCategory(catSheet.cat.id, { name, description: catDesc.trim() || undefined });
      }
      setCatSheet(null);
    } catch {
      /* the hook already showed the error */
    } finally {
      setCatBusy(false);
    }
  };

  const removeCat = async (c: Category) => {
    const n = countIn(c.id);
    if (!confirm(n ? t("itemsCategory.deleteWithServices", { name: c.name, count: n }) : t("itemsCategory.deleteConfirm", { name: c.name }))) return;
    try {
      await deleteCategory(c.id);
      if (selected === c.id) setSelected("all");
      void refresh();
    } catch {
      /* the hook already showed the error */
    }
  };

  const editService = (s: Service) =>
    navigate(s.serviceType === "COMBO" ? getPath("edit-combo-service", s.id) : getPath("edit-service", s.id));

  const loading = categoriesLoading || servicesLoading;
  const catOptions: { id: Sel; name: string; cat?: Category }[] = [
    { id: "all", name: t("itemsCategory.allServices") },
    ...categories.map((c) => ({ id: c.id as Sel, name: c.name, cat: c })),
    ...(countIn("uncategorized") ? [{ id: "uncategorized" as Sel, name: t("itemsCategory.notCategorisedName") }] : []),
  ];

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("common.services")}
          subtitle={
            services.length
              ? `${t("itemsCategory.servicesInCategories", { services: services.length, categories: categories.length })}${hiddenCount ? t("itemsCategory.notBookableOnline", { hiddenCount }) : ""}`
              : t("itemsCategory.whatYouSellHowLong")
          }
          actions={
            <>
              <Button variant="outline" className={secondaryBtn} onClick={() => openCat("new")}>
                <FolderPlus size={16} />{" "}{t("itemsCategory.newCategory")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className={primaryBtn}>
                    <Plus size={16} />{" "}{t("itemsCategory.newService")}{" "}<ChevronDown size={15} className="-mr-1 opacity-80" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[200px] rounded-2xl p-1.5">
                  <DropdownMenuItem className="gap-2 rounded-xl px-3 py-2.5" onSelect={() => navigate(getPath("add-service"))}>
                    <Sparkles size={16} />{" "}{t("common.service")}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 rounded-xl px-3 py-2.5" onSelect={() => navigate(getPath("add-combo-service"))}>
                    <Layers size={16} />{" "}{t("itemsCategory.comboOfServices")}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 rounded-xl px-3 py-2.5" onSelect={() => navigate(getPath("add-addon"))}>
                    <Package size={16} />{" "}{t("itemsCategory.addOn")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />

        <div className={pageBody}>
          {loading ? (
            <div className="h-64 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy />
          ) : services.length === 0 ? (
            <EmptyState
              icon={Scissors}
              title={t("itemsCategory.yourMenuIsEmpty")}
              body={t("itemsCategory.addWhatYouDoHow")}
              action={<Button className={primaryBtn} onClick={() => navigate(getPath("add-service"))}><Plus size={16} />{" "}{t("itemsCategory.addYourFirstService")}</Button>}
            />
          ) : (
            <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
              {/* Categories: a list on desktop, chips on a phone. */}
              <nav aria-label={t("itemsCategory.categories")} className="hidden lg:block">
                <ul className="sticky top-[132px] space-y-0.5 rounded-[20px] bg-white p-2 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                  {catOptions.map((o) => {
                    const on = selected === o.id;
                    return (
                      <li key={String(o.id)} className="group relative">
                        <button
                          type="button"
                          aria-current={on ? "true" : undefined}
                          onClick={() => setSelected(o.id)}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-xl py-2.5 pl-3 text-left text-sm font-semibold transition",
                            o.cat ? "pr-11" : "pr-3",
                            on ? "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]" : "text-[rgb(var(--reg-ink)/0.8)] hover:bg-[rgb(var(--reg-canvas))]",
                          )}
                        >
                          <span className="truncate">{o.name}</span>
                          <span className={cn("text-xs tabular-nums", on ? "" : "text-[rgb(var(--reg-muted))]")}>{countIn(o.id)}</span>
                        </button>
                        {o.cat && (
                          <span className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                            <ActionMenu
                              label={t("common.moreFor", { name: o.name })}
                              actions={[
                                { label: t("itemsCategory.rename"), icon: Pencil, onSelect: () => openCat(o.cat!) },
                                { label: t("itemsCategory.deleteCategory"), icon: Trash2, danger: true, onSelect: () => void removeCat(o.cat!) },
                              ]}
                            />
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="min-w-0 space-y-4">
                <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] lg:hidden" role="tablist" aria-label={t("itemsCategory.categories")}>
                  {catOptions.map((o) => {
                    const on = selected === o.id;
                    return (
                      <button
                        key={String(o.id)}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => setSelected(o.id)}
                        className={cn(
                          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold",
                          on ? "bg-[rgb(var(--reg-ink))] text-white" : "bg-white text-[rgb(var(--reg-ink)/0.75)] ring-1 ring-inset ring-[rgb(var(--reg-line))]",
                        )}
                      >
                        {o.name}
                        <span className={on ? "text-white/70" : "text-[rgb(var(--reg-muted))]"}>{countIn(o.id)}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))]" aria-hidden />
                    <input aria-label={t("itemsCategory.searchServices")} className={cn(fieldCls, "h-11 pl-10")} placeholder={t("itemsCategory.searchServices")} value={query} onChange={(e) => setQuery(e.target.value)} />
                  </div>
                  {typeof selected === "number" && (
                    <span className="lg:hidden">
                      <ActionMenu
                        label={t("itemsCategory.moreForThisCategory")}
                        actions={[
                          { label: t("itemsCategory.renameCategory"), icon: Pencil, onSelect: () => { const c = categories.find((x) => x.id === selected); if (c) openCat(c); } },
                          { label: t("itemsCategory.deleteCategory"), icon: Trash2, danger: true, onSelect: () => { const c = categories.find((x) => x.id === selected); if (c) void removeCat(c); } },
                        ]}
                      />
                    </span>
                  )}
                </div>

                {filtered.length === 0 ? (
                  <p className="rounded-[20px] bg-white px-5 py-10 text-center text-sm text-[rgb(var(--reg-muted))] ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                    {query ? t("common.nothingMatches", { query }) : t("itemsCategory.noServicesInThisCategory")}
                  </p>
                ) : (
                  groups.map((g) => (
                    <section key={g.key}>
                      {g.title && (
                        <h2 className="mb-2 flex items-baseline gap-2 px-1 text-sm font-extrabold tracking-[-0.01em]">
                          {g.title} <span className="text-xs font-semibold text-[rgb(var(--reg-muted))]">{g.items.length}</span>
                        </h2>
                      )}
                      <ul className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                        {g.items.map((s, i) => {
                          const on = isVisible(s);
                          const people = (s.staffIds ?? []).map((id) => staffById.get(id)).filter(Boolean) as { id: number; name: string; avatarUrl?: string }[];
                          return (
                            <li key={s.id} className={cn("group flex items-center gap-3 px-3 py-3 md:px-4", i > 0 && "border-t border-[rgb(var(--reg-line)/0.6)]")}>
                              <span className="h-11 w-1 shrink-0 rounded-full" style={{ backgroundColor: s.color?.startsWith("#") ? s.color : "rgb(var(--reg-brand) / 0.35)" }} aria-hidden />
                              <button type="button" onClick={() => editService(s)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)] rounded-lg">
                                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className={cn("truncate text-[15px] font-semibold", !on && "text-[rgb(var(--reg-ink)/0.6)]")}>{s.name}</span>
                                  {s.serviceType === "COMBO" && <Tag icon={Layers}>{t("common.combo")}</Tag>}
                                  {s.mobileService && <Tag icon={MapPin}>{t("itemsCategory.atClientS")}</Tag>}
                                  {s.virtualAppointment && <Tag icon={Video}>{t("itemsCategory.online")}</Tag>}
                                </span>
                                <span className="mt-0.5 block truncate text-sm text-[rgb(var(--reg-muted))]">
                                  {formatDuration(s.durationMinutes)}
                                  {s.priceType === "FROM" ? t("itemsCategory.priceVaries") : ""}
                                </span>
                              </button>

                              {people.length > 0 && (
                                <span className="hidden -space-x-1.5 sm:flex" aria-label={t("itemsCategory.doneBy", { value: people.map((p) => p.name).join(", ") })} title={people.map((p) => p.name).join(", ")}>
                                  {people.slice(0, 3).map((p) =>
                                    p.avatarUrl ? (
                                      <img key={p.id} src={p.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-white" />
                                    ) : (
                                      <span key={p.id} className={cn("flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold tracking-tight ring-2 ring-white", AVATAR_TONES[p.id % AVATAR_TONES.length])}>
                                        {initials(p.name)}
                                      </span>
                                    ),
                                  )}
                                  {people.length > 3 && (
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--reg-ink)/0.06)] text-[11px] font-bold ring-2 ring-white">+{people.length - 3}</span>
                                  )}
                                </span>
                              )}

                              <span className="w-[76px] shrink-0 text-right text-[15px] font-bold tabular-nums">{priceText(s)}</span>

                              <label className="flex shrink-0 flex-col items-center gap-0.5" title={on ? t("itemsCategory.clientsCanBookThisOnline") : t("itemsCategory.hiddenFromOnlineBooking")}>
                                <Switch
                                  checked={on}
                                  onCheckedChange={(v) => void toggleOnline(s, v)}
                                  aria-label={t("itemsCategory.bookableOnline", { name: s.name })}
                                  className="data-[state=checked]:bg-[rgb(var(--reg-brand))]"
                                />
                                <span className="text-[10px] font-semibold text-[rgb(var(--reg-muted))]">{t("itemsCategory.online")}</span>
                              </label>
                              <ChevronRight size={18} className="hidden shrink-0 text-[rgb(var(--reg-ink)/0.35)] md:block" aria-hidden />
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <FormSheet
          open={!!catSheet}
          onOpenChange={(o) => !o && setCatSheet(null)}
          title={catSheet?.mode === "edit" ? t("itemsCategory.editCategory") : t("itemsCategory.newCategory")}
          description={t("itemsCategory.categoriesGroupYourMenuHere")}
          footer={
            <>
              <Button variant="outline" className={sheetSecondary} onClick={() => setCatSheet(null)}>{t("common.cancel")}</Button>
              <Button className={sheetPrimary} disabled={!catName.trim() || catBusy} onClick={() => void saveCat()}>
                {catBusy ? t("common.saving") : catSheet?.mode === "edit" ? t("common.save") : t("itemsCategory.createCategory")}
              </Button>
            </>
          }
        >
          <Field label={t("common.name")} htmlFor="cat-name">
            <input id="cat-name" className={fieldCls} value={catName} onChange={(e) => setCatName(e.target.value)} placeholder={t("itemsCategory.hair")} maxLength={255} />
          </Field>
          <Field label={t("common.descriptionOptional")} htmlFor="cat-desc">
            <input id="cat-desc" className={fieldCls} value={catDesc} onChange={(e) => setCatDesc(e.target.value)} placeholder={t("itemsCategory.cutsColourAndStyling")} />
          </Field>
        </FormSheet>
      </BooqiScope>
    </AppLayout>
  );
}

function Tag({ icon: Icon, children }: { icon: typeof Layers; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--reg-ink)/0.05)] px-2 py-0.5 text-[11px] font-bold text-[rgb(var(--reg-ink)/0.7)]">
      <Icon size={11} /> {children}
    </span>
  );
}
