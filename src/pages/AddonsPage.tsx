import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNavigation } from "@/utils/navigationUtils";
import { Package, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, EmptyState, FormSheet, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn, sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { ActionMenu, ClientPreview, Field, RowAction, Segmented } from "@/components/page/kit";
import { fieldCls, money } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { useAddons } from "@/hooks/useAddons";
import { currencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Addon } from "@/services/addonService";
import { t } from "@/i18n";

type PriceType = "FIXED" | "FROM";
const EMPTY = { name: "", description: "", price: "", priceType: "FIXED" as PriceType };

const priceOf = (a: { price?: number | string; priceType?: string }) => {
  if (a.price == null || a.price === "") return "—";
  const p = money(a.price, currencySymbol());
  return a.priceType === "FROM" ? `${t("common.from")}${p}` : p;
};

/**
 * Add-ons: the extras that go on top of a service at the till — a mask after the wash,
 * nail art on a manicure. This route used to open the stock counter by mistake, so the
 * only way to manage add-ons was a tab inside the services list.
 */
export default function AddonsPage({ startNew = false }: { startNew?: boolean } = {}) {
  const navigate = useNavigate();
  const { getPath } = useNavigation();
  const { addons, loading, createAddon, updateAddon, deleteAddon } = useAddons();
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<{ mode: "new" } | { mode: "edit"; addon: Addon } | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const open = (a?: Addon) => {
    if (a) {
      setForm({ name: a.name, description: a.description ?? "", price: a.price != null ? String(a.price) : "", priceType: a.priceType === "FROM" ? "FROM" : "FIXED" });
      setSheet({ mode: "edit", addon: a });
    } else {
      setForm(EMPTY);
      setSheet({ mode: "new" });
    }
  };

  // /add-addon (the old full-page form) opens this sheet; closing it lands on the list.
  useEffect(() => {
    if (startNew) open();
  }, [startNew]);
  const closeSheet = () => {
    setSheet(null);
    if (startNew) navigate(getPath("addons"), { replace: true });
  };

  const price = Number(form.price);
  const valid = form.name.trim() && form.price.trim() !== "" && Number.isFinite(price) && price >= 0;

  const save = async (next = false) => {
    if (!sheet || !valid) return;
    setBusy(true);
    const body = { name: form.name.trim(), description: form.description.trim() || undefined, price, priceType: form.priceType };
    try {
      if (sheet.mode === "new") await createAddon(body);
      else await updateAddon(sheet.addon.id, body);
      if (next) setForm(EMPTY);
      else closeSheet();
    } catch {
      /* the hook already showed the error */
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: Addon) => {
    if (!confirm(t("addons.deletePastSalesKeepIt", { name: a.name }))) return;
    try {
      await deleteAddon(a.id);
    } catch {
      /* the hook already showed the error */
    }
  };

  const shown = addons.filter((a) => `${a.name} ${a.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("addons.addOns")}
          subtitle={t("addons.extrasYouAddOnTop")}
          actions={
            <Button className={primaryBtn} onClick={() => open()}>
              <Plus size={16} />{" "}{t("addons.newAddOn")}
            </Button>
          }
        />

        <div className={pageBody}>
          {loading ? (
            <div className="h-48 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy />
          ) : addons.length === 0 ? (
            <EmptyState
              icon={Package}
              title={t("addons.noAddOnsYet")}
              body={t("addons.aMaskAfterTheWash")}
              action={<Button className={primaryBtn} onClick={() => open()}><Plus size={16} />{" "}{t("addons.newAddOn")}</Button>}
            />
          ) : (
            <>
              <div className="relative max-w-md">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))]" aria-hidden />
                <input aria-label={t("addons.searchAddOns")} className={cn(fieldCls, "h-11 pl-10")} placeholder={t("addons.searchAddOns")} value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              {shown.length === 0 ? (
                <p className="rounded-[20px] bg-white px-5 py-10 text-center text-sm text-[rgb(var(--reg-muted))] ring-1 ring-[rgb(var(--reg-line)/0.8)]">{t("common.nothingMatches", { query })}</p>
              ) : (
                <ul className="overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                  {shown.map((a, i) => (
                    <li key={a.id} className={cn("flex items-center gap-3 px-4 py-3.5 md:px-5", i > 0 && "border-t border-[rgb(var(--reg-line)/0.6)]")}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand))]">
                        <Package size={18} strokeWidth={1.9} />
                      </span>
                      <button type="button" onClick={() => open(a)} className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]">
                        <span className="block truncate text-[15px] font-semibold">{a.name}</span>
                        <span className="block truncate text-sm text-[rgb(var(--reg-muted))]">{a.description || t("addons.noDescription")}</span>
                      </button>
                      <span className="shrink-0 text-[15px] font-bold tabular-nums">+{priceOf(a)}</span>
                      <span className="hidden sm:block">
                        <RowAction tone="ink" icon={Pencil} onClick={() => open(a)}>{t("common.edit")}</RowAction>
                      </span>
                      <ActionMenu
                        label={t("common.moreFor", { name: a.name })}
                        actions={[
                          { label: t("common.edit"), icon: Pencil, onSelect: () => open(a) },
                          { label: t("common.delete"), icon: Trash2, danger: true, onSelect: () => void remove(a) },
                        ]}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <FormSheet
          open={!!sheet}
          onOpenChange={(o) => !o && closeSheet()}
          title={sheet?.mode === "edit" ? t("addons.editAddOn") : t("addons.newAddOn")}
          description={t("addons.addedToAServiceWhen")}
          footer={
            <>
              {sheet?.mode === "new" ? (
                <Button variant="outline" className={sheetSecondary} disabled={!valid || busy} onClick={() => void save(true)}>{t("common.saveAddNext")}</Button>
              ) : (
                <Button variant="outline" className={sheetSecondary} onClick={closeSheet}>{t("common.cancel")}</Button>
              )}
              <Button className={sheetPrimary} disabled={!valid || busy} onClick={() => void save()}>
                {busy ? t("common.saving") : sheet?.mode === "edit" ? t("common.save") : t("addons.createAddOn")}
              </Button>
            </>
          }
        >
          <ClientPreview who={t("addons.preview")} where={t("addons.onTheBillAtThe")}>
            <div className="rounded-2xl bg-white p-4 text-sm">
              <div className="flex justify-between"><span className="font-semibold">{t("addons.womenSCutBlowDry")}</span><span className="tabular-nums">{money(45, currencySymbol())}</span></div>
              <div className="mt-1.5 flex justify-between text-[rgb(var(--reg-ink)/0.8)]">
                <span className="truncate pl-3">+ {form.name.trim() || t("addons.yourAddOn")}</span>
                <span className="shrink-0 tabular-nums">{priceOf({ price: form.price, priceType: form.priceType })}</span>
              </div>
            </div>
          </ClientPreview>
          <Field label={t("common.name")} htmlFor="ad-name">
            <input id="ad-name" className={fieldCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("addons.deepConditioningMask")} />
          </Field>
          <Field label={t("common.descriptionOptional")} htmlFor="ad-desc">
            <input id="ad-desc" className={fieldCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("addons.minutesAfterTheWash")} />
          </Field>
          <Field label={t("common.price")}>
            <Segmented<PriceType>
              label={t("common.priceType")}
              value={form.priceType}
              onChange={(priceType) => setForm({ ...form, priceType })}
              options={[{ value: "FIXED", label: t("common.fixed") }, { value: "FROM", label: t("common.from2"), hint: t("addons.variesByClient") }]}
            />
          </Field>
          <Field label={t("common.amount", { value: currencySymbol() })} htmlFor="ad-price">
            <input id="ad-price" type="number" inputMode="decimal" min={0} step="0.01" className={fieldCls} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="12" />
          </Field>
        </FormSheet>
      </BooqiScope>
    </AppLayout>
  );
}
