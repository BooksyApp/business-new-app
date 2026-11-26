import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNavigation } from "@/utils/navigationUtils";
import { Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { Btn, Drawer, EmptyState, Field, FormGrid, PageHead, SelectField, Skeleton } from "@/components/bz";
import { BzPage } from "@/components/bz/p2-page";
import { money } from "@/components/page/kitStyles";
import { useAddons } from "@/hooks/useAddons";
import { currencySymbol } from "@/lib/currency";
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

  const priceHint = form.priceType === "FROM" ? t("addons.variesByClient") : undefined;
  const footer = (
    <>
      {sheet?.mode === "new" ? (
        <Btn kind="soft" disabled={!valid || busy} onClick={() => void save(true)}>{t("common.saveAddNext")}</Btn>
      ) : (
        <Btn kind="ol" onClick={closeSheet}>{t("common.cancel")}</Btn>
      )}
      <Btn kind="v" disabled={!valid || busy} onClick={() => void save()}>
        {busy ? t("common.saving") : sheet?.mode === "edit" ? t("common.save") : t("addons.createAddOn")}
      </Btn>
    </>
  );

  return (
    <BzPage
      overlay={
        sheet ? (
          <Drawer
            narrow
            title={sheet.mode === "edit" ? t("addons.editAddOn") : t("addons.newAddOn")}
            sub={t("addons.addedToAServiceWhen")}
            onClose={closeSheet}
            closeIcon={<X className="ic" />}
            footer={footer}
          >
            <div className="g1">
              <Field label={t("common.name")} required>
                <input id="ad-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("addons.deepConditioningMask")} />
              </Field>
              <Field label={t("common.descriptionOptional")}>
                <input id="ad-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("addons.minutesAfterTheWash")} />
              </Field>
              <FormGrid cols={2}>
                <SelectField label={t("common.priceType")} hint={priceHint}>
                  <select value={form.priceType} onChange={(e) => setForm({ ...form, priceType: e.target.value as PriceType })}>
                    <option value="FIXED">{t("common.fixed")}</option>
                    <option value="FROM">{t("common.from2")}</option>
                  </select>
                </SelectField>
                <Field label={t("common.price")} suffix={currencySymbol()}>
                  <input id="ad-price" type="number" inputMode="decimal" min={0} step="0.01" aria-label={t("common.amount", { value: currencySymbol() })} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="12" />
                </Field>
              </FormGrid>
              <div className="prv">
                <small>{t("addons.preview")} · {t("addons.onTheBillAtThe")}</small>
                <div className="l">
                  <b>{t("addons.womenSCutBlowDry")}</b>
                  <b>{money(45, currencySymbol())}</b>
                </div>
                <div className="l">
                  <b>+ {form.name.trim() || t("addons.yourAddOn")}</b>
                  <b>{priceOf({ price: form.price, priceType: form.priceType })}</b>
                </div>
              </div>
            </div>
          </Drawer>
        ) : undefined
      }
    >
      <PageHead
        title={t("addons.addOns")}
        sub={t("addons.extrasYouAddOnTop")}
        right={<Btn kind="v" icon={<Plus className="ic" />} onClick={() => open()}>{t("addons.newAddOn")}</Btn>}
      />
      {loading ? (
        <Skeleton />
      ) : addons.length === 0 ? (
        <EmptyState
          icon={<Package className="ic" />}
          title={t("addons.noAddOnsYet")}
          text={t("addons.aMaskAfterTheWash")}
          action={<Btn kind="v" icon={<Plus className="ic" />} onClick={() => open()}>{t("addons.newAddOn")}</Btn>}
        />
      ) : (
        <>
          <div className="srch" style={{ height: 52, marginBottom: 14, maxWidth: 520 }}>
            <Search className="ic" aria-hidden />
            <input
              aria-label={t("addons.searchAddOns")}
              placeholder={t("addons.searchAddOns")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ border: 0, background: "transparent", outline: 0, font: "inherit", flex: 1, color: "inherit" }}
            />
          </div>
          {shown.length === 0 ? (
            <EmptyState icon={<Search className="ic" />} title={t("common.nothingMatches", { query })} />
          ) : (
            <div className="tbx">
              {shown.map((a) => (
                <div key={a.id} className="lr">
                  <span className="mn" style={{ background: "var(--bz-vsoft)", color: "var(--bz-vtext)" }}>
                    <Package className="ic" />
                  </span>
                  <div className="tx" onClick={() => open(a)} role="button" tabIndex={0}>
                    <b>{a.name}</b>
                    <span>{a.description || t("addons.noDescription")}</span>
                  </div>
                  <b>+{priceOf(a)}</b>
                  <span className="acts">
                    <Btn kind="ol" icon={<Pencil className="ic" />} onClick={() => open(a)} aria-label={t("common.moreFor", { name: a.name })}>{t("common.edit")}</Btn>
                    <Btn kind="dg" icon={<Trash2 className="ic" />} onClick={() => void remove(a)}>{t("common.delete")}</Btn>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </BzPage>
  );
}
