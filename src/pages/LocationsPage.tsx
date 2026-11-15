import { Fragment, useEffect, useState } from "react";
import { MapPin, Plus, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, FormSheet, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn, sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { Field } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { businessService, type Branch, type Business } from "@/services/businessService";
import { getCurrentBusinessId } from "@/config/api";
import { t } from "@/i18n";

/**
 * Setup listed "Locations" with no path — the item did nothing at all, while the backend
 * has had branch create and list since the endpoint shipped and nothing had ever called
 * the list. A salon with two shops could not see or add the second.
 */
export default function LocationsPage() {
  const businessId = getCurrentBusinessId();
  const [main, setMain] = useState<Business | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", city: "", country: "", phone: "", email: "" });

  const load = () => {
    if (!businessId) { setLoading(false); return; }
    setError(false);
    Promise.all([
      businessService.getBusiness(businessId),
      businessService.getBranches(businessId).catch(() => [] as Branch[]),
    ])
      .then(([b, list]) => { setMain(b); setBranches(list); })
      // An empty list must not stand in for a failed load — a salon would think its
      // second location had vanished.
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, [businessId]);

  const submit = async () => {
    if (!businessId || !form.name.trim()) return;
    setSaving(true);
    try {
      await businessService.createBranch({ businessId, ...form });
      toast.success(`${form.name} added`);
      setForm({ name: "", address: "", city: "", country: "", phone: "", email: "" });
      setAdding(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("locations.couldNotAddThisLocation"));
    } finally {
      setSaving(false);
    }
  };

  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const card = (opts: { name: string; label: string; address?: string | null; phone?: string | null; email?: string | null; main?: boolean }) => (
    <li className="flex items-start gap-3 rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-5">
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", opts.main ? "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand))]" : "bg-[rgb(var(--reg-ink)/0.05)] text-[rgb(var(--reg-ink)/0.7)]")}>
        <MapPin size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[16px] font-bold">{opts.name}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", opts.main ? "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]" : "bg-[rgb(var(--reg-ink)/0.05)]")}>{opts.label}</span>
        </p>
        <p className="mt-1 text-sm text-[rgb(var(--reg-muted))]">{opts.address || t("locations.noAddressSet")}</p>
        {(opts.phone || opts.email) && (
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[rgb(var(--reg-ink)/0.8)]">
            {opts.phone && <span className="inline-flex items-center gap-1.5"><Phone size={13} /> {opts.phone}</span>}
            {opts.email && <span className="inline-flex items-center gap-1.5"><Mail size={13} /> {opts.email}</span>}
          </p>
        )}
      </div>
    </li>
  );

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("locations.locations")}
          subtitle={t("locations.yourSalonAndAnyOther")}
          actions={
            <Button className={primaryBtn} onClick={() => setAdding(true)}>
              <Plus size={16} />{" "}{t("locations.addLocation")}
            </Button>
          }
        />
        <div className={pageBody}>
          {loading ? (
            <div className="h-32 animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]" aria-busy />
          ) : error ? (
            // An empty list must not stand in for a failed load.
            <div className="rounded-[20px] bg-rose-50 p-4 text-sm text-rose-900 ring-1 ring-inset ring-rose-200">
              {t("locations.couldNotLoadYourLocations")}
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {main && card({ name: main.name, label: t("locations.mainLocation"), address: main.address, phone: main.phone, main: true })}
              {branches.map((b) => <Fragment key={b.id}>{card({ name: b.name, label: t("locations.branch"), address: b.address, phone: b.phone, email: b.email })}</Fragment>)}
              {branches.length === 0 && (
                <li className="rounded-[20px] border-2 border-dashed border-[rgb(var(--reg-line))] p-5 text-sm text-[rgb(var(--reg-muted))]">
                  {t("locations.oneLocationSoFarAdd")}
                </li>
              )}
            </ul>
          )}
        </div>

        <FormSheet
          open={adding}
          onOpenChange={setAdding}
          title={t("locations.addALocation")}
          description={t("locations.anotherShopUnderTheSame")}
          footer={
            <>
              <Button variant="outline" className={sheetSecondary} onClick={() => setAdding(false)}>{t("common.cancel")}</Button>
              <Button className={sheetPrimary} disabled={saving || !form.name.trim()} onClick={() => void submit()}>
                {saving ? t("locations.adding") : t("locations.addLocation")}
              </Button>
            </>
          }
        >
          <Field label={t("common.name")} htmlFor="loc-name"><input id="loc-name" className={fieldCls} value={form.name} onChange={setF("name")} placeholder={t("locations.downtownBranch")} /></Field>
          <Field label={t("common.address")} htmlFor="loc-address"><input id="loc-address" className={fieldCls} value={form.address} onChange={setF("address")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("locations.city")} htmlFor="loc-city"><input id="loc-city" className={fieldCls} value={form.city} onChange={setF("city")} /></Field>
            <Field label={t("locations.country")} htmlFor="loc-country"><input id="loc-country" className={fieldCls} value={form.country} onChange={setF("country")} /></Field>
            <Field label={t("common.phone")} htmlFor="loc-phone"><input id="loc-phone" type="tel" className={fieldCls} value={form.phone} onChange={setF("phone")} /></Field>
            <Field label={t("common.email")} htmlFor="loc-email"><input id="loc-email" type="email" className={fieldCls} value={form.email} onChange={setF("email")} /></Field>
          </div>
        </FormSheet>
      </BooqiScope>
    </AppLayout>
  );
}
