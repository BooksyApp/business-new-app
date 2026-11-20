import type { Id } from "@/types/id";
import { useCallback, useEffect, useState } from "react";
import { BadgePercent, Plus, Ticket } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, EmptyState, FormSheet, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn, sheetPrimary, sheetSecondary } from "@/components/page/booqiStyles";
import { Field } from "@/components/page/kit";
import { fieldCls } from "@/components/page/kitStyles";
import { Button } from "@/components/ui/button";
import { useBusinessId } from "@/hooks/useBusinessId";
import { useServices } from "@/hooks/useServices";
import { formatPrice } from "@/lib/currency";
import { membershipService, type Membership } from "@/services/membershipService";
import { packageService, type ServicePackage } from "@/services/packageService";
import { t as tr } from "@/i18n";

const MEMBERSHIP_EMPTY = { name: "", description: "", price: "", period: "1", discount: "0", sessions: "0", serviceId: "" };
const PACKAGE_EMPTY = { name: "", description: "", price: "", sessions: "5", validDays: "", serviceId: "" };

const card = "rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)]";

/**
 * Memberships and prepaid packages. A membership renews and pays out a standing benefit; a
 * package is a block of sessions that runs out. Both are sold at the till (Sales) and spent
 * there too; the customer site lists them on the salon page.
 */
export default function PassesPage() {
  const businessId = useBusinessId();
  const { services } = useServices(businessId);
  const [plans, setPlans] = useState<Membership[] | null>(null);
  const [packs, setPacks] = useState<ServicePackage[] | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const [plan, setPlan] = useState(MEMBERSHIP_EMPTY);
  const [pack, setPack] = useState(PACKAGE_EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!businessId) return;
    membershipService.list(businessId).then(setPlans).catch(() => setPlans([]));
    packageService.list(businessId).then(setPacks).catch(() => setPacks([]));
  }, [businessId]);
  useEffect(load, [load]);

  const serviceName = (id: Id | null) => (id == null ? tr("passes.anyService") : services.find((s) => String(s.id) === String(id))?.name ?? tr("passes.anyService"));

  const createPlan = async () => {
    const price = Number(plan.price);
    if (!plan.name.trim()) return toast.error(tr("passes.giveAName"));
    if (!Number.isFinite(price) || price < 0 || plan.price.trim() === "") return toast.error(tr("passes.enterAPrice"));
    const discount = Math.round(Number(plan.discount) || 0);
    const sessions = Math.round(Number(plan.sessions) || 0);
    if (discount < 0 || discount > 100) return toast.error(tr("passes.discountRange"));
    if (discount === 0 && sessions === 0) return toast.error(tr("passes.needABenefit"));
    setBusy(true);
    try {
      const created = await membershipService.create(businessId, {
        name: plan.name.trim(),
        description: plan.description.trim() || undefined,
        price,
        billingPeriodMonths: Math.max(1, Math.round(Number(plan.period) || 1)),
        discountPercent: discount,
        includedSessions: sessions,
      });
      if (plan.serviceId) await membershipService.setServices(businessId, created.id, [plan.serviceId as Id]);
      toast.success(tr("passes.planCreated"));
      setPlanOpen(false);
      setPlan(MEMBERSHIP_EMPTY);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("passes.couldNotSave"));
    } finally {
      setBusy(false);
    }
  };

  const createPack = async () => {
    const price = Number(pack.price);
    const sessions = Math.round(Number(pack.sessions));
    if (!pack.name.trim()) return toast.error(tr("passes.giveAName"));
    if (!Number.isFinite(price) || price < 0 || pack.price.trim() === "") return toast.error(tr("passes.enterAPrice"));
    if (!Number.isFinite(sessions) || sessions < 1) return toast.error(tr("passes.needSessions"));
    setBusy(true);
    try {
      await packageService.create(businessId, {
        name: pack.name.trim(),
        description: pack.description.trim() || undefined,
        serviceId: pack.serviceId ? (pack.serviceId as Id) : undefined,
        sessionsTotal: sessions,
        price,
        validDays: pack.validDays.trim() ? Math.max(1, Math.round(Number(pack.validDays))) : undefined,
      });
      toast.success(tr("passes.packageCreated"));
      setPackOpen(false);
      setPack(PACKAGE_EMPTY);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("passes.couldNotSave"));
    } finally {
      setBusy(false);
    }
  };

  const retirePlan = async (m: Membership) => {
    if (!confirm(tr("passes.retireConfirm", { name: m.name }))) return;
    try {
      await membershipService.deactivate(businessId, m.id);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("passes.couldNotSave"));
    }
  };
  const togglePack = async (p: ServicePackage) => {
    try {
      await packageService.setActive(businessId, p.id, !p.active);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tr("passes.couldNotSave"));
    }
  };

  const select = (value: string, onChange: (v: string) => void, id: string) => (
    <select id={id} className={fieldCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{tr("passes.anyService")}</option>
      {services.map((s) => (
        <option key={String(s.id)} value={String(s.id)}>{s.name}</option>
      ))}
    </select>
  );

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader title={tr("passes.title")} subtitle={tr("passes.subtitle")} />
        <div className={pageBody}>
          {/* ── memberships ── */}
          <section data-testid="membership-plans">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{tr("passes.memberships")}</h2>
              <Button className={primaryBtn} onClick={() => setPlanOpen(true)} data-testid="new-membership">
                <Plus size={16} />{" "}{tr("passes.newMembership")}
              </Button>
            </div>
            {plans === null ? (
              <p className="text-sm text-[rgb(var(--reg-muted))]">{tr("common.loading2")}</p>
            ) : plans.length === 0 ? (
              <EmptyState icon={BadgePercent} title={tr("passes.noPlans")} body={tr("passes.noPlansBody")} />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {plans.map((m) => (
                  <li key={String(m.id)} className={card} data-testid="membership-row">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold">{m.name}</p>
                      {!m.active && <span className="text-xs font-semibold text-[rgb(var(--reg-muted))]">{tr("passes.retired")}</span>}
                    </div>
                    <p className="mt-1 text-xl font-bold tabular-nums">{formatPrice(m.price)}</p>
                    <p className="text-sm text-[rgb(var(--reg-muted))]">
                      {m.billing_period_months === 1 ? tr("passes.perMonth") : tr("passes.perMonths", { n: m.billing_period_months })}
                    </p>
                    <ul className="mt-2 space-y-0.5 text-sm">
                      {m.discount_percent > 0 && <li>{tr("passes.discountLine", { n: m.discount_percent })}</li>}
                      {m.included_sessions > 0 && <li>{tr("passes.sessionsLine", { n: m.included_sessions })}</li>}
                    </ul>
                    {m.active && (
                      <Button variant="outline" className={cn2("mt-3", sheetSecondary)} onClick={() => retirePlan(m)}>{tr("passes.retire")}</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── packages ── */}
          <section className="mt-8" data-testid="package-list">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{tr("passes.packages")}</h2>
              <Button className={primaryBtn} onClick={() => setPackOpen(true)} data-testid="new-package">
                <Plus size={16} />{" "}{tr("passes.newPackage")}
              </Button>
            </div>
            {packs === null ? (
              <p className="text-sm text-[rgb(var(--reg-muted))]">{tr("common.loading2")}</p>
            ) : packs.length === 0 ? (
              <EmptyState icon={Ticket} title={tr("passes.noPackages")} body={tr("passes.noPackagesBody")} />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {packs.map((p) => (
                  <li key={String(p.id)} className={card} data-testid="package-row">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold">{p.name}</p>
                      {!p.active && <span className="text-xs font-semibold text-[rgb(var(--reg-muted))]">{tr("passes.retired")}</span>}
                    </div>
                    <p className="mt-1 text-xl font-bold tabular-nums">{formatPrice(p.price)}</p>
                    <ul className="mt-2 space-y-0.5 text-sm">
                      <li>{tr("passes.sessionsCount", { n: p.sessions_total })}</li>
                      {p.valid_days ? <li>{tr("passes.validDays", { n: p.valid_days })}</li> : null}
                      <li className="text-[rgb(var(--reg-muted))]">{serviceName(p.service_id)}</li>
                    </ul>
                    <Button variant="outline" className={cn2("mt-3", sheetSecondary)} onClick={() => togglePack(p)}>
                      {p.active ? tr("passes.retire") : tr("passes.restore")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <FormSheet
          open={planOpen}
          onOpenChange={setPlanOpen}
          title={tr("passes.newMembership")}
          description={tr("passes.membershipHelp")}
          footer={
            <>
              <Button variant="outline" className={sheetSecondary} onClick={() => setPlanOpen(false)}>{tr("common.cancel")}</Button>
              <Button className={sheetPrimary} disabled={busy} onClick={createPlan} data-testid="save-membership">
                {busy ? tr("common.saving") : tr("passes.create")}
              </Button>
            </>
          }
        >
          <Field label={tr("passes.name")} htmlFor="pl-name"><input id="pl-name" className={fieldCls} value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} /></Field>
          <Field label={tr("passes.description")} htmlFor="pl-desc"><input id="pl-desc" className={fieldCls} value={plan.description} onChange={(e) => setPlan({ ...plan, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("passes.price")} htmlFor="pl-price"><input id="pl-price" inputMode="decimal" className={fieldCls} value={plan.price} onChange={(e) => setPlan({ ...plan, price: e.target.value })} /></Field>
            <Field label={tr("passes.periodMonths")} htmlFor="pl-period"><input id="pl-period" inputMode="numeric" className={fieldCls} value={plan.period} onChange={(e) => setPlan({ ...plan, period: e.target.value })} /></Field>
            <Field label={tr("passes.discountPercent")} htmlFor="pl-disc"><input id="pl-disc" inputMode="numeric" className={fieldCls} value={plan.discount} onChange={(e) => setPlan({ ...plan, discount: e.target.value })} /></Field>
            <Field label={tr("passes.includedSessions")} htmlFor="pl-sess"><input id="pl-sess" inputMode="numeric" className={fieldCls} value={plan.sessions} onChange={(e) => setPlan({ ...plan, sessions: e.target.value })} /></Field>
          </div>
          <Field label={tr("passes.coversService")} htmlFor="pl-svc">{select(plan.serviceId, (v) => setPlan({ ...plan, serviceId: v }), "pl-svc")}</Field>
        </FormSheet>

        <FormSheet
          open={packOpen}
          onOpenChange={setPackOpen}
          title={tr("passes.newPackage")}
          description={tr("passes.packageHelp")}
          footer={
            <>
              <Button variant="outline" className={sheetSecondary} onClick={() => setPackOpen(false)}>{tr("common.cancel")}</Button>
              <Button className={sheetPrimary} disabled={busy} onClick={createPack} data-testid="save-package">
                {busy ? tr("common.saving") : tr("passes.create")}
              </Button>
            </>
          }
        >
          <Field label={tr("passes.name")} htmlFor="pk-name"><input id="pk-name" className={fieldCls} value={pack.name} onChange={(e) => setPack({ ...pack, name: e.target.value })} /></Field>
          <Field label={tr("passes.description")} htmlFor="pk-desc"><input id="pk-desc" className={fieldCls} value={pack.description} onChange={(e) => setPack({ ...pack, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("passes.price")} htmlFor="pk-price"><input id="pk-price" inputMode="decimal" className={fieldCls} value={pack.price} onChange={(e) => setPack({ ...pack, price: e.target.value })} /></Field>
            <Field label={tr("passes.sessionsTotal")} htmlFor="pk-sess"><input id="pk-sess" inputMode="numeric" className={fieldCls} value={pack.sessions} onChange={(e) => setPack({ ...pack, sessions: e.target.value })} /></Field>
            <Field label={tr("passes.validForDays")} htmlFor="pk-days" hint={tr("passes.validHint")}><input id="pk-days" inputMode="numeric" className={fieldCls} value={pack.validDays} onChange={(e) => setPack({ ...pack, validDays: e.target.value })} /></Field>
          </div>
          <Field label={tr("passes.coversService")} htmlFor="pk-svc">{select(pack.serviceId, (v) => setPack({ ...pack, serviceId: v }), "pk-svc")}</Field>
        </FormSheet>
      </BooqiScope>
    </AppLayout>
  );
}

const cn2 = (...c: string[]) => c.join(" ");
