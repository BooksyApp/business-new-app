import type { Id } from "@/types/id";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, ArchiveRestore, ChevronDown, FolderPlus, Layers, Package, Pencil, Plus, Scissors, Search, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AvatarStack, Btn, ConfirmDialog, Drawer, EmptyState, Field, Note, PageHead, RowItem, Skeleton, Tag, Toolbar } from "@/components/bz";
import { BzPage } from "@/components/bz/p2-page";
import { ActionMenu } from "@/components/page/kit";
import { money } from "@/components/page/kitStyles";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useCategories } from "@/hooks/useCategories";
import { useServices } from "@/hooks/useServices";
import { useStaff } from "@/hooks/useStaff";
import { currencySymbol } from "@/lib/currency";
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


type Sel = "all" | "uncategorized" | Id;

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

  // UI2-HUBA-006: archive (soft delete) / restore / permanent delete of a service.
  const [showArchived, setShowArchived] = useState(false);
  const [archived, setArchived] = useState<Service[]>([]);
  const [confirm2, setConfirm2] = useState<{ kind: "archive" | "delete"; s: Service } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const routeBusinessId = useBusinessId();
  const loadArchived = async (bid?: Id) => {
    const b = bid ?? routeBusinessId;
    if (b == null) return;
    try {
      setArchived(await serviceService.getArchivedServices(b));
    } catch {
      /* keep the previous list */
    }
  };
  useEffect(() => {
    void loadArchived();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeBusinessId, showArchived]);

  const askDelete = async (s: Service) => {
    try {
      if (!(await serviceService.canDeleteService(s.id, s.businessId))) {
        toast.error(t("itemsCategory.cannotDeleteHistory"));
        return;
      }
    } catch {
      toast.error(t("itemsCategory.couldNotChangeThat"));
      return;
    }
    setConfirm2({ kind: "delete", s });
  };

  const runConfirm = async () => {
    if (!confirm2) return;
    const { kind, s } = confirm2;
    setConfirmBusy(true);
    try {
      if (kind === "archive") {
        await serviceService.deleteService(s.id, s.businessId);
        toast.success(t("itemsCategory.archivedToast", { name: s.name }));
      } else {
        await serviceService.deleteServicePermanently(s.id, s.businessId);
        toast.success(t("itemsCategory.deletedToast", { name: s.name }));
      }
      setConfirm2(null);
      void refresh();
      void loadArchived(s.businessId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("itemsCategory.couldNotChangeThat"));
    } finally {
      setConfirmBusy(false);
    }
  };

  const restore = async (s: Service) => {
    try {
      await serviceService.restoreService(s.id, s.businessId);
      toast.success(t("itemsCategory.restoredToast", { name: s.name }));
      void refresh();
      void loadArchived(s.businessId);
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      toast.error(/same name|already|409|conflict/i.test(m) ? t("itemsCategory.restoreNameClash") : m || t("itemsCategory.couldNotChangeThat"));
    }
  };

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const countIn = (id: Sel) =>
    id === "all" ? services.length : id === "uncategorized" ? services.filter((s) => !s.categoryId).length : services.filter((s) => s.categoryId === id).length;

  const isVisible = (s: Service) => visibleOverride[s.id] ?? s.isVisible !== false;
  const hiddenCount = services.filter((s) => !isVisible(s)).length;

  const filtered = services.filter((s) => {
    if (selected === "uncategorized" && s.categoryId) return false;
    if (selected !== "all" && selected !== "uncategorized" && s.categoryId !== selected) return false;
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

  const confirmDialog = confirm2 ? (
    <ConfirmDialog
      title={t(confirm2.kind === "archive" ? "itemsCategory.archiveConfirmTitle" : "itemsCategory.deleteConfirmTitle", { name: confirm2.s.name })}
      body={t(confirm2.kind === "archive" ? "itemsCategory.archiveConfirmBody" : "itemsCategory.deleteConfirmBody")}
      onClose={() => !confirmBusy && setConfirm2(null)}
      footer={
        <>
          <Btn kind="ol" disabled={confirmBusy} onClick={() => setConfirm2(null)}>{t("itemsCategory.confirmCancel")}</Btn>
          <Btn kind="dg" disabled={confirmBusy} onClick={() => void runConfirm()} data-testid="service-confirm">
            {confirm2.kind === "archive" ? t("itemsCategory.archiveAction") : t("itemsCategory.deletePermanently")}
          </Btn>
        </>
      }
    />
  ) : null;

  const catDrawer = catSheet ? (
    <Drawer
      narrow
      title={catSheet.mode === "edit" ? t("itemsCategory.editCategory") : t("itemsCategory.newCategory")}
      sub={t("itemsCategory.categoriesGroupYourMenuHere")}
      onClose={() => setCatSheet(null)}
      closeIcon={<X className="ic" />}
      footer={
        <>
          <Btn kind="ol" onClick={() => setCatSheet(null)}>{t("common.cancel")}</Btn>
          <Btn kind="v" disabled={!catName.trim() || catBusy} onClick={() => void saveCat()}>
            {catBusy ? t("common.saving") : catSheet.mode === "edit" ? t("common.save") : t("itemsCategory.createCategory")}
          </Btn>
        </>
      }
    >
      <div className="g1">
        <Field label={t("common.name")} required>
          <input id="cat-name" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder={t("itemsCategory.hair")} maxLength={255} />
        </Field>
        <Field label={t("common.descriptionOptional")}>
          <input id="cat-desc" value={catDesc} onChange={(e) => setCatDesc(e.target.value)} placeholder={t("itemsCategory.cutsColourAndStyling")} />
        </Field>
      </div>
    </Drawer>
  ) : null;

  const subtitle = services.length
    ? `${t("itemsCategory.servicesInCategories", { services: services.length, categories: categories.length })}${hiddenCount ? t("itemsCategory.notBookableOnline", { hiddenCount }) : ""}`
    : t("itemsCategory.whatYouSellHowLong");

  const serviceRow = (s: Service) => {
    const on = isVisible(s);
    const people = (s.staffIds ?? []).map((id) => staffById.get(id)).filter(Boolean) as { id: Id; name: string; avatarUrl?: string }[];
    return (
      <div key={s.id} className="lr">
        <span className="sw2" style={{ background: s.color?.startsWith("#") ? s.color : "var(--bz-violet)" }}>{initials(s.name)}</span>
        <div className="tx" onClick={() => editService(s)} role="button" tabIndex={0} style={{ cursor: "pointer" }}>
          <b style={on ? undefined : { opacity: 0.6 }}>{s.name}</b>
          <span>
            {formatDuration(s.durationMinutes)} · {priceText(s)}
            {s.priceType === "FROM" ? t("itemsCategory.priceVaries") : ""}
          </span>
        </div>
        {people.length > 0 && (
          <AvatarStack
            items={[
              ...people.slice(0, 3).map((p) =>
                p.avatarUrl ? <img key={p.id} src={p.avatarUrl} alt="" title={p.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : <span key={p.id} title={p.name}>{initials(p.name)}</span>,
              ),
              ...(people.length > 3 ? [`+${people.length - 3}`] : []),
            ]}
          />
        )}
        {s.serviceType === "COMBO" && <Tag kind="v">{t("common.combo")}</Tag>}
        {s.mobileService && <Tag kind="v">{t("itemsCategory.atClientS")}</Tag>}
        {s.virtualAppointment && <Tag kind="v">{t("itemsCategory.online")}</Tag>}
        <span className="acts">
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--bz-muted)", maxWidth: 150, textAlign: "right", lineHeight: 1.25 }}>
            {on ? t("itemsCategory.clientsCanBookThisOnline") : t("itemsCategory.hiddenFromOnlineBooking")}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={t("itemsCategory.bookableOnline", { name: s.name })}
            className={on ? "tg" : "tg off"}
            style={{ border: 0, padding: 0 }}
            onClick={() => void toggleOnline(s, !on)}
          />
          <ActionMenu
            label={t("itemsCategory.serviceActions")}
            actions={[{ label: t("itemsCategory.archiveAction"), icon: Archive, danger: true, onSelect: () => setConfirm2({ kind: "archive", s }) }]}
          />
        </span>
      </div>
    );
  };

  const newMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="btn btn-v s">
          <Plus className="ic" />
          {t("itemsCategory.newService")}
          <ChevronDown className="ic" />
        </button>
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
  );

  return (
    <BzPage
      overlay={
        <>
          {confirmDialog}
          {catDrawer}
        </>
      }
    >
      <PageHead
        title={t("common.services")}
        sub={subtitle}
        right={
          <>
            <Btn kind="ol" icon={<FolderPlus className="ic" />} onClick={() => openCat("new")}>{t("itemsCategory.newCategory")}</Btn>
            {newMenu}
          </>
        }
      />

      {showArchived ? (
        <div data-testid="archived-list">
          <Toolbar>
            <Btn kind="ol" icon={<Archive className="ic" />} onClick={() => setShowArchived(false)} aria-pressed data-testid="archived-toggle">{t("itemsCategory.archivedBack")}</Btn>
          </Toolbar>
          <Note kind="in">{t("itemsCategory.archivedHint")}</Note>
          {archived.length === 0 ? (
            <EmptyState icon={<Archive className="ic" />} title={t("itemsCategory.archivedEmpty")} />
          ) : (
            <div className="tbx">
              {archived.map((s) => (
                <RowItem
                  key={s.id}
                  title={s.name}
                  sub={`${formatDuration(s.durationMinutes)} · ${priceText(s)}`}
                  right={
                    <span className="acts">
                      <Tag>{t("itemsCategory.archivedTag")}</Tag>
                      <Btn kind="ol" icon={<ArchiveRestore className="ic" />} onClick={() => void restore(s)}>{t("itemsCategory.restore")}</Btn>
                      <ActionMenu
                        label={t("itemsCategory.serviceActions")}
                        actions={[{ label: t("itemsCategory.deletePermanently"), icon: Trash2, danger: true, onSelect: () => void askDelete(s) }]}
                      />
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <Skeleton />
      ) : services.length === 0 ? (
        <EmptyState
          icon={<Scissors className="ic" />}
          title={t("itemsCategory.yourMenuIsEmpty")}
          text={t("itemsCategory.addWhatYouDoHow")}
          action={<Btn kind="v" icon={<Plus className="ic" />} onClick={() => navigate(getPath("add-service"))}>{t("itemsCategory.addYourFirstService")}</Btn>}
        />
      ) : (
        <div className="sp2">
          <div className="rail" role="tablist" aria-label={t("itemsCategory.categories")}>
            <div className="lbl" style={{ padding: "0 14px 8px", fontWeight: 800 }}>{t("itemsCategory.categories")}</div>
            {catOptions.map((o) => (
              <span key={String(o.id)} role="tab" aria-selected={selected === o.id} className={selected === o.id ? "on" : ""} onClick={() => setSelected(o.id)}>
                {o.name}
                <em>{countIn(o.id)}</em>
                {o.cat && (
                  <span onClick={(e) => e.stopPropagation()}>
                    <ActionMenu
                      label={t("common.moreFor", { name: o.name })}
                      actions={[
                        { label: t("itemsCategory.rename"), icon: Pencil, onSelect: () => openCat(o.cat!) },
                        { label: t("itemsCategory.deleteCategory"), icon: Trash2, danger: true, onSelect: () => void removeCat(o.cat!) },
                      ]}
                    />
                  </span>
                )}
              </span>
            ))}
            {(archived.length > 0 || showArchived) && (
              <span style={{ marginTop: 8 }} onClick={() => setShowArchived(true)} role="button" tabIndex={0} data-testid="archived-toggle">
                {t("itemsCategory.archivedFilter", { count: archived.length })}
              </span>
            )}
          </div>
          <div>
            <div className="tbx">
              <div className="srch" style={{ height: 52, marginBottom: 14, maxWidth: 520 }}>
                <Search className="ic" aria-hidden />
                <input
                  aria-label={t("itemsCategory.searchServices")}
                  placeholder={t("itemsCategory.searchServices")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ border: 0, background: "transparent", outline: 0, font: "inherit", flex: 1, color: "inherit" }}
                />
              </div>
              {filtered.length === 0 ? (
                <EmptyState icon={<Search className="ic" />} title={query ? t("common.nothingMatches", { query }) : t("itemsCategory.noServicesInThisCategory")} />
              ) : (
                groups.map((g) => (
                  <div key={g.key}>
                    {g.title && (
                      <div className="lbl2" style={{ margin: "10px 0 4px" }}>
                        {g.title} <small>{g.items.length}</small>
                      </div>
                    )}
                    {g.items.map(serviceRow)}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </BzPage>
  );
}
